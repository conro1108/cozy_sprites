// The postcard: a framed, shareable PNG snapshot of the pet, posed in a
// simplified meadow under today's actual sky and weather. Composed on a small
// logical-pixel canvas and blown up at an integer scale (smoothing off), so
// the art stays on the pixel grid; only the text is drawn at export size.
//
// Kept DOM-lazy: nothing here touches document at module load, so the pure
// caption helpers stay importable from tests.

import { buildCreatureCanvas, CELL } from "./sprites";
import type { Mood } from "./sprites";
import { ADULTS } from "../pet/roster";
import type { PetState } from "../pet/types";

export interface PostcardOpts {
  key: string; // creature key (see creatureKey)
  mood: Mood;
  name: string;
  subtitle: string; // "Scholar", "Teen", …
  night: boolean;
  weather: "clear" | "rain" | "snow";
  date: string;
}

/** What the caption line under the photo calls the pet. Adults go by their
 *  form name — by the time one exists the player has met it. */
export function postcardSubtitle(pet: PetState): string {
  if (pet.stage === "adult" && pet.form) return ADULTS[pet.form].name;
  return pet.stage.charAt(0).toUpperCase() + pet.stage.slice(1);
}

export function postcardDate(now: number): string {
  return new Date(now).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Logical layout (1 unit = 1 art pixel), scaled by SCALE for export.
// 108×192 at ×10 = 1080×1920: exactly an Instagram story.
const L_W = 108;
const L_H = 192;
const SCALE = 10;
const BORDER = 6; // white frame, top and sides
const BAND = 26; // the deeper polaroid band under the photo
const SCENE_X = BORDER;
const SCENE_Y = BORDER;
const SCENE_W = L_W - BORDER * 2;
const SCENE_H = L_H - BORDER - BAND;
const HORIZON = SCENE_Y + 100; // where the grass meets the sky

/** Compose the postcard scene at logical-pixel size. */
function buildScenePx(opts: PostcardOpts): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = L_W;
  c.height = L_H;
  const ctx = c.getContext("2d")!;

  // Card stock.
  ctx.fillStyle = "#f6f2e8";
  ctx.fillRect(0, 0, L_W, L_H);

  const overcast = !opts.night && opts.weather !== "clear";

  // Sky.
  ctx.fillStyle = opts.night ? "#2b2552" : overcast ? "#9cc0cd" : "#a8dcec";
  ctx.fillRect(SCENE_X, SCENE_Y, SCENE_W, HORIZON - SCENE_Y);
  ctx.fillStyle = opts.night ? "#3a3462" : overcast ? "#bcd6dd" : "#cfeef8";
  ctx.fillRect(SCENE_X, HORIZON - 8, SCENE_W, 8);

  if (opts.night) {
    // Moon (with its crescent carved in sky color) and a few fixed stars.
    ctx.fillStyle = "#f3edd0";
    fillDisc(ctx, SCENE_X + 18, SCENE_Y + 13, 5);
    ctx.fillStyle = "#2b2552";
    fillDisc(ctx, SCENE_X + 21, SCENE_Y + 12, 5);
    ctx.fillStyle = "#fff";
    for (const [sx, sy] of [
      [34, 8], [52, 16], [70, 6], [86, 18], [24, 28], [62, 32], [44, 42], [80, 46], [14, 44],
    ]) {
      ctx.fillRect(SCENE_X + sx, SCENE_Y + sy, 1, 1);
    }
  } else if (!overcast) {
    // Sun, top-left so the stamp keeps its corner.
    ctx.fillStyle = "#ffe9a3";
    fillDisc(ctx, SCENE_X + 16, SCENE_Y + 13, 6);
    ctx.fillStyle = "#fff2c8";
    ctx.fillRect(SCENE_X + 12, SCENE_Y + 9, 4, 1);
  }
  // Clouds — white on a fair day, heavier gray on a wet one. They keep below
  // the header text's sky (drawn at export size over roughly rows 36-52).
  ctx.fillStyle = opts.night ? "#4a4478" : overcast ? "#dde3e7" : "#ffffff";
  for (const [cx, cy] of overcast ? [[10, 24], [44, 60], [66, 28]] : [[26, 26], [58, 62]]) {
    ctx.fillRect(SCENE_X + cx, SCENE_Y + cy, 12, 3);
    ctx.fillRect(SCENE_X + cx + 2, SCENE_Y + cy - 2, 7, 2);
  }

  // Hills: a soft two-mound ridge.
  ctx.fillStyle = opts.night ? "#33484a" : "#7ab35e";
  for (let x = 0; x < SCENE_W; x++) {
    const q = (x / SCENE_W) * Math.PI * 2;
    const h = 5 + Math.round(3 * Math.sin(q) + 2 * Math.sin(q * 2 + 1));
    ctx.fillRect(SCENE_X + x, HORIZON - h, 1, h);
  }

  // Grass, tufts, flowers.
  ctx.fillStyle = opts.night ? "#3f5a3c" : "#9cc85a";
  ctx.fillRect(SCENE_X, HORIZON, SCENE_W, SCENE_Y + SCENE_H - HORIZON);
  ctx.fillStyle = opts.night ? "#38503a" : "#84b348";
  for (let i = 0; i < 14; i++) {
    const gx = SCENE_X + ((i * 29 + 7) % SCENE_W);
    const gy = HORIZON + 3 + ((i * 11) % (SCENE_Y + SCENE_H - HORIZON - 6));
    ctx.fillRect(gx, gy, 2, 1);
  }
  const flowers: [number, number, string][] = [
    [8, 20, "#e88bb0"],
    [16, 44, "#fff"],
    [76, 16, "#fff"],
    [86, 40, "#e88bb0"],
  ];
  for (const [fx, fy, color] of flowers) {
    ctx.fillStyle = color;
    ctx.fillRect(SCENE_X + fx, HORIZON + fy, 2, 2);
    ctx.fillStyle = "#f7d94c";
    ctx.fillRect(SCENE_X + fx, HORIZON + fy, 1, 1);
  }

  // The star of the card, posing dead center with its shadow under it.
  const size = CELL * 4;
  const px = SCENE_X + Math.round((SCENE_W - size) / 2);
  const py = SCENE_Y + SCENE_H - size - 4;
  ctx.fillStyle = opts.night ? "rgba(20,30,20,0.4)" : "rgba(60,90,40,0.35)";
  ctx.fillRect(px + 10, py + size - 2, size - 20, 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buildCreatureCanvas(opts.key, opts.mood), px, py, size, size);

  // Weather falls over the finished scene, just like the live meadow.
  if (opts.weather === "rain") {
    ctx.fillStyle = "rgba(182,212,236,0.7)";
    for (let i = 0; i < 24; i++) {
      ctx.fillRect(SCENE_X + ((i * 31 + 5) % SCENE_W), SCENE_Y + ((i * 41) % (SCENE_H - 4)), 1, 3);
    }
  } else if (opts.weather === "snow") {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(SCENE_X + ((i * 37 + 9) % SCENE_W), SCENE_Y + ((i * 47) % (SCENE_H - 2)), 1, 1);
    }
  }

  // The stamp: perforated white square, the egg (where everyone starts) inside.
  const stW = 22;
  const stH = 26;
  const stX = SCENE_X + SCENE_W - stW - 3;
  const stY = SCENE_Y + 3;
  ctx.fillStyle = "#f6f2e8";
  ctx.fillRect(stX, stY, stW, stH);
  ctx.fillStyle = opts.night ? "#2b2552" : overcast ? "#9cc0cd" : "#a8dcec";
  for (let i = 0; i < stW; i += 3) {
    ctx.fillRect(stX + i, stY, 1, 1);
    ctx.fillRect(stX + i, stY + stH - 1, 1, 1);
  }
  for (let i = 0; i < stH; i += 3) {
    ctx.fillRect(stX, stY + i, 1, 1);
    ctx.fillRect(stX + stW - 1, stY + i, 1, 1);
  }
  ctx.drawImage(buildCreatureCanvas("egg", "neutral"), stX + 3, stY + 6, CELL, CELL);

  return c;
}

/** The full postcard at export size, text and all. */
export function buildPostcard(opts: PostcardOpts): HTMLCanvasElement {
  const px = buildScenePx(opts);
  const out = document.createElement("canvas");
  out.width = L_W * SCALE;
  out.height = L_H * SCALE;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(px, 0, 0, out.width, out.height);

  const mono = 'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", monospace';

  // Header over the sky, sitting below where story UIs park their chrome.
  // Outlined so it reads on any weather.
  ctx.textAlign = "center";
  ctx.font = `bold ${5 * SCALE}px ${mono}`;
  ctx.lineWidth = SCALE;
  ctx.lineJoin = "round"; // miter joins spike badly on stroked glyphs
  ctx.strokeStyle = opts.night ? "#1c1838" : "#4a7a8c";
  ctx.fillStyle = "#ffffff";
  const headY = (SCENE_Y + 40) * SCALE;
  ctx.strokeText("GREETINGS FROM", out.width / 2, headY);
  ctx.fillText("GREETINGS FROM", out.width / 2, headY);
  ctx.strokeText("THE MEADOW", out.width / 2, headY + 6.2 * SCALE);
  ctx.fillText("THE MEADOW", out.width / 2, headY + 6.2 * SCALE);

  // The band: name big, subtitle and date quiet.
  const bandTop = (L_H - BAND) * SCALE;
  ctx.textAlign = "left";
  ctx.fillStyle = "#3a3630";
  ctx.font = `bold ${7 * SCALE}px ${mono}`;
  ctx.fillText(opts.name, BORDER * SCALE, bandTop + 11 * SCALE);
  ctx.font = `${4.2 * SCALE}px ${mono}`;
  ctx.fillStyle = "#8a8478";
  ctx.fillText(opts.subtitle, BORDER * SCALE, bandTop + 18.5 * SCALE);
  ctx.textAlign = "right";
  ctx.fillText(opts.date, (L_W - BORDER) * SCALE, bandTop + 18.5 * SCALE);

  return out;
}

function fillDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}

/**
 * Share the postcard: the native share sheet where the platform offers one
 * (the mobile PWA case this game is built for), a straight PNG download
 * otherwise. Resolves with which path it took, or "failed" if the canvas
 * refused to produce a blob.
 */
export async function sharePostcard(
  opts: PostcardOpts,
): Promise<"shared" | "downloaded" | "failed"> {
  const canvas = buildPostcard(opts);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], `${opts.name.toLowerCase()}-postcard.png`, {
    type: "image/png",
  });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch {
      // Cancelled or unsupported after all — fall through to the download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a); // some browsers ignore clicks on detached anchors
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
