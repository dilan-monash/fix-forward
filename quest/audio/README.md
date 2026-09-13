# Quest story voice

These small MP3s are synthetic narration of FixForward's authored story text. They were generated locally with **Kokoro 82M v1.0**, its `af_heart` voice and Kokoro.js 1.2.1. The engine and model use Apache-2.0; the included `KOKORO-LICENSE.txt` preserves the licence. See the [Kokoro source](https://github.com/hexgrad/kokoro) and [ONNX model](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX).

The app serves a 24 kHz, mono, 64 kbps MP3 only when narration is requested. It never downloads the model or sends a child's information to a voice service. Pause and Resume keep the same playback position; Stop and navigation cancel playback. Dynamic or edited words without an exact recording use the device voice when available.

`story-manifest.js` stores each exact transcript, content hash, relative URL, duration and voice. Matching normalizes whitespace and quotation marks only. A changed safety fact cannot select the old recording through a fuzzy match.

To regenerate, follow the commented setup at the top of `scripts/generate-story-audio.mjs`. Its tools and model cache stay in ignored `tmp/quest-voice-build`; they are development dependencies only. The script rejects empty/silent output and resumes completed clips. Use `--force` after changing voice or model settings; `--sample` generates only the greeting for review. `test/quest-narration.test.js` checks media-control races, exact current transcripts, unique hashes, every MP3 frame and durations. These checks establish file and playback integrity; audible delivery and pronunciation still need human review, including on the target tablet.
