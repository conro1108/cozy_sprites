// The room: a small cozy pixel habitat drawn to a low-res buffer and scaled up
// crisply (CSS image-rendering: pixelated). Runs its own rAF animation loop.

import { CELL, buildCreatureCanvas } from "./sprites";
import type { Mood } from "./sprites";

export const SCENE_W = 112;
export const SCENE_H = 132;

const FLOOR_Y = 90; // wall/floor boundary

export interface SceneView {
  key: string; // creature key
  mood: Mood;
  poops: number;
  night: boolean;
  asleep: boolean;
  lightsOn: boolean;
}

type Pulse = "none" | "happy" | "shake" | "evolve" | "eat";

export class Scene {
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

  constructor(canvas: HTMLCanvasElement) {
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

  private draw(now: number): void {
    const ctx = this.ctx;
    const t = (now - this.t0) / 1000;
    const v = this.view;
    const dark = v.night && !v.lightsOn;

    // --- Room ---------------------------------------------------------------
    // Wall
    ctx.fillStyle = dark ? "#2b2542" : "#e7c9a8";
    ctx.fillRect(0, 0, SCENE_W, FLOOR_Y);
    // Wall trim / wainscoting stripe
    ctx.fillStyle = dark ? "#241f38" : "#d8b58f";
    ctx.fillRect(0, FLOOR_Y - 10, SCENE_W, 10);
    // Floor (wood planks)
    ctx.fillStyle = dark ? "#3a2f33" : "#b6885b";
    ctx.fillRect(0, FLOOR_Y, SCENE_W, SCENE_H - FLOOR_Y);
    ctx.fillStyle = dark ? "#332a2e" : "#a97b50";
    for (let x = 0; x < SCENE_W; x += 16) ctx.fillRect(x, FLOOR_Y, 1, SCENE_H - FLOOR_Y);

    this.drawWindow(t, dark, v);
    this.drawBed(dark);
    this.drawPlant(dark);
    this.drawRug(dark);

    // --- Poops (on the floor) ----------------------------------------------
    for (let i = 0; i < Math.min(v.poops, 4); i++) {
      this.drawPoop(14 + i * 22, SCENE_H - 12);
    }

    // --- Creature -----------------------------------------------------------
    this.drawCreature(t);

    // --- Night dim overlay --------------------------------------------------
    if (dark) {
      ctx.fillStyle = "rgba(20,16,40,0.35)";
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    }
    // Warm lamp glow when lights are on at night
    if (v.night && v.lightsOn) {
      const g = ctx.createRadialGradient(SCENE_W / 2, 40, 6, SCENE_W / 2, 40, 90);
      g.addColorStop(0, "rgba(255,220,150,0.22)");
      g.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    }
  }

  private drawWindow(t: number, dark: boolean, v: SceneView): void {
    const ctx = this.ctx;
    const wx = 66;
    const wy = 14;
    const ww = 34;
    const wh = 34;
    // frame
    ctx.fillStyle = dark ? "#1d1930" : "#8a6a4a";
    ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
    // sky
    ctx.fillStyle = dark ? "#141232" : "#9fd6f0";
    ctx.fillRect(wx, wy, ww, wh);
    if (dark) {
      // moon + stars
      ctx.fillStyle = "#f3edd0";
      ctx.fillRect(wx + 22, wy + 6, 6, 6);
      ctx.fillStyle = "#141232";
      ctx.fillRect(wx + 20, wy + 5, 3, 3);
      ctx.fillStyle = "#fff";
      const stars = [
        [6, 8],
        [12, 20],
        [24, 26],
        [8, 28],
      ];
      for (const [sx, sy] of stars) {
        if (Math.sin(t * 2 + sx) > -0.3) ctx.fillRect(wx + sx, wy + sy, 1, 1);
      }
    } else {
      // sun + drifting cloud
      ctx.fillStyle = "#ffe9a3";
      ctx.fillRect(wx + 6, wy + 6, 7, 7);
      ctx.fillStyle = "#ffffff";
      const cx = wx + ((t * 4) % (ww + 12)) - 6;
      ctx.fillRect(cx, wy + 20, 12, 4);
      ctx.fillRect(cx + 3, wy + 17, 7, 3);
    }
    // muntins (cross bars)
    ctx.fillStyle = dark ? "#1d1930" : "#8a6a4a";
    ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
    ctx.fillRect(wx, wy + wh / 2 - 1, ww, 2);
    void v;
  }

  private drawBed(dark: boolean): void {
    const ctx = this.ctx;
    const by = FLOOR_Y - 4;
    // frame
    ctx.fillStyle = dark ? "#3a2f45" : "#8a5a3c";
    ctx.fillRect(2, by, 40, 18);
    // mattress / blanket
    ctx.fillStyle = dark ? "#5b6a8a" : "#e59aa8";
    ctx.fillRect(4, by + 3, 36, 9);
    // pillow
    ctx.fillStyle = dark ? "#c8cbe0" : "#fdf3e6";
    ctx.fillRect(5, by + 4, 10, 7);
  }

  private drawPlant(dark: boolean): void {
    const ctx = this.ctx;
    const px = SCENE_W - 14;
    const py = FLOOR_Y + 2;
    // pot
    ctx.fillStyle = dark ? "#6b4a3a" : "#c07a4a";
    ctx.fillRect(px, py + 8, 10, 10);
    // leaves
    ctx.fillStyle = dark ? "#2f5a3a" : "#5aa85a";
    ctx.fillRect(px + 3, py - 4, 4, 12);
    ctx.fillRect(px - 1, py, 5, 6);
    ctx.fillRect(px + 6, py, 5, 6);
  }

  private drawRug(dark: boolean): void {
    const ctx = this.ctx;
    const rx = 30;
    const ry = SCENE_H - 16;
    ctx.fillStyle = dark ? "#4a3d5a" : "#d98a5a";
    ctx.fillRect(rx, ry, 52, 12);
    ctx.fillStyle = dark ? "#5a4d6a" : "#f0c07a";
    ctx.fillRect(rx + 4, ry + 3, 44, 6);
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

  private drawCreature(t: number): void {
    const ctx = this.ctx;
    const v = this.view;
    const scale = 3;
    const cw = CELL * scale;
    const baseX = Math.round(SCENE_W / 2 - cw / 2);
    const baseY = FLOOR_Y - cw + 12; // stand on the floor

    // Idle bob + pulse-driven transforms.
    let bob = Math.sin(t * 2) * 1.5;
    let squashY = 1;
    let squashX = 1;
    let dx = 0;
    let rot = 0;

    if (v.asleep) {
      bob = Math.sin(t * 1.2) * 0.8;
      squashY = 0.94;
    }

    const pdt = (performance.now() - this.pulseStart) / 1000;
    if (this.pulse !== "none" && pdt < 0.6) {
      const p = pdt / 0.6;
      if (this.pulse === "happy" || this.pulse === "eat") {
        bob -= Math.abs(Math.sin(p * Math.PI * 3)) * 6;
        squashY = 1 + Math.sin(p * Math.PI * 2) * 0.08;
      } else if (this.pulse === "shake") {
        dx = Math.sin(p * Math.PI * 8) * 4;
      } else if (this.pulse === "evolve") {
        rot = Math.sin(p * Math.PI * 6) * 0.15;
        squashX = 1 + Math.sin(p * Math.PI * 4) * 0.1;
      }
    } else if (v.key === "egg") {
      // Egg rocks periodically.
      rot = Math.sin(t * 1.5) * 0.06;
    }

    // Soft shadow
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    const shW = cw * 0.7;
    ctx.fillRect(
      Math.round(SCENE_W / 2 - shW / 2),
      FLOOR_Y + 6,
      Math.round(shW),
      3,
    );

    ctx.save();
    const cx = SCENE_W / 2 + dx;
    const cy = baseY + cw / 2 + bob;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(squashX, squashY);
    ctx.drawImage(this.creatureCanvas, -cw / 2, -cw / 2, cw, cw);
    ctx.restore();

    void baseX;
  }
}
