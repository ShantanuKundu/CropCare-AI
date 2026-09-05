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

  useEffect(() => { languageRef.current = language; }, [language]);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => { tRef.current = t; }, [t]);

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
      setTimeout(() => navigateRef.current(intent.route), 600);
    } else if (intent?.type === 'form-fill') {
      window.dispatchEvent(new CustomEvent('voice-fill', {
        detail: { field: intent.field, value: intent.value, raw: text }
      }));
      speak(tRef.current('voiceFieldFilled') + ': ' + intent.value);
    } else {
      speak(tRef.current('voiceNotUnderstood'));
    }
  }, [speak]);

  // ── Send audio to backend for transcription ─────────────────────────────────
  const transcribeOnBackend = useCallback(async (audioBlob, bcp47) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('language', bcp47);

      const res = await fetch(`${API_BASE}/api/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      console.log('[Voice] 📡 Backend response:', data);

      if (data.text) {
        handleTranscript(data.text);
      } else if (data.error === 'no-speech') {
        setVoiceError('no-speech');
        setTimeout(() => setVoiceError(null), 4000);
      } else if (data.error === 'network') {
        setVoiceError('network');
        setTimeout(() => setVoiceError(null), 5000);
      } else {
        setVoiceError('unknown');
        setTimeout(() => setVoiceError(null), 4000);
      }
    } catch (err) {
      console.error('[Voice] Backend transcription error:', err.message);
      setVoiceError('backend-error');
      setTimeout(() => setVoiceError(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  }, [handleTranscript]);

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
          echoCancellation: false,   // raw audio — bypass Windows enhancements
          noiseSuppression: false,
          autoGainControl:  false,
          sampleRate:       16000,
        }
      });
    } catch (err) {
      console.error('[Voice] getUserMedia failed:', err.name);
      setVoiceError(err.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture');
      setTimeout(() => setVoiceError(null), 6000);
      return;
    }

    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    audioChunksRef.current   = [];

    mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('[Voice] 🎙️ Recording stopped. Blob size:', blob.size, 'bytes');
      transcribeOnBackend(blob, bcp47);
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
  }, [isListening, isProcessing, transcribeOnBackend]);

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
