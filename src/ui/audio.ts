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
  | "lose"
  | "tie" // rps: nobody took the match
  | "pat" // the soft, warm sound of being pet (not the sharp poke of "tap")
  | "throw" // fetch: the ball leaves your hand
  | "fetchback" // fetch: trots back, prize in mouth
  | "hide" // hide & seek: scurries off to hide
  | "found" // hide & seek: there you are
  | "empty" // hide & seek: nothing here…
  | "roll" // higher/lower: the die tumbles
  | "cubewrong" // the cube's hum: a broken chain
  | "bark"; // the dog thing, excited

/** One beep. `at` is seconds from the start of the effect; `to` glides the pitch
 *  across `dur` (chirps up, sad slides down). */
export interface Tone {
  freq: number;
  dur: number;
  at: number;
  to?: number;
  type?: OscillatorType;
  gain?: number;
  /** Play band-passed noise instead of an oscillator — freq/to then sweep the
   *  centre of the band rather than a pitch. This is the only way to get a
   *  *rasp*: an oscillator can only ever beep, and a dog's bark is mostly the
   *  broadband snap of the mouth opening. Used by the bark; nothing else needs
   *  it, and nothing else should — noise is a texture, not a tune. */
  noise?: boolean;
  /** How resonant that band is. Low Q is a breathy hiss, high Q a narrow bark. */
  q?: number;
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
  // Flat, even two-note — neither the rise of a win nor the sink of a loss.
  tie: [
    { freq: 440, dur: 0.08, at: 0, type: "square", gain: 0.4 },
    { freq: 440, dur: 0.12, at: 0.09, type: "square", gain: 0.4 },
  ],
  // Soft and low, a warm little rise — being pet, not poked.
  pat: [
    { freq: 330, dur: 0.1, at: 0, type: "sine", gain: 0.5 },
    { freq: 415, dur: 0.16, at: 0.08, type: "sine", gain: 0.45 },
  ],
  // Fetch: a rising whoosh as it leaves your hand.
  throw: [{ freq: 260, to: 620, dur: 0.16, at: 0, type: "triangle", gain: 0.45 }],
  // Fetch: a bright, pleased two-note trot back.
  fetchback: [
    { freq: 587, dur: 0.06, at: 0, type: "square", gain: 0.4 },
    { freq: 784, dur: 0.1, at: 0.06, type: "square", gain: 0.4 },
  ],
  // Hide & seek: a quick down-swoop as it darts off to hide.
  hide: [{ freq: 700, to: 300, dur: 0.14, at: 0, type: "triangle", gain: 0.4 }],
  // Hide & seek: a soft "there you are" pop.
  found: [
    { freq: 523, dur: 0.07, at: 0, type: "sine", gain: 0.5 },
    { freq: 698, dur: 0.12, at: 0.07, type: "sine", gain: 0.5 },
  ],
  // Hide & seek: a hollow little "nothing here" sink.
  empty: [{ freq: 392, to: 262, dur: 0.2, at: 0, type: "sine", gain: 0.45 }],
  // Higher/lower: a light wooden tumble as the die settles.
  roll: [
    { freq: 420, dur: 0.04, at: 0, type: "triangle", gain: 0.35 },
    { freq: 360, dur: 0.04, at: 0.05, type: "triangle", gain: 0.32 },
    { freq: 300, dur: 0.05, at: 0.1, type: "triangle", gain: 0.3 },
  ],
  // The cube's hum: a sour descending buzz — you broke the chain.
  cubewrong: [{ freq: 300, to: 150, dur: 0.3, at: 0, type: "sawtooth", gain: 0.5 }],
  // "Arf! arf!" — the one sound in here that isn't a beep, because a bark that
  // beeps is just a buzz (which is exactly what two low sawtooths gave us).
  // Each arf is built the way a real one is: the noisy SNAP of the mouth
  // opening, an "ar" whose pitch collapses almost as fast as it starts, and the
  // breathy "f" of it closing again. The pitch fall is what sells it — hold the
  // note steady and you're back to a buzz. Second arf lands lower and softer,
  // the way the second one always does.
  bark: [
    { noise: true, freq: 1600, to: 700, q: 0.9, dur: 0.03, at: 0, gain: 0.75 },
    { freq: 520, to: 170, dur: 0.085, at: 0.005, type: "sawtooth", gain: 0.6 },
    { noise: true, freq: 2600, to: 1500, q: 1.4, dur: 0.045, at: 0.07, gain: 0.3 },
    { noise: true, freq: 1500, to: 650, q: 0.9, dur: 0.03, at: 0.17, gain: 0.65 },
    { freq: 470, to: 150, dur: 0.085, at: 0.175, type: "sawtooth", gain: 0.5 },
    { noise: true, freq: 2400, to: 1400, q: 1.4, dur: 0.045, at: 0.24, gain: 0.26 },
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

/** Throw the current context away, releasing its audio session first. */
function discard(): void {
  if (!ctx) return;
  // "closed" is already gone; anything else we close to release the (possibly
  // dead) audio session before dropping the reference.
  if (ctx.state !== "closed") {
    try {
      void ctx.close?.().catch(() => {});
    } catch {
      // Already closing, or an engine too old to have close() — we're
      // discarding this context either way.
    }
  }
  ctx = null;
  master = null;
  noise = null; // belongs to the context that made it
}

/** The context, after first discarding one that no gesture can save.
 *  "running" and a plain "suspended" are workable; "closed" and WebKit's
 *  non-standard "interrupted" (audio session lost to a call/another app/
 *  backgrounding the PWA) are not — resume() on an interrupted context is a
 *  known WebKit trap that reports success while staying silent — so those
 *  are rebuilt from scratch. On iOS a context is only *born* alive inside a
 *  real user activation; rebuilt anywhere else it comes up "interrupted"
 *  again, harmlessly, and the next gesture's rebuild is the one that takes. */
function live(): AudioContext | null {
  if (ctx && ctx.state !== "running" && ctx.state !== "suspended") discard();
  return audio();
}

/** Call from a real user gesture. iOS will only let an AudioContext start
 *  from inside one — and for touch, "inside one" means at gesture *end*
 *  (pointerup/click); a pointerdown alone doesn't carry user activation, so
 *  wire this to both ends of the tap. The first tap buys every later beep,
 *  and after the PWA comes back from the background this is also what
 *  replaces the context iOS killed while we were hidden. */
export function unlockAudio(): void {
  const c = live();
  if (c && c.state !== "running") void c.resume();
}

/** Call when the app returns to the foreground. Not a gesture, so nothing is
 *  created or resumed here — that has to wait for the next tap. This only
 *  clears wreckage so that tap starts from a clean slate: a context parked in
 *  "interrupted"/"closed" while hidden is dropped now, and one that *claims*
 *  "running" is probed, because iOS sometimes hands back a zombie that
 *  reports running while its clock is frozen and its audio session is gone. */
export function reviveAudio(): void {
  if (!ctx) return;
  if (ctx.state !== "running") {
    discard();
    return;
  }
  const c = ctx;
  const t = c.currentTime;
  setTimeout(() => {
    // A live "running" context advances its clock every few milliseconds; one
    // that hasn't moved in 250ms is a zombie. Discard so the next tap rebuilds.
    if (ctx === c && c.state === "running" && c.currentTime === t) discard();
  }, 250);
}

export function playSfx(name: SfxName): void {
  playTones(SFX[name]);
}

/** Schedule an ad-hoc set of tones (for pitched-by-index sounds that aren't
 *  worth a static table entry). Same guarantees as playSfx: respects mute,
 *  never throws into the caller. */
function playTones(tones: Tone[]): void {
  if (isMuted()) return;
  // live(), not audio(): most sounds fire from click handlers, so this is
  // usually a real user activation — the one place a context interrupted
  // behind our back (backgrounded iOS PWA) can actually be rebuilt and heard.
  const c = live();
  if (!c || !master) return;
  if (c.state === "suspended") void c.resume();
  const start = c.currentTime + 0.005; // a hair of lead time to schedule against
  try {
    for (const tone of tones) scheduleTone(c, master, tone, start);
  } catch {
    // A sound failing is never worth an exception reaching the game loop.
  }
}

// A major pentatonic scale (C D E G A). No two notes clash, so a random
// sequence of them is always a passable little melody — exactly what a
// simon-says needs, where the order is out of our hands.
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0];

/** Frequency for scale step `n`, wrapping up an octave every 5 steps so the
 *  mapping stays pentatonic no matter how high the index climbs. */
function pentatonic(n: number): number {
  const len = PENTATONIC.length;
  const octave = Math.floor(n / len);
  const note = PENTATONIC[((n % len) + len) % len];
  return note * 2 ** octave;
}

/** Play the pentatonic note for a given step/face index. The cube's hum uses
 *  this so each face has its own fixed pitch: the same note sounds when the
 *  cube demonstrates a step and when you play it back, and any sequence of
 *  faces comes out as a learnable melody. */
export function playTone(step: number): void {
  playTones([{ freq: pentatonic(step), dur: 0.16, at: 0, type: "triangle", gain: 0.5 }]);
}

// A handful of short, cheerful phrases the buddy hums to itself while idling.
// Each entry is a list of pentatonic scale steps, so however they're ordered
// the notes stay consonant; picking one at random keeps the song from wearing
// out its welcome the way a single fixed jingle would.
const SONGS: number[][] = [
  [0, 2, 4, 2, 4, 5],
  [4, 2, 0, 2, 4, 4],
  [0, 4, 2, 4, 5, 4],
  [2, 4, 5, 4, 2, 0],
];

/** Play one of the idle songs — a soft, skipping pentatonic phrase. Gentle
 *  triangle tone so it sits under the scene rather than over it. The last note
 *  rings a touch longer to land the phrase. */
export function playSong(): void {
  const song = SONGS[Math.floor(Math.random() * SONGS.length)];
  const step = 0.19; // seconds per note — an easy, skipping tempo
  playTones(
    song.map((n, i) => ({
      freq: pentatonic(n),
      dur: i === song.length - 1 ? 0.3 : 0.17,
      at: i * step,
      type: "triangle" as OscillatorType,
      gain: 0.42,
    })),
  );
}

/** A short rising flourish for clearing a hum. The whole run steps up with the
 *  streak, so longer runs literally sound higher and prouder. */
export function playCubeClear(streak: number): void {
  const base = Math.min(Math.max(0, streak), 7);
  playTones(
    [0, 2, 4].map((d, i) => ({
      freq: pentatonic(base + d),
      dur: i === 2 ? 0.18 : 0.09,
      at: i * 0.075,
      type: "triangle" as OscillatorType,
      gain: 0.5,
    })),
  );
}

/** A half-second of white noise, built once and looped by every noise tone.
 *  Dropped with the context (discard) — an AudioBuffer belongs to the sample
 *  rate it was made at, and a rebuilt context may not share it. */
let noise: AudioBuffer | null = null;
function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const len = Math.floor(c.sampleRate * 0.5);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

function scheduleTone(c: AudioContext, out: GainNode, tone: Tone, start: number): void {
  const t0 = start + tone.at;
  const t1 = t0 + tone.dur;

  // The source, and the node the envelope hangs off — for noise that's the
  // band-pass, since sweeping the band is the whole point (freq/to are the
  // band's centre, not a pitch).
  let source: AudioScheduledSourceNode;
  let tail: AudioNode;
  if (tone.noise) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = tone.q ?? 1;
    band.frequency.setValueAtTime(tone.freq, t0);
    if (tone.to !== undefined) band.frequency.exponentialRampToValueAtTime(tone.to, t1);
    src.connect(band);
    source = src;
    tail = band;
  } else {
    const osc = c.createOscillator();
    osc.type = tone.type ?? "square";
    osc.frequency.setValueAtTime(tone.freq, t0);
    if (tone.to !== undefined) {
      // exponentialRamp refuses to touch zero, and these are all audible anyway.
      osc.frequency.exponentialRampToValueAtTime(tone.to, t1);
    }
    source = osc;
    tail = osc;
  }

  const env = c.createGain();
  const peak = tone.gain ?? 0.5;
  // Tiny attack keeps square waves from clicking; exponential release so the
  // tail sounds like a decay instead of a cut cable.
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t1);
  tail.connect(env);
  env.connect(out);
  source.start(t0);
  source.stop(t1 + 0.02);
  // Let the graph collect itself; nodes are one-shot.
  source.onended = () => {
    source.disconnect();
    tail.disconnect();
    env.disconnect();
  };
}
