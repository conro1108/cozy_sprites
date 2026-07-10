// The habitat: a cozy garden clearing drawn to a low-res buffer and scaled up
// crisply (CSS image-rendering: pixelated). Runs its own rAF animation loop and
// a small "act" system for scripted moments (cleaning, fetch, hide & seek,
// rock-paper-scissors, death), plus an ambient layer: the creature wanders the
// clearing, pauses at props, idles with per-personality motion, and now and
// then does a rare celebratory flourish.
//
// The buffer height adapts to the container's aspect ratio so the scene fills
// the stage right up to the HUD and nav — no letterbox bars.

import { CELL, buildCreatureFrames, type SpriteFrame } from "./sprites";
import type { Mood } from "./sprites";
import type { AdultForm } from "../pet/types";
import { iconCanvas } from "./icons";
import type { IconName } from "./icons";
import type { FetchVariant } from "../pet/games";

export const SCENE_W = 112; // fixed content width; height adapts to the stage

const GRASS_DEPTH = 42; // grass below the horizon (floor sits this far up)
const CREATURE_X = 56; // resting center

export interface SceneView {
  key: string; // creature key
  mood: Mood;
  poops: number;
  night: boolean;
  asleep: boolean;
  lightsOn: boolean;
  /** Teen "audition" leaning — tints the sprite with an adult-hint accent. */
  variant?: AdultForm | null;
  /** A discipline-worthy fake call: the pet is visibly throwing a tantrum. */
  tantrum?: boolean;
  /** 0..1 — how energetic the creature is. Old-timers rest more, walk slower. */
  activity?: number;
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
    night: false,
    asleep: false,
    lightsOn: true,
  };
  private creatureCanvas: HTMLCanvasElement;
  private frames: Record<SpriteFrame, HTMLCanvasElement>;
  private creatureCacheKey = "";

  private altFrame = false; // per-frame: use the alt pose (dog's tail up)
  private forceGlance: -1 | 0 | 1 = 0; // per-frame: a quirk overrides the gaze
  private extraAlpha = 1; // per-frame: ghost flicker translucency
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
    this.startAct("clean", dur, { spots, cleanedAt: spots.map(() => -1) }, onDone);
  }

  /** Ball arcs out (power 0..1); the variant decides how it (doesn't) come back. */
  playFetch(power: number, variant: FetchVariant, onDone?: () => void): void {
    // Throws go either way — except over-the-fence, which needs the fence (right).
    const dir = variant === "overfence" ? 1 : Math.random() < 0.5 ? 1 : -1;
    const dist = (18 + power * 34) * dir;
    const arc = 18 + Math.random() * 16; // randomized throw height
    const lateral = (Math.random() - 0.5) * 10; // slight sideways curve
    this.startAct("fetch", 2500, { dist, variant, arc, lateral }, onDone);
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
    const rect = this.canvas.getBoundingClientRect();
    // The canvas is displayed with object-fit: cover, so mirror cover math
    // (max, with negative crop offsets) — contain math drifts whenever the
    // buffer-height clamp in resize() keeps the aspect from matching exactly.
    const scale = Math.max(rect.width / SCENE_W, rect.height / this.sh);
    const ox = (rect.width - SCENE_W * scale) / 2;
    const oy = (rect.height - this.sh * scale) / 2;
    const cw = CELL * 3 * this.depthScale(this.curDy);
    const sx = CREATURE_X + this.curDx;
    // Just above the sprite's head, wherever it currently roams on the plane.
    const sy = this.floorY + this.curDy + 16 - cw;
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
    const dark = v.night && !v.lightsOn;
    const FLOOR_Y = this.floorY;
    const SCENE_H = this.sh;

    // --- Sky ------------------------------------------------------------------
    ctx.fillStyle = dark ? "#141232" : v.night ? "#2b2552" : "#a8dcec";
    ctx.fillRect(0, 0, SCENE_W, FLOOR_Y);
    ctx.fillStyle = dark ? "#1d1940" : v.night ? "#3a3462" : "#cfeef8";
    ctx.fillRect(0, FLOOR_Y - 22, SCENE_W, 22);

    if (v.night) {
      // moon + twinkling stars
      ctx.fillStyle = "#f3edd0";
      ctx.fillRect(88, 10, 7, 7);
      ctx.fillStyle = dark ? "#141232" : "#2b2552";
      ctx.fillRect(86, 9, 4, 4);
      ctx.fillStyle = "#fff";
      const stars = [
        [10, 12],
        [26, 24],
        [44, 8],
        [62, 18],
        [78, 30],
        [18, 34],
        [98, 26],
      ];
      for (const [sx, sy] of stars) {
        if (Math.sin(t * 2 + sx) > -0.3) ctx.fillRect(sx, sy, 1, 1);
      }
    } else {
      // sun + drifting clouds
      ctx.fillStyle = "#ffe9a3";
      ctx.fillRect(90, 8, 9, 9);
      ctx.fillStyle = "#fff2c8";
      ctx.fillRect(92, 6, 5, 2);
      ctx.fillRect(92, 19, 5, 2);
      ctx.fillStyle = "#ffffff";
      const cx1 = ((t * 3) % (SCENE_W + 30)) - 20;
      ctx.fillRect(cx1, 18, 16, 5);
      ctx.fillRect(cx1 + 4, 14, 9, 4);
      const cx2 = ((t * 2 + 60) % (SCENE_W + 30)) - 20;
      ctx.fillRect(cx2, 34, 12, 4);
      ctx.fillRect(cx2 + 3, 31, 7, 3);
    }

    // --- Distant hills ----------------------------------------------------------
    // A low ridge with a few soft mounds. Chunky integer step-rows (no ellipse)
    // to match the meadow's hard pixels, but kept low and single-toned so the
    // hills stay quiet background rather than reading as a hard-edged prop.
    ctx.fillStyle = dark ? "#22303a" : v.night ? "#33484a" : "#7ab35e";
    const hillY = FLOOR_Y - 12;
    ctx.fillRect(0, hillY, SCENE_W, 12); // the ridge the mounds rise from
    const mounds: [number, number][] = [
      [8, 8],
      [42, 6],
      [76, 8],
      [110, 6],
    ];
    for (const [mx, h] of mounds) {
      // Stack centred spans that narrow as they climb: wide at the ridge, a
      // small cap at the peak — a stepped hump, one pixel per step (matches
      // the stump/dirt patch's finer row density).
      for (let dy = 0; dy < h; dy++) {
        const halfW = Math.round(22 * (1 - dy / h));
        ctx.fillRect(mx - halfW, hillY - dy - 1, halfW * 2 + 1, 1);
      }
    }

    // --- Grass -------------------------------------------------------------------
    ctx.fillStyle = dark ? "#2c3c2c" : v.night ? "#3f5a3c" : "#9cc85a";
    ctx.fillRect(0, FLOOR_Y, SCENE_W, SCENE_H - FLOOR_Y);
    // tufts
    ctx.fillStyle = dark ? "#26342a" : v.night ? "#38503a" : "#84b348";
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
    ctx.fillStyle = dark ? "#3a3228" : v.night ? "#5c4c38" : "#c9a96a";
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
      { y: FLOOR_Y + 4, draw: () => this.drawFence(dark, v.night) },
      { y: FLOOR_Y + 13, draw: () => this.drawStump(dark, v.night) },
      { y: FLOOR_Y + 4, draw: () => this.drawLantern(t, dark, v) },
      { y: FLOOR_Y + 16, draw: () => this.drawMushroom(dark, v.night) },
    ];
    for (const [fx, fy, color] of this.flowerPatch()) {
      layers.push({ y: fy + 4, draw: () => this.drawFlower(fx, fy, color, t, dark, v.night) });
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
    // Warm lantern glow washing over the clearing when lit at night
    if (v.night && v.lightsOn) {
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
    const lx = 32;
    const top = this.floorY - 40; // taller: the lantern is the heart of the clearing
    const lit = v.lightsOn;
    // a soft halo right around the glass, day or night, whenever it's lit
    if (lit) {
      const g = ctx.createRadialGradient(lx + 1, top + 7, 2, lx + 1, top + 7, 16);
      g.addColorStop(0, v.night ? "rgba(255,223,142,0.55)" : "rgba(255,233,163,0.35)");
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
    ctx.fillStyle = lit ? (v.night ? "#ffdf8e" : "#f5e6bc") : "#3a3448";
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
    const capRows: [number, number][] = [
      [-7, 1],
      [-6, 2],
      [-5, 4],
      [-4, 5],
      [-3, 6],
      [-2, 6],
    ];
    for (const [dy, hw] of capRows) ctx.fillRect(cx - hw, my + dy, hw * 2 + 1, 1);
    ctx.fillStyle = dark ? "#5e2c28" : night ? "#853c34" : "#b8432f";
    ctx.fillRect(cx - 6, my - 1, 13, 1); // shadow where the rim overhangs the stem
    // spots
    ctx.fillStyle = dark ? "#b0a89a" : "#fdf3e0";
    ctx.fillRect(cx - 4, my - 5, 2, 2);
    ctx.fillRect(cx + 2, my - 6, 2, 2);
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
    const ctx = this.ctx;
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(x, y, 8, 3);
    ctx.fillRect(x + 1, y - 2, 6, 2);
    ctx.fillRect(x + 2, y - 4, 4, 2);
    ctx.fillStyle = "#8a6a3a";
    ctx.fillRect(x + 2, y - 3, 2, 1);
  }

  /** A little broom standing on the ground at (x, y): angled handle up-right,
   *  bristle fan at the foot. `wiggle` sways the bristles as it sweeps. */
  private drawBroom(x: number, y: number, wiggle: number): void {
    const ctx = this.ctx;
    const bx = Math.round(x);
    const by = Math.round(y);
    ctx.fillStyle = "#8a5a3c"; // handle
    ctx.fillRect(bx + 4, by - 16, 2, 14);
    ctx.fillRect(bx + 5, by - 17, 2, 3);
    ctx.fillStyle = "#e8c06a"; // bristles
    ctx.fillRect(bx + Math.round(wiggle), by - 3, 8, 5);
    ctx.fillStyle = "#caa050";
    ctx.fillRect(bx + Math.round(wiggle), by + 2, 8, 1);
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
        if (!this.hidden) this.drawCreature(t, 0, 1, null);
        const spots = act.data.spots as { x: number; yOffset: number }[];
        const cleanedAt = act.data.cleanedAt as number[];
        const n = spots.length;

        if (n === 0) {
          // Nothing on the floor — a token flourish across the grass.
          const bx = 4 + p * (SCENE_W - 10);
          this.drawBroom(bx, this.sh - 14, Math.sin(p * Math.PI * 10) * 2);
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
        const bx = a.x + (b.x - a.x) * ease;
        const by = a.y + (b.y - a.y) * ease;

        // Mark each mess swept as the broom arrives at its waypoint.
        for (let i = 0; i < n; i++) {
          if (cleanedAt[i] < 0 && p >= (i + 1) / segs) cleanedAt[i] = p;
        }

        // Messes still ahead of the broom stay on the floor; freshly-swept ones
        // get a brief sparkle puff where they used to be.
        for (let i = 0; i < n; i++) {
          const sx = spots[i].x;
          const sy = FLOOR_Y + spots[i].yOffset;
          if (cleanedAt[i] < 0) {
            this.drawPoop(sx, sy);
          } else if (p - cleanedAt[i] < 0.3) {
            for (let k = 0; k < 4; k++) {
              this.drawSparkle(sx + (k % 2 ? 5 : 1), sy - ((k * 3) % 7), t * 8 + i + k);
            }
          }
        }

        this.drawBroom(bx, by, Math.sin(p * Math.PI * 12) * 1.5);
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
      if (act.type === "poop") {
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
        // Full chase, but returns with the wrong object held proudly in its mouth.
        if (p < 0.22) {
          ball = throwArc(p / 0.22);
        } else if (p < 0.5) {
          const q = (p - 0.22) / 0.28;
          dx = q * dist;
          ball = { x: targetX, y: FLOOR_Y + 8 };
        } else if (p < 0.66) {
          dx = dist;
          ball = { x: targetX, y: FLOOR_Y + 8 };
        } else {
          const q = (p - 0.66) / 0.34;
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
        // Normal chase out — but what comes back, slowly, reverently, hums.
        if (p < 0.22) {
          ball = throwArc(p / 0.22);
          this.drawCreature(t, 0, 1, null);
        } else if (p < 0.48) {
          const q = (p - 0.22) / 0.26;
          dx = q * dist;
          ball = { x: targetX, y: FLOOR_Y + 8 };
          this.drawCreature(t, dx, 1, null);
        } else if (p < 0.62) {
          // a long, still moment at the ball. Something is decided.
          dx = dist;
          this.drawCreature(t, dx, 1, null);
        } else {
          // the slow walk home. The ball is gone. The cube is here.
          const q = (p - 0.62) / 0.38;
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
    const SZ = 20;
    const PX = 14; // player's side
    const EX = 78; // pet's side
    const IY = 26;

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

    // Older creatures dwell longer, walk slower, and flop down more often.
    const activity = v.activity ?? 1;
    const dwellFor = () => (7000 + Math.random() * 7000) * (2 - activity);

    switch (this.wanderPhase) {
      case "dwell": {
        if (now >= this.wanderUntil) {
          // Idle is the default: most of the time it just keeps standing and
          // breathing, so a wander or a quirk reads as an occasional event
          // rather than constant motion. Calmer (low-activity) pets stay put
          // even more; babies get up and go a little more often.
          if (Math.random() < 0.45 + 0.25 * (1 - activity)) {
            this.wanderUntil = now + dwellFor();
            break;
          }
          if (Math.random() < 0.1 + 0.5 * (1 - activity)) {
            // Take a breather: a big yawn, then blob down for a while.
            this.wanderPhase = "yawn";
            this.phaseStart = now;
            this.wanderUntil = now + 1100;
            break;
          }
          if (Math.random() < 0.1) {
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
      if (key === "dog") this.altFrame = true; // tail streams up on the run
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
    const scale = 3 * scaleMul * this.depthScale(dy);
    const cw = CELL * scale;
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
        if (v.key === "dog") this.altFrame = true; // tail up on the run
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

    // --- Face life: quirk-driven glances only (no idle blink/glance jitter) -
    let sprite = this.creatureCanvas;
    if (!v.asleep && v.key !== "egg") {
      if (this.altFrame) {
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
    const shW = cw * (isGhost ? 0.5 : 0.7);
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
        ctx.fillStyle = `rgba(0,0,0,${0.15 * (1 - s)})`;
        const w = shW * (1 - s * 0.45);
        ctx.fillRect(Math.round(CREATURE_X + dx - w / 2), Math.round(groundY + 6), Math.round(w), 3);
      }
      if (s > 0) {
        // landed on the cut: a small contact shadow, hard-edged like the wood
        // it sits on and tucked inside the rim, right under the feet
        ctx.fillStyle = `rgba(0,0,0,${0.22 * s})`;
        const scx = Math.round(CREATURE_X + dx);
        const sy = this.floorY + STUMP_SEAT_TOP_DY;
        ctx.fillRect(scx - 4, sy - 1, 9, 1);
        ctx.fillRect(scx - 5, sy, 11, 1);
      }
    } else {
      ctx.fillStyle = isGhost ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.15)";
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
    ctx.save();
    // Snap the draw origin to the buffer's integer pixel grid. Drawing the
    // 3×-scaled sprite at a fractional origin makes its pixels crawl frame to
    // frame (a shimmer) — invisible while it's travelling across the scene, but
    // the *only* motion when it's idling in place, where it reads as jitter.
    const cx = Math.round(CREATURE_X + dx);
    // ctx.scale() shrinks the image toward this translate origin on both
    // sides. Nudge the origin down by half of what squashY trims off so the
    // feet stay planted on the shadow — vertical squash reads as sitting
    // into the ground instead of floating up off it.
    const cy = Math.round(baseY + cw / 2 + bob + (cw / 2) * (1 - squashY));
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(squashX * flip, squashY);
    if (this.extraAlpha < 1) ctx.globalAlpha *= this.extraAlpha; // ghost flicker
    ctx.drawImage(sprite, -cw / 2, -cw / 2, cw, cw);
    // The evolve flash: a pure-white silhouette bloomed over the sprite at the
    // peak of the transform — whatever the frame, old or new, it's just white,
    // so the stage swap underneath never shows.
    const flash = this.evolveFlash();
    if (flash > 0) {
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * flash;
      ctx.drawImage(this.whiteFrame(sprite), -cw / 2, -cw / 2, cw, cw);
      ctx.globalAlpha = a;
    }
    ctx.restore();
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
