/**
 * VoiceAssistant.jsx — Floating Voice Assistant UI Component
 *
 * A globally persistent floating mic button (bottom-right corner) that:
 *  - Native Speech-to-Text via Web Speech API
 *  - Natural speech feedback (TTS)
 *  - Pulses vibrant emerald/red when listening
 *  - Shows soundwave animation when speaking
 *  - Displays live transcript bubble with what it heard
 *  - Interactive help popup with one-click testable sample commands
 */

import { useState, useCallback } from 'react';
import { useVoiceAssistant } from '../../hooks/useVoiceAssistant';
import { useLanguage } from '../../context/LanguageContext';
import './VoiceAssistant.css';

// ── Soundwave bars (TTS indicator) ────────────────────────────────────────────
const SoundwaveIcon = () => (
  <span className="va-soundwave" aria-hidden="true">
    {[1, 2, 3, 4, 5].map((i) => (
      <span key={i} className={`va-bar va-bar-${i}`} />
    ))}
  </span>
);

// ── Mic SVG icon ──────────────────────────────────────────────────────────────
const MicIcon = ({ muted = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="va-mic-svg"
    aria-hidden="true"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
    {muted && <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2.5} />}
  </svg>
);

// ── Sample command items (text to say + command to test) ──────────────────────
const SAMPLE_COMMANDS = {
  en: [
    { label: 'Say "Disease Detection"', cmd: 'disease detection' },
    { label: 'Say "Tomato disease"', cmd: 'tomato disease' },
    { label: 'Say "Potato disease"', cmd: 'potato disease' },
    { label: 'Say "Mandi prices"', cmd: 'mandi prices' },
    { label: 'Say "Fertilizer"', cmd: 'fertilizer recommendation' },
    { label: 'Say "Crop calendar"', cmd: 'crop calendar' },
  ],
  hi: [
    { label: 'बोलें "रोग पहचान"', cmd: 'रोग पहचान' },
    { label: 'बोलें "टमाटर की बीमारी"', cmd: 'टमाटर की बीमारी' },
    { label: 'बोलें "आलू की बीमारी"', cmd: 'आलू की बीमारी' },
    { label: 'बोलें "मंडी भाव"', cmd: 'मंडी भाव' },
    { label: 'बोलें "खाद की सलाह"', cmd: 'खाद की सलाह' },
    { label: 'बोलें "फसल कैलेंडर"', cmd: 'फसल कैलेंडर' },
  ],
  bn: [
    { label: 'বলুন "রোগ শনাক্ত"', cmd: 'রোগ' },
    { label: 'বলুন "মান্ডি মূল্য"', cmd: 'মান্ডি' },
    { label: 'বলুন "সার সুপারিশ"', cmd: 'সার' },
  ],
  mr: [
    { label: 'बोला "रोग ओळख"', cmd: 'रोग' },
    { label: 'बोला "मंडी भाव"', cmd: 'मंडी' },
    { label: 'बोला "खत शिफारस"', cmd: 'खत' },
  ],
  te: [
    { label: 'చెప్పండి "వ్యాధి గుర్తింపు"', cmd: 'వ్యాధి' },
    { label: 'చెప్పండి "మండి ధరలు"', cmd: 'మండి' },
  ],
  or: [
    { label: 'କୁହନ୍ତୁ "ରୋଗ ଚିହ୍ନଟ"', cmd: 'ରୋଗ' },
    { label: 'କୁହନ୍ତୁ "ମଣ୍ଡି ମୂଲ୍ୟ"', cmd: 'ମଣ୍ଡି' },
  ],
  ta: [
    { label: 'சொல்லுங்கள் "நோய் கண்டறிதல்"', cmd: 'நோய்' },
    { label: 'சொல்லுங்கள் "மண்டி விலை"', cmd: 'மண்டி' },
  ],
  gu: [
    { label: 'બોલો "રોગ ઓળખ"', cmd: 'રોગ' },
    { label: 'બોલો "મંડી ભાવ"', cmd: 'મંડી' },
  ],
  kn: [
    { label: 'ಹೇಳಿ "ರೋಗ ಪತ್ತೆ"', cmd: 'ರೋಗ' },
    { label: 'ಹೇಳಿ "ಮಂಡಿ ಬೆಲೆ"', cmd: 'ಮಂಡಿ' },
  ],
  ml: [
    { label: 'പറയൂ "രോഗ നിർണ്ണയം"', cmd: 'രോഗം' },
    { label: 'പറയൂ "മണ്ടി വില"', cmd: 'മണ്ടി' },
  ],
  pa: [
    { label: 'ਬੋਲੋ "ਰੋਗ ਪਛਾਣ"', cmd: 'ਬਿਮਾਰੀ' },
    { label: 'ਬੋਲੋ "ਮੰਡੀ ਭਾਅ"', cmd: 'ਮੰਡੀ' },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function VoiceAssistant() {
  const { language, t } = useLanguage();
  const {
    startListening,
    stopListening,
    handleTranscript,
    isListening,
    isSpeaking,
    transcript,
    isSupported,
    voiceError,
  } = useVoiceAssistant();

  const [showHelp, setShowHelp] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // If browser completely lacks speech recognition, show gracefully
  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      setShowTranscript(true);
      startListening();
      setTimeout(() => setShowTranscript(false), 9000);
    }
  }, [isListening, startListening, stopListening]);

  const handleSampleClick = (cmd) => {
    setShowTranscript(true);
    setShowHelp(false);
    handleTranscript(cmd);
    setTimeout(() => setShowTranscript(false), 8000);
  };

  // ── Error message map ─────────────────────────────────────────────────────
  const ERROR_MESSAGES = {
    'not-allowed': '🔴 Mic blocked! Click 🔒 in address bar → Allow microphone.',
    'audio-capture': '🎙️ No microphone detected. Connect a mic and try again.',
    'no-speech': '🔇 No speech heard. Speak clearly after clicking the mic.',
    'network': '🌐 Network issue with speech service. Check your connection.',
    'unsupported': '🚫 Speech recognition works best on Chrome, Edge & Android Chrome.',
    unknown: '❓ Voice error. Please try again.',
  };

  const sampleCmds = SAMPLE_COMMANDS[language] ?? SAMPLE_COMMANDS['en'];

  return (
    <div className="va-root" role="region" aria-label="Voice Assistant">
      {/* ── Transcript bubble ── */}
      {(showTranscript || isListening) && transcript && (
        <div className="va-transcript-bubble" role="status" aria-live="polite">
          <span className="va-transcript-quote">🎙️</span>
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
          <span className="va-listening-dot" />
          {t('voiceListening') || 'Listening...'}
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
          <div className="va-help-header">
            <span className="va-help-icon">💡</span>
            <p className="va-help-title">{t('voiceHelp') || 'Voice Commands'}</p>
            <button
              className="va-help-close"
              onClick={() => setShowHelp(false)}
              aria-label="Close help"
            >
              ✕
            </button>
          </div>
          <p className="va-help-sub">Speak or tap any example below to try:</p>
          <ul className="va-help-list">
            {sampleCmds.map((item, i) => (
              <li
                key={i}
                className="va-sample-item"
                onClick={() => handleSampleClick(item.cmd)}
                title={`Try: ${item.cmd}`}
              >
                <span>{item.label}</span>
                <span className="va-sample-arrow">→</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── FAB button group ── */}
      <div className="va-fab-group">
        {/* Help button */}
        <button
          id="va-help-btn"
          className="va-help-btn"
          onClick={() => setShowHelp((v) => !v)}
          aria-label="Voice assistant help"
          title="Voice commands & examples"
        >
          ?
        </button>

        {/* Main mic button */}
        <button
          id="va-mic-btn"
          className={[
            'va-mic-btn',
            isListening ? 'va-listening' : '',
            isSpeaking ? 'va-speaking' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleMicClick}
          aria-label={isListening ? t('voiceListening') : t('voiceTapToSpeak')}
          title={isListening ? 'Listening (tap to stop)' : t('voiceTapToSpeak')}
          disabled={isSpeaking}
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