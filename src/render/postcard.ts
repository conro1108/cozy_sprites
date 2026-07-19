// The postcard: a framed, shareable PNG snapshot of the pet, posed in a
// simplified meadow under today's actual sky, weather, and season. Composed on
// a small logical-pixel canvas and blown up at an integer scale (smoothing
// off), so the art stays on the pixel grid; only the text is drawn at export
// size.
//
// Kept DOM-lazy: nothing here touches document at module load, so the pure
// caption helpers stay importable from tests.

import { buildCreatureCanvas, CELL } from "./sprites";
import type { Mood } from "./sprites";
import type { AdultForm } from "../pet/types";

export type Season = "spring" | "summer" | "fall" | "winter";

export interface PostcardOpts {
  key: string; // creature key (see creatureKey)
  mood: Mood;
  name: string;
  night: boolean;
  weather: "clear" | "rain" | "snow";
  season: Season;
  /** A teen's adult-hint leaning — the same accent the live scene tints it
   *  with, so a teen posts as the specific one it's becoming (not a generic
   *  teen). Null/absent for every other stage. */
  variant?: AdultForm | null;
}

// Logical layout (1 unit = 1 art pixel), scaled by SCALE for export.
// 108×192 at ×10 = 1080×1920: exactly an Instagram story.
const L_W = 108;
const L_H = 192;
const SCALE = 10;
const BORDER = 6; // white frame, top and sides
const BAND = 30; // the deeper polaroid band under the photo (holds the caption)
const SCENE_X = BORDER;
const SCENE_Y = BORDER;
const SCENE_W = L_W - BORDER * 2;
const SCENE_H = L_H - BORDER - BAND;
const HORIZON = SCENE_Y + 98; // where the grass meets the sky

// The ground palette per season — the same tables the live meadow dresses in
// (see SEASON_GROUND / the night grounds in render/scene.ts), so a shared
// postcard matches whatever season the player is looking at in-game.
type GroundPalette = { hills: string; grass: string; tuft: string };
const SEASON_GROUND: Record<Season, GroundPalette> = {
  spring: { hills: "#8ec572", grass: "#b2d878", tuft: "#98c463" },
  summer: { hills: "#7ab35e", grass: "#9cc85a", tuft: "#84b348" },
  fall: { hills: "#a89a52", grass: "#c9ae5c", tuft: "#a88e46" },
  winter: { hills: "#d8e4ed", grass: "#edf3f7", tuft: "#d4e0e8" },
};
const NIGHT_GROUND: GroundPalette = { hills: "#33484a", grass: "#3f5a3c", tuft: "#38503a" };
const WINTER_NIGHT_GROUND: GroundPalette = { hills: "#45566a", grass: "#7d8ba0", tuft: "#6e7c92" };

// Sun and moon as round pixel discs, drawn from the meadow's own half-width
// row tables (SUN_ROWS/MOON_ROWS in render/scene.ts) so the sky bodies read
// exactly as they do in-game rather than as generic circles.
const SUN_ROWS: [number, number][] = [
  [-4, 2], [-3, 3], [-2, 4], [-1, 4], [0, 4], [1, 4], [2, 4], [3, 3], [4, 2],
];
const MOON_ROWS: [number, number][] = [
  [-3, 2], [-2, 3], [-1, 3], [0, 3], [1, 3], [2, 3], [3, 2],
];

// The little flower dots that pepper the patch, keyed to the season's blooms
// (mirrors flowerPatch in scene.ts). Winter gets a couple of muted berries;
// everything else blooms in its own key.
const SEASON_FLOWERS: Record<Season, string[]> = {
  spring: ["#f7f2df", "#f2b8cc", "#ffd884", "#f7f2df"],
  summer: ["#e88bb0", "#ffffff", "#ffd884", "#e88bb0"],
  fall: ["#d0603a", "#e8b04a", "#b8542e", "#e8b04a"],
  winter: ["#c65a6e", "#c65a6e"],
};

// Distant hill ridge: the same gently rolling line of soft, identical mounds
// the meadow uses (one soft cosine, every peak the same low crown) — see
// hillHeightAt in render/scene.ts. A wider period than the live scene so the
// narrower postcard reads as just two calm mounds, not a crowded row.
const HILL_PERIOD = 48; // px between mound peaks (two across the 96px scene)
const HILL_PEAK_X = 24; // x of the first peak (peaks at 24/72, edges in valleys)
function hillHeightAt(x: number): number {
  const p = (2 * Math.PI * (x - HILL_PEAK_X)) / HILL_PERIOD;
  return 7 + Math.round(3 * Math.cos(p));
}

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
  const winter = opts.season === "winter";
  const ground = opts.night
    ? winter
      ? WINTER_NIGHT_GROUND
      : NIGHT_GROUND
    : SEASON_GROUND[opts.season];

  // Sky.
  ctx.fillStyle = opts.night ? "#2b2552" : overcast ? "#9cc0cd" : "#a8dcec";
  ctx.fillRect(SCENE_X, SCENE_Y, SCENE_W, HORIZON - SCENE_Y);
  ctx.fillStyle = opts.night ? "#3a3462" : overcast ? "#bcd6dd" : "#cfeef8";
  ctx.fillRect(SCENE_X, HORIZON - 8, SCENE_W, 8);

  if (opts.night) {
    // Moon on the right, its crescent carved by a second disc in the sky color
    // nudged right — the same MOON_ROWS pose the live meadow draws. A few fixed
    // stars, kept clear of the disc.
    ctx.fillStyle = "#f3edd0";
    fillDiscRows(ctx, SCENE_X + 80, SCENE_Y + 13, MOON_ROWS);
    ctx.fillStyle = "#2b2552";
    fillDiscRows(ctx, SCENE_X + 83, SCENE_Y + 13, MOON_ROWS);
    ctx.fillStyle = "#fff";
    for (const [sx, sy] of [
      [16, 10], [34, 8], [50, 16], [64, 7], [88, 24],
      [22, 32], [44, 28], [60, 42], [30, 48], [12, 44],
    ]) {
      ctx.fillRect(SCENE_X + sx, SCENE_Y + sy, 1, 1);
    }
  } else if (!overcast) {
    // Sun, upper-right with its top-left glint — the meadow's own SUN_ROWS disc.
    ctx.fillStyle = "#ffe9a3";
    fillDiscRows(ctx, SCENE_X + 80, SCENE_Y + 12, SUN_ROWS);
    ctx.fillStyle = "#fff2c8";
    ctx.fillRect(SCENE_X + 77, SCENE_Y + 9, 3, 1);
    ctx.fillRect(SCENE_X + 78, SCENE_Y + 8, 2, 1);
  }
  // Clouds — white on a fair day, heavier gray on a wet one.
  ctx.fillStyle = opts.night ? "#4a4478" : overcast ? "#dde3e7" : "#ffffff";
  for (const [cx, cy] of overcast ? [[10, 24], [44, 60], [66, 28]] : [[26, 26], [58, 62]]) {
    ctx.fillRect(SCENE_X + cx, SCENE_Y + cy, 12, 3);
    ctx.fillRect(SCENE_X + cx + 2, SCENE_Y + cy - 2, 7, 2);
  }

  // Hills: a rolling ridge of soft, identical mounds — the meadow's own ridge.
  ctx.fillStyle = ground.hills;
  for (let x = 0; x < SCENE_W; x++) {
    const h = hillHeightAt(x);
    ctx.fillRect(SCENE_X + x, HORIZON - h, 1, h);
  }

  // Grass, tufts, flowers.
  ctx.fillStyle = ground.grass;
  ctx.fillRect(SCENE_X, HORIZON, SCENE_W, SCENE_Y + SCENE_H - HORIZON);
  ctx.fillStyle = ground.tuft;
  for (let i = 0; i < 14; i++) {
    const gx = SCENE_X + ((i * 29 + 7) % SCENE_W);
    const gy = HORIZON + 3 + ((i * 11) % (SCENE_Y + SCENE_H - HORIZON - 6));
    ctx.fillRect(gx, gy, 2, 1);
  }
  // Fall only: a few dropped leaves scattered in among the tufts.
  if (opts.season === "fall" && !opts.night) {
    for (let i = 0; i < 7; i++) {
      const lx = SCENE_X + ((i * 41 + 11) % SCENE_W);
      const ly = HORIZON + 5 + ((i * 17 + 5) % (SCENE_Y + SCENE_H - HORIZON - 8));
      ctx.fillStyle = i % 2 ? "#c9673a" : "#a84f2c";
      ctx.fillRect(lx, ly, i % 3 ? 1 : 2, 1);
    }
  }
  const flowerColors = SEASON_FLOWERS[opts.season];
  const flowerSpots: [number, number][] = [
    [8, 20], [16, 44], [76, 16], [86, 40],
  ];
  flowerSpots.slice(0, flowerColors.length).forEach(([fx, fy], i) => {
    ctx.fillStyle = flowerColors[i];
    ctx.fillRect(SCENE_X + fx, HORIZON + fy, 2, 2);
    // Bright seasons get a sunny center; winter berries stay a single tone.
    if (!winter) {
      ctx.fillStyle = "#f7d94c";
      ctx.fillRect(SCENE_X + fx, HORIZON + fy, 1, 1);
    }
  });

  // The star of the card, posing dead center with its shadow under it.
  const size = CELL * 4;
  const px = SCENE_X + Math.round((SCENE_W - size) / 2);
  const py = SCENE_Y + SCENE_H - size - 4;
  ctx.fillStyle = opts.night ? "rgba(20,30,20,0.4)" : "rgba(60,90,40,0.35)";
  ctx.fillRect(px + 10, py + size - 2, size - 20, 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buildCreatureCanvas(opts.key, opts.mood, opts.variant), px, py, size, size);

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

  return c;
}

/** The full postcard at export size, caption and all. */
export function buildPostcard(opts: PostcardOpts): HTMLCanvasElement {
  const px = buildScenePx(opts);
  const out = document.createElement("canvas");
  out.width = L_W * SCALE;
  out.height = L_H * SCALE;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(px, 0, 0, out.width, out.height);

  const mono = 'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", monospace';

  // The band, as a postcard caption: the "Greetings from the Meadow" label
  // small and quiet up top, the pet's name signed big underneath.
  const bandTop = (L_H - BAND) * SCALE;
  ctx.textAlign = "center";
  const midX = out.width / 2;
  ctx.fillStyle = "#8a8478";
  ctx.font = `bold ${3.6 * SCALE}px ${mono}`;
  ctx.fillText("GREETINGS FROM THE MEADOW", midX, bandTop + 10 * SCALE);
  ctx.fillStyle = "#3a3630";
  ctx.font = `bold ${9 * SCALE}px ${mono}`;
  ctx.fillText(opts.name, midX, bandTop + 23 * SCALE);

  return out;
}

/** Fill a round pixel disc from a half-width-per-row table (see SUN_ROWS /
 *  MOON_ROWS) — the same technique the live meadow uses, so the card's sky
 *  bodies land on the exact same pixels. */
function fillDiscRows(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rows: [number, number][],
): void {
  for (const [dy, hw] of rows) ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
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
