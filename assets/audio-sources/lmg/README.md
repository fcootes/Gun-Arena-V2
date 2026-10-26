These source files are preserved for reproducible offline preparation, outside runtime assets.

- **Authentic M60 Firing.mp3**, FranklinRook1984, [Freesound 538302](https://freesound.org/people/FranklinRook1984/sounds/538302/), CC0 1.0. Exact user attachment; MP3 mono 44.1 kHz.
- **Metal_Hatch_Small_Close_02**, Rudmer_Rotteveel, [Freesound 718441](https://freesound.org/people/Rudmer_Rotteveel/sounds/718441/), CC0 1.0. Exact original WAV supplied for the final audio hotfix: stereo PCM16 at 44.1 kHz. Runtime closure uses its second, louder impact near 1.80 s.
- The older `-hq-preview.mp3` is retained only as an archived source for the previous commit. It is not used by the current preparation script and is outside Vite runtime assets.

Run `python3 scripts/prepare-lmg-audio.py` with numpy and ffmpeg. Detailed hashes, edit windows and operations are in the runtime `clip_manifest.json`. WAV export does not restore MP3 losses.
