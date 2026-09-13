// Development-only generation of fixed, authored speech. The public application
// loads MP3s, not this script, its npm dependencies, or the neural model.
// Install tools separately (use npm.cmd instead of npm in Windows PowerShell):
// npm install --prefix tmp/quest-voice-build --no-save --package-lock=false kokoro-js@1.2.1 lamejs@1.2.1
// Run from this checkout: node scripts/generate-story-audio.mjs [--sample] [--force] [--offline]
// Kokoro weights/code: Apache-2.0, https://github.com/hexgrad/kokoro
// MP3 encoder: lamejs 1.2.1, LGPL-3.0, used only during generation.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { KokoroTTS } from '../tmp/quest-voice-build/node_modules/kokoro-js/dist/kokoro.js';
import { env, StyleTextToSpeech2Model, AutoTokenizer } from '../tmp/quest-voice-build/node_modules/@huggingface/transformers/dist/transformers.node.mjs';
import { MISSIONS, SORT_ITEMS } from '../quest/content.js';
import { planFeedback } from '../quest/feedback.js';
import { STORY_LINES, normalizeStoryText } from '../quest/story-audio.js';
import { REWARD_LINES } from '../quest/reward-voice.js';

// Resolve all writes within this checkout. The ignored cache is never published.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'quest', 'audio');
env.cacheDir = path.join(root, 'tmp', 'quest-voice-build', 'model-cache');
// Once the model is cached, --offline proves regeneration makes no model or
// tokenizer download. Missing cached files fail clearly instead of going online.
if (process.argv.includes('--offline')) env.allowRemoteModels = false;
await fs.mkdir(output, { recursive: true });
const manifestPath = path.join(output, 'story-manifest.js');
const existing = (await import(new URL('../quest/audio/story-manifest.js', import.meta.url))).STORY_RECORDINGS;
const existingById = new Map(existing.map(recording => [recording.id, recording]));

// One natural narrator keeps the story consistent. Deliberate punctuation gives
// pauses and questions room; we do not simulate emotions by distorting pitch.
const entries = new Map();
function add(text, role = 'story') {
  if (!text?.trim()) return;
  const normalized = normalizeStoryText(text);
  const id = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  if (!entries.has(id)) entries.set(id, { id, text: text.trim(), role });
}
Object.values(STORY_LINES).forEach(text => add(text, 'invitation'));
Object.values(REWARD_LINES).flat().forEach(text => add(text, 'cheer'));
for (const mission of MISSIONS) {
  add(`${mission.fictionalContext} ${mission.guideLines.intro}`, 'intro');
  Object.values(mission.guideLines).forEach(text => add(text, 'dialogue'));
  mission.clues.forEach(clue => add(clue.text, 'fact'));
  add(mission.reflection.prompt, 'question');
  add(mission.reflection.explanation, 'fact');
  add(mission.outcome.text, 'ending');
  add(mission.helpText, 'hint');
  mission.allowedActions.forEach(action => add(action.feedback, 'feedback'));
  // The two-item story explains each selected item separately. Record all its
  // complete wrong-plan combinations so mixed feedback keeps the same narrator.
  // Future larger stories stay dynamic rather than creating an unbounded bank.
  if (mission.slots.length === 2) {
    for (const first of mission.allowedActions) for (const second of mission.allowedActions) {
      const result = planFeedback(mission, { [mission.slots[0].id]: first.id, [mission.slots[1].id]: second.id });
      if (!result.correct) add(`${result.summary} ${result.slots.map(row => `${row.label}. ${row.message}`).join(' ')}`, 'feedback');
    }
  }
}
for (const item of SORT_ITEMS) {
  add(item.condition, 'fact');
  add(item.clue, 'hint');
  add(item.explanation, 'feedback');
}

// The bundled browser build avoids lamejs's broken Node module references. It is
// a pinned local dependency, evaluated in an isolated context during generation.
const encoderContext = vm.createContext({});
vm.runInContext(await fs.readFile(path.join(root, 'tmp/quest-voice-build/node_modules/lamejs/lame.all.js'), 'utf8'), encoderContext);
const { Mp3Encoder } = encoderContext.lamejs;
function encodeMp3(audio) {
  const encoder = new Mp3Encoder(1, audio.sampling_rate, 64);
  const pcm = new Int16Array(audio.audio.length);
  for (let index = 0; index < pcm.length; index += 1) pcm[index] = Math.round(Math.max(-1, Math.min(1, audio.audio[index])) * 32767);
  const chunks = [];
  for (let index = 0; index < pcm.length; index += 1152) chunks.push(Buffer.from(encoder.encodeBuffer(pcm.subarray(index, index + 1152))));
  chunks.push(Buffer.from(encoder.flush()));
  return Buffer.concat(chunks);
}

const sample = process.argv.includes('--sample');
// Use --force after changing the voice/model settings; ordinary reruns resume
// already-generated words without spending CPU time on identical recordings.
const force = process.argv.includes('--force');
// Generate the most visible content first so a developer can review every story
// opening while later hints render. The final run still covers the whole bank.
const priority = { invitation: 0, cheer: 0, intro: 1, fact: 2, question: 3, dialogue: 4, ending: 5, hint: 6, feedback: 7 };
const requested = sample ? [...entries.values()].slice(0, 1) : [...entries.values()].sort((a, b) => priority[a.role] - priority[b.role]);
console.log(`Preparing ${requested.length} authored clips using a local Kokoro model.`);
// A small thread count prevents a laptop from spending more time coordinating
// threads than generating these short clips. Runtime pages never run this work.
const modelId = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const progress_callback = event => { if (['initiate', 'done'].includes(event.status)) console.log(`Model ${event.status}: ${event.file}`); };
const [model, tokenizer] = await Promise.all([
  StyleTextToSpeech2Model.from_pretrained(modelId, { dtype: 'q8', device: 'cpu', progress_callback, session_options: { intraOpNumThreads: 2, interOpNumThreads: 1, executionMode: 'sequential' } }),
  AutoTokenizer.from_pretrained(modelId, { progress_callback }),
]);
const tts = new KokoroTTS(model, tokenizer);
// Preserve completed metadata even when generation resumes in a new priority
// order. Previously generated clips must not vanish from a partial manifest.
const recordings = existing.filter(recording => entries.has(recording.id));
for (const [index, entry] of requested.entries()) {
  const filename = `${entry.id}.mp3`;
  const previous = existingById.get(entry.id);
  if (!force && previous && await fs.stat(path.join(output, filename)).then(file => file.size > 0, () => false)) {
    if (!recordings.some(recording => recording.id === entry.id)) recordings.push(previous);
    continue;
  }
  const started = performance.now();
  // Cheers are short and bright, with natural word timing rather than pitch
  // manipulation. Slower facts keep their existing, easy-to-follow reading pace.
  const audio = await tts.generate(entry.text, { voice: 'af_heart', speed: entry.role === 'fact' ? 0.92 : entry.role === 'cheer' ? 1.04 : 0.96 });
  const generatedAt = performance.now();
  // Reject silent or invalid output so failed generation never becomes a served clip.
  const peak = audio.audio.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
  if (!Number.isFinite(peak) || peak < 0.005 || audio.audio.length < audio.sampling_rate / 2) throw new Error(`Invalid audio: ${entry.id}`);
  const mp3 = encodeMp3(audio);
  await fs.writeFile(path.join(output, filename), mp3);
  const recording = { id: entry.id, text: entry.text, src: `/quest/audio/${filename}`, seconds: Math.round(audio.audio.length / audio.sampling_rate * 100) / 100, voice: 'af_heart' };
  const previousIndex = recordings.findIndex(item => item.id === entry.id);
  if (previousIndex >= 0) recordings[previousIndex] = recording;
  else recordings.push(recording);
  console.log(`${index + 1}/${requested.length}: ${entry.role}, ${recording.seconds}s, ${mp3.length} bytes, voice ${Math.round(generatedAt - started)}ms / encode ${Math.round(performance.now() - generatedAt)}ms`);
  // Persist each success so an interrupted local generation can be resumed safely.
  // An atomic rename keeps local preview reloads from reading half a JavaScript
  // file while this background generation is updating the manifest.
  const nextManifest = path.join(output, 'story-manifest.next');
  await fs.writeFile(nextManifest, `// Generated fixed transcripts and MP3 paths; regenerate with scripts/generate-story-audio.mjs.\n// Kokoro 82M v1.0, af_heart, Apache-2.0. No child data or browser inference is used.\n// id hashes the exact normalized text; src is local; seconds describes the voice waveform.\nexport const STORY_RECORDINGS = ${JSON.stringify(recordings, null, 2)};\n`);
  await fs.rename(nextManifest, manifestPath);
}
console.log(`Ready: ${recordings.length} recordings. Model cache stays in tmp/quest-voice-build.`);
