// Tiny chiptune sound effects. No asset files and no dependencies: every sound
// is a handful of oscillator beeps with a volume envelope, which is all a pixel
// pet really needs. The sound table below is plain data so it can be unit
// tested without a browser — only `playSfx` touches WebAudio.
//
// Browsers refuse to start audio before a user gesture, so the AudioContext is
// built lazily and `unlockAudio()` nudges it awake on the first tap.

export type SfxName =
  | "tap" // a poke, acknowledged
  | "annoyed" // that is quite enough finger
  | "eat"
  | "refuse" // full, or otherwise unimpressed
  | "happy"
  | "love" // a call answered
  | "clean"
  | "medicine"
  | "hatch"
  | "evolve"
  | "death"
  | "win"
  | "lose";

/** One oscillator beep. `at` is seconds from the start of the effect; `to`
 *  glides the pitch across `dur` (chirps up, sad slides down). */
export interface Tone {
  freq: number;
  dur: number;
  at: number;
  to?: number;
  type?: OscillatorType;
  gain?: number;
}

/** Everything is deliberately short — these fire constantly during play, and a
 *  sound you notice twice is a sound you resent by the tenth time. */
export const SFX: Record<SfxName, Tone[]> = {
  tap: [{ freq: 660, dur: 0.05, at: 0, type: "square", gain: 0.5 }],
  annoyed: [{ freq: 300, to: 170, dur: 0.16, at: 0, type: "sawtooth", gain: 0.6 }],
  eat: [
    { freq: 520, dur: 0.05, at: 0, type: "triangle" },
    { freq: 700, dur: 0.06, at: 0.06, type: "triangle" },
  ],
  refuse: [
    { freq: 220, dur: 0.08, at: 0, type: "square", gain: 0.5 },
    { freq: 160, dur: 0.11, at: 0.09, type: "square", gain: 0.5 },
  ],
  happy: [
    { freq: 523, dur: 0.07, at: 0, type: "square", gain: 0.45 },
    { freq: 659, dur: 0.07, at: 0.07, type: "square", gain: 0.45 },
    { freq: 784, dur: 0.11, at: 0.14, type: "square", gain: 0.45 },
  ],
  love: [
    { freq: 659, dur: 0.09, at: 0, type: "sine", gain: 0.7 },
    { freq: 880, dur: 0.16, at: 0.08, type: "sine", gain: 0.7 },
  ],
  clean: [{ freq: 1200, to: 380, dur: 0.22, at: 0, type: "triangle", gain: 0.4 }],
  medicine: [{ freq: 880, to: 1320, dur: 0.18, at: 0, type: "sine", gain: 0.5 }],
  hatch: [
    { freq: 392, dur: 0.09, at: 0, type: "square", gain: 0.5 },
    { freq: 523, dur: 0.09, at: 0.09, type: "square", gain: 0.5 },
    { freq: 659, dur: 0.18, at: 0.18, type: "square", gain: 0.5 },
  ],
  // The one sound allowed to show off. Lands under the evolve flash.
  evolve: [
    { freq: 523, dur: 0.1, at: 0, type: "square", gain: 0.5 },
    { freq: 659, dur: 0.1, at: 0.1, type: "square", gain: 0.5 },
    { freq: 784, dur: 0.1, at: 0.2, type: "square", gain: 0.5 },
    { freq: 1047, dur: 0.32, at: 0.3, type: "square", gain: 0.55 },
    { freq: 1568, dur: 0.32, at: 0.34, type: "triangle", gain: 0.3 },
  ],
  death: [{ freq: 392, to: 150, dur: 0.9, at: 0, type: "sine", gain: 0.6 }],
  win: [
    { freq: 784, dur: 0.07, at: 0, type: "square", gain: 0.5 },
    { freq: 1047, dur: 0.14, at: 0.07, type: "square", gain: 0.5 },
  ],
  lose: [
    { freq: 392, dur: 0.09, at: 0, type: "square", gain: 0.45 },
    { freq: 294, dur: 0.16, at: 0.09, type: "square", gain: 0.45 },
  ],
};

// --- Mute preference ---------------------------------------------------------
const MUTE_KEY = "cozy-sprites-muted";

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false; // private mode, or no storage — sound on, not silence
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Preference is best-effort; never let it break the game.
  }
}

// --- Playback ----------------------------------------------------------------
/** Everything is mixed through here, well below 1 — these are beeps, not music. */
const MASTER_GAIN = 0.18;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unavailable = false;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  if (unavailable) return null;
  const AC =
    typeof window !== "undefined"
      ? window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!AC) {
    unavailable = true;
    return null;
  }
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
    return ctx;
  } catch {
    unavailable = true;
    return null;
  }
}

/** Call from a real user gesture. iOS in particular will only let an
 *  AudioContext start from inside one, so the first tap buys every later beep. */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === "suspended") void c.resume();
}

export function playSfx(name: SfxName): void {
  if (isMuted()) return;
  const c = audio();
  if (!c || !master) return;
  if (c.state === "suspended") void c.resume();
  const start = c.currentTime + 0.005; // a hair of lead time to schedule against
  try {
    for (const tone of SFX[name]) scheduleTone(c, master, tone, start);
  } catch {
    // A sound failing is never worth an exception reaching the game loop.
  }
}

function scheduleTone(c: AudioContext, out: GainNode, tone: Tone, start: number): void {
  const t0 = start + tone.at;
  const t1 = t0 + tone.dur;
  const osc = c.createOscillator();
  osc.type = tone.type ?? "square";
  osc.frequency.setValueAtTime(tone.freq, t0);
  if (tone.to !== undefined) {
    // exponentialRamp refuses to touch zero, and these are all audible anyway.
    osc.frequency.exponentialRampToValueAtTime(tone.to, t1);
  }
  const env = c.createGain();
  const peak = tone.gain ?? 0.5;
  // Tiny attack keeps square waves from clicking; exponential release so the
  // tail sounds like a decay instead of a cut cable.
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t1);
  osc.connect(env);
  env.connect(out);
  osc.start(t0);
  osc.stop(t1 + 0.02);
  // Let the graph collect itself; nodes are one-shot.
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
}
