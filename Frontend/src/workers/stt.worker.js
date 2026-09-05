/**
 * stt.worker.js — Speech-to-Text Web Worker
 *
 * Tries to load Whisper-tiny via @huggingface/transformers.
 * Has a 30-second timeout — if WASM takes too long to initialize,
 * sends { type: 'timeout' } so the hook can fall back to Web Speech API.
 *
 * Communication protocol (all via postMessage):
 *
 *  INCOMING (main → worker)
 *    { type: 'load' }                        — start loading model
 *    { type: 'transcribe', audio, language } — Float32Array PCM + BCP-47 lang
 *
 *  OUTGOING (worker → main)
 *    { type: 'loading', progress }           — 0-100 during model download
 *    { type: 'ready' }                       — model ready
 *    { type: 'result',  text }               — transcription done
 *    { type: 'timeout' }                     — WASM init took too long
 *    { type: 'error',   message }            — something went wrong
 */

import { pipeline, env } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/whisper-tiny';

env.allowLocalModels = false;
env.useBrowserCache  = true;

let transcriber = null;
let loading     = false;

function onProgress(event) {
  if (event.status === 'downloading' || event.status === 'progress') {
    const pct = event.progress != null ? Math.round(event.progress) : 0;
    self.postMessage({ type: 'loading', progress: pct });
  } else if (event.status === 'done') {
    self.postMessage({ type: 'loading', progress: 100, status: 'initializing' });
  }
}

async function loadModel() {
  if (transcriber || loading) return;
  loading = true;

  self.postMessage({ type: 'loading', progress: 0 });

  // 30-second timeout for WASM init (it can hang indefinitely)
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    console.warn('[STTWorker] ⏰ Model init timed out after 30s');
    self.postMessage({ type: 'timeout' });
    loading = false;
  }, 30000);

  try {
    transcriber = await pipeline(
      'automatic-speech-recognition',
      MODEL_ID,
      {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: onProgress,
      }
    );

    clearTimeout(timeout);
    if (!timedOut) {
      self.postMessage({ type: 'ready' });
      console.log('[STTWorker] ✅ Whisper ready');
    }
  } catch (err) {
    clearTimeout(timeout);
    if (!timedOut) {
      console.error('[STTWorker] ❌ Load failed:', err.message);
      self.postMessage({ type: 'error', message: err.message });
    }
  } finally {
    loading = false;
  }
}

async function transcribe(audioFloat32, language) {
  if (!transcriber) {
    self.postMessage({ type: 'error', message: 'Model not loaded.' });
    return;
  }
  try {
    const whisperLang = language ? language.split('-')[0] : 'en';
    const output = await transcriber(audioFloat32, {
      language: whisperLang,
      task: 'transcribe',
      return_timestamps: false,
    });
    const text = (output?.text || '').trim();
    self.postMessage({ type: 'result', text });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
}

self.addEventListener('message', async (event) => {
  const { type, audio, language } = event.data;
  switch (type) {
    case 'load':      await loadModel();            break;
    case 'transcribe': await transcribe(audio, language); break;
    default: self.postMessage({ type: 'error', message: `Unknown: ${type}` });
  }
});
