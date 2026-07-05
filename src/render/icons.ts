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
  | "dice2"
  | "dice6"
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
  | "scissors"
  | "fist";

interface IconDef {
  rows: string[];
  palette: Record<string, string>;
}

const K = "#402e3a"; // shared outline ink

const ICONS: Record<IconName, IconDef> = {
  status: {
    // clipboard — text lines in soft brown so they read as writing, not bars
    rows: [
      "....kkkk....",
      "..kkkccckkk.",
      "..kpppppppk.",
      "..kplllllpk.",
      "..kpppppppk.",
      "..kplllllpk.",
      "..kpppppppk.",
      "..kplllllpk.",
      "..kpppppppk.",
      "..kpppppppk.",
      "..kkkkkkkkk.",
      "............",
    ],
    palette: { k: K, p: "#fdf3e0", c: "#c9a96a", l: "#c9b896" },
  },
  burger: {
    rows: [
      "............",
      "...kkkkkk...",
      "..kbbbbbbk..",
      ".kbbsbbsbbk.",
      ".kLLLLLLLLk.",
      ".kttttttttk.",
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
    // a little gamepad: d-pad left, button diamond right
    rows: [
      "............",
      "............",
      ".kkkkkkkkkk.",
      "kggggggggggk",
      "kggdggggrggk",
      "kgdddggrgrgk",
      "kggdggggrggk",
      "kggggggggggk",
      ".kkkkkkkkkk.",
      "............",
      "............",
      "............",
    ],
    palette: { k: K, g: "#ddd0b0", d: "#5c4a38", r: "#e05c48" },
  },
  broom: {
    // angled wooden handle sweeping down into a full, outlined bristle fan
    rows: [
      ".........kk.",
      "........khk.",
      ".......khk..",
      "......khk...",
      ".....khk....",
      "...kkkkkk...",
      "..kyybyyyk..",
      "..kybyyybk..",
      ".kyybyyybyk.",
      ".kybyyybyyk.",
      ".kkkkkkkkkk.",
      "............",
    ],
    palette: { k: K, h: "#a97048", y: "#e8c06a", b: "#c9a050" },
  },
  bandage: {
    // a proper plaster: tan wings, pale pad, dotted texture
    rows: [
      "............",
      "............",
      "............",
      "..kkkkkkkk..",
      ".kbbppppbbk.",
      ".kbbpddpbbk.",
      ".kbbpddpbbk.",
      ".kbbppppbbk.",
      "..kkkkkkkk..",
      "............",
      "............",
      "............",
    ],
    palette: { k: K, b: "#f0c896", p: "#fdf3e0", d: "#e8b088" },
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
      "..kk....kk..",
      ".krrk..krrk.",
      "krwrrkkrrrrk",
      "krrrrrrrrrrk",
      "krrrrrrrrrrk",
      ".krrrrrrrrk.",
      "..krrrrrrk..",
      "...krrrrk...",
      "....krrk....",
      ".....kk.....",
      "............",
    ],
    palette: { k: K, r: "#ff5c7a", w: "#ffc2cf" },
  },
  heartgold: {
    rows: [
      "............",
      "..kk....kk..",
      ".krrk..krrk.",
      "krwrrkkrrrrk",
      "krrrrrrrrrrk",
      "krrrrrrrrrrk",
      ".krrrrrrrrk.",
      "..krrrrrrk..",
      "...krrrrk...",
      "....krrk....",
      ".....kk.....",
      "............",
    ],
    palette: { k: K, r: "#f0b840", w: "#ffe9b0" },
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
      "...g.g.g....",
      "...ggggg....",
      "....ggg.....",
      "...kkkkk....",
      "...koook....",
      "...kowok....",
      "...koook....",
      "....kok.....",
      "....kok.....",
      ".....k......",
      "............",
      "............",
    ],
    palette: { k: K, o: "#f08030", w: "#ffb066", g: "#5aa85a" },
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
    // A box in three-quarter view: a flat square front face, a lighter top face
    // slanting up-right, and a darker side face — so it reads as a solid cube,
    // not a gem. F = front, T = top, R = right side.
    rows: [
      "............",
      "....kkkkkkkk",
      "...kTTTTTTkk",
      "..kTTTTTTkRk",
      ".kkkkkkkkRRk",
      ".kFFFFFFkRRk",
      ".kFFFFFFkRRk",
      ".kFFFFFFkRRk",
      ".kFFFFFFkRRk",
      ".kFFFFFFkRk.",
      ".kFFFFFFkk..",
      ".kkkkkkkk...",
    ],
    palette: { k: K, T: "#d6f2fa", F: "#a3ddec", R: "#6fb8cc" },
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
  // Extra die faces the name-reroll button flashes through mid-tumble.
  dice2: {
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kwwwwwwwwk.",
      ".kwppwwwwwk.",
      ".kwppwwwwwk.",
      ".kwwwwwwwwk.",
      ".kwwwwwwwwk.",
      ".kwwwwwppwk.",
      ".kwwwwwppwk.",
      ".kwwwwwwwwk.",
      "..kkkkkkkk..",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", p: "#402e3a" },
  },
  dice6: {
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kwwwwwwwwk.",
      ".kwpwwwwpwk.",
      ".kwwwwwwwwk.",
      ".kwpwwwwpwk.",
      ".kwwwwwwwwk.",
      ".kwpwwwwpwk.",
      ".kwwwwwwwwk.",
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
    // the mystery card: an outlined tile with the question on it
    rows: [
      "............",
      ".kkkkkkkkkk.",
      ".kwwqqqwwwk.",
      ".kwqqwqqwwk.",
      ".kwwwwqqwwk.",
      ".kwwwqqwwwk.",
      ".kwwwqqwwwk.",
      ".kwwwwwwwwk.",
      ".kwwwqqwwwk.",
      ".kkkkkkkkkk.",
      "............",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", q: "#5e3e29" },
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
    // an open, raised palm — three finger grooves and a thumb. The universal
    // "that's enough" gesture.
    rows: [
      "............",
      "..kkkkkkkk..",
      ".khhkhhkhhk.",
      ".khhkhhkhhk.",
      ".khhkhhkhhk.",
      ".khhhhhhhhk.",
      "kkhhhhhhhhk.",
      "kthhhhhhhhk.",
      ".kthhhhhhk..",
      "..khhhhhk...",
      "...kkkkk....",
      "............",
    ],
    palette: { k: K, h: "#f0c896", t: "#d9a86f" },
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
    // a clean four-point star with two glints
    rows: [
      "............",
      ".....y......",
      ".....y......",
      "....ywy.....",
      "..yywwwyy...",
      "....ywy.....",
      ".....y......",
      ".....y......",
      "..w......w..",
      "............",
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
      "...kkkkkk...",
      "..kswssssk..",
      ".kswwsssssk.",
      ".kssssssssk.",
      ".kssssssssk.",
      "..kssssssk..",
      "...kkkkkk...",
      "............",
      "............",
      "............",
      "............",
    ],
    palette: { k: K, s: "#9a9cb0", w: "#c8cbe0" },
  },
  paper: {
    rows: [
      "............",
      "..kkkkkkkk..",
      "..kwwwwwwk..",
      "..kwllllwk..",
      "..kwwwwwwk..",
      "..kwllllwk..",
      "..kwwwwwwk..",
      "..kwllllwk..",
      "..kwwwwwwk..",
      "..kkkkkkkk..",
      "............",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", l: "#c9b896" },
  },
  fist: {
    // the RPS countdown pump — a fist, knuckles forward
    rows: [
      "............",
      "............",
      "...kkkkk....",
      "..khhhhhk...",
      ".khhhhhhhk..",
      ".khkhkhkhk..",
      ".khhhhhhhk..",
      ".kthhhhhhk..",
      ".kthhhhhk...",
      "..kkkkkk....",
      "............",
      "............",
    ],
    palette: { k: K, h: "#f0c896", t: "#d9a86f" },
  },
  scissors: {
    // blades in the outline ink itself; outlined red handle loops
    rows: [
      "............",
      ".kk......kk.",
      "..kk....kk..",
      "...kk..kk...",
      "....kkkk....",
      ".....kk.....",
      "....kkkk....",
      "..kkk..kkk..",
      "..krk..krk..",
      "..krk..krk..",
      "..kkk..kkk..",
      "............",
    ],
    palette: { k: K, r: "#e05c48" },
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
