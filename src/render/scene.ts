// The habitat: a cozy garden clearing drawn to a low-res buffer and scaled up
// crisply (CSS image-rendering: pixelated). Runs its own rAF animation loop and
// a small "act" system for scripted moments (cleaning, fetch, hide & seek,
// rock-paper-scissors, death), plus an ambient layer: the creature wanders the
// clearing, pauses at props, idles with per-personality motion, and now and
// then does a rare celebratory flourish.
//
// The buffer height adapts to the container's aspect ratio so the scene fills
// the stage right up to the HUD and nav — no letterbox bars.
//
// RENDERING RULE: never draw the creature (or any 16×16 sprite art) through
// ctx.scale()/ctx.rotate() with non-integer factors. At this buffer size that
// resamples the art off the pixel grid — eyes come out unequal, 1px outlines
// double or vanish, rotation shears stray pixels. All creature deformation
// (squash, tilt, flip) must go through drawSpriteQuantized, which keeps every
// blit integer-aligned. See its docblock before touching any of this.

import { CELL, buildCreatureFrames, type SpriteFrame } from "./sprites";
import type { Mood } from "./sprites";
import type { AdultForm, SkyPhase } from "../pet/types";
import { iconCanvas } from "./icons";
import type { IconName } from "./icons";
import { HIDE_SPOTS, type FetchVariant, type HideSpot } from "../pet/games";

export const SCENE_W = 112; // fixed content width; height adapts to the stage

const GRASS_DEPTH = 42; // grass below the horizon (floor sits this far up)
const CREATURE_X = 56; // resting center

// Fetch timing: the throw+chase+return always takes FETCH_DURATION; variants
// that come home holding something other than the ball get FETCH_HOLD_MS
// tacked on at the end as a beat to actually look at it before the verdict.
const FETCH_DURATION = 2500;
const FETCH_HOLD_MS = 1000;
const FETCH_HOLD_VARIANTS: ReadonlySet<FetchVariant> = new Set(["sock", "stick", "cube"]);

// Rock-paper-scissors reveal geometry (see drawRps).
const RPS_ICON_SZ = 20;
const RPS_PLAYER_X = 14;
const RPS_ICON_Y = 26;

// Distant hill ridge: a gently rolling line of evenly spaced, identical
// mounds — one soft cosine, so every peak has the same low, smooth crown.
// Rendered as solid columns down to the floor (see draw), so it reads as one
// continuous silhouette at the meadow's pixel density. HILL_MIN_H is the
// lowest point of that silhouette; the sky's horizon band is sized to match so
// the hills always mask it fully and no lighter seam shows in the valleys.
const HILL_PERIOD = 38; // px between mound peaks (three across the 112px scene)
const HILL_PEAK_X = 18; // x of the first peak (peaks at 18/56/94, edges in valleys)
function hillHeightAt(x: number): number {
  const p = (2 * Math.PI * (x - HILL_PEAK_X)) / HILL_PERIOD;
  return 14 + 4 * Math.cos(p);
}
const HILL_MIN_H = (() => {
  let min = Infinity;
  for (let x = 0; x < SCENE_W; x++) min = Math.min(min, hillHeightAt(x));
  return Math.floor(min);
})();

// Sun and moon as round pixel discs — half-widths per 1px row, same technique
// as the mushroom cap so the sky bodies read at the meadow's density instead of
// the old hard squares. The moon draws this disc twice: once lit, once in the
// sky colour offset sideways to carve the crescent.
const SUN_ROWS: [number, number][] = [
  [-4, 2], [-3, 3], [-2, 4], [-1, 4], [0, 4], [1, 4], [2, 4], [3, 3], [4, 2],
];
const MOON_ROWS: [number, number][] = [
  [-3, 2], [-2, 3], [-1, 3], [0, 3], [1, 3], [2, 3], [3, 2],
];

// --- Twilight ----------------------------------------------------------------
// Dusk and dawn (the hour either side of night) trade the flat sky for a ramp:
// colour stops from zenith (0) to horizon (1), interpolated one 1px row at a
// time. Rows, not a canvas gradient — browsers dither gradient fills, and at
// this buffer size the dither speckle survives the upscale and reads as noise.
// Dusk sinks the sun behind the right-hand hill peak and dawn floats it back up
// over the left one, so the sun tracks left→right across the day.
type SkyStop = [number, [number, number, number]];
const TWILIGHT_SKY: Record<"dusk" | "dawn", SkyStop[]> = {
  dusk: [
    [0, [43, 37, 82]], // the night indigo it's about to become
    [0.3, [82, 52, 110]],
    [0.55, [141, 72, 110]],
    [0.75, [206, 106, 86]],
    [0.9, [235, 150, 84]],
    [1, [246, 199, 120]], // molten gold on the horizon
  ],
  dawn: [
    [0, [38, 41, 92]], // the night, not quite let go
    [0.3, [77, 74, 134]],
    [0.55, [125, 98, 152]],
    [0.75, [206, 124, 138]],
    [0.9, [233, 163, 146]],
    [1, [246, 208, 168]], // pale peach, still cold out
  ],
};
const TWILIGHT_CLOUD: Record<"dusk" | "dawn", string> = {
  dusk: "#f2a078", // lit from below, salmon
  dawn: "#eeb2b6", // barely pink
};
// dy hangs the sun off the floor line: the hill peaks reach 18px, so a sun
// centred just above that is bitten into by the ridge. The core has to fight
// the gradient's own glow at the horizon — a sun the same gold as the sky it
// sets into simply disappears — so dusk burns orange and dawn goes near-white.
const TWILIGHT_SUN: Record<
  "dusk" | "dawn",
  { x: number; dy: number; core: string; rim: string; glow: string }
> = {
  dusk: { x: 94, dy: -21, core: "#ef6a3d", rim: "#ffb877", glow: "255,130,60" },
  dawn: { x: 18, dy: -18, core: "#ffdc8a", rim: "#fff6d4", glow: "255,205,150" },
};

/** The sky's colour at row `y` of `h`, interpolated between the stops. */
function twilightRow(stops: SkyStop[], y: number, h: number): string {
  const p = h > 1 ? y / (h - 1) : 0;
  let i = 1;
  while (i < stops.length - 1 && p > stops[i][0]) i++;
  const [p0, c0] = stops[i - 1];
  const [p1, c1] = stops[i];
  const k = p1 === p0 ? 0 : (p - p0) / (p1 - p0);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * k);
  return `rgb(${mix(c0[0], c1[0])},${mix(c0[1], c1[1])},${mix(c0[2], c1[2])})`;
}

// Cloud variants — each a set of [dx, dy, w, h] puffs riding on a base, so none
// read flat. A drifting cloud re-rolls which variant (and how high it floats)
// every time it wraps the sky, so it's never the same two clouds twice.
const CLOUD_SHAPES: [number, number, number, number][][] = [
  [[0, 2, 16, 3], [3, 0, 7, 3], [10, 1, 5, 2]], // broad, three soft humps
  [[0, 2, 12, 3], [2, 0, 6, 3], [7, 0, 5, 3]], // compact double puff
  [[1, 2, 9, 2], [2, 0, 6, 3], [4, -1, 3, 2]], // tall little tuft
  [[0, 3, 17, 2], [1, 1, 5, 2], [6, 0, 6, 3], [12, 1, 5, 2]], // long, rolling humps
];

/** Is the ground in darkness? Dawn is still night as far as the meadow's
 *  palette (and the pet's sleep) is concerned — only the sky knows better. */
function isNightSky(sky: SkyPhase): boolean {
  return sky === "night" || sky === "dawn";
}

/** Cheap deterministic 0..1 hash of an integer — picks a cloud's look/height
 *  per drift cycle without any stored state. */
function cloudHash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export interface SceneView {
  key: string; // creature key
  mood: Mood;
  poops: number;
  /** The sky overhead. Dusk paints as day + a sunset, dawn as night + a
   *  sunrise — see isNightSky, which is what the meadow's palette keys off. */
  sky: SkyPhase;
  asleep: boolean;
  lightsOn: boolean;
  /** Teen "audition" leaning — tints the sprite with an adult-hint accent. */
  variant?: AdultForm | null;
  /** A discipline-worthy fake call: the pet is visibly throwing a tantrum. */
  tantrum?: boolean;
  /** A rare, brief burst of energy: the pet dashes around the clearing. */
  zoomies?: boolean;
  /** 0..1 — how energetic the creature is. Old-timers rest more, walk slower. */
  activity?: number;
  /** Dysentery, or a bad-diet mess still on the floor: the messes render as
   *  wet diarrhea pools, not tidy coils. */
  runny?: boolean;
}

type Pulse = "none" | "happy" | "shake" | "evolve" | "eat" | "nudge" | "love";

interface Act {
  type: "clean" | "fetch" | "hide" | "reveal" | "rps" | "death" | "poop";
  start: number;
  duration: number;
  data: Record<string, unknown>;
  onDone?: () => void;
  finished: boolean;
}

// --- Ambient wander ----------------------------------------------------------
// The clearing is a ground *plane*, not a line: every wander target has a depth
// (dy) as well as a sideways offset, and everything that stands on the grass —
// props, poops, the creature — is depth-sorted and drawn back-to-front. That's
// what lets the sprite duck behind the stump or wade *into* the flowers.
type WanderPhase =
  | "dwell"
  | "walk"
  | "zoom" // the zoomies: a fast, giddy dash from spot to spot
  | "interact"
  | "yawn"
  | "rest"
  | "sitdown" // hopping up onto the stump, mushy settle
  | "sit" // perched on the stump, breathing
  | "situp"; // hopping back down
interface WanderTarget {
  dx: number; // offset from CREATURE_X
  dy: number; // depth offset from the resting line (- = toward the hills)
  prop: string | null; // a prop to react to on arrival
}
// Where the creature likes to potter off to. Props get a little reaction, and
// their dy values are tuned against the props' sort anchors (behind the
// mushroom, tucked behind the stump, in among the front flowers).
const WANDER_TARGETS: WanderTarget[] = [
  { dx: 22, dy: 4, prop: "mushroom" },
  { dx: 8, dy: 18, prop: "flowers" },
  { dx: -22, dy: -4, prop: "lantern" },
  { dx: -36, dy: 0, prop: "stump" },
  { dx: -14, dy: 12, prop: null },
  { dx: 16, dy: -6, prop: null },
  { dx: 30, dy: 16, prop: null },
  { dx: 0, dy: 0, prop: null },
];
const WALK_SPEED = 16; // px / second
const ZOOM_SPEED = 110; // px / second — the zoomies, a proper blur
const FLOURISH_DUR = 1.7; // seconds
const EVOLVE_DUR = 1.4; // seconds — the shared age-up transformation

// The stump doubles as a seat. Perching lifts the sprite so its *real* feet
// rest on the sawn top (which sits just above the floor line at the stump's x).
// The lift is derived per-sprite in seatBob() from each body's empty bottom
// rows — a fixed constant floated the shorter bodies above the wood.
const STUMP_SEAT_DX = 15 - CREATURE_X; // stump centre, relative to rest
const STUMP_SEAT_TOP_DY = 3; // sawn cut, floor-relative (mirrors drawStump)

/** The plop: a deep squash on contact, a small rebound past true, settle.
 *  q runs 0..1 over the plop; ≥1 means it's over. */
function plopSquash(q: number): { sx: number; sy: number } {
  if (q >= 1 || q < 0) return { sx: 1, sy: 1 };
  const dip = Math.sin(Math.min(q / 0.5, 1) * Math.PI) * 0.24;
  const over = q > 0.5 ? Math.sin(((q - 0.5) / 0.5) * Math.PI) * 0.07 : 0;
  return { sx: 1 + dip * 0.8 - over * 0.5, sy: 1 - dip + over };
}

/** Periodic quirk window: returns progress 0..1 while inside the window that
 *  opens for `dur` seconds every `period` seconds (phase-shifted), else -1. */
function quirk(t: number, period: number, dur: number, offset = 0): number {
  const c = (t + offset) % period;
  return c < dur ? c / dur : -1;
}

// Standing still should read as a quiet breathe, not constant rocking — every
// per-form idle motion gets damped by this before it hits the canvas.
const IDLE_WIGGLE_SCALE = 0.5;

// Idle song cadence. Randomized per-firing rather than a fixed metronome, so
// it never settles into a beat the player can predict.
const SONG_PERIOD_MIN = 32; // seconds, shortest gap between idle songs
const SONG_PERIOD_MAX = 58; // seconds, longest gap
const SONG_DUR = 2.8; // how long the notes drift up

function randomSongInterval(): number {
  return SONG_PERIOD_MIN + Math.random() * (SONG_PERIOD_MAX - SONG_PERIOD_MIN);
}

/** The trot: the bounce every creature uses when it's actually going
 *  somewhere — shared so carried objects can ride the same rhythm. */
export function trotBob(t: number): number {
  return -Math.abs(Math.sin(t * 9)) * 2.6;
}

/** A depth-sortable drawable: `y` is where it meets the ground. */
interface Layer {
  y: number;
  draw: () => void;
}

export class Scene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private view: SceneView = {
    key: "egg",
    mood: "neutral",
    poops: 0,
    sky: "day",
    asleep: false,
    lightsOn: true,
  };
  private creatureCanvas: HTMLCanvasElement;
  private frames: Record<SpriteFrame, HTMLCanvasElement>;
  private creatureCacheKey = "";
  private mirrorCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

  private altFrame = false; // per-frame: use the alt pose (dog's tail, flipped)
  private forceGlance: -1 | 0 | 1 = 0; // per-frame: a quirk overrides the gaze
  private extraAlpha = 1; // per-frame: ghost flicker translucency
  private patSquintUntil = 0; // eyes held shut until this time (a savoured pat)
  private crackEyeUntil = 0; // one eye held open until this time (poked mid-sleep)
  private settleStart = -Infinity; // last time it stopped moving → plop squish
  private raf = 0;
  private t0 = performance.now();
  private pulse: Pulse = "none";
  private pulseStart = 0;
  private act: Act | null = null;
  private hidden = false; // creature is off hiding (hide & seek)
  private peekSpot: string | null = null; // imperfect hide: head pokes out here
  private peekTopFrac = 0; // sprite-canvas fraction above the first opaque row
  private curDx = 0; // creature's current x offset (for bubble anchoring)
  private curDy = 0; // creature's current depth offset (for sorting/anchoring)
  private facing: 1 | -1 = 1; // 1 = facing right; mirrors the sprite when -1
  private prevPosDx = 0; // last positional dx, to derive facing from movement

  // Adaptive sizing.
  private sh = 132; // scene buffer height
  private floorY = 90; // horizon within the buffer
  private ro: ResizeObserver | null = null;

  // Ambient wander state.
  private wanderPhase: WanderPhase = "dwell";
  private wanderX = 0;
  private wanderY = 0; // depth position on the ground plane
  private wanderTargetX = 0;
  private wanderTargetY = 0;
  private wanderUntil = 0;
  private wanderProp: string | null = null;
  private phaseStart = 0; // when the current yawn/rest began (for easing)
  private lastFrame = 0;

  // Where each mess landed on the ground plane (index-matched to view.poops).
  // yOffset is relative to floorY, not an absolute canvas y — the scene's
  // aspect (and so floorY) can change after a resize/rotation, and a stored
  // absolute y would then float free of the horizon (see drawPoop callers).
  private poopSpots: { x: number; yOffset: number }[] = [];

  // Flourish (rare easter-egg animation).
  private flourishStart = -Infinity;

  // Age-up: a shared evolve burst that plays over every stage boundary.
  private evolveStart = -Infinity;
  // White-silhouette cache for the evolve flash, keyed by source frame so a
  // rebuilt sprite drops its stale whitened copy for free.
  private whiteCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

  // Fraction of the sprite grid empty *below* its lowest opaque row — the seat
  // lift reads this so each body's feet land on the wood (see seatBob). Cached
  // on sprite swap, like creatureCacheKey; scanning pixels every frame is silly.
  private seatBottomFrac = 0;

  // When the pet last fell asleep — eases the settle-down and times the Zzz.
  private sleepStart = -Infinity;
  // …and when it last woke. Only the mole cares: it has to climb back out of
  // its burrow, and without this it would pop out of the ground instantly.
  private wakeStart = -Infinity;

  // Idle singing: music notes float up like the Zzz, and a callback fires the
  // sound once as the window opens. nextSongAt is a scene-clock deadline,
  // rerolled to a fresh random interval every time it fires.
  private singHandler: (() => void) | null = null;
  private nextSongAt = -1; // -1 = not yet scheduled (set on first update())
  private songWindowStart = -Infinity;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.resize();
    this.frames = buildCreatureFrames("egg", "neutral");
    this.creatureCanvas = this.frames.base;
    // Keep the buffer aspect matched to the element so nothing letterboxes.
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
    }
  }

  /** Match the buffer height to the element's aspect ratio (fills the stage). */
  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = rect.width > 0 ? rect.height / rect.width : 132 / SCENE_W;
    this.sh = Math.max(124, Math.min(240, Math.round(SCENE_W * ratio)));
    this.floorY = this.sh - GRASS_DEPTH;
    this.canvas.width = SCENE_W;
    this.canvas.height = this.sh;
    this.ctx.imageSmoothingEnabled = false;
  }

  update(view: SceneView): void {
    if (view.asleep && !this.view.asleep) this.sleepStart = performance.now();
    if (!view.asleep && this.view.asleep) this.wakeStart = performance.now();
    this.view = view;
    const cacheKey = `${view.key}:${view.mood}:${view.variant ?? ""}`;
    if (cacheKey !== this.creatureCacheKey) {
      this.frames = buildCreatureFrames(view.key, view.mood, view.variant);
      this.creatureCanvas = this.frames.base;
      this.creatureCacheKey = cacheKey;
      this.seatBottomFrac = spriteBottomFraction(this.creatureCanvas);
    }
  }

  triggerPulse(p: Pulse): void {
    this.pulse = p;
    this.pulseStart = performance.now();
  }

  /** A brief, contented eye-close — the pet savouring a good pat. Shown instead
   *  of narrating it. Refreshing it (rubbing) keeps the eyes shut until you stop. */
  patSquint(): void {
    if (this.busy() || this.hidden) return;
    this.patSquintUntil = performance.now() + 750;
  }

  /** Poked while asleep: one eye cracks open for a moment, unimpressed. */
  crackEye(): void {
    if (this.hidden) return;
    this.crackEyeUntil = performance.now() + 900;
  }

  /** Register the sound to play when the pet strikes up an idle song. Kept as
   *  a callback so the render layer never has to import the audio module. */
  onIdleSong(handler: () => void): void {
    this.singHandler = handler;
  }

  /** A rare celebratory flourish (main fires this roughly once an hour). */
  triggerFlourish(): void {
    if (this.busy() || this.hidden) return;
    // Skip while asleep, still an egg, or mid-tantrum — the tantrum animation
    // takes priority in ambientMotion, so a flourish would just be lost.
    if (this.view.asleep || this.view.key === "egg" || this.view.tantrum) return;
    this.flourishStart = performance.now();
    // Break off any wander so the flourish plays from where it stands.
    this.wanderPhase = "dwell";
    this.wanderUntil = performance.now() + FLOURISH_DUR * 1000 + 400;
  }

  private flourishing(): boolean {
    return (performance.now() - this.flourishStart) / 1000 < FLOURISH_DUR;
  }

  /** The age-up: anticipation, a white-silhouette flash that hides the sprite
   *  swap, a sparkle burst, and a settle. main fires this on every stage
   *  boundary; safe to call mid-wander or mid-perch — it takes over the body. */
  triggerEvolve(): void {
    if (this.hidden) return;
    this.evolveStart = performance.now();
    // Drop any wander/perch and hold it centred-in-place through the transform.
    this.wanderPhase = "dwell";
    this.wanderUntil = performance.now() + EVOLVE_DUR * 1000 + 400;
  }

  private evolving(): boolean {
    return (performance.now() - this.evolveStart) / 1000 < EVOLVE_DUR;
  }

  /** 0..1 over the evolve. */
  private evolveP(): number {
    return Math.min(1, (performance.now() - this.evolveStart) / (EVOLVE_DUR * 1000));
  }

  // --- Acts ------------------------------------------------------------------
  private startAct(
    type: Act["type"],
    duration: number,
    data: Record<string, unknown> = {},
    onDone?: () => void,
  ): void {
    // Acts take the stage: reset the wander so choreography starts from center.
    this.wanderPhase = "dwell";
    this.wanderX = 0;
    this.wanderY = 0;
    this.wanderTargetX = 0;
    this.wanderTargetY = 0;
    this.wanderUntil = performance.now() + 1500;
    this.flourishStart = -Infinity;
    this.act = { type, start: performance.now(), duration, data, onDone, finished: false };
  }

  /** Broom tours the floor, sweeping up each mess in turn (sparkles in its
   *  wake). Snapshots the mess positions *now* — this runs before state zeroes
   *  the poop count, so poopSpots still holds where everything landed. */
  playClean(onDone?: () => void): void {
    const spots = this.poopSpots
      .slice(0, 4)
      .map((s) => ({ x: s.x, yOffset: s.yOffset }))
      .sort((a, b) => a.x - b.x); // sweep left → right
    // Longer floors take longer: a beat of lead-in plus time per mess.
    const dur = spots.length > 0 ? 500 + spots.length * 450 : 900;
    const dx = this.wanderX;
    const dy = this.wanderY;
    this.startAct("clean", dur, { spots, cleanedAt: spots.map(() => -1), dx, dy }, onDone);
    // The broom sweeps the floor; the pet just watches from where it stands —
    // don't let startAct snap it to center (mirrors playPoop).
    this.wanderX = dx;
    this.wanderY = dy;
    this.wanderTargetX = dx;
    this.wanderTargetY = dy;
  }

  /** Ball arcs out (power 0..1); the variant decides how it (doesn't) come back. */
  playFetch(power: number, variant: FetchVariant, onDone?: () => void): void {
    // Throws go either way — except over-the-fence, which needs the fence (right).
    const dir = variant === "overfence" ? 1 : Math.random() < 0.5 ? 1 : -1;
    const dist = (18 + power * 34) * dir;
    const arc = 18 + Math.random() * 16; // randomized throw height
    const lateral = (Math.random() - 0.5) * 10; // slight sideways curve
    // Coming home with the wrong thing in its mouth is the whole joke — give
    // it a beat longer to actually land before the verdict cuts in.
    const duration = FETCH_HOLD_VARIANTS.has(variant) ? FETCH_DURATION + FETCH_HOLD_MS : FETCH_DURATION;
    this.startAct("fetch", duration, { dist, variant, arc, lateral }, onDone);
  }

  /** Nature calls: squat, tremble, produce. The mess lands where it stands. */
  playPoop(onDone?: () => void): void {
    if (this.busy() || this.hidden || this.view.asleep || this.view.key === "egg") {
      onDone?.();
      return;
    }
    const dx = this.wanderX;
    const dy = this.wanderY;
    this.startAct("poop", 1100, { dx, dy }, onDone);
    // Poop where it stands — don't let startAct snap it back to center.
    this.wanderX = dx;
    this.wanderY = dy;
    this.wanderTargetX = dx;
    this.wanderTargetY = dy;
  }

  /** Poof — the creature vanishes to go hide. Stays hidden until reveal.
   *  Pass `peekAt` (a hide spot) for an imperfect hide: the top of its head
   *  stays visible there the whole time. A gift to the seeker. */
  playHide(peekAt: string | null = null, onDone?: () => void): void {
    this.peekSpot = peekAt;
    if (peekAt) this.peekTopFrac = spriteTopFraction(this.creatureCanvas);
    this.startAct("hide", 500, {}, () => {
      this.hidden = true;
      onDone?.();
    });
  }

  /** Creature pops out from the actual hiding spot, then returns to center. */
  playReveal(spot: string, onDone?: () => void): void {
    this.hidden = false;
    this.peekSpot = null;
    const pos = this.hideSpotPos(spot);
    // Depth offset of the spot relative to the resting line, so the pop-out
    // happens *at* the spot's depth and the trot home walks back forward.
    const dy = pos.y - this.floorY - 9;
    this.startAct("reveal", 1400, { x: pos.x, dy }, onDone);
  }

  /**
   * Fists pump the countdown, both moves reveal, then the outcome plays out:
   * the winning move slides over and flattens the loser (ties bounce apart).
   * `outcome` is from the player's side: "win" = player's move wins.
   */
  playRps(
    player: IconName,
    pet: IconName,
    outcome: "win" | "lose" | "tie",
    onDone?: () => void,
  ): void {
    this.startAct("rps", 3200, { player, pet, outcome }, onDone);
  }

  /** The pet lies down, fades, and a little spirit floats up. */
  playDeath(onDone?: () => void): void {
    this.startAct("death", 3000, {}, onDone);
  }

  /** True while a scripted act is running (main can defer input). */
  busy(): boolean {
    return this.act !== null && !this.act.finished;
  }

  /** Where a hide-and-seek reveal pops out, in scene coords (floor-relative).
   *  Depths sit just behind each spot's prop sort anchor, so "behind the
   *  fence" genuinely pops out *behind* the fence. `peek` is where the crown
   *  of an imperfectly hidden head sits — just clear of that spot's cover
   *  (the stump's sawn top, the fence rail, the mushroom cap, the blooms). */
  private hideSpotPos(spot: string): { x: number; y: number; peek: number } {
    const f = this.floorY;
    const spots: Record<string, { x: number; y: number; peek: number }> = {
      "behind the stump": { x: 16, y: f + 10, peek: f - 7 },
      "in the flowers": { x: 68, y: f + 26, peek: f + 14 },
      "behind the fence": { x: 98, y: f + 2, peek: f - 13 },
      "under the mushroom": { x: 82, y: f + 14, peek: f - 1 },
    };
    return spots[spot] ?? { x: CREATURE_X, y: f + 10, peek: f - 7 };
  }

  /**
   * CSS-pixel position (relative to the canvas element) of the point just
   * above the creature's head — where speech bubbles should point.
   */
  creatureAnchor(): { x: number; y: number } {
    const cw = CELL * 3 * this.depthScale(this.curDy);
    const sx = CREATURE_X + this.curDx;
    // Just above the sprite's head, wherever it currently roams on the plane.
    const sy = this.floorY + this.curDy + 16 - cw;
    return this.toScreen(sx, sy);
  }

  /** CSS-pixel bounding box (relative to the canvas element) the creature
   *  currently occupies, padded a little for forgiving touch — lets a pat or
   *  poke gesture be gated to the pet itself instead of the whole stage. */
  creatureBounds(): { x: number; y: number; width: number; height: number } {
    const pad = 10; // scene px of slack around the sprite, each side
    const cw = CELL * 3 * this.depthScale(this.curDy);
    const cx = CREATURE_X + this.curDx;
    const topY = this.floorY + this.curDy + 16 - cw;
    const topLeft = this.toScreen(cx - cw / 2 - pad, topY - pad);
    const bottomRight = this.toScreen(cx + cw / 2 + pad, topY + cw + pad);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  /** Which hide-and-seek spot (if any) a canvas-relative tap lands nearest —
   *  lets the player guess by tapping the prop itself, not just a text list.
   *  Taps out on the open grass, past every spot's radius, match nothing. */
  hideSpotAt(cx: number, cy: number): HideSpot | null {
    const { scale } = this.screenTransform();
    const maxDist = 22 * scale; // scene-px radius, converted to CSS px
    let best: HideSpot | null = null;
    let bestDist = Infinity;
    for (const spot of HIDE_SPOTS) {
      const pos = this.hideSpotPos(spot);
      const screen = this.toScreen(pos.x, pos.y);
      const d = Math.hypot(cx - screen.x, cy - screen.y);
      if (d < bestDist) {
        bestDist = d;
        best = spot;
      }
    }
    return bestDist <= maxDist ? best : null;
  }

  /** Uniform scene→CSS scale factor and origin offset — shared by toScreen and
   *  anything sizing on-screen hit targets to match the rendered scene. */
  private screenTransform(): { scale: number; ox: number; oy: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.max(rect.width / SCENE_W, rect.height / this.sh);
    return { scale, ox: (rect.width - SCENE_W * scale) / 2, oy: (rect.height - this.sh * scale) / 2 };
  }

  /** Internal scene coords → CSS pixels relative to the canvas element.
   *  Mirrors the canvas's object-fit: cover scaling (max, with negative crop
   *  offsets) — contain math drifts whenever the buffer-height clamp in
   *  resize() keeps the aspect from matching exactly. */
  private toScreen(sx: number, sy: number): { x: number; y: number } {
    const { scale, ox, oy } = this.screenTransform();
    return { x: ox + sx * scale, y: oy + sy * scale };
  }

  /** Perspective: things nearer the camera (dy > 0) draw a touch larger. */
  private depthScale(dy: number): number {
    return 1 + dy * 0.007;
  }

  start(): void {
    const loop = () => {
      this.draw(performance.now());
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
  }

  // --- Drawing ----------------------------------------------------------------
  private draw(now: number): void {
    const ctx = this.ctx;
    const t = (now - this.t0) / 1000;
    const v = this.view;
    const night = isNightSky(v.sky);
    const dark = night && !v.lightsOn;
    const FLOOR_Y = this.floorY;
    const SCENE_H = this.sh;

    this.drawSky(t, dark);

    // --- Distant hills ----------------------------------------------------------
    // A rolling ridge of soft, symmetric mounds (see hillHeightAt) drawn as
    // solid 1px-wide columns down to the floor — single-toned so it stays quiet
    // background rather than reading as a hard-edged prop.
    ctx.fillStyle = dark ? "#22303a" : night ? "#33484a" : "#7ab35e";
    for (let x = 0; x < SCENE_W; x++) {
      const h = Math.round(hillHeightAt(x));
      ctx.fillRect(x, FLOOR_Y - h, 1, h);
    }

    // --- Grass -------------------------------------------------------------------
    ctx.fillStyle = dark ? "#2c3c2c" : night ? "#3f5a3c" : "#9cc85a";
    ctx.fillRect(0, FLOOR_Y, SCENE_W, SCENE_H - FLOOR_Y);
    // tufts
    ctx.fillStyle = dark ? "#26342a" : night ? "#38503a" : "#84b348";
    for (let i = 0; i < 14; i++) {
      const gx = (i * 37) % SCENE_W;
      const gy = FLOOR_Y + 4 + ((i * 13) % (SCENE_H - FLOOR_Y - 8));
      ctx.fillRect(gx, gy, 2, 1);
      ctx.fillRect(gx + 1, gy - 1, 1, 1);
    }
    // Worn dirt patch where the creature stands. Built from integer rows (no
    // ellipse) so it matches the meadow's hard-edged pixels — but its rim is
    // stippled, dirt fading to grass in a checkerboard, so it reads as trodden
    // ground rather than a drawn oval competing with the props.
    ctx.fillStyle = dark ? "#3a3228" : night ? "#5c4c38" : "#c9a96a";
    const dcx = CREATURE_X;
    const dcy = FLOOR_Y + 12;
    const dirtRim: [number, number][] = [
      [-6, 10], [-5, 15], [-4, 19], [-3, 21], [-2, 23], [-1, 25],
      [0, 26], [1, 25], [2, 23], [3, 21], [4, 18], [5, 15], [6, 10],
    ];
    for (const [dy, hw] of dirtRim) {
      const y = dcy + dy;
      const core = hw - 3;
      ctx.fillRect(dcx - core, y, core * 2 + 1, 1); // solid trodden centre
      for (let k = core + 1; k <= hw; k++) {
        // stipple the outer few px so the edge wears into the grass
        if (((dcx - k) ^ y) & 1) ctx.fillRect(dcx - k, y, 1, 1);
        if (((dcx + k) ^ y) & 1) ctx.fillRect(dcx + k, y, 1, 1);
      }
    }

    // --- The ground plane: depth-sorted, drawn back-to-front --------------------
    // Everything standing on the grass sorts by where it meets the ground, so
    // the creature can wander behind the stump or in front of the flowers.
    const layers: Layer[] = [
      { y: FLOOR_Y + 4, draw: () => this.drawFence(dark, night) },
      { y: FLOOR_Y + 13, draw: () => this.drawStump(dark, night) },
      { y: FLOOR_Y + 4, draw: () => this.drawLantern(t, dark, v) },
      { y: FLOOR_Y + 16, draw: () => this.drawMushroom(dark, night) },
    ];
    for (const [fx, fy, color] of this.flowerPatch()) {
      layers.push({ y: fy + 4, draw: () => this.drawFlower(fx, fy, color, t, dark, night) });
    }
    this.syncPoopSpots();
    for (const spot of this.poopSpots.slice(0, 4)) {
      const py = FLOOR_Y + spot.yOffset;
      layers.push({ y: py + 3, draw: () => this.drawPoop(spot.x, py) });
    }
    // The creature (plus any act fx) sorts at last frame's ground point — one
    // frame of lag is invisible at walking speed.
    // While perched on the stump the creature must sort *in front of* it
    // (its ground anchor alone would tuck it behind the seat it's sitting on).
    const seated =
      this.wanderPhase === "sitdown" || this.wanderPhase === "sit" || this.wanderPhase === "situp";
    layers.push({ y: FLOOR_Y + 9 + this.curDy + (seated ? 6 : 0), draw: () => this.runAct(now, t) });
    layers.sort((a, b) => a.y - b.y);
    for (const layer of layers) layer.draw();

    // --- Night dim + fireflies -----------------------------------------------------
    if (dark) {
      ctx.fillStyle = "rgba(20,16,40,0.35)";
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
      ctx.fillStyle = "#e8ffa0";
      for (let i = 0; i < 5; i++) {
        const fx = 20 + ((i * 23 + Math.sin(t * 0.7 + i * 2) * 10 + t * 3) % (SCENE_W - 30));
        const fy = FLOOR_Y - 20 + Math.sin(t * 1.3 + i * 1.7) * 12;
        if (Math.sin(t * 3 + i * 2.4) > 0.2) ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
      }
    }
    // Twilight wash. The meadow keeps its day palette at dusk and its night one
    // at dawn — a single low-alpha pass over the whole scene is what sells the
    // hour, and costs a lot less than a third colour ramp for every prop.
    if (v.sky === "dusk" || v.sky === "dawn") {
      ctx.fillStyle = v.sky === "dusk" ? "rgba(255,132,58,0.18)" : "rgba(255,150,170,0.12)";
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    }

    // Warm lantern glow washing over the clearing when lit at night
    if (night && v.lightsOn) {
      const g = ctx.createRadialGradient(33, FLOOR_Y - 33, 5, 33, FLOOR_Y - 33, 85);
      g.addColorStop(0, "rgba(255,220,150,0.45)");
      g.addColorStop(0.5, "rgba(255,220,150,0.18)");
      g.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    }

    // Sleeping: a lazy trail of Zs drifts up off the sleeper. Drawn after the
    // night dim so they stay soft and readable in the dark.
    if (v.asleep && !this.hidden && v.key !== "egg") {
      const settled = (now - this.sleepStart) / 1000 > 0.8;
      if (settled) {
        const cx = CREATURE_X + this.curDx;
        const headY = FLOOR_Y + this.curDy - 14;
        for (let i = 0; i < 3; i++) {
          const q = (t * 0.3 + i / 3) % 1; // each Z on its own staggered loop
          const zx = cx + 8 + q * 8 + Math.sin(q * Math.PI * 2 + i * 2.1) * 1.5;
          const zy = headY - q * 16;
          const fadeIn = Math.min(1, q / 0.12);
          ctx.globalAlpha = fadeIn * Math.max(0, 1 - Math.max(0, q - 0.5) * 2);
          this.drawZ(Math.round(zx), Math.round(zy), 1);
        }
        ctx.globalAlpha = 1;
      }
    }

    // The "love" pulse floats a few little hearts up off the creature.
    const lp = (now - this.pulseStart) / 1000;
    if (this.pulse === "love" && lp < 1.2) {
      const cx = CREATURE_X + this.curDx;
      const headY = FLOOR_Y + this.curDy - 26;
      for (let i = 0; i < 3; i++) {
        const q = lp - i * 0.18;
        if (q < 0 || q > 0.9) continue;
        const hx = cx - 7 + i * 7 + Math.sin(q * 5 + i * 2) * 2;
        const hy = headY - q * 16;
        ctx.globalAlpha = Math.max(0, 1 - q * 1.1);
        this.drawTinyHeart(Math.round(hx), Math.round(hy));
      }
      ctx.globalAlpha = 1;
    }

    // The idle song: now and then the buddy hums a little tune — music notes
    // drift up like the Zzz, and (via the sing handler) a soft pentatonic
    // phrase plays once as the window opens. Suppressed whenever it wouldn't
    // ring true: asleep, hiding, still an egg, mid-act/flourish/age-up, having
    // a tantrum, or plainly sad.
    if (
      !v.asleep &&
      !this.hidden &&
      v.key !== "egg" &&
      !v.tantrum &&
      v.mood !== "sad" &&
      !this.busy() &&
      !this.flourishing() &&
      !this.evolving()
    ) {
      // The countdown only runs while eligible, so a long nap doesn't spend
      // down a song that was due mid-sleep.
      if (this.nextSongAt < 0) this.nextSongAt = t + randomSongInterval();
      if (t >= this.nextSongAt) {
        this.songWindowStart = t;
        this.singHandler?.();
        this.nextSongAt = t + randomSongInterval();
      }
      const elapsed = t - this.songWindowStart;
      const qs = elapsed >= 0 && elapsed < SONG_DUR ? elapsed / SONG_DUR : -1;
      if (qs >= 0) {
        const cx = CREATURE_X + this.curDx;
        const headY = FLOOR_Y + this.curDy - 20;
        for (let i = 0; i < 3; i++) {
          const q = qs - i * 0.2; // each note trails the one before it
          if (q < 0 || q > 1) continue;
          const nx = cx + 6 + i * 6 + Math.sin(q * Math.PI * 3 + i * 1.7) * 3;
          const ny = headY - q * 22;
          const fadeIn = Math.min(1, q / 0.12);
          ctx.globalAlpha = fadeIn * Math.max(0, 1 - Math.max(0, q - 0.55) * 2.2);
          this.drawNote(Math.round(nx), Math.round(ny), i % 2 === 1);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /** A pixel Z at unit size `s` (1 = 4×4) — kept small so it sits in the same
   *  register as the tiny hearts. The diagonal needs two steps to read as a Z
   *  and not an H. */
  private drawZ(x: number, y: number, s: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#e9e2ff";
    ctx.fillRect(x, y, 4 * s, s);
    ctx.fillRect(x + 2 * s, y + s, s, s);
    ctx.fillRect(x + s, y + 2 * s, s, s);
    ctx.fillRect(x, y + 3 * s, 4 * s, s);
  }

  private drawTinyHeart(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#ff5c7a";
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x + 2, y, 1, 1);
    ctx.fillRect(x, y + 1, 3, 1);
    ctx.fillRect(x + 1, y + 2, 1, 1);
  }

  /** A little music note in warm gold — the sung counterpart to the Zzz. A
   *  single eighth note (♪) or a beamed pair (♫) for variety across the trail. */
  private drawNote(x: number, y: number, beamed: boolean): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#ffdf7a";
    if (beamed) {
      ctx.fillRect(x, y, 6, 1); // beam across the top
      ctx.fillRect(x, y + 1, 1, 4); // left stem
      ctx.fillRect(x + 5, y + 1, 1, 4); // right stem
      ctx.fillRect(x - 1, y + 4, 2, 2); // left notehead
      ctx.fillRect(x + 4, y + 4, 2, 2); // right notehead
    } else {
      ctx.fillRect(x + 3, y, 1, 5); // stem
      ctx.fillRect(x + 4, y, 2, 1); // flag
      ctx.fillRect(x + 4, y + 1, 1, 1); // flag curl
      ctx.fillRect(x + 1, y + 4, 3, 2); // notehead
    }
  }

  private drawFence(dark: boolean, night: boolean): void {
    const ctx = this.ctx;
    const FLOOR_Y = this.floorY;
    ctx.fillStyle = dark ? "#3a2f28" : night ? "#5c4a38" : "#a97b50";
    for (let x = 88; x <= 109; x += 7) {
      ctx.fillRect(x, FLOOR_Y - 8, 3, 14);
      ctx.fillStyle = dark ? "#332a24" : night ? "#524234" : "#96683f";
      ctx.fillRect(x, FLOOR_Y - 8, 3, 2); // post cap
      ctx.fillStyle = dark ? "#3a2f28" : night ? "#5c4a38" : "#a97b50";
    }
    ctx.fillRect(86, FLOOR_Y - 5, 26, 2);
    ctx.fillRect(86, FLOOR_Y + 1, 26, 2);
  }

  private drawStump(dark: boolean, night: boolean): void {
    const ctx = this.ctx;
    const cx = 15; // footprint centre — drives STUMP_SEAT_DX
    const top = this.floorY + 3; // the sawn cut; perched feet land here (STUMP_SEAT_TOP_DY)
    const bark = dark ? "#3f3128" : night ? "#5e4634" : "#8a5a3c";
    const barkDark = dark ? "#33281f" : night ? "#4e3a2c" : "#75482e";
    const wood = dark ? "#4f3e32" : night ? "#77593e" : "#c99a64";
    const ring = dark ? "#3f3126" : night ? "#5e4630" : "#a5764a";
    // Everything here is hand-placed on integer rows — fillRect only, no
    // ellipse — so the stump stays hard-edged pixel art like the rest of the
    // meadow. `oval` paints a run-length table of [dy, x, width] rows measured
    // from the cut, which is how the round shapes keep their crisp outline.
    const oval = (rows: [number, number, number][]) => {
      for (const [dy, x, w] of rows) ctx.fillRect(x, top + dy, w, 1);
    };

    // Trunk: a chunky bark barrel that splays into roots at its base.
    ctx.fillStyle = bark;
    ctx.fillRect(6, top + 1, 19, 9); // barrel
    ctx.fillStyle = barkDark;
    ctx.fillRect(10, top + 5, 1, 6); // grooves down the bark
    ctx.fillRect(15, top + 5, 1, 6);
    ctx.fillRect(20, top + 5, 1, 6);
    ctx.fillRect(6, top + 5, 1, 6); // shaded barrel edges
    ctx.fillRect(24, top + 5, 1, 6);

    // Roots: a few asymmetric humps of different widths spreading off the base
    // into the turf — a broad one sprawling left, a narrower one kicking right,
    // a small nub between, and one knuckly root crossing down in front. Warm
    // bark with barkDark seams, so it grips the grass instead of ending in a step.
    ctx.fillStyle = bark;
    // broad left root
    ctx.fillRect(4, top + 8, 3, 1);
    ctx.fillRect(3, top + 9, 5, 1);
    ctx.fillRect(2, top + 10, 7, 1);
    ctx.fillRect(3, top + 11, 5, 1);
    ctx.fillRect(4, top + 12, 3, 1);
    // narrower right root
    ctx.fillRect(22, top + 8, 3, 1);
    ctx.fillRect(22, top + 9, 5, 1);
    ctx.fillRect(22, top + 10, 6, 1);
    ctx.fillRect(24, top + 11, 3, 1);
    // small root nub tucked between, further back
    ctx.fillRect(17, top + 10, 5, 1);
    ctx.fillRect(18, top + 11, 3, 1);
    // the front root: knuckles down over the base into the grass
    ctx.fillRect(10, top + 9, 6, 1);
    ctx.fillRect(10, top + 10, 7, 1);
    ctx.fillRect(11, top + 11, 5, 1);
    ctx.fillRect(12, top + 12, 3, 1);
    ctx.fillRect(12, top + 13, 2, 1);
    ctx.fillStyle = barkDark;
    ctx.fillRect(9, top + 9, 1, 3);   // crevice between the left and front roots
    ctx.fillRect(16, top + 10, 1, 1); // front root's shaded right shoulder
    ctx.fillRect(15, top + 11, 1, 1);
    ctx.fillRect(22, top + 10, 1, 1); // crease between the nub and the right root
    ctx.fillRect(7, top + 10, 1, 1);  // little shadow within the left root

    // The sawn top: a fat bark-rimmed oval of pale wood. A shadow row under the
    // front lip lifts the seat proud of the barrel; a single growth ring and a
    // heartwood pith give it the classic cut-log read.
    ctx.fillStyle = bark;
    oval([
      [-4, 11, 9],
      [-3, 9, 13],
      [-2, 8, 15],
      [-1, 6, 19],
      [0, 6, 19],
      [1, 6, 19],
      [2, 7, 17],
      [3, 9, 13],
      [4, 11, 9],
    ]);
    ctx.fillStyle = barkDark;
    oval([[3, 9, 13]]); // the overhang's shadow
    ctx.fillStyle = wood;
    oval([
      [-3, 10, 11],
      [-2, 8, 15],
      [-1, 7, 17],
      [0, 7, 17],
      [1, 8, 15],
      [2, 10, 11],
    ]);
    ctx.fillStyle = ring;
    oval([
      [-2, 11, 9],
      [-1, 10, 11],
      [0, 11, 9],
    ]);
    ctx.fillStyle = wood;
    oval([
      [-2, 13, 5],
      [-1, 12, 7],
      [0, 13, 5],
    ]);
    ctx.fillStyle = ring;
    ctx.fillRect(cx - 1, top - 1, 2, 1); // heartwood pith
  }

  private drawLantern(t: number, dark: boolean, v: SceneView): void {
    const ctx = this.ctx;
    const night = isNightSky(v.sky);
    const lx = 32;
    const top = this.floorY - 40; // taller: the lantern is the heart of the clearing
    const lit = v.lightsOn;
    // a soft halo right around the glass, day or night, whenever it's lit
    if (lit) {
      const g = ctx.createRadialGradient(lx + 1, top + 7, 2, lx + 1, top + 7, 16);
      g.addColorStop(0, night ? "rgba(255,223,142,0.55)" : "rgba(255,233,163,0.35)");
      g.addColorStop(1, "rgba(255,223,142,0)");
      ctx.fillStyle = g;
      ctx.fillRect(lx - 16, top - 10, 34, 34);
    }
    // post
    ctx.fillStyle = dark ? "#2e2620" : "#6e5138";
    ctx.fillRect(lx, top + 13, 3, 31);
    ctx.fillStyle = dark ? "#241f1a" : "#5c4230";
    ctx.fillRect(lx - 2, this.floorY + 2, 7, 2); // base plate
    // lantern box — bigger glass, proper frame
    ctx.fillStyle = dark ? "#241f1a" : "#4a3527";
    ctx.fillRect(lx - 3, top, 9, 13);
    ctx.fillStyle = lit ? (night ? "#ffdf8e" : "#f5e6bc") : "#3a3448";
    ctx.fillRect(lx - 2, top + 1, 7, 11);
    if (lit) {
      // the flame itself, flickering
      const fl = Math.sin(t * 7) > -0.6;
      ctx.fillStyle = "#fff3c8";
      ctx.fillRect(lx, top + (fl ? 4 : 5), 3, fl ? 5 : 4);
      ctx.fillStyle = "#ffb84a";
      ctx.fillRect(lx + 1, top + 7, 1, 2);
    }
    // cap + finial
    ctx.fillStyle = dark ? "#241f1a" : "#4a3527";
    ctx.fillRect(lx - 4, top - 2, 11, 2);
    ctx.fillRect(lx, top - 4, 3, 2);
  }

  /**
   * The sky, in four hours: flat blue by day, flat indigo by night, and a
   * painted ramp at dusk and dawn (TWILIGHT_SKY). The twilight sun hangs low
   * enough that the hills — drawn after this — bite into it, so it reads as
   * setting behind the ridge rather than pasted on it.
   */
  private drawSky(t: number, dark: boolean): void {
    const ctx = this.ctx;
    const sky = this.view.sky;
    const FLOOR_Y = this.floorY;

    if (sky === "dusk" || sky === "dawn") {
      const stops = TWILIGHT_SKY[sky];
      for (let y = 0; y < FLOOR_Y; y++) {
        ctx.fillStyle = twilightRow(stops, y, FLOOR_Y);
        ctx.fillRect(0, y, SCENE_W, 1);
      }
      // The sun, half-drowned in the ridge, with the air glowing around it.
      const sun = TWILIGHT_SUN[sky];
      const cy = FLOOR_Y + sun.dy;
      const glow = ctx.createRadialGradient(sun.x, cy, 2, sun.x, cy, 34);
      glow.addColorStop(0, `rgba(${sun.glow},0.38)`);
      glow.addColorStop(1, `rgba(${sun.glow},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - 34, cy - 34, 68, 68);
      ctx.fillStyle = sun.core;
      this.fillDisc(sun.x, cy, SUN_ROWS);
      ctx.fillStyle = sun.rim; // the lit upper edge
      ctx.fillRect(sun.x - 2, cy - 4, 5, 1);
      // First stars out / last stars left, depending which way the hour runs.
      ctx.fillStyle = sky === "dusk" ? "#d8d4f0" : "#cdd2ee";
      for (const [sx, sy] of [
        [22, 9],
        [58, 6],
        [74, 15],
      ]) {
        if (Math.sin(t * 1.4 + sx) > -0.1) ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.fillStyle = TWILIGHT_CLOUD[sky]; // clouds lit from underneath
      this.drawClouds(t);
      return;
    }

    const night = sky === "night";
    ctx.fillStyle = dark ? "#141232" : night ? "#2b2552" : "#a8dcec";
    ctx.fillRect(0, 0, SCENE_W, FLOOR_Y);
    ctx.fillStyle = dark ? "#1d1940" : night ? "#3a3462" : "#cfeef8";
    ctx.fillRect(0, FLOOR_Y - HILL_MIN_H, SCENE_W, HILL_MIN_H);

    if (night) {
      // moon + twinkling stars
      ctx.fillStyle = "#f3edd0";
      this.fillDisc(92, 13, MOON_ROWS);
      // Carve the crescent: the same disc in the sky colour, nudged right.
      ctx.fillStyle = dark ? "#141232" : "#2b2552";
      this.fillDisc(95, 13, MOON_ROWS);
      ctx.fillStyle = "#fff";
      const stars = [
        [10, 14],
        [26, 30],
        [44, 10],
        [62, 24],
        [78, 42],
        [18, 46],
        [98, 34],
      ];
      for (const [sx, sy] of stars) {
        if (Math.sin(t * 2 + sx) > -0.3) ctx.fillRect(sx, sy, 1, 1);
      }
    } else {
      // sun + drifting clouds
      ctx.fillStyle = "#ffe9a3";
      this.fillDisc(94, 12, SUN_ROWS);
      ctx.fillStyle = "#fff2c8"; // top-left glint
      ctx.fillRect(91, 9, 3, 1);
      ctx.fillRect(92, 8, 2, 1);
      ctx.fillStyle = "#ffffff";
      this.drawClouds(t);
    }
  }

  /** Fill a round pixel disc from 1px rows (half-width per row). The current
   *  fill style is used, so the moon can paint one disc lit and another in the
   *  sky colour to carve its crescent. */
  private fillDisc(cx: number, cy: number, rows: [number, number][]): void {
    const ctx = this.ctx;
    const rx = Math.round(cx);
    const ry = Math.round(cy);
    for (const [dy, hw] of rows) ctx.fillRect(rx - hw, ry + dy, hw * 2 + 1, 1);
  }

  /** Two clouds drifting at different speeds. Each wrap of the sky re-rolls the
   *  cloud's shape and height (keyed off the wrap count), so the sky keeps
   *  changing instead of looping the same pair. x is integer-snapped for crisp
   *  pixels; the two tracks keep to an upper and lower band so they don't stack. */
  private drawClouds(t: number): void {
    const span = SCENE_W + 30;
    const tracks = [
      { speed: 3, phase: 0, yMin: 10, yRange: 14 }, // faster, high
      { speed: 2, phase: 60, yMin: 26, yRange: 20 }, // slower, low
    ];
    tracks.forEach((tr, k) => {
      const travel = t * tr.speed + tr.phase;
      const cycle = Math.floor(travel / span);
      const x = Math.round((travel % span) - 20);
      const shape = CLOUD_SHAPES[Math.floor(cloudHash(cycle * 2 + k * 101) * CLOUD_SHAPES.length)];
      const y = tr.yMin + Math.floor(cloudHash(cycle * 7 + k * 13) * tr.yRange);
      for (const [dx, dy, w, h] of shape) this.ctx.fillRect(x + dx, y + dy, w, h);
    });
  }

  private drawMushroom(dark: boolean, night: boolean): void {
    const ctx = this.ctx;
    const mx = 78;
    const my = this.floorY + 10;
    const cx = mx + 5; // cap centre
    // stem
    ctx.fillStyle = dark ? "#8a8478" : "#f0e6d0";
    ctx.fillRect(mx + 3, my, 4, 6);
    // cap: a smooth dome built from single-pixel rows (the stump's oval
    // technique) so it reads at the same density as the stump/dirt patch,
    // instead of the old two flat blocks.
    ctx.fillStyle = dark ? "#7a3a34" : night ? "#a04a40" : "#d95848";
    // Half-widths ease up gently (2,3,4,5,6,6) so the crown rounds off instead
    // of coming to the old near-point.
    const capRows: [number, number][] = [
      [-7, 2],
      [-6, 3],
      [-5, 4],
      [-4, 5],
      [-3, 6],
      [-2, 6],
    ];
    for (const [dy, hw] of capRows) ctx.fillRect(cx - hw, my + dy, hw * 2 + 1, 1);
    ctx.fillStyle = dark ? "#5e2c28" : night ? "#853c34" : "#b8432f";
    ctx.fillRect(cx - 6, my - 1, 13, 1); // shadow where the rim overhangs the stem
    // spots — two rows apart so the cap doesn't read as mirror-symmetric, both
    // tucked inside the dome's red.
    ctx.fillStyle = dark ? "#b0a89a" : "#fdf3e0";
    ctx.fillRect(cx - 4, my - 5, 2, 2);
    ctx.fillRect(cx + 3, my - 3, 2, 2);
  }

  /** Flower positions — returned so each can be depth-sorted individually. */
  private flowerPatch(): [number, number, string][] {
    const H = this.sh;
    return [
      [60, H - 18, "#f2a0bc"],
      [66, H - 12, "#ffd884"],
      [72, H - 20, "#e88aa8"],
      [90, H - 16, "#f2a0bc"],
      [24, H - 10, "#ffd884"],
      [10, H - 20, "#e88aa8"],
    ];
  }

  private drawFlower(
    fx: number,
    fy: number,
    color: string,
    t: number,
    dark: boolean,
    night: boolean,
  ): void {
    const ctx = this.ctx;
    const sway = Math.round(Math.sin(t * 1.5 + fx) * 0.6);
    ctx.fillStyle = dark ? "#2f4a34" : night ? "#4a6a48" : "#5aa85a";
    ctx.fillRect(fx + 1, fy, 1, 4);
    ctx.fillStyle = dark ? "#5c5468" : color;
    ctx.fillRect(fx + sway, fy - 3, 3, 3);
    ctx.fillStyle = dark ? "#78708a" : "#fff7dc";
    ctx.fillRect(fx + 1 + sway, fy - 2, 1, 1);
  }

  /** Keep the recorded mess positions in step with the pet's poop count.
   *  New messes appear wherever the creature currently stands (jittered so a
   *  restored save with several poops doesn't stack them). */
  private syncPoopSpots(): void {
    const want = this.view.poops;
    if (this.poopSpots.length > want) this.poopSpots.length = want;
    while (this.poopSpots.length < want) {
      const behind = -this.facing * (5 + Math.random() * 4);
      const x = Math.max(
        6,
        Math.min(SCENE_W - 12, CREATURE_X + this.curDx + behind + (Math.random() - 0.5) * 10),
      );
      const yOffset = Math.max(
        4,
        Math.min(this.sh - this.floorY - 6, this.curDy + 8 + (Math.random() - 0.5) * 8),
      );
      this.poopSpots.push({ x, yOffset });
    }
  }

  private drawPoop(x: number, y: number): void {
    if (this.view.runny) {
      this.drawPoopPool(x, y);
      return;
    }
    const ctx = this.ctx;
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(x, y, 8, 3);
    ctx.fillRect(x + 1, y - 2, 6, 2);
    ctx.fillRect(x + 2, y - 4, 4, 2);
    ctx.fillStyle = "#8a6a3a";
    ctx.fillRect(x + 2, y - 3, 2, 1);
  }

  /** Dysentery: a low, spread puddle instead of a tidy coil — wider footprint,
   *  a stray splatter or two, and a wet sheen catching the light. */
  private drawPoopPool(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#5c3f24";
    ctx.fillRect(x - 3, y + 1, 15, 2); // the spread base
    ctx.fillRect(x - 1, y, 11, 1); // slightly domed middle
    ctx.fillRect(x - 4, y + 2, 17, 1); // thin outer edge, seeping wider
    ctx.fillRect(x + 12, y, 2, 1); // stray splatter, downwind
    ctx.fillRect(x - 5, y + 1, 1, 1);
    ctx.fillStyle = "#7a5730"; // wet sheen
    ctx.fillRect(x + 1, y, 4, 1);
    ctx.fillRect(x + 6, y + 1, 3, 1);
  }

  /** A little broom standing on the ground at (x, y). `lean` tips the handle
   *  top by that many px (a stepped pixel diagonal — no rotation, so it stays
   *  on the grid); `squash` ∈ [0,1] presses the bristle fan into the floor,
   *  wider and shorter, as the stroke makes contact. */
  private drawBroom(x: number, y: number, lean: number, squash: number): void {
    const ctx = this.ctx;
    const bx = Math.round(x);
    const by = Math.round(y);
    const tip = Math.round(lean);
    // Handle: five 2×3 segments stepping from the bristle block up to the tip.
    ctx.fillStyle = "#8a5a3c";
    for (let i = 0; i < 5; i++) {
      const sx = bx + 4 + Math.round((tip * (i + 1)) / 5);
      ctx.fillRect(sx, by - 5 - (i + 1) * 3, 2, 3);
    }
    ctx.fillStyle = "#6e4630"; // knob at the top, catching the tilt
    ctx.fillRect(bx + 4 + tip, by - 21, 2, 2);
    // Bristle fan: squash widens it a px each side and shaves a row off.
    const sq = Math.round(squash);
    const fx = bx - sq;
    const fw = 8 + sq * 2;
    const fh = 7 - sq;
    ctx.fillStyle = "#e8c06a";
    ctx.fillRect(fx, by - 5 + sq, fw, fh);
    ctx.fillStyle = "#f6dfa0"; // light strands ride the fan
    ctx.fillRect(fx + 1, by - 5 + sq, 1, fh - 1);
    ctx.fillRect(fx + 4, by - 5 + sq, 1, fh - 1);
    ctx.fillRect(fx + fw - 2, by - 5 + sq, 1, fh - 1);
    ctx.fillStyle = "#caa050"; // worn tip line at the floor
    ctx.fillRect(fx, by + 2, fw, 1);
  }

  /** A puff of low dust flung forward from the bristles mid-stroke. */
  private drawSweepDust(x: number, y: number, q: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(240,236,220,${0.6 * (1 - q)})`;
    ctx.fillRect(Math.round(x + q * 7), Math.round(y - 1 - q * 3), 2, 2);
    ctx.fillRect(Math.round(x + 3 + q * 10), Math.round(y - q * 2), 1, 1);
    ctx.fillRect(Math.round(x + 1 + q * 4), Math.round(y + 1 - q * 4), 1, 1);
  }

  private drawBall(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#a8d84a";
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    ctx.fillStyle = "#f0f8d0";
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 1, 1);
  }

  /** A single sad sock — what fetch sometimes brings back instead of the ball. */
  private drawSock(x: number, y: number): void {
    const ctx = this.ctx;
    const rx = Math.round(x);
    const ry = Math.round(y);
    ctx.fillStyle = "#e8e2d0"; // off-white knit
    ctx.fillRect(rx - 2, ry - 4, 4, 5);
    ctx.fillRect(rx - 2, ry + 1, 6, 3); // the foot
    ctx.fillStyle = "#d0492f"; // a jaunty red stripe
    ctx.fillRect(rx - 2, ry - 4, 4, 1);
  }

  /** An imperfect hide: the creature crouches fully behind the spot's cover
   *  and just the crown of its head clears it, bobbing gently. The sprite is
   *  sunk so its first opaque row rides at the spot's `peek` line, and a
   *  fixed clip band cuts everything below — the cover does the rest. */
  private drawPeek(t: number): void {
    const pos = this.hideSpotPos(this.peekSpot!);
    const dy = pos.y - this.floorY - 9;
    const cw = CELL * 3 * this.depthScale(dy);
    // Rest position of the sprite's first opaque row (mirrors drawCreature:
    // sprite top = floorY + dy - cw + 12, plus the sprite's empty top rows).
    const headTopRest = this.floorY + dy - cw + 12 + this.peekTopFrac * cw;
    // Sink the whole sprite so that row sits at the peek line; the bob is
    // mostly-down so the head rises into view and ducks nearly out of it.
    const bob = pos.peek - headTopRest + Math.sin(t * 2.5) * 1.5 + 1;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.round(pos.x - cw / 2), Math.round(pos.peek) - 2, Math.round(cw), 7);
    ctx.clip();
    this.drawCreature(t, pos.x - CREATURE_X, 1, bob, undefined, undefined, dy);
    ctx.restore();
  }

  /** A good stick — fetch's other wrong answer. Carried sideways, naturally. */
  private drawStick(x: number, y: number): void {
    const ctx = this.ctx;
    const rx = Math.round(x);
    const ry = Math.round(y);
    ctx.fillStyle = "#8a5a3c";
    ctx.fillRect(rx - 5, ry, 10, 2);
    ctx.fillRect(rx + 1, ry - 2, 2, 2); // the fork
    ctx.fillStyle = "#5c3d22";
    ctx.fillRect(rx - 5, ry + 1, 10, 1);
  }

  /** A tiny floating "?" for moments of genuine bafflement. */
  private drawQuestionMark(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#fff7dc";
    ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillRect(x + 1, y + 1, 1, 1);
    ctx.fillRect(x, y + 2, 1, 1);
    ctx.fillRect(x, y + 4, 1, 1);
  }

  private drawSparkle(x: number, y: number, phase: number): void {
    const ctx = this.ctx;
    if (Math.sin(phase) < 0) return;
    ctx.fillStyle = "#fff7dc";
    ctx.fillRect(x, y - 1, 1, 3);
    ctx.fillRect(x - 1, y, 3, 1);
  }

  // --- Act orchestration -------------------------------------------------------
  private runAct(now: number, t: number): void {
    const act = this.act;
    const FLOOR_Y = this.floorY;
    if (!act) {
      // Idle: advance the ambient wander and draw the creature where it roams.
      if (!this.hidden) {
        this.updateWander(now);
        this.drawCreature(t, this.wanderX, 1, null, undefined, undefined, this.wanderY);
        if (this.evolving()) this.drawEvolveBurst(t);
        // The humming cube's pulse throws a little light around.
        if (this.view.key === "humcube" && quirk(t, 16.5, 1.8) >= 0) {
          const hx = Math.round(CREATURE_X + this.curDx);
          const hy = Math.round(FLOOR_Y + this.curDy - 20);
          this.drawSparkle(hx - 10, hy + 4, t * 6);
          this.drawSparkle(hx + 10, hy, t * 6 + 1.6);
          this.drawSparkle(hx + 4, hy - 6, t * 6 + 3.1);
        }
      } else if (this.peekSpot) {
        this.drawPeek(t);
      }
      return;
    }
    const p = Math.min(1, (now - act.start) / act.duration);

    switch (act.type) {
      case "clean": {
        const cdx = act.data.dx as number;
        const cdy = act.data.dy as number;
        if (!this.hidden) this.drawCreature(t, cdx, 1, null, undefined, undefined, cdy);
        const spots = act.data.spots as { x: number; yOffset: number }[];
        const cleanedAt = act.data.cleanedAt as number[];
        const n = spots.length;

        // The scrubbing stroke everything shares: the broom jabs forward and
        // eases back (phase φ), leaning its handle against the direction it's
        // pushing, lifting slightly on the backswing, and pressing the fan
        // into the floor at the front of each push.
        const phi = p * Math.PI * 10; // ~5 strokes over the act
        const jab = Math.sin(phi) * 3;
        const push = Math.cos(phi); // stroke velocity: + pushing, − returning
        const lean = -push * 3; // handle trails the push
        const lift = Math.max(0, -push) * 2; // backswing skims off the floor
        const press = Math.max(0, push); // contact pressure while pushing

        if (n === 0) {
          // Nothing on the floor — a token flourish across the grass.
          const bx = 4 + p * (SCENE_W - 10) + jab;
          const by = this.sh - 14 - lift;
          this.drawBroom(bx, by, lean, press);
          if (push > 0.3) this.drawSweepDust(bx + 8, by + 1, 1 - push);
          for (let i = 0; i < 4; i++) {
            this.drawSparkle(
              Math.round(bx - 6 - i * 9),
              this.sh - 12 - ((i * 5) % 8),
              t * 6 + i,
            );
          }
          break;
        }

        // The broom walks a path: lead-in → each mess (L→R) → exit. Segments
        // share the timeline equally, so a mess is swept the moment the broom
        // reaches its waypoint.
        const segs = n + 1;
        const way = (i: number): { x: number; y: number } => {
          if (i === 0) return { x: spots[0].x - 16, y: FLOOR_Y + spots[0].yOffset + 4 };
          if (i >= segs)
            return { x: spots[n - 1].x + 16, y: FLOOR_Y + spots[n - 1].yOffset };
          const s = spots[i - 1];
          return { x: s.x, y: FLOOR_Y + s.yOffset };
        };
        const seg = Math.min(segs - 1, Math.floor(p * segs));
        const q = p * segs - seg;
        const ease = q * q * (3 - 2 * q);
        const a = way(seg);
        const b = way(seg + 1);
        const bx = a.x + (b.x - a.x) * ease + jab;
        const by = a.y + (b.y - a.y) * ease - lift;

        // Mark each mess swept as the broom arrives at its waypoint.
        for (let i = 0; i < n; i++) {
          if (cleanedAt[i] < 0 && p >= (i + 1) / segs) cleanedAt[i] = p;
        }

        // Messes ahead of the broom stay put. A reached mess gets shoved: it
        // skids off in the sweep direction, flattening as it goes, THEN the
        // sparkles take over where it used to sit — cause before effect.
        for (let i = 0; i < n; i++) {
          const sx = spots[i].x;
          const sy = FLOOR_Y + spots[i].yOffset;
          const since = p - cleanedAt[i];
          if (cleanedAt[i] < 0) {
            this.drawPoop(sx, sy);
          } else if (since < 0.08) {
            // The shove: slide right, squash down to a skidding smear.
            const d = since / 0.08;
            const px = Math.round(sx + d * 12);
            const h = Math.max(1, Math.round(3 - d * 2));
            const w = Math.max(3, Math.round(8 - d * 4));
            const ctx = this.ctx;
            ctx.fillStyle = "#6b4a2a";
            ctx.fillRect(px, sy + (3 - h), w, h);
            if (d < 0.5) ctx.fillRect(px + 1, sy - 2 + (3 - h), w - 3, 1);
          } else if (since < 0.35) {
            for (let k = 0; k < 4; k++) {
              this.drawSparkle(sx + (k % 2 ? 5 : 1), sy - ((k * 3) % 7), t * 8 + i + k);
            }
          }
        }

        this.drawBroom(bx, by, lean, press);
        if (push > 0.3) this.drawSweepDust(bx + 8, by + 1, 1 - push);
        break;
      }

      case "fetch": {
        this.drawFetch(act, p, t);
        break;
      }

      case "hide": {
        // poof: creature shrinks into a dust cloud
        const scale = 1 - p;
        if (scale > 0.05) this.drawCreature(t, 0, scale, null);
        const ctx = this.ctx;
        ctx.fillStyle = `rgba(240,236,220,${0.7 * (1 - p)})`;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + p * 2;
          ctx.fillRect(
            Math.round(CREATURE_X + Math.cos(a) * (6 + p * 14)),
            Math.round(FLOOR_Y - 8 + Math.sin(a) * (4 + p * 8)),
            2,
            2,
          );
        }
        break;
      }

      case "reveal": {
        const spotX = act.data.x as number;
        const spotDy = act.data.dy as number;
        const spotDx = spotX - CREATURE_X;
        if (p < 0.45) {
          // pop out of the hiding spot — at the spot's actual depth
          const q = p / 0.45;
          const hop = Math.sin(q * Math.PI) * 6;
          this.drawCreature(t, spotDx, 0.4 + q * 0.6, -hop, undefined, undefined, spotDy);
        } else {
          // trot back to center, forward out of the scenery
          const q = (p - 0.45) / 0.55;
          const dx = spotDx * (1 - q);
          const dy = spotDy * (1 - q);
          const hop = Math.abs(Math.sin(q * Math.PI * 4)) * 2;
          this.drawCreature(t, dx, 1, -hop, undefined, undefined, dy);
        }
        break;
      }

      case "rps": {
        this.drawCreature(t, 0, 1, null);
        this.drawRps(act, p);
        break;
      }

      case "poop": {
        // Squat low, tremble with effort, then pop back up relieved.
        const dx = act.data.dx as number;
        const dy = act.data.dy as number;
        const squat =
          p < 0.75
            ? 1 - Math.min(p / 0.15, 1) * 0.3
            : 0.7 + ((p - 0.75) / 0.25) * 0.3;
        const jitter = p > 0.15 && p < 0.75 ? Math.sin(p * 46) * 0.7 : 0;
        this.drawCreature(t, dx + jitter, 1, 0, 1.08, squat, dy);
        // little effort marks over its head
        if (p > 0.25 && p < 0.7) {
          const ctx = this.ctx;
          ctx.fillStyle = "#fff7dc";
          const hx = CREATURE_X + dx;
          const hy = FLOOR_Y + dy - 20;
          if (Math.sin(t * 10) > 0) {
            ctx.fillRect(hx - 8, hy, 1, 2);
            ctx.fillRect(hx + 8, hy + 2, 1, 2);
          }
        }
        break;
      }

      case "death": {
        const ctx = this.ctx;
        if (p < 0.4) {
          // lie down slowly
          const q = p / 0.4;
          this.drawCreature(t, 0, 1, null, 1 - q * 0.5, 1 - q * 0.6);
        } else {
          // faded body + a little spirit floats up
          ctx.globalAlpha = 0.35;
          this.drawCreature(t, 0, 1, null, 0.5, 0.4);
          ctx.globalAlpha = 1;
          const q = (p - 0.4) / 0.6;
          const gy = FLOOR_Y - 10 - q * 44;
          ctx.globalAlpha = Math.max(0, 0.9 - q);
          ctx.fillStyle = "#f2f6ff";
          const gx = CREATURE_X + Math.sin(q * Math.PI * 3) * 4;
          ctx.fillRect(Math.round(gx) - 3, Math.round(gy) - 4, 6, 7);
          ctx.fillRect(Math.round(gx) - 4, Math.round(gy) - 2, 8, 4);
          ctx.fillStyle = "#3a2b3f";
          ctx.fillRect(Math.round(gx) - 2, Math.round(gy) - 2, 1, 2);
          ctx.fillRect(Math.round(gx) + 1, Math.round(gy) - 2, 1, 2);
          ctx.globalAlpha = 1;
        }
        break;
      }
    }

    if (p >= 1 && !act.finished) {
      act.finished = true;
      this.act = null;
      if (act.type === "poop" || act.type === "clean") {
        // Stay where it, uh, was. Take a slightly embarrassed beat.
        this.wanderX = act.data.dx as number;
        this.wanderY = act.data.dy as number;
        this.wanderTargetX = this.wanderX;
        this.wanderTargetY = this.wanderY;
      } else {
        // Settle back to center and take a beat before wandering again —
        // arriving home from an act lands with a plop.
        this.wanderX = 0;
        this.wanderY = 0;
        this.settleStart = now;
      }
      this.wanderPhase = "dwell";
      this.wanderUntil = now + 1200;
      act.onDone?.();
    }
  }

  /** Fetch choreography — each variant reads distinctly (see FetchVariant). */
  private drawFetch(act: Act, p: number, t: number): void {
    const FLOOR_Y = this.floorY;
    const dist = act.data.dist as number; // signed: negative throws go left
    const variant = act.data.variant as FetchVariant;
    const arc = act.data.arc as number;
    const lateral = act.data.lateral as number;
    const dir = Math.sign(dist) || 1;
    const targetX = CREATURE_X + dist;
    // The chase/return choreography below is all authored against the base
    // 2500ms timeline; hold variants get extra real time tacked on at the
    // end (see FETCH_HOLD_MS), so their thresholds run off `cp` — the same
    // curve, just clamped at 1 once the base timeline elapses, holding the
    // final pose (object in mouth, home) for the remaining hold beat.
    const cp = Math.min(1, (p * act.duration) / FETCH_DURATION);
    let dx = 0;
    let ball: { x: number; y: number } | null = null;
    let sock: { x: number; y: number } | null = null;
    let stick: { x: number; y: number } | null = null;

    const throwArc = (q: number) => ({
      x: CREATURE_X + q * dist + Math.sin(q * Math.PI) * lateral,
      y: FLOOR_Y - 6 - Math.sin(q * Math.PI) * (arc + 8),
    });
    // Where a carried object sits on the trot home: in the mouth — front of
    // the face (it runs back facing -dir), riding the same trot as the body.
    const mouth = (extraY = 0) => ({
      x: CREATURE_X + dx - 6 * dir,
      y: FLOOR_Y - 8 + trotBob(t) + extraY,
    });

    switch (variant) {
      case "overfence": {
        // The ball keeps climbing and sails off past the fence, gone.
        const bx = CREATURE_X + p * (dist + 60);
        const by = FLOOR_Y - 6 - Math.sin(Math.min(p * 1.5, 1) * Math.PI) * arc - p * 60;
        if (by > -6) ball = { x: bx, y: by };
        // trots out a little, then stops and watches it leave
        dx = Math.min(p / 0.35, 1) * (dist * 0.45);
        this.drawCreature(t, dx, 1, null);
        break;
      }

      case "wrongway": {
        if (p < 0.22) {
          const a = throwArc(p / 0.22);
          ball = a;
          this.drawCreature(t, 0, 1, null);
        } else {
          // sprints off in the *opposite* direction, fully committed
          const q = (p - 0.22) / 0.78;
          ball = { x: targetX, y: FLOOR_Y + 8 };
          dx = -dir * q * 42;
          this.drawCreature(t, dx, 1, -Math.abs(Math.sin(q * Math.PI * 6)) * 3);
        }
        break;
      }

      case "distracted": {
        if (p < 0.2) {
          const a = throwArc(p / 0.2);
          ball = a;
          this.drawCreature(t, 0, 1, null);
        } else {
          // ambles halfway, then just… stops. Sits down, even.
          const q = (p - 0.2) / 0.8;
          ball = { x: targetX, y: FLOOR_Y + 8 };
          dx = Math.min(q * 2, 1) * (dist * 0.4);
          const squash = q > 0.5 ? 1 - (q - 0.5) * 0.5 : 1;
          this.drawCreature(t, dx, 1, null, 1, squash);
        }
        break;
      }

      case "sock":
      case "stick": {
        // Full chase, but returns with the wrong object held proudly in its
        // mouth — then holds there a beat once home (see cp above).
        if (cp < 0.22) {
          ball = throwArc(cp / 0.22);
        } else if (cp < 0.5) {
          const q = (cp - 0.22) / 0.28;
          dx = q * dist;
          ball = { x: targetX, y: FLOOR_Y + 8 };
        } else if (cp < 0.66) {
          dx = dist;
          ball = { x: targetX, y: FLOOR_Y + 8 };
        } else {
          const q = (cp - 0.66) / 0.34;
          dx = (1 - q) * dist;
          if (variant === "sock") sock = mouth();
          else stick = mouth(2);
        }
        this.drawCreature(t, dx, 1, null);
        break;
      }

      case "whichway": {
        // The throw looks normal — then the ball simply stops existing. The
        // chase becomes a search: whipping side to side, hopping, no leads.
        if (p < 0.22) {
          ball = throwArc(p / 0.22);
          this.drawCreature(t, 0, 1, null);
        } else if (p < 0.45) {
          const q = (p - 0.22) / 0.23;
          dx = q * dist;
          this.drawCreature(t, dx, 1, null);
        } else {
          const q = (p - 0.45) / 0.55;
          dx = dist + Math.sin(q * Math.PI * 5) * 9; // facing flips with each whip
          const hop = Math.abs(Math.sin(q * Math.PI * 9)) * 2;
          this.drawCreature(t, dx, 1, -hop);
          if (Math.sin(t * 6) > -0.2) {
            this.drawQuestionMark(Math.round(CREATURE_X + dx), FLOOR_Y - 26);
          }
        }
        break;
      }

      case "cube": {
        // Normal chase out — but what comes back, slowly, reverently, hums —
        // then holds there once home, humming, a beat longer (see cp above).
        if (cp < 0.22) {
          ball = throwArc(cp / 0.22);
          this.drawCreature(t, 0, 1, null);
        } else if (cp < 0.48) {
          const q = (cp - 0.22) / 0.26;
          dx = q * dist;
          ball = { x: targetX, y: FLOOR_Y + 8 };
          this.drawCreature(t, dx, 1, null);
        } else if (cp < 0.62) {
          // a long, still moment at the ball. Something is decided.
          dx = dist;
          this.drawCreature(t, dx, 1, null);
        } else {
          // the slow walk home. The ball is gone. The cube is here.
          const q = (cp - 0.62) / 0.38;
          dx = (1 - q) * dist;
          this.drawCreature(t, dx, 1, null);
          const cx = CREATURE_X + dx + 7 * dir;
          const cy = FLOOR_Y + 1;
          this.ctx.drawImage(iconCanvas("cube"), Math.round(cx) - 4, Math.round(cy) - 5, 9, 9);
          this.drawSparkle(Math.round(cx) + 5, Math.round(cy) - 6, t * 5);
          this.drawSparkle(Math.round(cx) - 6, Math.round(cy) - 2, t * 5 + 2);
        }
        break;
      }

      case "epic": {
        // Runs out, leaps, snatches it mid-air, trots back triumphant.
        if (p < 0.35) {
          const q = p / 0.35;
          const a = throwArc(q);
          ball = a;
          dx = q * dist;
          this.drawCreature(t, dx, 1, -Math.abs(Math.sin(q * Math.PI * 3)) * 3);
        } else if (p < 0.45) {
          // the catch — a big hop up to the ball
          const q = (p - 0.35) / 0.1;
          const hop = Math.sin(q * Math.PI) * 12;
          dx = dist;
          ball = { x: targetX, y: FLOOR_Y - 6 - hop };
          this.drawCreature(t, dx, 1, -hop);
        } else {
          const q = (p - 0.45) / 0.55;
          dx = (1 - q) * dist;
          const hop = Math.abs(Math.sin(q * Math.PI * 3)) * 3;
          // Carried home in the mouth, riding the victory bounce.
          ball = { x: CREATURE_X + dx - 6 * dir, y: FLOOR_Y - 8 - hop };
          this.drawCreature(t, dx, 1, -hop);
        }
        break;
      }

      default: {
        // "return": chase, sniff, bring it back.
        if (p < 0.25) {
          ball = throwArc(p / 0.25);
        } else if (p < 0.55) {
          const q = (p - 0.25) / 0.3;
          dx = q * dist;
          ball = { x: targetX, y: FLOOR_Y + 8 };
        } else if (p < 0.7) {
          dx = dist;
          ball = { x: targetX, y: FLOOR_Y + 8 };
        } else {
          const q = (p - 0.7) / 0.3;
          dx = (1 - q) * dist;
          ball = mouth(); // trots it back in its mouth, not dragging it behind
        }
        this.drawCreature(t, dx, 1, null);
        break;
      }
    }

    if (ball) this.drawBall(ball.x, ball.y);
    if (sock) this.drawSock(sock.x, sock.y);
    if (stick) this.drawStick(stick.x, stick.y);
  }

  /**
   * The RPS ceremony: fists pump the count, moves reveal, then the winning
   * move slides across and flattens the loser — rock crushes, scissors cut,
   * paper covers. Ties knock together and bounce apart.
   */
  private drawRps(act: Act, p: number): void {
    const ctx = this.ctx;
    const player = act.data.player as IconName;
    const pet = act.data.pet as IconName;
    const outcome = act.data.outcome as "win" | "lose" | "tie";
    const SZ = RPS_ICON_SZ;
    const PX = RPS_PLAYER_X; // player's side
    const EX = 78; // pet's side
    const IY = RPS_ICON_Y;

    if (p < 0.42) {
      // countdown: two fists pump in sync
      const bob = Math.abs(Math.sin(p * Math.PI * 7)) * 6;
      ctx.drawImage(iconCanvas("fist"), PX, Math.round(IY + bob), SZ, SZ);
      ctx.drawImage(iconCanvas("fist"), EX, Math.round(IY + bob), SZ, SZ);
      return;
    }
    if (p < 0.58 || outcome === "tie") {
      // the reveal — for ties, a bump and a mutual recoil
      let nudge = 0;
      if (outcome === "tie" && p >= 0.58) {
        const q = (p - 0.58) / 0.42;
        nudge = Math.sin(Math.min(q * 2, 1) * Math.PI) * 8;
      }
      ctx.drawImage(iconCanvas(player), Math.round(PX + nudge), IY, SZ, SZ);
      ctx.drawImage(iconCanvas(pet), Math.round(EX - nudge), IY, SZ, SZ);
      return;
    }

    // Someone won: the winner lunges across; the loser crumples and drops.
    const q = (p - 0.58) / 0.42;
    const playerWon = outcome === "win";
    const [winIcon, winX0, loseIcon, loseX] = playerWon
      ? ([player, PX, pet, EX] as const)
      : ([pet, EX, player, PX] as const);
    const lunge = Math.min(1, q / 0.5);
    const winX = winX0 + (loseX - winX0) * lunge * lunge; // accelerating lunge

    if (q <= 0.5) {
      ctx.drawImage(iconCanvas(loseIcon), loseX, IY, SZ, SZ);
    } else {
      // contact: the loser tips over, fades, and slides off the bottom
      const f = (q - 0.5) / 0.5;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f * 1.3);
      ctx.translate(loseX + SZ / 2, IY + SZ / 2 + f * 26);
      ctx.rotate(f * 1.4);
      ctx.drawImage(iconCanvas(loseIcon), -SZ / 2, -SZ / 2, SZ, SZ);
      ctx.restore();
    }
    ctx.drawImage(iconCanvas(winIcon), Math.round(winX), IY, SZ, SZ);
  }

  // --- Ambient wander ----------------------------------------------------------
  /** Stroll the clearing: dwell, walk to a spot, react to a prop, repeat. */
  private updateWander(now: number): void {
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    const v = this.view;
    // Egg stays put; sleep, tantrum, flourish and the age-up suspend wandering.
    if (v.key === "egg" || v.asleep || v.tantrum || this.flourishing() || this.evolving()) {
      if (v.key === "egg") {
        this.wanderX = 0;
        this.wanderY = 0;
      }
      return;
    }

    // The zoomies override the ordinary cadence entirely: a giddy dash from
    // spot to spot, picking a new one the instant it arrives, for as long as
    // the burst lasts. It ends the moment the flag drops, settling with the
    // same plop a normal walk gets when it arrives somewhere.
    if (v.zoomies) {
      if (this.wanderPhase !== "zoom") {
        this.wanderPhase = "zoom";
        this.pickZoomTarget();
      }
      const step = ZOOM_SPEED * dt;
      const dxDiff = this.wanderTargetX - this.wanderX;
      const dyDiff = this.wanderTargetY - this.wanderY;
      const remaining = Math.hypot(dxDiff, dyDiff);
      if (remaining <= step + 0.4) {
        this.wanderX = this.wanderTargetX;
        this.wanderY = this.wanderTargetY;
        this.pickZoomTarget();
      } else {
        this.wanderX += (dxDiff / remaining) * step;
        this.wanderY += (dyDiff / remaining) * step;
      }
      return;
    }
    if (this.wanderPhase === "zoom") {
      this.wanderPhase = "dwell";
      this.wanderUntil = now + 600;
      this.settleStart = now; // skidded to a stop: plop
    }

    // Older creatures dwell longer, walk slower, and flop down more often.
    const activity = v.activity ?? 1;
    const dwellFor = () => (5000 + Math.random() * 5500) * (2 - activity);

    switch (this.wanderPhase) {
      case "dwell": {
        if (now >= this.wanderUntil) {
          // A little of the "stay put" bias from the overcorrected version,
          // halved rather than fully reverted or reapplied.
          if (Math.random() < 0.22 + 0.13 * (1 - activity)) {
            this.wanderUntil = now + dwellFor();
            break;
          }
          if (Math.random() < 0.11 + 0.53 * (1 - activity)) {
            // Take a breather: a big yawn, then blob down for a while.
            this.wanderPhase = "yawn";
            this.phaseStart = now;
            this.wanderUntil = now + 1100;
            break;
          }
          if (Math.random() < 0.14) {
            // Off to perch on the stump for a spell.
            this.wanderTargetX = STUMP_SEAT_DX;
            this.wanderTargetY = 0;
            this.wanderProp = "seat";
            this.wanderPhase = "walk";
            break;
          }
          const target = WANDER_TARGETS[Math.floor(Math.random() * WANDER_TARGETS.length)];
          this.wanderTargetX = target.dx;
          this.wanderTargetY = target.dy;
          this.wanderProp = target.prop;
          this.wanderPhase = "walk";
        }
        break;
      }
      case "walk": {
        // Walk the ground plane as a straight line in (x, depth).
        const step = WALK_SPEED * (0.55 + 0.45 * activity) * dt;
        const dxDiff = this.wanderTargetX - this.wanderX;
        const dyDiff = this.wanderTargetY - this.wanderY;
        const remaining = Math.hypot(dxDiff, dyDiff);
        if (remaining <= step + 0.4) {
          this.wanderX = this.wanderTargetX;
          this.wanderY = this.wanderTargetY;
          if (this.wanderProp === "seat") {
            this.wanderPhase = "sitdown";
            this.phaseStart = now;
            this.wanderUntil = now + 560;
          } else if (this.wanderProp) {
            this.wanderPhase = "interact";
            this.wanderUntil = now + 1200;
          } else {
            this.wanderPhase = "dwell";
            this.wanderUntil = now + dwellFor();
            this.settleStart = now; // arrived: plop down into the grass
          }
        } else {
          this.wanderX += (dxDiff / remaining) * step;
          this.wanderY += (dyDiff / remaining) * step;
        }
        break;
      }
      case "interact": {
        if (now >= this.wanderUntil) {
          this.wanderPhase = "dwell";
          this.wanderUntil = now + dwellFor();
        }
        break;
      }
      case "sitdown": {
        if (now >= this.wanderUntil) {
          this.wanderPhase = "sit";
          this.wanderUntil = now + (3600 + Math.random() * 4600) * (2 - activity);
        }
        break;
      }
      case "sit": {
        if (now >= this.wanderUntil) {
          this.wanderPhase = "situp";
          this.phaseStart = now;
          this.wanderUntil = now + 480;
        }
        break;
      }
      case "situp": {
        if (now >= this.wanderUntil) {
          this.wanderPhase = "dwell";
          this.wanderUntil = now + dwellFor();
          this.settleStart = now; // landed: plop
        }
        break;
      }
      case "yawn": {
        if (now >= this.wanderUntil) {
          // Most yawns settle into a proper rest; some are just yawns.
          if (Math.random() < 0.75) {
            this.wanderPhase = "rest";
            this.phaseStart = now;
            this.wanderUntil = now + (4000 + Math.random() * 5000) * (2 - activity);
          } else {
            this.wanderPhase = "dwell";
            this.wanderUntil = now + dwellFor();
          }
        }
        break;
      }
      case "rest": {
        if (now >= this.wanderUntil) {
          this.wanderPhase = "dwell";
          this.wanderUntil = now + dwellFor();
        }
        break;
      }
    }
  }

  /** A fresh spot to dash to mid-zoomies. Reuses the ordinary wander spots but
   *  ignores their prop — the zoomies never stop to sniff anything. */
  private pickZoomTarget(): void {
    const target = WANDER_TARGETS[Math.floor(Math.random() * WANDER_TARGETS.length)];
    this.wanderTargetX = target.dx;
    this.wanderTargetY = target.dy;
  }

  /** The bob (negative = up) that rests the creature's *real* feet on the
   *  stump's sawn top. Feet sit `12 - squashY·cw·bottomFrac` px below the
   *  ground line (bottomFrac = empty rows under the sprite); we want them at
   *  the cut, `STUMP_SEAT_TOP_DY` px below it. Squash is folded in so the plop
   *  keeps the feet planted instead of sinking through the wood. Pure math on
   *  cached inputs — could be unit-tested. */
  private seatBob(squashY: number, cw: number): number {
    const footBelowGround = 12 - squashY * cw * this.seatBottomFrac;
    return STUMP_SEAT_TOP_DY - footBelowGround;
  }

  /**
   * The ambient (non-act) motion of the creature: tantrum, flourish, walking,
   * prop reaction, or a per-personality idle. Returns bob + deformations.
   */
  private ambientMotion(
    t: number,
    key: string,
  ): { bob: number; dx: number; sx: number; sy: number; rot: number } {
    const v = this.view;
    const m = { bob: 0, dx: 0, sx: 1, sy: 1, rot: 0 };

    // The age-up owns the body outright — nothing else gets a say while it runs.
    if (this.evolving()) return this.evolveMotion();
    if (v.asleep) {
      // Settle down into the grass like a little loaf, breathing slowly —
      // unmistakably asleep, not just standing there with its eyes shut.
      const settle = Math.min(1, (performance.now() - this.sleepStart) / 700);
      m.sy = 1 - settle * (0.16 - Math.sin(t * 1.1) * 0.015);
      m.sx = 1 + settle * 0.1;
      m.bob = settle * 2;
      return m;
    }
    if (v.tantrum) {
      // Unmistakably throwing a fit: fast little stomps, jitter, a jerky lean.
      m.bob = -Math.abs(Math.sin(t * 14)) * 3;
      m.dx = Math.sin(t * 22) * 2;
      m.sy = 1 + Math.sin(t * 14) * 0.06;
      m.rot = Math.sin(t * 18) * 0.05;
      return m;
    }
    if (this.flourishing()) return this.flourishMotion(t, key);
    if (this.wanderPhase === "yawn") {
      // a huge stretch up onto tiptoes, then a slump back down
      const q = Math.min(1, (performance.now() - this.phaseStart) / 1100);
      const env = Math.sin(q * Math.PI);
      m.sy = 1 + env * 0.22;
      m.sx = 1 - env * 0.12;
      m.bob = -env * 2.5;
      m.rot = -env * 0.06;
      return m;
    }
    if (this.wanderPhase === "rest") {
      // blobbed down flat, breathing slowly. Bliss.
      const settle = Math.min(1, (performance.now() - this.phaseStart) / 600);
      m.sy = 1 - settle * (0.22 - Math.sin(t * 1.1) * 0.015);
      m.sx = 1 + settle * 0.14;
      m.bob = settle * 2.5;
      return m;
    }
    if (this.wanderPhase === "walk") {
      // a clean hop along the ground — no side-to-side rock, just bounce,
      // with a touch of squash-stretch to sell the airborne moment
      const phase = Math.abs(Math.sin(t * 9));
      m.bob = -phase * 3;
      m.sy = 1 + phase * 0.1;
      m.sx = 1 - phase * 0.06;
      m.rot = this.facing * 0.05; // leans into where it's going
      return m;
    }
    if (this.wanderPhase === "zoom") {
      // The zoomies: the same trot, cranked — a much faster, bouncier blur.
      const phase = Math.abs(Math.sin(t * 22));
      m.bob = -phase * 4;
      m.sy = 1 + phase * 0.16;
      m.sx = 1 - phase * 0.1;
      m.rot = this.facing * 0.09;
      return m;
    }
    if (this.wanderPhase === "interact") {
      // lean in and give it a proper investigative sniff
      m.rot = 0.06;
      m.bob = 1 + Math.sin(t * 8) * 0.7;
      m.sy = 1 + Math.sin(t * 8) * 0.02;
      return m;
    }
    // The perch lift is per-sprite (seatBob); wanderY is 0 while seated, so cw
    // matches the fixed-y stump exactly and the feet don't desync from it.
    const seatCw = CELL * 3 * this.depthScale(this.wanderY);
    if (this.wanderPhase === "sitdown") {
      // Hop up onto the stump, then the mushy settle onto the cut.
      const q = Math.min(1, (performance.now() - this.phaseStart) / 560);
      if (q < 0.45) {
        const a = q / 0.45; // airborne: an eager little arc up
        m.sy = 1.06;
        m.sx = 0.96;
        m.bob = this.seatBob(m.sy, seatCw) * a - Math.sin(a * Math.PI) * 7;
      } else {
        const p = plopSquash((q - 0.45) / 0.55); // contact: the mush
        m.sy = p.sy;
        m.sx = p.sx;
        m.bob = this.seatBob(m.sy, seatCw);
      }
      return m;
    }
    if (this.wanderPhase === "sit") {
      // Perched: settled into a soft loaf, breathing, tail going if it has one.
      m.sy = 0.86 + Math.sin(t * 1.4) * 0.018;
      m.sx = 1.1;
      m.bob = this.seatBob(m.sy, seatCw);
      if (key === "dog" && quirk(t, 13.5, 1.6, 1.3) >= 0) {
        this.altFrame = Math.sin(t * 16) > 0; // a lazy seated wag
      }
      return m;
    }
    if (this.wanderPhase === "situp") {
      // Hop down off the stump; the landing plop happens back in dwell.
      const q = Math.min(1, (performance.now() - this.phaseStart) / 480);
      m.sy = 1.05;
      m.sx = 0.97;
      m.bob = this.seatBob(m.sy, seatCw) * (1 - q) - Math.sin(q * Math.PI) * 6;
      return m;
    }
    const idle = this.idleMotion(t, key);
    // A fresh arrival plops: deep squash, small rebound, settle.
    const sq = (performance.now() - this.settleStart) / 380;
    if (sq < 1) {
      const p = plopSquash(sq);
      idle.sy *= p.sy;
      idle.sx *= p.sx;
    }
    return idle;
  }

  /** Per-creature idle: same clearing, very different body language. On top
   *  of each form's continuous idle, a signature move plays every several
   *  seconds (periods are staggered so no two moves sync up). */
  private idleMotion(
    t: number,
    key: string,
  ): { bob: number; dx: number; sx: number; sy: number; rot: number } {
    const m = { bob: 0, dx: 0, sx: 1, sy: 1, rot: 0 };
    let q: number;
    switch (key) {
      case "dog":
        m.bob = -Math.abs(Math.sin(t * 3)) * 2.6; // eager little bounces
        if ((q = quirk(t, 15.5, 1.5)) >= 0) {
          // The wag: tail thumps up and down, hindquarters can't stay still.
          const env = Math.sin(q * Math.PI);
          this.altFrame = Math.sin(t * 20) > 0;
          m.dx = Math.sin(t * 17) * 1.1 * env;
          m.bob = -Math.abs(Math.sin(t * 6)) * 2 * env;
        }
        break;
      case "blob":
        m.bob = Math.sin(t * 1.6) * 0.8;
        m.sy = 1 + Math.sin(t * 3) * 0.05; // gelatinous wobble
        m.sx = 1 - Math.sin(t * 3) * 0.04;
        if ((q = quirk(t, 22.5, 2.4)) >= 0) {
          // The melt: slumps into a puddle of itself, quivers, reforms.
          const env = Math.sin(q * Math.PI);
          m.sy *= 1 - env * 0.34;
          m.sx *= 1 + env * 0.4;
          m.bob += env * 3;
          if (q > 0.7) m.sy *= 1 + Math.sin(t * 22) * 0.03; // the jiggly reform
        }
        break;
      case "gremlin":
        m.bob = Math.sin(t * 2.4) * 1.4;
        m.dx = Math.sin(t * 5.5) * 0.6; // twitchy, up to something
        if ((q = quirk(t, 17.5, 1.3)) >= 0) {
          // The case-of-the-place: eyes dart one way, then the other.
          this.forceGlance = q < 0.5 ? -1 : 1;
          m.dx += (q < 0.5 ? -1 : 1) * 1.2;
          m.rot = (q < 0.5 ? -1 : 1) * 0.05;
        }
        break;
      case "scholar":
        m.bob = Math.sin(t * 1.4) * 0.9;
        m.rot = Math.sin(t * 0.8) * 0.03; // a contemplative nod
        if ((q = quirk(t, 20.5, 1.7)) >= 0) {
          // A thought lands: two slow, convinced nods at the middle distance.
          m.rot += Math.sin(q * Math.PI * 2) * 0.09;
          m.bob += Math.sin(q * Math.PI * 2) * 1.2;
          this.forceGlance = 1;
        }
        break;
      case "office":
        m.bob = Math.sin(t * 1.1) * 0.6;
        m.sy = 0.98; // a permanent, weary slump
        if ((q = quirk(t, 24.5, 2.5)) >= 0) {
          // The sigh: a long inhale up, held, then everything lets go.
          m.sy *= 1 + Math.sin(q * Math.PI * 2) * 0.055;
          m.bob += -Math.sin(q * Math.PI * 2) * 1.6;
          m.rot = q > 0.5 ? Math.sin((q - 0.5) * Math.PI * 2) * 0.05 : 0;
        }
        break;
      case "menace":
        m.bob = Math.sin(t * 1.0) * 0.7;
        m.rot = Math.sin(t * 0.6) * 0.02; // haughtily still, chin up
        if ((q = quirk(t, 21.5, 2.0)) >= 0) {
          // The appraisal: a slow head-tilt, a long sideways look, judgment.
          m.rot += Math.sin(q * Math.PI) * 0.13;
          this.forceGlance = -1;
        }
        break;
      case "ghost":
        m.bob = Math.sin(t * 1.6) * 3 - 5; // hovers off the grass
        m.dx = Math.sin(t * 0.8) * 1.5; // drifting, never quite anchored
        if ((q = quirk(t, 18.5, 1.4)) >= 0) {
          // The flicker: briefly less here than usual.
          this.extraAlpha = 0.45 + 0.55 * Math.abs(Math.cos(q * Math.PI * 3));
        }
        break;
      case "humcube":
        m.bob = Math.sin(t * 1.3) * 1.0;
        if ((q = quirk(t, 16.5, 1.8)) >= 0) {
          // The hum, visible: the whole lattice pulses in time.
          const env = Math.sin(q * Math.PI);
          m.sy *= 1 + Math.sin(t * 14) * 0.035 * env;
          m.sx *= 1 - Math.sin(t * 14) * 0.03 * env;
        }
        break;
      case "carrot":
        m.bob = Math.sin(t * 2.4) * 1.2;
        m.rot = Math.sin(t * 1.7) * 0.05; // teetering on its tip, serenely
        if ((q = quirk(t, 16.9, 0.9)) >= 0) {
          // The greens shake themselves out, like a tiny wet dog.
          m.rot += Math.sin(t * 30) * 0.06 * Math.sin(q * Math.PI);
          m.bob -= Math.sin(q * Math.PI) * 1.2;
        }
        break;
      case "cosmos":
        m.bob = Math.sin(t * 1.15) * 1.6 - 3; // held a little aloft, drifting
        m.dx = Math.sin(t * 0.6) * 1.2; // never quite anchored to the ground
        // The shimmer: the whole nebula breathes like far starlight, always —
        // with an occasional deeper twinkle laid over it.
        this.extraAlpha = 0.82 + 0.18 * Math.sin(t * 2.2);
        if ((q = quirk(t, 16.7, 1.2)) >= 0) {
          this.extraAlpha = 0.55 + 0.45 * Math.abs(Math.cos(q * Math.PI * 3));
        }
        break;
      case "mole":
        m.bob = Math.sin(t * 3.4) * 0.5; // small and quick — the claws never stop
        if ((q = quirk(t, 19.5, 2)) >= 0) {
          // Surfacing: rises up out of the work, squints at the daylight, thinks
          // better of the whole thing, and sinks back into the tunnel.
          const env = Math.sin(q * Math.PI);
          m.bob -= env * 2.6;
          m.sy *= 1 + env * 0.05;
          this.forceGlance = 1;
        }
        break;
      case "baby":
        m.bob = Math.sin(t * 2.6) * 1.6;
        m.dx = Math.sin(t * 6) * 0.5; // a delighted wiggle
        if ((q = quirk(t, 12.5, 1.2)) >= 0) {
          // Sheer joy arrives and must be bounced out.
          m.bob = -Math.abs(Math.sin(t * 11)) * 3.2 * Math.sin(q * Math.PI);
        }
        break;
      case "child":
        m.bob = -Math.abs(Math.sin(t * 2.2)) * 1.6; // can't stop hopping
        if ((q = quirk(t, 19.5, 1.2)) >= 0) {
          // A hop with a cheeky half-twirl out and back — the full 360 stays
          // reserved for the happy pulse, so a spin still means something.
          const env = Math.sin(q * Math.PI);
          m.rot = env * Math.PI; // out to a half-turn, then unwound
          m.bob -= env * 5;
        }
        break;
      case "teen":
        m.bob = Math.sin(t * 1.2) * 0.8;
        m.rot = 0.04; // a practiced slouch
        if ((q = quirk(t, 25.5, 1.3)) >= 0) {
          // The hair flip: up, back, and returned to the slouch, unbothered.
          m.rot -= Math.sin(q * Math.PI) * 0.13;
          m.bob -= Math.sin(q * Math.PI) * 2;
        }
        break;
      default:
        m.bob = Math.sin(t * 2) * 1.5;
    }
    m.bob *= IDLE_WIGGLE_SCALE;
    m.dx *= IDLE_WIGGLE_SCALE;
    m.rot *= IDLE_WIGGLE_SCALE;
    m.sx = 1 + (m.sx - 1) * IDLE_WIGGLE_SCALE;
    m.sy = 1 + (m.sy - 1) * IDLE_WIGGLE_SCALE;
    return m;
  }

  /** The rare flourish — a joyful spin/hop, flavoured a little by personality. */
  private flourishMotion(
    t: number,
    key: string,
  ): { bob: number; dx: number; sx: number; sy: number; rot: number } {
    const p = Math.min(1, (performance.now() - this.flourishStart) / (FLOURISH_DUR * 1000));
    const env = Math.sin(p * Math.PI); // 0→1→0 over the flourish
    const m = { bob: 0, dx: 0, sx: 1, sy: 1, rot: 0 };
    // A double hop for everyone…
    m.bob = -Math.abs(Math.sin(p * Math.PI * 2)) * 10 * env;
    switch (key) {
      case "dog":
      case "child":
        m.rot = p * Math.PI * 2; // an exuberant full spin
        break;
      case "gremlin":
        m.dx = Math.sin(p * Math.PI * 12) * 4 * env; // a gleeful shimmy
        m.rot = Math.sin(p * Math.PI * 6) * 0.2;
        break;
      case "blob":
        m.sy = 1 + Math.sin(p * Math.PI * 3) * 0.25 * env; // big squash bounce
        m.sx = 1 - Math.sin(p * Math.PI * 3) * 0.18 * env;
        break;
      case "ghost":
        m.dx = Math.sin(p * Math.PI * 2) * 8; // a slow spectral loop
        m.bob = -env * 14 + Math.sin(t * 3) * 2;
        break;
      case "menace":
      case "office":
        m.rot = Math.sin(p * Math.PI * 2) * 0.25; // a dignified little sway
        break;
      default:
        m.rot = p * Math.PI * 2;
    }
    return m;
  }

  /** The age-up body shape: coil down (anticipation), spring up tall through
   *  the flash, then plop back to itself. The white flash + burst are drawn
   *  separately; this just deforms the body so the swap doesn't pop. */
  private evolveMotion(): { bob: number; dx: number; sx: number; sy: number; rot: number } {
    const p = this.evolveP();
    const m = { bob: 0, dx: 0, sx: 1, sy: 1, rot: 0 };
    if (p < 0.35) {
      const a = p / 0.35; // gather: squash down and widen
      m.sy = 1 - a * 0.24;
      m.sx = 1 + a * 0.18;
      m.bob = a * 3;
      m.rot = Math.sin(a * Math.PI * 3) * 0.04; // a held shiver
    } else if (p < 0.6) {
      const env = Math.sin(((p - 0.35) / 0.25) * Math.PI); // launch up and back
      m.sy = 1 + env * 0.3;
      m.sx = 1 - env * 0.16;
      m.bob = -env * 10;
    } else {
      const s = plopSquash((p - 0.6) / 0.4); // arrive: the new form settles in
      m.sy = s.sy;
      m.sx = s.sx;
    }
    return m;
  }

  /**
   * Draw the creature. `dxAct` shifts it, `scaleMul` scales it (acts),
   * `hopY` overrides bob, `deathSquashX/Y` deform for the death pose, and
   * `dy` places it in depth on the ground plane (perspective-scales it too).
   * When idle (no act, no hop override) the ambient motion layer drives it.
   */
  private drawCreature(
    t: number,
    dxAct: number,
    scaleMul: number,
    hopY: number | null,
    deathSquashX?: number,
    deathSquashY?: number,
    dy = 0,
  ): void {
    const ctx = this.ctx;
    const v = this.view;
    const night = isNightSky(v.sky);
    const dark = night && !v.lightsOn;
    const scale = 3 * scaleMul * this.depthScale(dy);
    // Round to a whole buffer pixel like the translate origin below — dy (and
    // so depthScale) crawls continuously while walking, and drawing a
    // fractional-width sprite every frame is what reads as fuzzy on the move;
    // idle rarely triggers it since dy sits still.
    const cw = Math.round(CELL * scale);
    const isGhost = v.key === "ghost";
    const ambient = this.act === null && hopY === null;

    // Per-frame micro-animation flags; motion code below may raise them.
    this.altFrame = false;
    this.forceGlance = 0;
    this.extraAlpha = 1;

    // Face the way we're moving. Facing derives from *positional* movement
    // only — ambient jitter (tantrum shimmy, shake pulses) never flips it.
    const step = dxAct - this.prevPosDx;
    if (Math.abs(step) > 0.12) {
      this.facing = step > 0 ? 1 : -1;
    }
    this.prevPosDx = dxAct;

    // Idle bob + pulse-driven transforms.
    let bob = hopY !== null ? hopY : Math.sin(t * 2) * 1.5;
    let squashY = deathSquashY ?? 1;
    let squashX = deathSquashX ?? 1;
    let dx = dxAct;
    let rot = 0;

    if (ambient) {
      const m = this.ambientMotion(t, v.key);
      bob = m.bob;
      dx += m.dx;
      squashX *= m.sx;
      squashY *= m.sy;
      rot += m.rot;
    } else {
      // Act context. Any leg of choreography that's actually travelling gets
      // the trot: bounce, a lean into the direction, squash on each landing —
      // so chases and carries read as running, not sliding.
      const moving = hopY === null && !v.asleep && Math.abs(step) > 0.2;
      if (moving) {
        const ph = Math.abs(Math.sin(t * 9));
        bob = trotBob(t);
        squashY *= 1 + ph * 0.08;
        squashX *= 1 - ph * 0.05;
        rot += this.facing * 0.05;
      }
      if (v.asleep) {
        bob = 2;
        squashY = 0.86 + Math.sin(t * 1.1) * 0.015;
        squashX = 1.1;
      }
      if (isGhost && hopY === null && !moving) {
        bob = Math.sin(t * 1.6) * 3 - 5;
      }
    }

    const pdt = (performance.now() - this.pulseStart) / 1000;
    if (this.pulse !== "none" && pdt < 0.6 && !this.evolving()) {
      const p = pdt / 0.6;
      if (this.pulse === "happy" || this.pulse === "eat" || this.pulse === "love") {
        bob -= Math.abs(Math.sin(p * Math.PI * 3)) * 6;
        squashY *= 1 + Math.sin(p * Math.PI * 2) * 0.08;
      } else if (this.pulse === "shake") {
        dx += Math.sin(p * Math.PI * 8) * 4;
      } else if (this.pulse === "nudge") {
        // the smallest acknowledgment: a single squish, no fanfare
        squashY *= 1 - Math.sin(p * Math.PI) * 0.08;
        squashX *= 1 + Math.sin(p * Math.PI) * 0.05;
      } else if (this.pulse === "evolve") {
        rot = Math.sin(p * Math.PI * 6) * 0.15;
        squashX *= 1 + Math.sin(p * Math.PI * 4) * 0.1;
      }
    } else if (v.key === "egg" && ambient) {
      // Egg rocks periodically.
      rot = Math.sin(t * 1.5) * 0.06;
    }

    this.curDx = dx;
    this.curDy = dy;
    const groundY = this.floorY + dy;

    // A mole doesn't sleep on the grass — it digs in. Once the loaf-settle has
    // landed it sinks straight down through the floor, clipped at the soil line
    // so it vanishes into the earth rather than drawing over the meadow, and the
    // displaced dirt piles into a molehill on top. The Zzz are anchored to the
    // ground rather than the sprite, so they go on drifting up out of the mound
    // and the burrow still reads as sleep and not as a pet that despawned.
    const burrow = v.key === "mole" ? this.burrowAmount() : 0;
    const soilY = Math.round(groundY + 12); // where the feet meet the earth
    bob += burrow * (cw + 2);

    // --- Face life: quirk-driven glances only (no idle blink/glance jitter) -
    let sprite = this.creatureCanvas;
    if (v.asleep) {
      if (performance.now() < this.crackEyeUntil) {
        sprite = this.frames.peek; // poked — one eye cracks open
      }
    } else if (v.key !== "egg") {
      if (performance.now() < this.patSquintUntil) {
        sprite = this.frames.blink; // eyes shut, savouring the pat
      } else if (this.altFrame) {
        sprite = this.frames.alt;
      } else if (this.forceGlance !== 0) {
        sprite = this.forceGlance === -1 ? this.frames.glanceL : this.frames.glanceR;
      }
    }

    // Soft shadow (fainter under a hovering ghost). While perched, the ground
    // shadow would fall through the stump's trunk — so blend it into a small
    // contact shadow on the sawn top, following the feet up off the grass
    // (sitdown/situp) and settling onto the wood (sit). `s` runs 0 = on the
    // grass → 1 = resting on the cut, read straight off how far the seat lift
    // has carried the feet.
    const shW = cw * squashX * (isGhost ? 0.5 : 0.7);
    // Moonlit ground gives a softer, cooler-toned shadow than daylight's hard black.
    const shRgb = dark ? "12,10,36" : "0,0,0";
    // Nothing casts a shadow on ground it's underneath — fade it out as it digs.
    const shMul = (dark ? 0.65 : 1) * (1 - burrow);
    const seated =
      ambient &&
      (this.wanderPhase === "sitdown" ||
        this.wanderPhase === "sit" ||
        this.wanderPhase === "situp");
    if (seated) {
      const sb = this.seatBob(squashY, cw);
      const s = sb !== 0 ? Math.max(0, Math.min(1, bob / sb)) : 1;
      if (s < 1) {
        // still near the grass: a ground shadow that shrinks and fades away
        ctx.fillStyle = `rgba(${shRgb},${0.3 * shMul * (1 - s)})`;
        const w = shW * (1 - s * 0.45);
        ctx.fillRect(Math.round(CREATURE_X + dx - w / 2), Math.round(groundY + 6), Math.round(w), 3);
      }
      if (s > 0) {
        // landed on the cut: a small contact shadow, hard-edged like the wood
        // it sits on and tucked inside the rim, right under the feet
        ctx.fillStyle = `rgba(${shRgb},${0.22 * shMul * s})`;
        const scx = Math.round(CREATURE_X + dx);
        const sy = this.floorY + STUMP_SEAT_TOP_DY;
        ctx.fillRect(scx - 4, sy - 1, 9, 1);
        ctx.fillRect(scx - 5, sy, 11, 1);
      }
    } else {
      ctx.fillStyle = isGhost
        ? `rgba(${shRgb},${0.16 * shMul})`
        : `rgba(${shRgb},${0.3 * shMul})`;
      ctx.fillRect(
        Math.round(CREATURE_X + dx - shW / 2),
        Math.round(groundY + 6),
        Math.round(shW),
        3,
      );
    }

    const baseY = groundY - cw + 12;
    // The egg never travels, so it never flips.
    const flip = v.key === "egg" ? 1 : this.facing;
    // Snap the draw origin to the buffer's integer pixel grid. Drawing the
    // 3×-scaled sprite at a fractional origin makes its pixels crawl frame to
    // frame (a shimmer) — invisible while it's travelling across the scene, but
    // the *only* motion when it's idling in place, where it reads as jitter.
    const cx = Math.round(CREATURE_X + dx);
    // Anchor at the feet so vertical squash reads as sitting into the ground
    // instead of floating up off it.
    const feetY = Math.round(baseY + cw + bob);
    // Clip to the soil line while it's underground: the sprite is *below* the
    // meadow now, and without this it would draw straight over the grass.
    if (burrow > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, SCENE_W, soilY);
      ctx.clip();
    }
    this.drawSpriteQuantized(
      sprite,
      cx,
      feetY,
      cw * squashX,
      cw * squashY,
      rot,
      flip,
      this.extraAlpha, // ghost flicker
    );
    // The evolve flash: a pure-white silhouette bloomed over the sprite at the
    // peak of the transform — whatever the frame, old or new, it's just white,
    // so the stage swap underneath never shows.
    const flash = this.evolveFlash();
    if (flash > 0) {
      this.drawSpriteQuantized(
        this.whiteFrame(sprite),
        cx,
        feetY,
        cw * squashX,
        cw * squashY,
        rot,
        flip,
        this.extraAlpha * flash,
      );
    }
    // Drop the soil-line clip, then pile the earth on top of it.
    if (burrow > 0) {
      ctx.restore();
      this.drawMolehill(cx, soilY, burrow, dark, night);
    }
  }

  /**
   * How far the mole is into the earth: 0 = standing on the grass, 1 = fully
   * under, with only its molehill left on the surface. It digs in a beat after
   * the loaf-settle lands (so you see it flatten, *then* dig), and climbs back
   * out a little quicker than it went down.
   */
  private burrowAmount(): number {
    const ease = (q: number): number => {
      const c = Math.max(0, Math.min(1, q));
      return c * c * (3 - 2 * c);
    };
    const since = (performance.now() - (this.view.asleep ? this.sleepStart : this.wakeStart)) / 1000;
    // wakeStart is -Infinity until the first wake, which lands this at 0 — an
    // awake mole that has never slept is simply on the surface, as it should be.
    return this.view.asleep ? ease((since - 0.7) / 1.2) : ease(1 - since / 0.8);
  }

  /**
   * The molehill a sleeping mole leaves on the surface: the earth it displaced,
   * piled up over the tunnel mouth. Grows with the dig, and the mouth of the
   * tunnel opens at the crest once it's most of the way down. Integer rows only
   * — this has to sit on the same pixel grid as the meadow it's made of.
   */
  private drawMolehill(cx: number, soilY: number, p: number, dark: boolean, night: boolean): void {
    if (p <= 0) return;
    const ctx = this.ctx;
    // Freshly turned earth, deliberately *not* the trodden dirt patch's colour —
    // the mound sits directly on that patch, and matching it makes the molehill
    // disappear into the ground, which reads as the pet despawning rather than
    // digging in. Lighter than the patch so it catches the light as a raised heap.
    const soil = dark ? "#4c4234" : night ? "#6f5a42" : "#a67f47";
    const shade = dark ? "#332c22" : night ? "#54432f" : "#82602f";
    const crest = dark ? "#5d5142" : night ? "#846d51" : "#c49a5c";
    const mouth = dark ? "#15110c" : night ? "#241c12" : "#3b2b18";
    const h = Math.max(1, Math.round(p * 7));
    const baseHw = Math.round(4 + p * 6);
    // Domed, not a trapezoid: a linear taper builds a tent with straight sides
    // and a flat top, which reads as a pitched roof rather than a heap of loose
    // earth. Squaring the term rounds the shoulders and narrows the crest.
    const halfWidth = (i: number): number =>
      Math.max(0, Math.round(baseHw * (1 - (i / h) ** 2)));
    for (let i = 0; i < h; i++) {
      const y = soilY - 1 - i;
      const hw = halfWidth(i);
      // Base sits in its own shadow; the crest catches the light.
      ctx.fillStyle = i < 2 ? shade : i === h - 1 ? crest : soil;
      ctx.fillRect(cx - hw, y, hw * 2 + 1, 1);
    }
    // Crumbs of turned earth flung out around the base.
    ctx.fillStyle = shade;
    for (let k = 0; k < 4; k++) {
      const sx = cx + (k % 2 === 0 ? -1 : 1) * (baseHw + 1 + ((k * 3) % 3));
      if ((sx ^ soilY) & 1) ctx.fillRect(sx, soilY - 1, 1, 1);
    }
    // The tunnel mouth: sunk *into* the crest, never proud of it. Drawn only on
    // rows whose soil is wide enough to leave a lip of earth on either side, so
    // it reads as a hole in the mound instead of a box balanced on top of one.
    const open = Math.max(0, (p - 0.6) / 0.4);
    if (open > 0) {
      const hw = Math.round(open * 1.5);
      ctx.fillStyle = mouth;
      for (let i = h - 1; i >= 0 && i >= h - 2; i--) {
        if (halfWidth(i) <= hw) continue; // no lip left — would breach the side
        ctx.fillRect(cx - hw, soilY - 1 - i, hw * 2 + 1, 1);
      }
    }
  }

  /**
   * Draw a sprite frame deformed only on the pixel grid. Continuous
   * ctx.scale/rotate resamples the 16×16 art off-grid at this buffer size —
   * one eye lands on 3 buffer px while its twin gets 2, and rotation shears
   * stray pixels off the outline. Instead, every source row is drawn as its
   * own strip: squash varies strip heights by ±1px (no row of anatomy can
   * ever drop out), each strip is an integer-aligned axis-aligned drawImage
   * (nearest-neighbour sampling of those is mirror-symmetric, so paired
   * features like eyes always come out equal), and rotation becomes an
   * integer per-row shear — the pixel-art lean. `cx` is the horizontal
   * centre, `feetY` the bottom edge, `w`/`h` the desired size in buffer px.
   */
  private drawSpriteQuantized(
    sprite: HTMLCanvasElement,
    cx: number,
    feetY: number,
    w: number,
    h: number,
    rot: number,
    flip: number,
    alpha: number,
  ): void {
    const ctx = this.ctx;
    const src = flip < 0 ? this.mirrorFrame(sprite) : sprite;
    const sw = src.width;
    const sh = src.height;
    const dw = Math.max(1, Math.round(w));
    const dh = Math.max(1, Math.round(h));
    const left = Math.round(cx - dw / 2);
    const top = feetY - dh;
    const prevAlpha = ctx.globalAlpha;
    if (alpha < 1) ctx.globalAlpha = prevAlpha * alpha;
    if (rot === 0 && dh >= sh) {
      ctx.drawImage(src, left, top, dw, dh);
    } else {
      // Rotation is world-space (never mirrored with the sprite), matching
      // the old ctx.rotate-before-flip order — callers bake facing into rot.
      const pivot = top + dh / 2;
      for (let r = 0; r < sh; r++) {
        const y0 = Math.round((r * dh) / sh);
        const y1 = Math.round(((r + 1) * dh) / sh);
        if (y1 <= y0) continue; // only when squashed below 1px per row
        const shear = rot ? Math.round(-rot * (top + (y0 + y1) / 2 - pivot)) : 0;
        ctx.drawImage(src, 0, r, sw, 1, left + shear, top + y0, dw, y1 - y0);
      }
    }
    ctx.globalAlpha = prevAlpha;
  }

  /** A horizontally mirrored copy of a sprite frame, cached per source —
   *  flipping via a prebuilt canvas keeps the scene draw free of transforms,
   *  so every blit stays on the integer pixel grid. */
  private mirrorFrame(src: HTMLCanvasElement): HTMLCanvasElement {
    let m = this.mirrorCache.get(src);
    if (!m) {
      m = document.createElement("canvas");
      m.width = src.width;
      m.height = src.height;
      const c = m.getContext("2d")!;
      c.translate(src.width, 0);
      c.scale(-1, 1);
      c.drawImage(src, 0, 0);
      this.mirrorCache.set(src, m);
    }
    return m;
  }

  /** Whitness of the evolve flash, 0..1, peaking as the new form springs up. */
  private evolveFlash(): number {
    if (!this.evolving()) return 0;
    const p = this.evolveP();
    if (p < 0.2 || p > 0.72) return 0;
    return Math.sin(((p - 0.2) / 0.52) * Math.PI); // 0→1→0 across the peak
  }

  /** A pure-white copy of a sprite frame (its silhouette), cached per source. */
  private whiteFrame(src: HTMLCanvasElement): HTMLCanvasElement {
    let w = this.whiteCache.get(src);
    if (!w) {
      w = document.createElement("canvas");
      w.width = src.width;
      w.height = src.height;
      const c = w.getContext("2d")!;
      c.drawImage(src, 0, 0);
      c.globalCompositeOperation = "source-atop"; // paint only where opaque
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, w.width, w.height);
      this.whiteCache.set(src, w);
    }
    return w;
  }

  /** The evolve sparkle burst: a ring of sparks that blooms outward and up as
   *  the new form settles, drawn over the creature. */
  private drawEvolveBurst(t: number): void {
    const p = this.evolveP();
    if (p < 0.4) return;
    const q = (p - 0.4) / 0.6; // 0→1 through the settle
    const cx = CREATURE_X + this.curDx;
    const cy = this.floorY + this.curDy - 14;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + p * 1.5;
      const r = 4 + q * 16;
      this.drawSparkle(
        Math.round(cx + Math.cos(a) * r),
        Math.round(cy + Math.sin(a) * r * 0.7 - q * 4),
        t * 6 + i,
      );
    }
  }
}

/** Fraction of a sprite canvas above its first opaque pixel row — bodies sit
 *  at different heights in the 16×16 grid (baby is six empty rows deep), so
 *  the peek band has to find the actual head, not the grid top. */
function spriteTopFraction(c: HTMLCanvasElement): number {
  const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 0) return y / c.height;
    }
  }
  return 0;
}

/** Fraction of a sprite canvas *below* its lowest opaque pixel row — the mirror
 *  of spriteTopFraction, scanning up from the bottom. Bodies leave a different
 *  number of empty rows under their feet (baby: one), so the perch lift reads
 *  this to plant each on the stump's cut instead of floating a fixed amount. */
function spriteBottomFraction(c: HTMLCanvasElement): number {
  const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  for (let y = c.height - 1; y >= 0; y--) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 0) return (c.height - 1 - y) / c.height;
    }
  }
  return 0;
}
