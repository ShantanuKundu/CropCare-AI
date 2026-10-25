/**
 * useVoiceAssistant.js — Fast, Reliable Browser Voice Assistant
 *
 * Uses native Web Speech API (window.SpeechRecognition || window.webkitSpeechRecognition)
 * for instant zero-latency speech-to-text supporting 11 Indian languages.
 * Uses Web Speech Synthesis (window.speechSynthesis) for spoken feedback.
 *
 * Resolves spoken commands to application routes (e.g., "disease detection",
 * "tomato disease", "mandi prices", "fertilizer recommendation").
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { resolveIntent } from '../utils/voiceCommands';

const LANG_TO_BCP47 = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  te: 'te-IN',
  or: 'or-IN',
  ta: 'ta-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
};

// Check if browser supports Web Speech API
const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export function useVoiceAssistant() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef(null);
  const languageRef = useRef(language);
  const navigateRef = useRef(navigate);
  const tRef = useRef(t);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // ── Text-to-Speech (TTS) ──────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      const bcp47 = LANG_TO_BCP47[languageRef.current] ?? 'en-IN';
      utt.lang = bcp47;
      utt.rate = 0.95;
      utt.pitch = 1.0;

      utt.onstart = () => setIsSpeaking(true);
      utt.onend = () => setIsSpeaking(false);
      utt.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utt);
    } catch (err) {
      console.warn('[Voice TTS] speech error:', err);
      setIsSpeaking(false);
    }
  }, []);

  // ── Process Transcribed Intent ────────────────────────────────────────────
  const handleTranscript = useCallback(
    (text) => {
      if (!text || !text.trim()) return;
      const cleanText = text.trim();
      console.log('[Voice] 📝 Heard:', JSON.stringify(cleanText));
      setTranscript(cleanText);

      const intent = resolveIntent(cleanText, languageRef.current);
      console.log('[Voice] 🧠 Intent resolved:', intent);

      if (intent?.type === 'navigate') {
        const confirmPrefix = tRef.current('voiceNavigatingTo') || 'Opening';
        speak(`${confirmPrefix} ${intent.label}`);
        setTimeout(() => {
          navigateRef.current(intent.route);
        }, 350);
      } else if (intent?.type === 'form-fill') {
        window.dispatchEvent(
          new CustomEvent('voice-fill', {
            detail: { field: intent.field, value: intent.value, raw: cleanText },
          })
        );
        speak(`${tRef.current('voiceFieldFilled') || 'Filled'}: ${intent.value}`);
      } else {
        const notUnderstood =
          tRef.current('voiceNotUnderstood') ||
          "Sorry, I didn't catch that. Please try saying 'Disease Detection' or 'Mandi'.";
        speak(notUnderstood);
      }
    },
    [speak]
  );

  // ── Start Listening ───────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (isListening) return;

    setTranscript('');
    setVoiceError(null);
    finalTranscriptRef.current = '';

    if (!SpeechRecognition) {
      console.warn('[Voice] Web Speech API not supported in this browser.');
      setVoiceError('unsupported');
      setTimeout(() => setVoiceError(null), 6000);
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = LANG_TO_BCP47[languageRef.current] ?? 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setIsProcessing(false);
        console.log('[Voice] 🔴 Listening started in language:', recognition.lang);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += piece;
          } else {
            interim += piece;
          }
        }

        const spokenNow = (final || interim).trim();
        if (spokenNow) {
          setTranscript(spokenNow);
        }
        if (final) {
          finalTranscriptRef.current = final;
        }
      };

      recognition.onerror = (event) => {
        console.warn('[Voice] recognition error:', event.error);
        if (event.error === 'no-speech') {
          setVoiceError('no-speech');
        } else if (event.error === 'not-allowed') {
          setVoiceError('not-allowed');
        } else if (event.error === 'audio-capture') {
          setVoiceError('audio-capture');
        } else if (event.error === 'network') {
          setVoiceError('network');
        } else {
          setVoiceError('unknown');
        }
        setIsListening(false);
        setTimeout(() => setVoiceError(null), 5000);
      };

      recognition.onend = () => {
        setIsListening(false);
        const textToProcess = finalTranscriptRef.current || transcript;
        if (textToProcess) {
          handleTranscript(textToProcess);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[Voice] Failed to start recognition:', err);
      setVoiceError('unknown');
      setIsListening(false);
      setTimeout(() => setVoiceError(null), 5000);
    }
  }, [isListening, transcript, handleTranscript]);

  // ── Stop Listening ────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
  }, [isListening]);

  return {
    startListening,
    stopListening,
    speak,
    handleTranscript,
    isListening,
    isSpeaking,
    isProcessing,
    transcript,
    voiceError,
    modelReady: true,
    modelLoadProgress: 100,
    isInitializing: false,
    isSupported: !!SpeechRecognition,
  };
}
