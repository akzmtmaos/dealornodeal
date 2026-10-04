// ============================================
// Sound effects (Web Audio synthesis + recorded MP3 stings)
// ============================================
import { game } from './game.js?v=100';

let audioCtx = null;
let audioMasterGain = null;

function getAudioCtx() {
  if (!audioCtx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      // Everything routes through one master gain so sound can be toggled,
      // and boosted louder than normal via the Volume setting.
      audioMasterGain = audioCtx.createGain();
      audioMasterGain.gain.value = 0;
      audioMasterGain.connect(audioCtx.destination);
      applySfxLevel();
    } catch (e) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Applies the Sound Effects on/off + Volume setting to the master gain. */
export function applySfxLevel() {
  if (!audioMasterGain || !audioCtx) return;
  const level = game.sfxEnabled ? Math.max(0, game.sfxVolumePercent) / 100 : 0;
  audioMasterGain.gain.setTargetAtTime(level, audioCtx.currentTime, 0.02);
}

// Browsers only let audio start after a user gesture — warm the context up
// on the first interaction so reveal sounds are never silently blocked.
document.addEventListener('pointerdown', function unlockAudio() { getAudioCtx(); }, { once: true });
document.addEventListener('keydown', function unlockAudio2() { getAudioCtx(); }, { once: true });

/** Plays a short filtered noise burst (snare-ish crack / crash). */
function playNoiseBurst(ctx, startAt, dur, peak, cutoff) {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * dur)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  let node = src;
  if (cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    src.connect(filter);
    node = filter;
  }
  node.connect(gain);
  gain.connect(audioMasterGain || ctx.destination);
  src.start(startAt);
}

/** Accelerating snare-style drumroll + a quiet rising sweep, for the tension
 *  while a case is travelling to center stage and opening. */
function playTensionRoll(ctx, dur) {
  const t0 = ctx.currentTime;
  const ticks = 14;
  for (let i = 0; i < ticks; i++) {
    const p = i / (ticks - 1);
    // p^2 spacing makes the hits accelerate toward the reveal moment
    playNoiseBurst(ctx, t0 + dur * p * p * 0.97, 0.045, 0.05 + 0.1 * p, 3200);
  }
  scheduleTone(ctx, 'sine', 150, t0, dur, 0.045, 780);
}

/** Schedules one tone: oscillator + fast attack / exponential decay envelope,
 *  optional pitch glide to freqEnd and low-pass cutoff to tame harsh shapes. */
function scheduleTone(ctx, type, freq, startAt, dur, peak, freqEnd, cutoff) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), startAt);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), startAt + dur);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  let node = osc;
  if (cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    osc.connect(filter);
    node = filter;
  }
  node.connect(gain);
  gain.connect(audioMasterGain || ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.05);
}

/** Recorded case-value reveal stings, resolved from this module's own
 *  path so both builds load the same shared files no matter where
 *  index.html lives. The legacy document-relative paths are kept as
 *  fallbacks for older copies. */
const LIGHT_REVEAL_SFX_URL = new URL('./sounds/lightamountreveal.mp3', import.meta.url).href;
const LIGHT_REVEAL_SFX_LEGACY_URL = 'js/sounds/lightamountreveal.mp3';
const DANGER_REVEAL_SFX_URL = new URL('./sounds/dangeramountreveal.mp3', import.meta.url).href;
const DANGER_REVEAL_SFX_LEGACY_URL = 'js/sounds/dangeramountreveal.mp3';

/** The reveal recordings start right on the hit, so no lead-in offset
 *  is needed. If a re-exported file gains a soft intro, raise this to skip it. */
const REVEAL_SFX_START_SEC = 0;

/** Below $100K (good news): the recorded light reveal sting. Falls
 *  back to the legacy path, then a media element, then the synth
 *  chime, if the file can't load or play. */
export function revealSoundLow() {
  playRecordedSfx([LIGHT_REVEAL_SFX_URL, LIGHT_REVEAL_SFX_LEGACY_URL], REVEAL_SFX_START_SEC, revealSoundLowSynth);
}

/** $100K and up (danger): the recorded danger reveal sting, with the
 *  same fallback chain ending in the synth boom-and-growl. */
export function revealSoundHigh() {
  playRecordedSfx([DANGER_REVEAL_SFX_URL, DANGER_REVEAL_SFX_LEGACY_URL], REVEAL_SFX_START_SEC, revealSoundHighSynth);
}

/** Synthesized light reveal — the fallback when the recorded
 *  lightamountreveal sting can't play: a soft "thwack" then a bright
 *  rising two-note chime, celebratory but lighter than the big-money sting. */
function revealSoundLowSynth() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  playNoiseBurst(ctx, t0, 0.07, 0.14, 2600);
  scheduleTone(ctx, 'sine', 130, t0, 0.22, 0.14);                  // warm floor note
  scheduleTone(ctx, 'triangle', 880, t0 + 0.03, 0.16, 0.16);       // A5
  scheduleTone(ctx, 'triangle', 1318.51, t0 + 0.13, 0.34, 0.13);   // E6
}

/** Synthesized danger reveal — the fallback when the recorded
 *  dangeramountreveal sting can't play: the drumroll lands on a big
 *  hit — sub boom + noise crash — then a growl glides down as the
 *  amount registers. */
function revealSoundHighSynth() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  scheduleTone(ctx, 'sine', 98, t0, 0.6, 0.65);                    // deep sub boom
  playNoiseBurst(ctx, t0, 0.18, 0.38, 1800);                      // crash
  scheduleTone(ctx, 'sawtooth', 440, t0 + 0.03, 0.5, 0.28, 110, 900); // A4 -> A2 growl
  scheduleTone(ctx, 'square', 233.08, t0 + 0.08, 0.32, 0.11, 116.54, 500);
}

/** Plays the reveal sting matching the revealed value's tier (same split as
 *  the shelf flash: below 100K is the good/yellow one, 100K+ the red danger). */
export function playRevealSound(value) {
  if (value < 100000) {
    revealSoundLow();
  } else {
    revealSoundHigh();
  }
}

/** Kicks off the accelerating drumroll that runs while a case opens (auto
 *  reveals only — the manual drag version has its own pacing). */
export function startTensionRoll(durSec) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  playTensionRoll(ctx, durSec || 0.65);
}

/** One short double "brring-brring" phone bell (440+480 Hz fused with a
 *  25 Hz tremolo, the classic telephone cadence). */
function ringBurst(ctx, t0) {
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'sine'; o1.frequency.value = 440;
  o2.type = 'sine'; o2.frequency.value = 480;
  const trem = ctx.createGain();
  trem.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = 25;
  const lfoAmp = ctx.createGain();
  lfoAmp.gain.value = 0.5;
  lfo.connect(lfoAmp);
  lfoAmp.connect(trem.gain);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);   // ring…
  env.gain.setValueAtTime(0.16, t0 + 0.19);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24); // …gap…
  env.gain.exponentialRampToValueAtTime(0.15, t0 + 0.29);   // ring!
  env.gain.setValueAtTime(0.15, t0 + 0.4);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.46);
  o1.connect(trem);
  o2.connect(trem);
  trem.connect(env);
  env.connect(audioMasterGain || ctx.destination);
  o1.start(t0); o2.start(t0); lfo.start(t0);
  o1.stop(t0 + 0.55); o2.stop(t0 + 0.55); lfo.stop(t0 + 0.55);
}

/** Plays the banker's phone ringing while the call icon is active — `rings`
 *  bursts spaced like a real ringer. */
export function playBankerRing(rings) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const n = rings || 2;
  const start = ctx.currentTime + 0.05;
  for (let i = 0; i < n; i++) {
    ringBurst(ctx, start + i * 0.7);
  }
}

/** Synthesized light cross-off — the fallback when the recorded
 *  light sting can't play: a crisp rising double-tick with a soft
 *  confirm ping as the tile lands dark. */
function boardEliminateLowSynth() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  scheduleTone(ctx, 'triangle', 523.25, t0, 0.06, 0.16);          // C5 tick
  scheduleTone(ctx, 'triangle', 659.25, t0 + 0.07, 0.07, 0.15);   // E5 tick
  scheduleTone(ctx, 'sine', 1046.5, t0 + 0.16, 0.16, 0.1);        // C6 ping
  playNoiseBurst(ctx, t0 + 0.97, 0.05, 0.09, 2000);               // flip lands
}

/** One heavy "BANG": a low sine that drops in pitch with a bright noise slap
 *  on the attack, like a giant impact — punchy, then it rings off. */
function stompAt(ctx, startAt, freq, peak) {
  scheduleTone(ctx, 'sine', freq, startAt, 0.55, peak, freq * 0.5);
  playNoiseBurst(ctx, startAt, 0.12, peak * 0.45, 900);
}

/** One loud board-impact THOMP for danger values — also the fallback when the
 *  recorded danger sting can't play. */
function boardEliminateDangerThomp() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  stompAt(ctx, t0, 62, 0.78);
}

/** Recorded danger sting locations, resolved from this module's own path so
 *  both builds load the same shared file no matter where index.html lives.
 *  The legacy document-relative path is kept as a fallback for older copies. */
const DANGER_SFX_URL = new URL('./sounds/danger.mp3', import.meta.url).href;
const DANGER_SFX_LEGACY_URL = 'js/sounds/danger.mp3';

/** decodeAudioData wrapper that also works on older callback-only
 *  engines — the deprecated callbacks still fire in modern ones, and
 *  resolving a Promise twice is a no-op. */
function decodeSfxBuffer(ctx, arrayBuffer) {
  return new Promise(function (resolve, reject) {
    const result = ctx.decodeAudioData(arrayBuffer, resolve, reject);
    if (result && typeof result.then === 'function') result.then(resolve, reject);
  });
}

/** Plays one recorded SFX from a decoded buffer: a fresh BufferSource
 *  per play lets quick reveals overlap, and the audio rides the master
 *  gain like every other SFX (so the 0–130% Sound Effects setting
 *  applies, including values above 100%). `startSec` skips any soft
 *  lead-in on the decoded-buffer path. */
function playRecordedSfxFrom(fullUrls, urls, startSec, synthFallback) {
  if (!urls.length) {
    // Nothing could be decoded (e.g. file:// blocks fetch) — still
    // try the recording via a media element, then the synth fallback.
    playRecordedSfxElement(fullUrls, synthFallback);
    return;
  }
  const rest = urls.slice(1);
  const ctx = getAudioCtx();
  if (!ctx) {
    playRecordedSfxElement(fullUrls, synthFallback);
    return;
  }
  fetch(urls[0])
    .then(function (response) {
      if (!response.ok) throw new Error('sfx HTTP ' + response.status);
      return response.arrayBuffer();
    })
    .then(function (arrayBuffer) { return decodeSfxBuffer(ctx, arrayBuffer); })
    .then(function (audioBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(audioMasterGain || ctx.destination);
      // start(when, offset) guarantees the lead-in skip; clamp so an
      // offset past the end can never throw and break the chain.
      const offset = Math.min(startSec, Math.max(0, audioBuffer.duration - 0.05));
      src.start(0, offset);
    })
    .catch(function () { playRecordedSfxFrom(fullUrls, rest, startSec, synthFallback); });
}

/** Last-resort media-element playback. Plays the recording from its
 *  start — only the Web Audio path can guarantee the offset. */
function playRecordedSfxElement(urls, synthFallback) {
  if (!urls.length) {
    synthFallback();
    return;
  }
  const rest = urls.slice(1);
  try {
    const a = new Audio(urls[0]);
    // HTMLMediaElement.volume only accepts [0,1] and THROWS above 1 —
    // the SFX volume setting can exceed 100%, so clamp it. Setting it
    // inside the try means any media failure falls back to the next
    // URL (or the synth) instead of breaking the reveal chain.
    a.volume = game.sfxEnabled ? Math.min(1, Math.max(0, game.sfxVolumePercent) / 100) : 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(function () { playRecordedSfxElement(rest, synthFallback); });
  } catch (e) {
    playRecordedSfxElement(rest, synthFallback);
  }
}

/** Plays a recorded SFX from `urls` (module-relative first, legacy
 *  second): decode-and-buffer first, media element second, synthesized
 *  fallback last. */
function playRecordedSfx(urls, startSec, synthFallback) {
  playRecordedSfxFrom(urls, urls.slice(), startSec, synthFallback);
}

/** Recorded danger sting, played from the beginning when a danger amount
 *  ($100K+) is crossed off the board. Falls back to the legacy path, then a
 *  media element, then the synthesized THOMP, if the file can't load or play. */
function playDangerSfx() {
  playRecordedSfx([DANGER_SFX_URL, DANGER_SFX_LEGACY_URL], 0, boardEliminateDangerThomp);
}

/** Recorded light cross-off sting location (below-$100K board
 *  removals), resolved like the danger sting. */
const LIGHT_ELIM_SFX_URL = new URL('./sounds/light.mp3', import.meta.url).href;
const LIGHT_ELIM_SFX_LEGACY_URL = 'js/sounds/light.mp3';

/** The light recording starts right on the tick, so no lead-in
 *  offset is needed. If a re-exported file gains a soft intro,
 *  raise this to skip it. */
const LIGHT_ELIM_SFX_START_SEC = 0;

/** Below-$100K cross-off: the recorded light sting. Falls back to
 *  the legacy path, then a media element, then the synthesized
 *  double-tick, if the file can't load or play. */
function boardEliminateLow() {
  playRecordedSfx([LIGHT_ELIM_SFX_URL, LIGHT_ELIM_SFX_LEGACY_URL], LIGHT_ELIM_SFX_START_SEC, boardEliminateLowSynth);
}

/** Plays the matching cross-off sound when a board value is eliminated — same
 *  split as everywhere else: below 100K is the good one (the recorded
 *  light sting), 100K+ the danger one (the recorded danger sting). */
export function boardEliminateSound(value) {
  if (value < 100000) {
    boardEliminateLow();
  } else {
    playDangerSfx();
  }
}
