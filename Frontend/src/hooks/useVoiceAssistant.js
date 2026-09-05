/**
 * useVoiceAssistant.js
 *
 * Records audio with MediaRecorder (getUserMedia) → sends to FastAPI /api/transcribe
 * → Python SpeechRecognition transcribes it → intent matching → navigation.
 *
 * This bypasses Chrome's Web Speech API entirely, which was failing due to
 * Windows audio enhancements suppressing the mic signal before Chrome sees it.
 * MediaRecorder gets the raw audio directly from the device.
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { resolveIntent } from '../utils/voiceCommands';
import { useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const LANG_TO_BCP47 = {
  en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', mr: 'mr-IN',
  te: 'te-IN', or: 'or-IN', ta: 'ta-IN', gu: 'gu-IN',
  kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN',
};

export function useVoiceAssistant() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [isListening,  setIsListening]  = useState(false);
  const [isSpeaking,   setIsSpeaking]   = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const [voiceError,   setVoiceError]   = useState(null);
  const [isProcessing, setIsProcessing] = useState(false); // true while backend transcribes

  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const languageRef      = useRef(language);
  const navigateRef      = useRef(navigate);
  const tRef             = useRef(t);
  const workerRef = useRef(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => { tRef.current = t; }, [t]);
  useEffect(() => {
  workerRef.current = new Worker(
    new URL('../workers/stt.worker.js', import.meta.url),
    { type: 'module' }
  );

  workerRef.current.postMessage({ type: 'load' });

  workerRef.current.onmessage = (e) => {
  console.log('[Whisper]', e.data);

  const { type, text, progress } = e.data;

  if (type === 'ready') {
    setModelReady(true);
  }

  if (type === 'loading') {
    setModelLoadProgress(progress || 0);
  }

  if (type === 'result') {
    handleTranscript(text);
  }

  if (type === 'error') {
    console.error('[Whisper Error]', e.data.message);
  }
};

  return () => workerRef.current?.terminate();
}, []);

  // ── TTS ─────────────────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt   = new SpeechSynthesisUtterance(text);
    utt.lang    = LANG_TO_BCP47[languageRef.current] ?? 'en-IN';
    utt.rate    = 0.9;
    utt.pitch   = 1;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend   = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, []);

  // ── Intent resolver ─────────────────────────────────────────────────────────
  const handleTranscript = useCallback((text) => {
    if (!text) return;
    console.log('[Voice] 📝 Heard:', JSON.stringify(text));
    setTranscript(text);

    const intent = resolveIntent(text, languageRef.current);
    console.log('[Voice] 🧠 Intent:', intent);

    if (intent?.type === 'navigate') {
      speak(tRef.current('voiceNavigatingTo') + ' ' + intent.label);
      setTimeout(() => navigateRef.current(intent.route), 300);
    } else if (intent?.type === 'form-fill') {
      window.dispatchEvent(new CustomEvent('voice-fill', {
        detail: { field: intent.field, value: intent.value, raw: text }
      }));
      speak(tRef.current('voiceFieldFilled') + ': ' + intent.value);
    } else {
      speak(tRef.current('voiceNotUnderstood'));
    }
  }, [speak]);

 

  // ── Start recording ─────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (isListening || isProcessing) return;

    setTranscript('');
    setVoiceError(null);

    const bcp47 = LANG_TO_BCP47[languageRef.current] ?? 'en-IN';

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: {
            exact: '61a30323444520e77d0c2f2413dc89355b007c57b5afa63f3b71b4d206a7489b'
            },
          echoCancellation: true,   // raw audio — bypass Windows enhancements
          noiseSuppression: true,
          autoGainControl:  true,
          sampleRate:       16000,
        }
      });

      console.log(
    '[MIC]',
    stream.getAudioTracks()[0].label
  );
    } 
    catch (err) {
      console.error('[Voice] getUserMedia failed:', err.name);
      setVoiceError(err.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture');
      setTimeout(() => setVoiceError(null), 6000);
      return;
    }

    const mr = new MediaRecorder(stream);
    console.log('[MIC SETTINGS]', stream.getAudioTracks()[0].getSettings());  
    mediaRecorderRef.current = mr;
    audioChunksRef.current   = [];

    mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('[Voice] 🎙️ Recording stopped. Blob size:', blob.size, 'bytes');
      (async () => {
        const arrayBuffer = await blob.arrayBuffer();

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
       
      const source = audioBuffer.getChannelData(0);  
      
      let peak = 0;

      for (let i = 0; i < source.length; i++) {
        const v = Math.abs(source[i]);
        if (v > peak) peak = v;
      }

      console.log('[SOURCE PEAK]', peak);
      
      const targetRate = 16000;
      const ratio = audioBuffer.sampleRate / targetRate;
      const newLength = Math.round(audioBuffer.length / ratio);

      const audio = new Float32Array(newLength);

      for (let i = 0; i < newLength; i++) {
        audio[i] = source[Math.floor(i * ratio)];
      }

          let audioPeak = 0;

          for (let i = 0; i < audio.length; i++) {
            const v = Math.abs(audio[i]);
            if (v > audioPeak) audioPeak = v;
          }

          console.log(
            '[Audio Stats]',
            'peak=', audioPeak,
            'len=', audio.length
          );

        

        console.log('[RESAMPLED LEN]', audio.length);
        workerRef.current.postMessage({
          type: 'transcribe',
          audio,
          language: bcp47,
        });
      })(); 
      setIsListening(false);
    };

    mr.start();
    setIsListening(true);
    console.log('[Voice] 🔴 Recording started...');

    // Auto-stop after 6 seconds
    setTimeout(() => {
      if (mr.state === 'recording') {
        console.log('[Voice] ⏱️ Auto-stopping after 6s');
        mr.stop();
      }
    }, 6000);
  }, [isListening, isProcessing]);

  // ── Stop recording early ────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  return {
    startListening,
    stopListening,
    speak,
    isListening,
    isSpeaking,
    isProcessing,  // true while backend is transcribing
    transcript,
    voiceError,
    // Kept so VoiceAssistant.jsx doesn't break
    modelReady:        true,
    modelLoadProgress: 0,
    isInitializing:    false,
    isSupported:       !!navigator.mediaDevices?.getUserMedia,
  };
}
