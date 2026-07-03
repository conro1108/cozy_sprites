// The habitat: a cozy garden clearing drawn to a low-res buffer and scaled up
// crisply (CSS image-rendering: pixelated). Runs its own rAF animation loop and
// a small "act" system for scripted moments (cleaning, fetch, hide & seek,
// rock-paper-scissors, death).

import { CELL, buildCreatureCanvas } from "./sprites";
import type { Mood } from "./sprites";
import { iconCanvas } from "./icons";
import type { IconName } from "./icons";

export const SCENE_W = 112;
export const SCENE_H = 132;

const FLOOR_Y = 90; // horizon: sky above, grass below
const CREATURE_X = 56; // resting center

export interface SceneView {
  key: string; // creature key
  mood: Mood;
  poops: number;
  night: boolean;
  asleep: boolean;
  lightsOn: boolean;
}

type Pulse = "none" | "happy" | "shake" | "evolve" | "eat";

/** Where a hide-and-seek reveal pops out, in scene coords. */
export const HIDE_SPOT_POS: Record<string, { x: number; y: number }> = {
  "behind the stump": { x: 16, y: FLOOR_Y + 10 },
  "in the flowers": { x: 68, y: FLOOR_Y + 26 },
  "behind the fence": { x: 98, y: FLOOR_Y + 6 },
  "under the mushroom": { x: 82, y: FLOOR_Y + 16 },
};

interface Act {
  type: "clean" | "fetch" | "hide" | "reveal" | "rps" | "death";
  start: number;
  duration: number;
  data: Record<string, unknown>;
  onDone?: () => void;
  finished: boolean;
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
  private creatureCacheKey = "";
  private raf = 0;
  private t0 = performance.now();
  private pulse: Pulse = "none";
  private pulseStart = 0;
  private act: Act | null = null;
  private hidden = false; // creature is off hiding (hide & seek)
  private curDx = 0; // creature's current x offset (for bubble anchoring)

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = SCENE_W;
    canvas.height = SCENE_H;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.creatureCanvas = buildCreatureCanvas("egg", "neutral");
  }

  update(view: SceneView): void {
    this.view = view;
    const cacheKey = `${view.key}:${view.mood}`;
    if (cacheKey !== this.creatureCacheKey) {
      this.creatureCanvas = buildCreatureCanvas(view.key, view.mood);
      this.creatureCacheKey = cacheKey;
    }
  }

  triggerPulse(p: Pulse): void {
    this.pulse = p;
    this.pulseStart = performance.now();
  }

  // --- Acts ------------------------------------------------------------------
  private startAct(
    type: Act["type"],
    duration: number,
    data: Record<string, unknown> = {},
    onDone?: () => void,
  ): void {
    this.act = { type, start: performance.now(), duration, data, onDone, finished: false };
  }

  /** Broom sweeps across the grass, sparkles in its wake. */
  playClean(onDone?: () => void): void {
    this.startAct("clean", 1000, {}, onDone);
  }

  /** Ball arcs out (power 0..1), creature chases; success = brings it back. */
  playFetch(power: number, success: boolean, onDone?: () => void): void {
    const dist = 18 + power * 34;
    this.startAct("fetch", 2400, { dist, success }, onDone);
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
    const pos = HIDE_SPOT_POS[spot] ?? { x: CREATURE_X, y: FLOOR_Y + 10 };
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

  /**
   * CSS-pixel position (relative to the canvas element) of the point just
   * above the creature's head — where speech bubbles should point.
   */
  creatureAnchor(): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / SCENE_W, rect.height / SCENE_H);
    const ox = (rect.width - SCENE_W * scale) / 2;
    const oy = (rect.height - SCENE_H * scale) / 2;
    const sx = CREATURE_X + this.curDx;
    const sy = FLOOR_Y - CELL * 3 + 16; // just above the sprite's head
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
  }

  // --- Drawing ----------------------------------------------------------------
  private draw(now: number): void {
    const ctx = this.ctx;
    const t = (now - this.t0) / 1000;
    const v = this.view;
    const dark = v.night && !v.lightsOn;

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
    const sy = FLOOR_Y + 2;
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
    const top = FLOOR_Y - 30;
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
    const my = FLOOR_Y + 10;
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
    const patch: [number, number, string][] = [
      [60, SCENE_H - 18, "#f2a0bc"],
      [66, SCENE_H - 12, "#ffd884"],
      [72, SCENE_H - 20, "#e88aa8"],
      [90, SCENE_H - 16, "#f2a0bc"],
      [24, SCENE_H - 10, "#ffd884"],
      [10, SCENE_H - 20, "#e88aa8"],
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
    if (!act) {
      if (!this.hidden) this.drawCreature(t, 0, 1, null);
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
        ctx.fillRect(Math.round(bx + 3), SCENE_H - 30, 2, 16);
        ctx.fillStyle = "#e8c06a";
        ctx.fillRect(Math.round(bx + wiggle), SCENE_H - 15, 8, 6);
        for (let i = 0; i < 4; i++) {
          this.drawSparkle(
            Math.round(bx - 6 - i * 9),
            SCENE_H - 12 - ((i * 5) % 8),
            t * 6 + i,
          );
        }
        break;
      }

      case "fetch": {
        const dist = act.data.dist as number;
        const success = act.data.success as boolean;
        const targetX = CREATURE_X + dist;
        let dx = 0;
        let ballX: number | null = null;
        let ballY: number | null = null;
        if (p < 0.25) {
          // ball flies in an arc
          const q = p / 0.25;
          ballX = CREATURE_X + q * dist;
          ballY = FLOOR_Y - 6 - Math.sin(q * Math.PI) * 26;
        } else if (p < 0.55) {
          // creature chases
          const q = (p - 0.25) / 0.3;
          dx = q * (targetX - CREATURE_X);
          ballX = targetX;
          ballY = FLOOR_Y + 8;
        } else if (p < 0.7) {
          // sniffing around the ball
          dx = targetX - CREATURE_X;
          ballX = targetX;
          ballY = FLOOR_Y + 8;
        } else {
          // return trip — with or without the ball
          const q = (p - 0.7) / 0.3;
          dx = (1 - q) * (targetX - CREATURE_X);
          if (success) {
            ballX = CREATURE_X + dx + 6;
            ballY = FLOOR_Y + 4;
          } else {
            ballX = targetX;
            ballY = FLOOR_Y + 8;
          }
        }
        if (ballX !== null && ballY !== null) this.drawBall(ballX, ballY);
        this.drawCreature(t, dx, 1, null);
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
      act.onDone?.();
    }
  }

  /**
   * Draw the creature. `dxOverride` shifts it, `scaleMul` scales it (acts),
   * `hopY` overrides bob, `alphaSquashX/Y` deform for the death pose.
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

    // Idle bob + pulse-driven transforms.
    let bob = hopY !== null ? hopY : Math.sin(t * 2) * 1.5;
    let squashY = deathSquashY ?? 1;
    let squashX = deathSquashX ?? 1;
    let dx = dxAct;
    let rot = 0;

    if (v.asleep) {
      bob = Math.sin(t * 1.2) * 0.8;
      squashY = 0.94;
    }
    if (isGhost) {
      bob = Math.sin(t * 1.6) * 3 - 5; // hovers above the grass
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
    } else if (v.key === "egg") {
      // Egg rocks periodically.
      rot = Math.sin(t * 1.5) * 0.06;
    }

    this.curDx = dx;

    // Soft shadow (fainter under a hovering ghost)
    ctx.fillStyle = isGhost ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.15)";
    const shW = cw * (isGhost ? 0.5 : 0.7);
    ctx.fillRect(
      Math.round(CREATURE_X + dx - shW / 2),
      FLOOR_Y + 6,
      Math.round(shW),
      3,
    );

    const baseY = FLOOR_Y - cw + 12;
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
