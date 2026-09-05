/**
 * VoiceAssistant.jsx — Floating Voice Assistant UI Component
 *
 * A globally persistent floating mic button (bottom-right corner) that:
 *  - Shows model download progress on first load
 *  - Pulses red when listening
 *  - Shows soundwave animation when speaking (TTS)
 *  - Displays a transcript bubble with what it heard
 *  - Gracefully hides on unsupported browsers
 */

import { useState, useCallback } from 'react';
import { useVoiceAssistant } from '../../hooks/useVoiceAssistant';
import { useLanguage } from '../../context/LanguageContext';
import './VoiceAssistant.css';

// ── Soundwave bars (TTS indicator) ────────────────────────────────────────────
const SoundwaveIcon = () => (
  <span className="va-soundwave" aria-hidden="true">
    {[1,2,3,4,5].map(i => <span key={i} className={`va-bar va-bar-${i}`} />)}
  </span>
);

// ── Mic SVG icon ──────────────────────────────────────────────────────────────
const MicIcon = ({ muted = false }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className="va-mic-svg" aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8"  y1="23" x2="16" y2="23" />
    {muted && <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2.5} />}
  </svg>
);

// ── Help tooltip content ──────────────────────────────────────────────────────
const SAMPLE_COMMANDS = {
  en: ['Say "disease" to open Disease Detection', 'Say "mandi" for Market Prices', 'Say "fertilizer" for recommendations'],
  hi: ['"बीमारी" बोलें — रोग पहचान', '"मंडी" बोलें — बाजार भाव', '"खाद" बोलें — उर्वरक सुझाव'],
  bn: ['"রোগ" বলুন — রোগ শনাক্ত', '"মান্ডি" বলুন — বাজার মূল্য'],
  mr: ['"रोग" बोला — रोग ओळख', '"मंडी" बोला — बाजार भाव'],
  te: ['"వ్యాధి" చెప్పండి — వ్యాధి గుర్తింపు', '"మండి" చెప్పండి — ధరలు'],
  or: ['"ରୋଗ" କୁହ — ରୋଗ ଚିହ୍ନଟ', '"ମଣ୍ଡି" କୁହ — ମୂଲ୍ୟ'],
  ta: ['"நோய்" சொல்லுங்கள் — நோய் கண்டறிதல்', '"மண்டி" சொல்லுங்கள் — விலை'],
  gu: ['"રોગ" બોલો — રોગ ઓળખ', '"મંડી" બોલો — ભાવ'],
  kn: ['"ರೋಗ" ಹೇಳಿ — ರೋಗ ಪತ್ತೆ', '"ಮಂಡಿ" ಹೇಳಿ — ಬೆಲೆ'],
  ml: ['"രോഗം" പറയൂ — രോഗ നിർണ്ണയം', '"മണ്ടി" പറയൂ — വില'],
  pa: ['"ਬਿਮਾਰੀ" ਬੋਲੋ — ਰੋਗ ਪਛਾਣ', '"ਮੰਡੀ" ਬੋਲੋ — ਭਾਅ'],
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function VoiceAssistant() {
  const { language, t } = useLanguage();
  const {
    startListening, stopListening, isListening, isSpeaking,
    transcript, modelReady, modelLoadProgress, isSupported,
    voiceError, isInitializing, isProcessing,
  } = useVoiceAssistant();

  const [showHelp,       setShowHelp]       = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Don't render on unsupported browsers
  if (!isSupported) return null;

  const handleMicClick = useCallback(() => {
    if (isProcessing) return; // wait for backend
    if (isListening) {
      stopListening();
    } else {
      setShowTranscript(true);
      startListening();
      setTimeout(() => setShowTranscript(false), 8000);
    }
  }, [isListening, isProcessing, startListening, stopListening]);

  // ── Error message map ─────────────────────────────────────────────────────
  const ERROR_MESSAGES = {
    'not-allowed':   '🔴 Mic blocked! Click 🔒 in the address bar → Allow mic → Refresh.',
    'audio-capture': '🎙️ No microphone found. Connect a mic and try again.',
    'no-speech':     '🔇 Could not understand. Speak clearly after the mic turns red.',
    'network':       '🌐 Server needs internet for voice. Check your WiFi.',
    'backend-error': '⚠️ Voice server error. Make sure the backend is running.',
    'unsupported':   '🚫 Your browser does not support audio recording.',
    'unknown':       '❓ Voice error. Try again.',
  };

  const sampleCmds = SAMPLE_COMMANDS[language] ?? SAMPLE_COMMANDS['en'];

  return (
    <div className="va-root" role="region" aria-label="Voice Assistant">

      {/* ── Model loading bar — purely informational, does NOT block the mic ── */}
      {!modelReady && modelLoadProgress > 0 && (
        <div className="va-model-bar" role="status" aria-live="polite">
          <span className="va-model-label">
            {isInitializing ? '⚡ AI model finalizing...' : `🔄 ${t('voiceModelLoading')} ${modelLoadProgress}%`}
          </span>
          <div className="va-progress-track">
            <div
              className={`va-progress-fill${isInitializing ? ' va-progress-pulse' : ''}`}
              style={{ width: isInitializing ? '100%' : `${modelLoadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Model ready toast (fires once) ── */}
      {modelReady && modelLoadProgress > 0 && modelLoadProgress < 101 && (
        <div className="va-toast va-toast-ready" role="status">
          ✅ {t('voiceOfflineReady')}
        </div>
      )}

      {/* ── Transcript bubble ── */}
      {showTranscript && transcript && (
        <div className="va-transcript-bubble" role="status" aria-live="polite">
          <span className="va-transcript-text">"{transcript}"</span>
        </div>
      )}

      {/* ── Error toast ── */}
      {voiceError && (
        <div className="va-toast va-toast-error" role="alert" aria-live="assertive">
          {ERROR_MESSAGES[voiceError] ?? ERROR_MESSAGES['unknown']}
        </div>
      )}

      {/* ── Listening label ── */}
      {isListening && (
        <div className="va-status-label va-listening-label" aria-live="polite">
          {t('voiceListening')}
        </div>
      )}

      {/* ── Speaking label ── */}
      {isSpeaking && (
        <div className="va-status-label va-speaking-label" aria-live="polite">
          <SoundwaveIcon />
        </div>
      )}

      {/* ── Help tooltip ── */}
      {showHelp && (
        <div className="va-help-tooltip" role="tooltip">
          <p className="va-help-title">{t('voiceHelp')}</p>
          <ul className="va-help-list">
            {sampleCmds.map((cmd, i) => <li key={i}>{cmd}</li>)}
          </ul>
          <button
            className="va-help-close"
            onClick={() => setShowHelp(false)}
            aria-label="Close help"
          >✕</button>
        </div>
      )}

      {/* ── FAB button group ── */}
      <div className="va-fab-group">
        {/* Help button */}
        <button
          id="va-help-btn"
          className="va-help-btn"
          onClick={() => setShowHelp(v => !v)}
          aria-label="Voice assistant help"
          title="Voice commands help"
        >?</button>

        {/* Main mic button */}
        <button
          id="va-mic-btn"
          className={[
            'va-mic-btn',
            isListening  ? 'va-listening'  : '',
            isSpeaking   ? 'va-speaking'   : '',
            isProcessing ? 'va-loading'    : '',
          ].filter(Boolean).join(' ')}
          onClick={handleMicClick}
          aria-label={isListening ? t('voiceListening') : isProcessing ? 'Processing...' : t('voiceTapToSpeak')}
          title={isListening ? 'Tap to stop' : isProcessing ? 'Processing voice...' : t('voiceTapToSpeak')}
          disabled={isSpeaking || isProcessing}
        >
          {/* Pulse rings shown when listening */}
          {isListening && (
            <>
              <span className="va-ring va-ring-1" aria-hidden="true" />
              <span className="va-ring va-ring-2" aria-hidden="true" />
            </>
          )}

          {isSpeaking ? <SoundwaveIcon /> : <MicIcon />}
        </button>
      </div>
    </div>
  );
}
