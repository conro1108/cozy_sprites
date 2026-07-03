// Pixel-art UI icons — replaces every emoji in the interface. Authored as
// 12×12 char grids with tiny fixed palettes, rendered once to data URLs and
// cached, so they can be used both as elements and inside innerHTML templates.

export type IconName =
  | "status"
  | "burger"
  | "play"
  | "broom"
  | "bandage"
  | "bulb"
  | "moon"
  | "heart"
  | "heartgold"
  | "cake"
  | "carrot"
  | "noodles"
  | "cube"
  | "dice"
  | "ball"
  | "eyes"
  | "question"
  | "pill"
  | "hand"
  | "tractor"
  | "book"
  | "disk"
  | "egg"
  | "grave"
  | "sparkle"
  | "alert"
  | "thermometer"
  | "rock"
  | "paper"
  | "scissors";

interface IconDef {
  rows: string[];
  palette: Record<string, string>;
}

const K = "#402e3a"; // shared outline ink

const ICONS: Record<IconName, IconDef> = {
  status: {
    // clipboard
    rows: [
      "....kkkk....",
      "..kkkccckkk.",
      "..kpppppppk.",
      "..kpkkkkkpk.",
      "..kpppppppk.",
      "..kpkkkkkpk.",
      "..kpppppppk.",
      "..kpkkkkkpk.",
      "..kpppppppk.",
      "..kpppppppk.",
      "..kkkkkkkkk.",
      "............",
    ],
    palette: { k: K, p: "#fdf3e0", c: "#c9a96a" },
  },
  burger: {
    rows: [
      "............",
      "...kkkkkk...",
      "..kbbbbbbk..",
      ".kbbsbbsbbk.",
      ".kLLLLLLLLk.",
      ".ktttttttk..",
      ".kmmmmmmmmk.",
      ".kbbbbbbbbk.",
      "..kbbbbbbk..",
      "...kkkkkk...",
      "............",
      "............",
    ],
    palette: { k: K, b: "#eeb060", s: "#fbe6b6", L: "#7fc45e", t: "#e05c48", m: "#8a5030" },
  },
  play: {
    // game ball with star
    rows: [
      "............",
      "....kkkk....",
      "...kbbbbk...",
      "..kbbwbbbk..",
      ".kbbwwwbbbk.",
      ".kbwwwwwbbk.",
      ".kbbwwwbbbk.",
      ".kbbbwbbbbk.",
      "..kbbbbbbk..",
      "...kbbbbk...",
      "....kkkk....",
      "............",
    ],
    palette: { k: K, b: "#e07a4a", w: "#fdf3e0" },
  },
  broom: {
    rows: [
      "........kk..",
      ".......kk...",
      "......kk....",
      ".....kk.....",
      "....kk......",
      "...hhh......",
      "..hhhhh.....",
      ".hhhhhh.....",
      ".hhhhhh.....",
      ".h.hh.h.....",
      ".h.hh.h.....",
      "............",
    ],
    palette: { k: "#8a5a3c", h: "#e8c06a" },
  },
  bandage: {
    rows: [
      "............",
      "..kkk.......",
      ".kbbbkk.....",
      ".kbbbbbkk...",
      "..kkbpbbbk..",
      "....kbpbbbk.",
      ".....kbbpbk.",
      "......kbbbk.",
      ".......kbk..",
      "........k...",
      "............",
      "............",
    ],
    palette: { k: K, b: "#f0c896", p: "#fdf3e0" },
  },
  bulb: {
    rows: [
      "....kkkk....",
      "...kyyyyk...",
      "..kyyyyyyk..",
      "..kyywyyyk..",
      "..kyywyyyk..",
      "..kyyyyyyk..",
      "...kyyyyk...",
      "....kyyk....",
      "....kggk....",
      "....kggk....",
      ".....kk.....",
      "............",
    ],
    palette: { k: K, y: "#ffd884", w: "#fff7dc", g: "#9a9cb0" },
  },
  moon: {
    rows: [
      "............",
      "....kkkk....",
      "...kmmmmk...",
      "..kmmkkkk...",
      ".kmmk.......",
      ".kmmk...w...",
      ".kmmk.......",
      ".kmmk.....w.",
      "..kmmkkkk...",
      "...kmmmmk...",
      "....kkkk....",
      "............",
    ],
    palette: { k: K, m: "#f3edd0", w: "#fffef0" },
  },
  heart: {
    rows: [
      "............",
      "..rr....rr..",
      ".rrrr..rrrr.",
      ".rwrrrrrrrr.",
      ".rrrrrrrrrr.",
      ".rrrrrrrrrr.",
      "..rrrrrrrr..",
      "...rrrrrr...",
      "....rrrr....",
      ".....rr.....",
      "............",
      "............",
    ],
    palette: { r: "#ff5c7a", w: "#ffc2cf" },
  },
  heartgold: {
    rows: [
      "............",
      "..rr....rr..",
      ".rrrr..rrrr.",
      ".rwrrrrrrrr.",
      ".rrrrrrrrrr.",
      ".rrrrrrrrrr.",
      "..rrrrrrrr..",
      "...rrrrrr...",
      "....rrrr....",
      ".....rr.....",
      "............",
      "............",
    ],
    palette: { r: "#f0b840", w: "#ffe9b0" },
  },
  cake: {
    rows: [
      ".....c......",
      ".....f......",
      "....kkkk....",
      "...kppppk...",
      "..kppppppk..",
      "..kwwwwwwk..",
      "..kssssssk..",
      "..kwwwwwwk..",
      "..kssssssk..",
      "..kkkkkkkk..",
      "............",
      "............",
    ],
    palette: { k: K, p: "#f2a0bc", w: "#fdf3e0", s: "#e8b088", c: "#ffd884", f: "#e05c48" },
  },
  carrot: {
    rows: [
      ".........gg.",
      "........gg..",
      ".......gg...",
      "......oo....",
      ".....oooo...",
      "....oooo....",
      "...oooo.....",
      "..oooo......",
      ".ooo........",
      ".oo.........",
      "............",
      "............",
    ],
    palette: { o: "#f08030", g: "#5aa85a" },
  },
  noodles: {
    rows: [
      "............",
      ".w..w..w....",
      ".w..w..w..k.",
      ".w..w..w.k..",
      ".w..w..wk...",
      "kkkkkkkkkk..",
      "kbbbbbbbbk..",
      "kbbbbbbbbk..",
      ".kbbbbbbk...",
      "..kkkkkk....",
      "............",
      "............",
    ],
    palette: { k: K, b: "#e07a4a", w: "#fbe6b6" },
  },
  cube: {
    // An actual isometric cube: a diamond top face over a darker left face and
    // a mid-tone right face, split by the front vertical edge down the middle.
    rows: [
      "............",
      ".....kk.....",
      "....kTTk....",
      "..kkTTTTkk..",
      ".kTTTTTTTTk.",
      "kTTTTTTTTTTk",
      "kLLLLLRRRRRk",
      "kLLLLLRRRRRk",
      ".kLLLLRRRRk.",
      "..kLLLRRRk..",
      "...kLLRRk...",
      "....kkkk....",
    ],
    palette: { k: "#5b88a0", T: "#d6f2fa", L: "#6fb8cc", R: "#a3ddec" },
  },
  dice: {
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kwwwwwwwwk.",
      ".kwpwwwwpwk.",
      ".kwwwwwwwwk.",
      ".kwwwppwwwk.",
      ".kwwwppwwwk.",
      ".kwwwwwwwwk.",
      ".kwpwwwwpwk.",
      ".kwwwwwwwwk.",
      "..kkkkkkkk..",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", p: "#402e3a" },
  },
  ball: {
    rows: [
      "............",
      "....kkkk....",
      "...kyyyyk...",
      "..kyywyyyk..",
      ".kyywyyyyyk.",
      ".kywyyyyyyk.",
      ".kyyyyyywyk.",
      ".kyyyyyywyk.",
      "..kyyyywyk..",
      "...kyyyyk...",
      "....kkkk....",
      "............",
    ],
    palette: { k: K, y: "#a8d84a", w: "#f0f8d0" },
  },
  eyes: {
    // two peeking eyes in the dark
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kddddddddk.",
      ".kdwwddwwdk.",
      ".kdwedwedk..",
      ".kdwwddwwdk.",
      ".kddddddddk.",
      "..kkkkkkkk..",
      "............",
      "............",
      "............",
      "............",
    ],
    palette: { k: K, d: "#3a2b3f", w: "#fdf3e0", e: "#402e3a" },
  },
  question: {
    rows: [
      "............",
      "...qqqqq....",
      "..qq...qq...",
      "..qq...qq...",
      ".......qq...",
      "......qq....",
      ".....qq.....",
      ".....qq.....",
      "............",
      ".....qq.....",
      ".....qq.....",
      "............",
    ],
    palette: { q: "#8a6f57" },
  },
  pill: {
    rows: [
      "............",
      "............",
      "...kkkkkk...",
      "..krrrwwwk..",
      ".krrrrwwwwk.",
      ".krrrrwwwwk.",
      "..krrrwwwk..",
      "...kkkkkk...",
      "............",
      "............",
      "............",
      "............",
    ],
    palette: { k: K, r: "#e05c48", w: "#fdf3e0" },
  },
  hand: {
    rows: [
      "............",
      "....h.h.h...",
      "...hhhhhhh..",
      "...hhhhhhh..",
      "...hhhhhhh..",
      ".h.hhhhhhh..",
      ".hhhhhhhhh..",
      "..hhhhhhhh..",
      "...hhhhhh...",
      "....hhhh....",
      "............",
      "............",
    ],
    palette: { h: "#f0c896" },
  },
  tractor: {
    rows: [
      "............",
      "...kkkk.....",
      "...krrk.....",
      "kkkkrrkkkk..",
      "krrrrrrrrk..",
      "krrrrrrrrkk.",
      "kkkkkkkkkkk.",
      ".kwk....kwk.",
      "kwwwk..kwwwk",
      ".kwk....kwk.",
      "............",
      "............",
    ],
    palette: { k: K, r: "#e05c48", w: "#8a6f57" },
  },
  book: {
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kbbbbbbbbk.",
      ".kbwwwwwwbk.",
      ".kbwbbbbwbk.",
      ".kbwwwwwwbk.",
      ".kbwbbbwwbk.",
      ".kbwwwwwwbk.",
      ".kbbbbbbbbk.",
      "..kkkkkkkk..",
      "............",
      "............",
    ],
    palette: { k: K, b: "#8f77c6", w: "#fdf3e0" },
  },
  disk: {
    rows: [
      "............",
      ".kkkkkkkkk..",
      ".kbbwwwbbkk.",
      ".kbbwwwbbbk.",
      ".kbbbbbbbbk.",
      ".kbbbbbbbbk.",
      ".kbwwwwwwbk.",
      ".kbwwwwwwbk.",
      ".kbwwwwwwbk.",
      ".kkkkkkkkkk.",
      "............",
      "............",
    ],
    palette: { k: K, b: "#5b88a0", w: "#fdf3e0" },
  },
  egg: {
    rows: [
      "............",
      "....kkkk....",
      "...kccck....",
      "..kcccccck..",
      "..koccccck..",
      ".kcccccccck.",
      ".kccoccccck.",
      ".kcccccccck.",
      ".kccccoccck.",
      "..kcccccck..",
      "...kkkkkk...",
      "............",
    ],
    palette: { k: K, c: "#f7e7c4", o: "#c69a6a" },
  },
  grave: {
    rows: [
      "............",
      "....kkkk....",
      "...ksssck...",
      "..kssssssk..",
      "..kscccssk..",
      "..ksscsssk..",
      "..ksscsssk..",
      "..kssssssk..",
      "..kssssssk..",
      ".kkkkkkkkkk.",
      ".gggggggggg.",
      "............",
    ],
    palette: { k: K, s: "#b0b4c4", c: "#7c8094", g: "#5aa85a" },
  },
  sparkle: {
    rows: [
      "............",
      ".....y......",
      ".....y......",
      "...yyyyy....",
      ".....y......",
      ".....y......",
      "..........w.",
      ".w..........",
      "............",
      ".....w......",
      "............",
      "............",
    ],
    palette: { y: "#ffd884", w: "#fff7dc" },
  },
  alert: {
    rows: [
      "....rrrr....",
      "....rrrr....",
      "....rrrr....",
      "....rrrr....",
      "....rrrr....",
      "....rrrr....",
      ".....rr.....",
      "............",
      "....rrrr....",
      "....rrrr....",
      "............",
      "............",
    ],
    palette: { r: "#e05c48" },
  },
  thermometer: {
    rows: [
      "............",
      ".....kk.....",
      "....kwwk....",
      "....kwrk....",
      "....kwrk....",
      "....kwrk....",
      "....kwrk....",
      "...krrrrk...",
      "...krrrrk...",
      "....krrk....",
      ".....kk.....",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", r: "#e05c48" },
  },
  rock: {
    rows: [
      "............",
      "............",
      "....ssss....",
      "..ssssssss..",
      ".sssswsssss.",
      ".ssswssssss.",
      ".sssssssss..",
      "..ssssssss..",
      "...ssssss...",
      "............",
      "............",
      "............",
    ],
    palette: { s: "#9a9cb0", w: "#c8cbe0" },
  },
  paper: {
    rows: [
      "............",
      "..wwwwwww...",
      "..wwwwwwww..",
      "..wwwwwwww..",
      "..wllllllw..",
      "..wwwwwwww..",
      "..wllllllw..",
      "..wwwwwwww..",
      "..wllllllw..",
      "..wwwwwwww..",
      "............",
      "............",
    ],
    palette: { w: "#fdf3e0", l: "#c9b896" },
  },
  scissors: {
    rows: [
      "............",
      ".ss......ss.",
      "..ss....ss..",
      "...ss..ss...",
      "....ssss....",
      ".....ss.....",
      "....ssss....",
      "...rr..rr...",
      "..r..r.r..r.",
      "..r..r.r..r.",
      "...rr...rr..",
      "............",
    ],
    palette: { s: "#9a9cb0", r: "#e05c48" },
  },
};

const CELL = 12;
const urlCache = new Map<string, string>();
const canvasCache = new Map<string, HTMLCanvasElement>();

/** A raw 12×12 canvas for drawing into other canvases (the scene uses this). */
export function iconCanvas(name: IconName): HTMLCanvasElement {
  const cached = canvasCache.get(name);
  if (cached) return cached;
  const canvas = renderIcon(name);
  canvasCache.set(name, canvas);
  return canvas;
}

function renderIcon(name: IconName): HTMLCanvasElement {
  const def = ICONS[name];
  const canvas = document.createElement("canvas");
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(CELL, CELL);
  for (let y = 0; y < def.rows.length && y < CELL; y++) {
    const row = def.rows[y];
    for (let x = 0; x < row.length && x < CELL; x++) {
      const color = def.palette[row[x]];
      if (!color) continue;
      const i = (y * CELL + x) * 4;
      img.data[i] = parseInt(color.slice(1, 3), 16);
      img.data[i + 1] = parseInt(color.slice(3, 5), 16);
      img.data[i + 2] = parseInt(color.slice(5, 7), 16);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Render an icon to a cached data URL (drawn 1px per cell, scaled by CSS). */
export function iconUrl(name: IconName): string {
  const cached = urlCache.get(name);
  if (cached) return cached;
  const url = iconCanvas(name).toDataURL();
  urlCache.set(name, url);
  return url;
}

/** `<img>` markup for innerHTML templates. Size in CSS px. */
export function iconHTML(name: IconName, size = 20): string {
  return `<img class="pxicon" src="${iconUrl(name)}" width="${size}" height="${size}" alt="" />`;
}

/** An `<img>` element for programmatic composition. */
export function iconEl(name: IconName, size = 20): HTMLImageElement {
  const img = document.createElement("img");
  img.className = "pxicon";
  img.src = iconUrl(name);
  img.width = size;
  img.height = size;
  img.alt = "";
  return img;
}
