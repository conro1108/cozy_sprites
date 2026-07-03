// The habitat: a cozy garden clearing drawn to a low-res buffer and scaled up
// crisply (CSS image-rendering: pixelated). Runs its own rAF animation loop and
// a small "act" system for scripted moments (cleaning, fetch, hide & seek,
// rock-paper-scissors, death), plus an ambient layer: the creature wanders the
// clearing, pauses at props, idles with per-personality motion, and now and
// then does a rare celebratory flourish.
//
// The buffer height adapts to the container's aspect ratio so the scene fills
// the stage right up to the HUD and nav — no letterbox bars.

import { CELL, buildCreatureCanvas } from "./sprites";
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
}

type Pulse = "none" | "happy" | "shake" | "evolve" | "eat";

interface Act {
  type: "clean" | "fetch" | "hide" | "reveal" | "rps" | "death";
  start: number;
  duration: number;
  data: Record<string, unknown>;
  onDone?: () => void;
  finished: boolean;
}

// --- Ambient wander ----------------------------------------------------------
type WanderPhase = "dwell" | "walk" | "interact";
interface WanderTarget {
  dx: number; // offset from CREATURE_X
  prop: string | null; // a prop to react to on arrival
}
// Where the creature likes to potter off to. Props get a little reaction.
const WANDER_TARGETS: WanderTarget[] = [
  { dx: 22, prop: "mushroom" },
  { dx: 8, prop: "flowers" },
  { dx: -22, prop: "lantern" },
  { dx: -14, prop: null },
  { dx: 16, prop: null },
  { dx: 0, prop: null },
];
const WALK_SPEED = 16; // px / second
const FLOURISH_DUR = 1.7; // seconds

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
  private creatureCacheKey = "";
  private raf = 0;
  private t0 = performance.now();
  private pulse: Pulse = "none";
  private pulseStart = 0;
  private act: Act | null = null;
  private hidden = false; // creature is off hiding (hide & seek)
  private curDx = 0; // creature's current x offset (for bubble anchoring)

  // Adaptive sizing.
  private sh = 132; // scene buffer height
  private floorY = 90; // horizon within the buffer
  private ro: ResizeObserver | null = null;

  // Ambient wander state.
  private wanderPhase: WanderPhase = "dwell";
  private wanderX = 0;
  private wanderTargetX = 0;
  private wanderUntil = 0;
  private wanderProp: string | null = null;
  private lastFrame = 0;

  // Flourish (rare easter-egg animation).
  private flourishStart = -Infinity;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.resize();
    this.creatureCanvas = buildCreatureCanvas("egg", "neutral");
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
    this.view = view;
    const cacheKey = `${view.key}:${view.mood}:${view.variant ?? ""}`;
    if (cacheKey !== this.creatureCacheKey) {
      this.creatureCanvas = buildCreatureCanvas(view.key, view.mood, view.variant);
      this.creatureCacheKey = cacheKey;
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

  // --- Acts ------------------------------------------------------------------
  private startAct(
    type: Act["type"],
    duration: number,
    data: Record<string, unknown> = {},
    onDone?: () => void,
  ): void {
    // Acts take the stage: reset the wander so the creature doesn't teleport.
    this.wanderPhase = "dwell";
    this.wanderX = 0;
    this.wanderTargetX = 0;
    this.wanderUntil = performance.now() + 1500;
    this.flourishStart = -Infinity;
    this.act = { type, start: performance.now(), duration, data, onDone, finished: false };
  }

  /** Broom sweeps across the grass, sparkles in its wake. */
  playClean(onDone?: () => void): void {
    this.startAct("clean", 1000, {}, onDone);
  }

  /** Ball arcs out (power 0..1); the variant decides how it (doesn't) come back. */
  playFetch(power: number, variant: FetchVariant, onDone?: () => void): void {
    const dist = 18 + power * 34;
    const arc = 18 + Math.random() * 16; // randomized throw height
    const lateral = (Math.random() - 0.5) * 10; // slight sideways curve
    this.startAct("fetch", 2500, { dist, variant, arc, lateral }, onDone);
  }

  /** Poof — the creature vanishes to go hide. Stays hidden until reveal. */
  playHide(onDone?: () => void): void {
    this.startAct("hide", 500, {}, () => {
      this.hidden = true;
      onDone?.();
    });
  }

  /** Creature pops out from the actual hiding spot, then returns to center. */
  playReveal(spot: string, onDone?: () => void): void {
    this.hidden = false;
    const pos = this.hideSpotPos(spot);
    this.startAct("reveal", 1400, { x: pos.x, y: pos.y }, onDone);
  }

  /** Countdown shake, then both moves revealed above the players. */
  playRps(player: IconName, pet: IconName, onDone?: () => void): void {
    this.startAct("rps", 2000, { player, pet }, onDone);
  }

  /** The pet lies down, fades, and a little spirit floats up. */
  playDeath(onDone?: () => void): void {
    this.startAct("death", 3000, {}, onDone);
  }

  /** True while a scripted act is running (main can defer input). */
  busy(): boolean {
    return this.act !== null && !this.act.finished;
  }

  /** Where a hide-and-seek reveal pops out, in scene coords (floor-relative). */
  private hideSpotPos(spot: string): { x: number; y: number } {
    const f = this.floorY;
    const spots: Record<string, { x: number; y: number }> = {
      "behind the stump": { x: 16, y: f + 10 },
      "in the flowers": { x: 68, y: f + 26 },
      "behind the fence": { x: 98, y: f + 6 },
      "under the mushroom": { x: 82, y: f + 16 },
    };
    return spots[spot] ?? { x: CREATURE_X, y: f + 10 };
  }

  /**
   * CSS-pixel position (relative to the canvas element) of the point just
   * above the creature's head — where speech bubbles should point.
   */
  creatureAnchor(): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / SCENE_W, rect.height / this.sh);
    const ox = (rect.width - SCENE_W * scale) / 2;
    const oy = (rect.height - this.sh * scale) / 2;
    const sx = CREATURE_X + this.curDx;
    const sy = this.floorY - CELL * 3 + 16; // just above the sprite's head
    return { x: ox + sx * scale, y: oy + sy * scale };
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
    ctx.fillStyle = dark ? "#22303a" : v.night ? "#33484a" : "#7ab35e";
    ctx.fillRect(0, FLOOR_Y - 12, SCENE_W, 12);
    for (let x = -8; x < SCENE_W; x += 34) {
      ctx.beginPath();
      ctx.ellipse(x + 16, FLOOR_Y - 10, 22, 9, 0, Math.PI, 0);
      ctx.fill();
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
    // worn dirt patch where the creature stands
    ctx.fillStyle = dark ? "#3a3228" : v.night ? "#5c4c38" : "#c9a96a";
    ctx.beginPath();
    ctx.ellipse(CREATURE_X, FLOOR_Y + 12, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    this.drawFence(dark, v.night);
    this.drawStump(dark, v.night);
    this.drawLantern(t, dark, v);
    this.drawMushroom(dark, v.night);
    this.drawFlowers(t, dark, v.night);

    // --- Poops (on the grass) ---------------------------------------------------
    for (let i = 0; i < Math.min(v.poops, 4); i++) {
      this.drawPoop(14 + i * 22, SCENE_H - 12);
    }

    // --- Creature + acts ----------------------------------------------------------
    this.runAct(now, t);

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
    // Warm lantern glow when the lantern is lit at night
    if (v.night && v.lightsOn) {
      const g = ctx.createRadialGradient(34, FLOOR_Y - 22, 4, 34, FLOOR_Y - 22, 60);
      g.addColorStop(0, "rgba(255,220,150,0.3)");
      g.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    }
  }

  private drawFence(dark: boolean, night: boolean): void {
    const ctx = this.ctx;
    const FLOOR_Y = this.floorY;
    ctx.fillStyle = dark ? "#3a2f28" : night ? "#5c4a38" : "#a97b50";
    for (let x = 88; x <= 108; x += 7) {
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
    const sx = 6;
    const sy = this.floorY + 2;
    ctx.fillStyle = dark ? "#3f3128" : night ? "#5e4634" : "#8a5a3c";
    ctx.fillRect(sx, sy, 18, 12);
    ctx.fillStyle = dark ? "#4a3a30" : night ? "#6e543e" : "#a97048";
    ctx.fillRect(sx, sy - 3, 18, 5);
    // rings on top
    ctx.fillStyle = dark ? "#3a2d24" : night ? "#553f2e" : "#8a5a3c";
    ctx.fillRect(sx + 4, sy - 2, 10, 1);
    ctx.fillRect(sx + 7, sy, 4, 1);
  }

  private drawLantern(t: number, dark: boolean, v: SceneView): void {
    const ctx = this.ctx;
    const lx = 32;
    const top = this.floorY - 30;
    // post
    ctx.fillStyle = dark ? "#2e2620" : "#6e5138";
    ctx.fillRect(lx, top + 8, 3, 26);
    // lantern box
    ctx.fillStyle = dark ? "#241f1a" : "#4a3527";
    ctx.fillRect(lx - 2, top, 7, 9);
    const lit = v.lightsOn;
    ctx.fillStyle = lit ? (v.night ? "#ffdf8e" : "#f5e6bc") : "#3a3448";
    ctx.fillRect(lx - 1, top + 1, 5, 7);
    if (lit && v.night) {
      // flicker
      if (Math.sin(t * 7) > -0.6) {
        ctx.fillStyle = "#fff3c8";
        ctx.fillRect(lx, top + 3, 3, 3);
      }
    }
    // cap
    ctx.fillStyle = dark ? "#241f1a" : "#4a3527";
    ctx.fillRect(lx - 3, top - 2, 9, 2);
  }

  private drawMushroom(dark: boolean, night: boolean): void {
    const ctx = this.ctx;
    const mx = 78;
    const my = this.floorY + 10;
    // stem
    ctx.fillStyle = dark ? "#8a8478" : "#f0e6d0";
    ctx.fillRect(mx + 3, my, 4, 6);
    // cap
    ctx.fillStyle = dark ? "#7a3a34" : night ? "#a04a40" : "#d95848";
    ctx.fillRect(mx, my - 4, 10, 5);
    ctx.fillRect(mx + 2, my - 6, 6, 2);
    // spots
    ctx.fillStyle = dark ? "#b0a89a" : "#fdf3e0";
    ctx.fillRect(mx + 2, my - 3, 2, 2);
    ctx.fillRect(mx + 7, my - 4, 2, 2);
  }

  private drawFlowers(t: number, dark: boolean, night: boolean): void {
    const ctx = this.ctx;
    const H = this.sh;
    const patch: [number, number, string][] = [
      [60, H - 18, "#f2a0bc"],
      [66, H - 12, "#ffd884"],
      [72, H - 20, "#e88aa8"],
      [90, H - 16, "#f2a0bc"],
      [24, H - 10, "#ffd884"],
      [10, H - 20, "#e88aa8"],
    ];
    for (const [fx, fy, color] of patch) {
      const sway = Math.round(Math.sin(t * 1.5 + fx) * 0.6);
      ctx.fillStyle = dark ? "#2f4a34" : night ? "#4a6a48" : "#5aa85a";
      ctx.fillRect(fx + 1, fy, 1, 4);
      ctx.fillStyle = dark ? "#5c5468" : color;
      ctx.fillRect(fx + sway, fy - 3, 3, 3);
      ctx.fillStyle = dark ? "#78708a" : "#fff7dc";
      ctx.fillRect(fx + 1 + sway, fy - 2, 1, 1);
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
        this.drawCreature(t, this.wanderX, 1, null);
      }
      return;
    }
    const p = Math.min(1, (now - act.start) / act.duration);

    switch (act.type) {
      case "clean": {
        if (!this.hidden) this.drawCreature(t, 0, 1, null);
        const bx = 4 + p * (SCENE_W - 10);
        const ctx = this.ctx;
        // broom: angled handle + bristles, sweeping wiggle
        const wiggle = Math.sin(p * Math.PI * 10) * 2;
        ctx.fillStyle = "#8a5a3c";
        ctx.fillRect(Math.round(bx + 3), this.sh - 30, 2, 16);
        ctx.fillStyle = "#e8c06a";
        ctx.fillRect(Math.round(bx + wiggle), this.sh - 15, 8, 6);
        for (let i = 0; i < 4; i++) {
          this.drawSparkle(
            Math.round(bx - 6 - i * 9),
            this.sh - 12 - ((i * 5) % 8),
            t * 6 + i,
          );
        }
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
        const spotDx = spotX - CREATURE_X;
        if (p < 0.45) {
          // pop out of the hiding spot, growing with a hop
          const q = p / 0.45;
          const hop = Math.sin(q * Math.PI) * 6;
          this.drawCreature(t, spotDx, 0.4 + q * 0.6, -hop);
        } else {
          // trot back to center
          const q = (p - 0.45) / 0.55;
          const dx = spotDx * (1 - q);
          const hop = Math.abs(Math.sin(q * Math.PI * 4)) * 2;
          this.drawCreature(t, dx, 1, -hop);
        }
        break;
      }

      case "rps": {
        this.drawCreature(t, 0, 1, null);
        const ctx = this.ctx;
        const player = act.data.player as IconName;
        const pet = act.data.pet as IconName;
        if (p < 0.5) {
          // countdown: two "fists" bob in sync
          const bob = Math.abs(Math.sin(p * Math.PI * 6)) * 6;
          ctx.drawImage(iconCanvas("rock"), 14, Math.round(26 + bob), 20, 20);
          ctx.drawImage(iconCanvas("rock"), 78, Math.round(26 + bob), 20, 20);
        } else {
          // reveal both moves
          ctx.drawImage(iconCanvas(player), 14, 26, 20, 20);
          ctx.drawImage(iconCanvas(pet), 78, 26, 20, 20);
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
      // Settle back to center and take a beat before wandering again.
      this.wanderX = 0;
      this.wanderPhase = "dwell";
      this.wanderUntil = now + 1200;
      act.onDone?.();
    }
  }

  /** Fetch choreography — each variant reads distinctly (see FetchVariant). */
  private drawFetch(act: Act, p: number, t: number): void {
    const FLOOR_Y = this.floorY;
    const dist = act.data.dist as number;
    const variant = act.data.variant as FetchVariant;
    const arc = act.data.arc as number;
    const lateral = act.data.lateral as number;
    const targetX = CREATURE_X + dist;
    let dx = 0;
    let ball: { x: number; y: number } | null = null;
    let sock: { x: number; y: number } | null = null;

    const throwArc = (q: number) => ({
      x: CREATURE_X + q * dist + Math.sin(q * Math.PI) * lateral,
      y: FLOOR_Y - 6 - Math.sin(q * Math.PI) * (arc + 8),
    });

    switch (variant) {
      case "overfence": {
        // The ball keeps climbing and sails off past the fence, gone.
        const bx = CREATURE_X + p * (dist + 60);
        const by = FLOOR_Y - 6 - Math.sin(Math.min(p * 1.5, 1) * Math.PI) * arc - p * 60;
        if (by > -6) ball = { x: bx, y: by };
        // trots out a little, then stops and watches it leave
        dx = Math.min(p / 0.35, 1) * (dist * 0.45);
        this.drawCreature(t, dx, 1, by > -6 ? -1 : 0);
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
          dx = -q * 42;
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

      case "sock": {
        // Full chase, but returns with a sock instead of the ball.
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
          sock = { x: CREATURE_X + dx + 6, y: FLOOR_Y + 3 };
        }
        this.drawCreature(t, dx, 1, null);
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
          ball = { x: CREATURE_X + dx + 5, y: FLOOR_Y + 2 };
          this.drawCreature(t, dx, 1, -Math.abs(Math.sin(q * Math.PI * 3)) * 3);
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
          ball = { x: CREATURE_X + dx + 6, y: FLOOR_Y + 4 };
        }
        this.drawCreature(t, dx, 1, null);
        break;
      }
    }

    if (ball) this.drawBall(ball.x, ball.y);
    if (sock) this.drawSock(sock.x, sock.y);
  }

  // --- Ambient wander ----------------------------------------------------------
  /** Stroll the clearing: dwell, walk to a spot, react to a prop, repeat. */
  private updateWander(now: number): void {
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    const v = this.view;
    // Egg stays put; sleep, tantrum and flourish all suspend wandering.
    if (v.key === "egg" || v.asleep || v.tantrum || this.flourishing()) {
      if (v.key === "egg") this.wanderX = 0;
      return;
    }

    switch (this.wanderPhase) {
      case "dwell": {
        if (now >= this.wanderUntil) {
          const target = WANDER_TARGETS[Math.floor(Math.random() * WANDER_TARGETS.length)];
          this.wanderTargetX = target.dx;
          this.wanderProp = target.prop;
          this.wanderPhase = "walk";
        }
        break;
      }
      case "walk": {
        const step = WALK_SPEED * dt;
        const diff = this.wanderTargetX - this.wanderX;
        if (Math.abs(diff) <= step + 0.4) {
          this.wanderX = this.wanderTargetX;
          if (this.wanderProp) {
            this.wanderPhase = "interact";
            this.wanderUntil = now + 1200;
          } else {
            this.wanderPhase = "dwell";
            this.wanderUntil = now + 3000 + Math.random() * 4000;
          }
        } else {
          this.wanderX += Math.sign(diff) * step;
        }
        break;
      }
      case "interact": {
        if (now >= this.wanderUntil) {
          this.wanderPhase = "dwell";
          this.wanderUntil = now + 3000 + Math.random() * 4000;
        }
        break;
      }
    }
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

    if (v.asleep) {
      m.bob = Math.sin(t * 1.2) * 0.8;
      m.sy = 0.94;
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
    if (this.wanderPhase === "walk") {
      // a little waddle while on the move
      m.bob = -Math.abs(Math.sin(t * 9)) * 2.2;
      m.rot = Math.sin(t * 9) * 0.05;
      return m;
    }
    if (this.wanderPhase === "interact") {
      // pause and lean into whatever it wandered over to
      m.bob = Math.sin(t * 3) * 0.8 + 1;
      m.rot = 0.05;
      return m;
    }
    return this.idleMotion(t, key);
  }

  /** Per-creature idle: same clearing, very different body language. */
  private idleMotion(
    t: number,
    key: string,
  ): { bob: number; dx: number; sx: number; sy: number; rot: number } {
    const m = { bob: 0, dx: 0, sx: 1, sy: 1, rot: 0 };
    switch (key) {
      case "dog":
        m.bob = -Math.abs(Math.sin(t * 3)) * 2.6; // eager little bounces
        break;
      case "blob":
        m.bob = Math.sin(t * 1.6) * 0.8;
        m.sy = 1 + Math.sin(t * 3) * 0.05; // gelatinous wobble
        m.sx = 1 - Math.sin(t * 3) * 0.04;
        break;
      case "gremlin":
        m.bob = Math.sin(t * 2.4) * 1.4;
        m.dx = Math.sin(t * 5.5) * 0.6; // twitchy, up to something
        break;
      case "scholar":
        m.bob = Math.sin(t * 1.4) * 0.9;
        m.rot = Math.sin(t * 0.8) * 0.03; // a contemplative nod
        break;
      case "office":
        m.bob = Math.sin(t * 1.1) * 0.6;
        m.sy = 0.98; // a permanent, weary slump
        break;
      case "menace":
        m.bob = Math.sin(t * 1.0) * 0.7;
        m.rot = Math.sin(t * 0.6) * 0.02; // haughtily still, chin up
        break;
      case "ghost":
        m.bob = Math.sin(t * 1.6) * 3 - 5; // hovers off the grass
        break;
      case "baby":
        m.bob = Math.sin(t * 2.6) * 1.6;
        m.dx = Math.sin(t * 6) * 0.5; // a delighted wiggle
        break;
      case "child":
        m.bob = -Math.abs(Math.sin(t * 2.2)) * 1.6; // can't stop hopping
        break;
      case "teen":
        m.bob = Math.sin(t * 1.2) * 0.8;
        m.rot = 0.04; // a practiced slouch
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

  /**
   * Draw the creature. `dxAct` shifts it, `scaleMul` scales it (acts),
   * `hopY` overrides bob, `deathSquashX/Y` deform for the death pose.
   * When idle (no act, no hop override) the ambient motion layer drives it.
   */
  private drawCreature(
    t: number,
    dxAct: number,
    scaleMul: number,
    hopY: number | null,
    deathSquashX?: number,
    deathSquashY?: number,
  ): void {
    const ctx = this.ctx;
    const v = this.view;
    const scale = 3 * scaleMul;
    const cw = CELL * scale;
    const isGhost = v.key === "ghost";
    const ambient = this.act === null && hopY === null;

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
      // Act context: keep the old gentle defaults.
      if (v.asleep) {
        bob = Math.sin(t * 1.2) * 0.8;
        squashY = 0.94;
      }
      if (isGhost && hopY === null) {
        bob = Math.sin(t * 1.6) * 3 - 5;
      }
    }

    const pdt = (performance.now() - this.pulseStart) / 1000;
    if (this.pulse !== "none" && pdt < 0.6) {
      const p = pdt / 0.6;
      if (this.pulse === "happy" || this.pulse === "eat") {
        bob -= Math.abs(Math.sin(p * Math.PI * 3)) * 6;
        squashY *= 1 + Math.sin(p * Math.PI * 2) * 0.08;
      } else if (this.pulse === "shake") {
        dx += Math.sin(p * Math.PI * 8) * 4;
      } else if (this.pulse === "evolve") {
        rot = Math.sin(p * Math.PI * 6) * 0.15;
        squashX *= 1 + Math.sin(p * Math.PI * 4) * 0.1;
      }
    } else if (v.key === "egg" && ambient) {
      // Egg rocks periodically.
      rot = Math.sin(t * 1.5) * 0.06;
    }

    this.curDx = dx;

    // Soft shadow (fainter under a hovering ghost)
    ctx.fillStyle = isGhost ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.15)";
    const shW = cw * (isGhost ? 0.5 : 0.7);
    ctx.fillRect(
      Math.round(CREATURE_X + dx - shW / 2),
      this.floorY + 6,
      Math.round(shW),
      3,
    );

    const baseY = this.floorY - cw + 12;
    ctx.save();
    const cx = CREATURE_X + dx;
    const cy = baseY + cw / 2 + bob;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(squashX, squashY);
    ctx.drawImage(this.creatureCanvas, -cw / 2, -cw / 2, cw, cw);
    ctx.restore();
  }
}
