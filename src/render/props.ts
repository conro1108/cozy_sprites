// Pixel-art scenery for the Farm diorama — trees, pond, picnic, campfire,
// bunting and friends. Same char-grid technique as icons.ts, but grids here
// are whatever size the prop wants (width = longest row). Rendered once to
// data URLs and cached; use propEl for placed props and propUrl for tiled
// CSS backgrounds (the bunting and horizon fence repeat-x).

export type PropName =
  | "tree"
  | "flowers"
  | "tuft"
  | "pond"
  | "hay"
  | "picnic"
  | "campfire"
  | "bunting"
  | "lanterns"
  | "fence"
  | "barn"
  | "cloud"
  | "headstone"
  | "note";

interface PropDef {
  rows: string[];
  palette: Record<string, string>;
}

const K = "#402e3a"; // shared outline ink (matches icons.ts)

const PROPS: Record<PropName, PropDef> = {
  tree: {
    rows: [
      ".....kkkkk......",
      "...kkgggggkk....",
      "..kggglgggggk...",
      ".kgglllggggggk..",
      ".kglllllgglggk..",
      "kggllllggglllgk.",
      "kglllllggggllgk.",
      "kgglllgggggggk..",
      ".kggggggglggk...",
      "..kkgggggggk....",
      "....kkgggkk.....",
      "......ktbk......",
      "......ktbk......",
      ".....kttbk......",
      ".....ktttbk.....",
    ],
    palette: { k: K, g: "#4e8a3c", l: "#74b356", t: "#7a5230", b: "#5c3d22" },
  },
  flowers: {
    rows: [
      ".r...w...p.",
      "rrr.www.ppp",
      ".r.g.w.g.p.",
      ".g.g.g.g.g.",
      "gggggggggggg",
    ],
    palette: { g: "#5a9440", r: "#e06a7c", w: "#f6f1dc", p: "#c98add" },
  },
  tuft: {
    rows: [
      "g..g..g",
      ".g.g.g.",
      ".ggggg.",
    ],
    palette: { g: "#6aa348" },
  },
  pond: {
    rows: [
      "......kkkkkkkkkkkk......",
      "...kkkwwbbbbbbbbwwkkk...",
      ".kkbwwbbbbwwbbbbbbwwbkk.",
      "kbbbbbwwbbbbbbwwbbbbbbbk",
      "kbbwwbbbbbbwbbbbbbwwbbbk",
      ".kbbbbbwwbbbbbwwbbbbbbk.",
      "..kkbbbbbbbwwbbbbbbkkk..",
      "....kkkkkkkkkkkkkkk.....",
    ],
    palette: { k: "#3d6b52", b: "#5db3c9", w: "#a8e4ef" },
  },
  hay: {
    rows: [
      ".kkkkkkkkkk.",
      "khyyhhyyhyhk",
      "kyhyyhhyhyyk",
      "khhyhyyhhyhk",
      "kyhyhhyhyhyk",
      "khyyhyhhyyhk",
      ".kkkkkkkkkk.",
    ],
    palette: { k: "#8a6a2e", y: "#e8c56a", h: "#c9a648" },
  },
  picnic: {
    rows: [
      "......kbbbk.........",
      "......kbbbk.........",
      ".....kbbbbbk........",
      "..kkkkkkkkkkkkkkk...",
      ".krwrwrwrwrwrwrwrk..",
      "kwrwrwrwrwrwrwrwrwk.",
      "krwrwrwrwrwrwrwrwrrk",
      "kkkkkkkkkkkkkkkkkkkk",
    ],
    palette: { k: K, r: "#e05c48", w: "#f7ecd8", b: "#b98a4e" },
  },
  campfire: {
    rows: [
      ".....y......",
      "....yoy.....",
      "....yoy.....",
      "...yooroy...",
      "...yorroy...",
      "..yorrrroy..",
      "..yorrrroy..",
      "...yorroy...",
      ".t..yooy..t.",
      ".ttttkktttt.",
      "t.tt.kk.tt.t",
    ],
    palette: { k: K, y: "#ffd884", o: "#f59a3e", r: "#e05c48", t: "#7a5230" },
  },
  bunting: {
    // one repeating unit of festival flags on a string
    rows: [
      "ssssssssssss",
      ".rrr..bbb...",
      ".rrr..bbb...",
      "..r....b....",
      "............",
    ],
    palette: { s: "#8a6a4e", r: "#e06a7c", b: "#6aa9d8" },
  },
  lanterns: {
    // one repeating unit of paper lanterns on a string, for festival nights
    rows: [
      "ssssssssssss",
      "..k.....k...",
      ".kok...kok..",
      ".oyo...oyo..",
      ".oyo...oyo..",
      ".kok...kok..",
      "............",
    ],
    palette: { k: K, s: "#7a6a8a", o: "#f59a3e", y: "#ffe9a8" },
  },
  fence: {
    // distant paddock fence, tiles along the horizon
    rows: [
      "w........w..",
      "wwwwwwwwwwww",
      "w........w..",
      "wwwwwwwwwwww",
      "w........w..",
      "w........w..",
    ],
    palette: { w: "#9a7148" },
  },
  barn: {
    rows: [
      ".......kkkkkkkkk........",
      ".....kkrrrrrrrrrkk......",
      "...kkrrrrrrrrrrrrrkk....",
      ".kkrrrrrrrrrrrrrrrrrkk..",
      "kkbbbbbbbbbbbbbbbbbbbkk.",
      ".kbbwwbbbbbdddbbbbwwbk..",
      ".kbbwwbbbbdddddbbbwwbk..",
      ".kbbbbbbbbddkddbbbbbbk..",
      ".kbbbbbbbbddkddbbbbbbk..",
      ".kkkkkkkkkkkkkkkkkkkkk..",
    ],
    palette: { k: K, r: "#b0453a", b: "#c9584a", w: "#f7ecd8", d: "#7a4034" },
  },
  cloud: {
    rows: [
      "....wwwww.......",
      "..wwwwwwwww.ww..",
      ".wwwwwwwwwwwwww.",
      "wwwwwwwwwwwwwwww",
      ".wwwwww.wwwwww..",
    ],
    palette: { w: "#ffffff" },
  },
  headstone: {
    // a rounded stone with a carved rim, moss and a flower at its foot
    rows: [
      "....kkkkkk....",
      "...kssssssk...",
      "..kssccccssk..",
      "..kscssssssk..",
      "..kssssssssk..",
      "..kscssssssk..",
      "..kssssssssk..",
      "..kscsssscsk..",
      "..kssssssssk..",
      ".kssssssssssk.",
      "rkmmssssssmmkg",
      ".g.g.g..g.g.g.",
    ],
    palette: { k: K, s: "#b0b4c4", c: "#888ca0", m: "#6a9a58", g: "#5a9440", r: "#e06a7c" },
  },
  note: {
    rows: [
      "...kk...",
      "...kkk..",
      "...k.kk.",
      "...k....",
      "...k....",
      ".kkk....",
      "kkkk....",
      ".kk.....",
    ],
    palette: { k: "#5a4a6a" },
  },
};

const urlCache = new Map<string, string>();

/** Render a prop to a cached data URL, 1 device px per cell. */
export function propUrl(name: PropName): string {
  const cached = urlCache.get(name);
  if (cached) return cached;
  const def = PROPS[name];
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const row = def.rows[y];
    for (let x = 0; x < row.length; x++) {
      const color = def.palette[row[x]];
      if (!color) continue;
      const i = (y * w + x) * 4;
      img.data[i] = parseInt(color.slice(1, 3), 16);
      img.data[i + 1] = parseInt(color.slice(3, 5), 16);
      img.data[i + 2] = parseInt(color.slice(5, 7), 16);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL();
  urlCache.set(name, url);
  return url;
}

/** Cell dimensions of a prop grid (for sizing tiled backgrounds). */
export function propSize(name: PropName): { w: number; h: number } {
  const def = PROPS[name];
  return { w: Math.max(...def.rows.map((r) => r.length)), h: def.rows.length };
}

/** An `<img>` for a placed prop, scaled up nearest-neighbour by CSS. */
export function propEl(name: PropName, scale = 3): HTMLImageElement {
  const { w, h } = propSize(name);
  const img = document.createElement("img");
  img.className = "pxprop";
  img.src = propUrl(name);
  img.width = w * scale;
  img.height = h * scale;
  img.alt = "";
  img.draggable = false;
  return img;
}
