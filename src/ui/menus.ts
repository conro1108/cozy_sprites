// Overlay screens: Food, Play (6 games), Care, Status, Help, Collection, Backup.
// Pure view code — every state change goes back through the MenuCtx callbacks.
// Games run *in the scene*: panels only collect input, then hand off to scene
// acts, and all result text comes out of the sprite's mouth.

import type { FoodId, GameId, PetState, FarmEntry, AdultForm } from "../pet/types";
import { ILLNESSES } from "../pet/types";
import { FOODS, FOOD_ORDER, ADULTS, ADULT_ORDER } from "../pet/roster";
import { ageLabel } from "../pet/format";
import { MAX_HEARTS } from "../pet/state";
import { farmConfirmLine } from "../pet/dialogue";
import {
  judgeHigherLower,
  judgeRps,
  rollCard,
  rpsAiMove,
  resolveFetch,
  pickHideSpot,
  hideSeekLine,
  randomWouldYou,
  HIDE_SPOTS,
  extendHum,
  humMatches,
  cubeHumLine,
  CUBE_FACES,
  CUBE_HUM_TARGET,
} from "../pet/games";
import type { RpsMove } from "../pet/games";
import { buildCreatureCanvas } from "../render/sprites";
import { iconEl, iconHTML } from "../render/icons";
import type { IconName } from "../render/icons";
import type { Scene } from "../render/scene";
import { getNotifyPref, setNotifyPref } from "./notifications";
import type { NotifyPref } from "./notifications";

export interface MenuCtx {
  pet(): PetState;
  farm(): FarmEntry[];
  discovered(): Set<AdultForm>;
  scene(): Scene;
  /** The .stage element — in-scene game controls overlay onto it. */
  stageEl(): HTMLElement;
  feed(food: FoodId): void;
  clean(): void;
  medicine(): void;
  discipline(): void;
  finishGame(game: GameId, won: boolean, line?: string): void;
  sayLine(text: string): void;
  sendToFarm(): void;
  exportSave(): string;
  importSave(code: string): boolean;
  reload(): void;
}

let root: HTMLElement;
export function initMenus(appRoot: HTMLElement): void {
  root = appRoot;
}

// --- Panel scaffold ---------------------------------------------------------
interface Panel {
  overlay: HTMLDivElement;
  body: HTMLDivElement;
  close: () => void;
  onClose: (fn: () => void) => void;
  setTitle: (title: string, sub?: string) => void;
}

function openPanel(title: string, sub?: string): Panel {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="panel">
      <button class="panel-close" aria-label="Close">✕</button>
      <h2></h2>
      <p class="panel-sub"></p>
      <div class="panel-body"></div>
    </div>`;
  const closers: (() => void)[] = [];
  const close = () => {
    closers.forEach((f) => f());
    overlay.remove();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".panel-close")!.addEventListener("click", close);
  const h2 = overlay.querySelector("h2")!;
  const subEl = overlay.querySelector<HTMLParagraphElement>(".panel-sub")!;
  const setTitle = (t: string, s?: string) => {
    h2.textContent = t;
    subEl.textContent = s ?? "";
    subEl.style.display = s ? "block" : "none";
  };
  setTitle(title, sub);
  root.appendChild(overlay);
  return {
    overlay,
    body: overlay.querySelector<HTMLDivElement>(".panel-body")!,
    close,
    onClose: (fn) => closers.push(fn),
    setTitle,
  };
}

function tile(icon: IconName, name: string, onClick: () => void, note?: string): HTMLElement {
  const el = document.createElement("button");
  el.className = "tile";
  el.appendChild(iconEl(icon, 32));
  const nameEl = document.createElement("span");
  nameEl.className = "tile-name";
  nameEl.textContent = name;
  el.appendChild(nameEl);
  if (note) {
    const noteEl = document.createElement("span");
    noteEl.className = "tile-note";
    noteEl.textContent = note;
    el.appendChild(noteEl);
  }
  el.addEventListener("click", onClick);
  return el;
}

/** Compact control strip overlaid on the stage for in-scene games. */
function stageOverlay(ctx: MenuCtx): { el: HTMLDivElement; close: () => void } {
  const el = document.createElement("div");
  el.className = "stage-controls";
  ctx.stageEl().appendChild(el);
  return { el, close: () => el.remove() };
}

/** Small dismiss button for in-scene game loops ("that's enough for now"). */
function doneButton(onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "btn secondary btn-small";
  b.textContent = "Done";
  b.addEventListener("click", onClick);
  return b;
}

/** Whether an in-scene game can immediately offer another round. */
function canReplay(ctx: MenuCtx): boolean {
  const p = ctx.pet();
  return p.deadAt === null && p.stage !== "egg" && !p.asleep;
}

// --- Food -------------------------------------------------------------------
const FOOD_ICONS: Record<FoodId, IconName> = {
  burger: "burger",
  cake: "cake",
  carrot: "carrot",
  noodles: "noodles",
  cube: "cube",
};

export function openFood(ctx: MenuCtx): void {
  const p = openPanel("Kitchen", "What's on the menu?");
  const grid = document.createElement("div");
  grid.className = "tile-grid";
  for (const id of FOOD_ORDER) {
    const f = FOODS[id];
    grid.appendChild(
      tile(FOOD_ICONS[id], f.name, () => {
        ctx.feed(id);
        p.close();
      }),
    );
  }
  p.body.appendChild(grid);
}

// --- Play (game picker) -----------------------------------------------------
const GAME_META: { id: GameId; icon: IconName; name: string }[] = [
  { id: "higherlower", icon: "dice", name: "Higher / Lower" },
  { id: "fetch", icon: "ball", name: "Fetch" },
  { id: "rps", icon: "rock", name: "Rock Paper Scissors" },
  { id: "hideseek", icon: "eyes", name: "Hide & Seek" },
  { id: "wouldyou", icon: "question", name: "Would You Rather" },
  { id: "cubehum", icon: "cube", name: "The Cube's Hum" },
];

export function openPlay(ctx: MenuCtx): void {
  const p = openPanel("Play", "Pick a game.");
  const grid = document.createElement("div");
  grid.className = "tile-grid";
  for (const g of GAME_META) {
    grid.appendChild(tile(g.icon, g.name, () => startGame(ctx, p, g.id)));
  }
  p.body.appendChild(grid);
}

function startGame(ctx: MenuCtx, p: Panel, game: GameId): void {
  switch (game) {
    case "higherlower":
      p.body.innerHTML = "";
      p.setTitle("Higher or Lower", "Best of 5 rounds.");
      higherLower(ctx, p);
      break;
    case "fetch":
      p.close();
      fetchGame(ctx);
      break;
    case "rps":
      p.close();
      rps(ctx);
      break;
    case "hideseek":
      p.close();
      hideSeek(ctx);
      break;
    case "wouldyou":
      p.close();
      wouldYou(ctx);
      break;
    case "cubehum":
      p.body.innerHTML = "";
      p.setTitle("The Cube's Hum", "Repeat what the cube hums.");
      cubeHum(ctx, p);
      break;
  }
}

// Panel-input game: cards in the panel, verdict spoken by the sprite.
function higherLower(ctx: MenuCtx, p: Panel): void {
  const wrap = document.createElement("div");
  wrap.className = "game-body";
  p.body.appendChild(wrap);

  let current = rollCard();
  let round = 0;
  let wins = 0;
  const total = 5;

  const numEl = document.createElement("div");
  numEl.className = "big-number";
  const info = document.createElement("p");
  const result = document.createElement("div");
  result.className = "game-result";
  const choices = document.createElement("div");
  choices.className = "game-choices";

  const higher = document.createElement("button");
  higher.className = "btn";
  higher.textContent = "▲ Higher";
  const lower = document.createElement("button");
  lower.className = "btn secondary";
  lower.textContent = "▼ Lower";
  choices.append(higher, lower);

  const guess = (isHigher: boolean) => {
    let next = rollCard();
    while (next === current) next = rollCard();
    const outcome = judgeHigherLower(current, isHigher, next);
    current = next;
    round++;
    if (outcome === "win") wins++;
    result.textContent = outcome === "win" ? `${next} — yes` : `${next} — no`;
    result.style.color = outcome === "win" ? "#2f8f2f" : "#c0492f";
    numEl.textContent = String(next);
    if (round >= total) {
      // Verdict comes from the pet, not the panel.
      const won = wins >= 3;
      setTimeout(() => {
        p.close();
        ctx.finishGame("higherlower", won);
      }, 650);
    } else {
      info.textContent = `Round ${round + 1} of ${total} · ${wins} correct`;
    }
  };

  higher.addEventListener("click", () => guess(true));
  lower.addEventListener("click", () => guess(false));
  numEl.textContent = String(current);
  info.textContent = `Round 1 of ${total}`;
  wrap.append(numEl, info, result, choices);
}

// Panel-input game: the cube hums a growing sequence of its four faces; you hum
// it back. Match all the way to CUBE_HUM_TARGET to win. The verdict — like every
// game — comes out of the sprite's mouth via finishGame().
const CUBE_PAD_COLORS = ["#8f86c4", "#d6f2fa", "#6fb8cc", "#b3abe0"];

function cubeHum(ctx: MenuCtx, p: Panel): void {
  const wrap = document.createElement("div");
  wrap.className = "game-body";
  p.body.appendChild(wrap);

  const info = document.createElement("p");
  const status = document.createElement("div");
  status.className = "game-result";
  const pads = document.createElement("div");
  pads.className = "cube-pads";

  const padEls: HTMLButtonElement[] = [];
  for (let i = 0; i < CUBE_FACES; i++) {
    const b = document.createElement("button");
    b.className = "cube-pad";
    b.style.setProperty("--pad", CUBE_PAD_COLORS[i]);
    b.appendChild(iconEl("cube", 26));
    b.addEventListener("click", () => onTap(i));
    padEls.push(b);
    pads.appendChild(b);
  }

  let seq = extendHum([]);
  let input: number[] = [];
  let accepting = false;
  let resolved = false;

  const flash = (i: number) => {
    const el = padEls[i];
    el.classList.add("lit");
    setTimeout(() => el.classList.remove("lit"), 260);
  };

  // Play the current sequence back to the player, then open the input window.
  const playSeq = () => {
    accepting = false;
    input = [];
    status.textContent = "Listen…";
    info.textContent = `A ${seq.length}-note hum.`;
    seq.forEach((face, idx) => {
      setTimeout(() => {
        // The panel can be torn out mid-hum (close, save restore) — don't keep
        // flashing a detached node or reopen input on a dead panel.
        if (!wrap.isConnected || resolved) return;
        flash(face);
        if (idx === seq.length - 1) {
          setTimeout(() => {
            if (!wrap.isConnected || resolved) return;
            accepting = true;
            status.textContent = "Hum it back.";
          }, 420);
        }
      }, 480 + idx * 520);
    });
  };

  const finishAndClose = (won: boolean) => {
    if (resolved) return;
    resolved = true;
    accepting = false;
    status.textContent = won ? "…" : "✕";
    setTimeout(() => {
      p.close();
      ctx.finishGame("cubehum", won, cubeHumLine(won));
    }, 520);
  };

  const onTap = (face: number) => {
    if (!accepting || resolved) return;
    flash(face);
    input.push(face);
    if (!humMatches(seq, input)) {
      finishAndClose(false);
      return;
    }
    if (input.length === seq.length) {
      if (seq.length >= CUBE_HUM_TARGET) {
        finishAndClose(true);
        return;
      }
      accepting = false;
      status.textContent = "Yes. Again, longer.";
      seq = extendHum(seq);
      setTimeout(() => {
        if (wrap.isConnected && !resolved) playSeq();
      }, 720);
    }
  };

  wrap.append(info, pads, status);
  playSeq();
}

// In-scene game: throw meter over the stage, animation in the scene.
// Loops: after each throw plays out, the meter comes right back.
function fetchGame(ctx: MenuCtx): void {
  const { el, close } = stageOverlay(ctx);
  const track = document.createElement("div");
  track.className = "throw-track";
  const sweet = document.createElement("div");
  sweet.className = "sweet";
  const marker = document.createElement("div");
  marker.className = "marker";
  track.append(sweet, marker);
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Throw!";

  let pos = 0;
  let dir = 1;
  let raf = 0;
  const animate = () => {
    // The overlay can be torn out from under us (death act, save restore) —
    // don't keep a zombie rAF loop mutating a detached node.
    if (!el.isConnected) return;
    pos += dir * 0.018;
    if (pos >= 1) {
      pos = 1;
      dir = -1;
    } else if (pos <= 0) {
      pos = 0;
      dir = 1;
    }
    marker.style.left = `calc(${pos * 100}% - 3px)`;
    raf = requestAnimationFrame(animate);
  };
  raf = requestAnimationFrame(animate);
  const dismiss = () => {
    cancelAnimationFrame(raf);
    close();
  };

  btn.addEventListener("click", () => {
    const res = resolveFetch(pos, undefined, ctx.pet().stage);
    dismiss();
    // The whole point: you see the throw, the chase, and the (non-)return —
    // and the animation matches the variant (sock, over the fence, wrong way…).
    ctx.scene().playFetch(pos, res.variant, () => {
      ctx.finishGame("fetch", res.success, res.line);
      if (canReplay(ctx)) fetchGame(ctx);
    });
  });

  const hint = document.createElement("p");
  hint.className = "stage-hint";
  hint.textContent = "Stop the marker in the green.";
  el.append(hint, track, btn, doneButton(dismiss));
}

// In-scene game: pick a move, watch the countdown play out at the sprite.
// Loops: the chooser comes straight back after each round, one tap per throw.
function rps(ctx: MenuCtx, round = 1): void {
  const cheat = ctx.pet().form === "gremlin";
  const { el, close } = stageOverlay(ctx);
  const hint = document.createElement("p");
  hint.className = "stage-hint";
  hint.textContent = round === 1 ? "Choose your weapon." : "Again. Choose.";
  const choices = document.createElement("div");
  choices.className = "game-choices";
  const moves: { m: RpsMove; icon: IconName; label: string }[] = [
    { m: "rock", icon: "rock", label: "Rock" },
    { m: "paper", icon: "paper", label: "Paper" },
    { m: "scissors", icon: "scissors", label: "Scissors" },
  ];
  for (const { m, icon, label } of moves) {
    const b = document.createElement("button");
    b.className = "btn secondary btn-iconed";
    b.appendChild(iconEl(icon, 20));
    b.appendChild(document.createTextNode(label));
    b.addEventListener("click", () => {
      const ai = rpsAiMove(m, cheat);
      const outcome = judgeRps(m, ai);
      close();
      ctx.scene().playRps(m as IconName, ai as IconName, outcome, () => {
        if (outcome === "tie") {
          ctx.finishGame("rps", false, "A tie. How embarrassing for us both.");
        } else if (outcome === "win") {
          ctx.finishGame("rps", true);
        } else {
          // The pick-after-you animation already shows the cheat; no need to
          // confess it out loud every single round.
          ctx.finishGame("rps", false, cheat && Math.random() < 0.3 ? "I definitely cheated." : undefined);
        }
        if (canReplay(ctx)) rps(ctx, round + 1);
      });
    });
    choices.appendChild(b);
  }
  el.append(hint, choices, doneButton(close));
}

// In-scene game: the sprite actually vanishes, then pops out of its spot.
// Loops: after the reveal, one tap hides it again.
function hideSeek(ctx: MenuCtx): void {
  const spot = pickHideSpot();
  ctx.scene().playHide(() => {
    const { el, close } = stageOverlay(ctx);
    const hint = document.createElement("p");
    hint.className = "stage-hint";
    hint.textContent = "Where did it go?";
    const row = document.createElement("div");
    row.className = "game-choices";
    for (const s of HIDE_SPOTS) {
      const b = document.createElement("button");
      b.className = "btn secondary btn-small";
      b.textContent = s;
      b.addEventListener("click", () => {
        const won = s === spot;
        close();
        ctx.scene().playReveal(spot, () => {
          ctx.finishGame("hideseek", won, hideSeekLine(won, spot));
          if (canReplay(ctx)) hideSeekAgain(ctx);
        });
      });
      row.appendChild(b);
    }
    el.append(hint, row);
  });
}

/** The between-rounds beat: hide again, or call it. */
function hideSeekAgain(ctx: MenuCtx): void {
  const { el, close } = stageOverlay(ctx);
  const row = document.createElement("div");
  row.className = "game-choices";
  const again = document.createElement("button");
  again.className = "btn btn-small";
  again.textContent = "Hide again";
  again.addEventListener("click", () => {
    close();
    hideSeek(ctx);
  });
  row.append(again, doneButton(close));
  el.append(row);
}

// In-scene game: the question floats over the stage so the pet's judgement is
// visible the moment you answer — and the next question is one tap away.
function wouldYou(ctx: MenuCtx): void {
  const { el, close } = stageOverlay(ctx);
  const q = randomWouldYou();
  const hint = document.createElement("p");
  hint.className = "stage-hint";
  hint.textContent = "Would you rather…";
  const choices = document.createElement("div");
  choices.className = "game-choices";
  const answer = (judge: string) => {
    close();
    // Not win/lose — always a small happiness bump (SPEC §11).
    ctx.finishGame("wouldyou", true, judge);
    if (canReplay(ctx)) wouldYou(ctx);
  };
  for (const [label, judge] of [
    [q.a, q.judgeA],
    [q.b, q.judgeB],
  ] as const) {
    const b = document.createElement("button");
    b.className = "btn secondary btn-small";
    b.textContent = label;
    b.addEventListener("click", () => answer(judge));
    choices.appendChild(b);
  }
  el.append(hint, choices, doneButton(close));
}

// --- Care -------------------------------------------------------------------
export function openCare(ctx: MenuCtx): void {
  const p = openPanel("Care", "Look after your sprite.");
  const pet = ctx.pet();

  const med = document.createElement("button");
  med.className = "btn btn-iconed";
  med.appendChild(iconEl("pill", 20));
  // Like the Food button, the label never advertises the pet's condition —
  // reading whether it's actually sick is part of the game.
  med.appendChild(document.createTextNode("Give Medicine"));
  med.addEventListener("click", () => {
    ctx.medicine();
    p.close();
  });

  const disc = document.createElement("button");
  disc.className = "btn secondary btn-iconed";
  disc.appendChild(iconEl("hand", 20));
  disc.appendChild(document.createTextNode("Discipline"));
  disc.addEventListener("click", () => {
    ctx.discipline();
    p.close();
  });

  const farm = document.createElement("button");
  farm.className = "btn danger btn-iconed";
  farm.appendChild(iconEl("tractor", 20));
  farm.appendChild(document.createTextNode("Send to Farm…"));
  farm.addEventListener("click", () => confirmFarm(ctx, p));

  p.body.append(med, disc, farm);

  if (pet.stage === "baby" || pet.stage === "egg") {
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Discipline has no effect this young.";
    p.body.appendChild(note);
  }
}

function confirmFarm(ctx: MenuCtx, p: Panel): void {
  const pet = ctx.pet();
  const young = pet.stage !== "adult";
  p.setTitle(
    "Send to Farm?",
    young
      ? "This is permanent. It hasn't finished growing up."
      : "This is permanent. Your sprite retires forever.",
  );
  p.body.innerHTML = "";
  const line = document.createElement("p");
  line.textContent = farmConfirmLine(pet.stage);
  line.style.fontStyle = "italic";
  if (young) line.style.color = "#8a3320";
  const confirm = document.createElement("button");
  confirm.className = "btn danger";
  confirm.textContent = young ? "Do it anyway" : "Yes, send to the farm";
  confirm.addEventListener("click", () => {
    ctx.sendToFarm();
    p.close();
  });
  const cancel = document.createElement("button");
  cancel.className = "btn secondary";
  cancel.textContent = "Never mind";
  cancel.addEventListener("click", p.close);
  p.body.append(line, confirm, cancel);
}

// --- Status -----------------------------------------------------------------
const STAGE_LABEL: Record<PetState["stage"], string> = {
  egg: "Egg",
  baby: "Baby",
  child: "Child",
  teen: "Teen",
  adult: "Adult",
};

export function openStatus(ctx: MenuCtx, now: number): void {
  const pet = ctx.pet();
  const p = openPanel(pet.name, "Status");
  const list = document.createElement("div");
  list.className = "stat-list";

  const formName = pet.form ? ADULTS[pet.form].name : STAGE_LABEL[pet.stage];
  const condition = pet.sick
    ? pet.illness
      ? `Has ${ILLNESSES[pet.illness].label}`
      : "Sick"
    : "Well";
  const rows: [string, string | HTMLElement][] = [
    ["Name", pet.name],
    ["Stage", pet.form ? `Adult · ${formName}` : STAGE_LABEL[pet.stage]],
    ["Age", ageLabel(now - pet.createdAt)],
    ["Weight", `${Math.round(pet.weight)}g`],
    ["Hunger", heartBar(pet.hunger)],
    ["Happiness", heartBar(pet.happiness)],
    ["Health", pctBar(pet.health)],
    ["Discipline", pctBar(pet.discipline)],
    ["Condition", condition],
  ];
  for (const [label, val] of rows) {
    const row = document.createElement("div");
    row.className = "row";
    const b = document.createElement("b");
    b.textContent = label;
    row.appendChild(b);
    if (typeof val === "string") {
      const span = document.createElement("span");
      span.textContent = val;
      row.appendChild(span);
    } else {
      row.appendChild(val);
    }
    list.appendChild(row);
  }
  p.body.appendChild(list);

  const coll = document.createElement("button");
  coll.className = "btn secondary btn-iconed";
  coll.appendChild(iconEl("book", 20));
  coll.appendChild(document.createTextNode("Collection & Farm"));
  coll.addEventListener("click", () => {
    p.close();
    openCollection(ctx);
  });
  const backup = document.createElement("button");
  backup.className = "btn secondary btn-iconed";
  backup.appendChild(iconEl("disk", 20));
  backup.appendChild(document.createTextNode("Backup save"));
  backup.addEventListener("click", () => {
    p.close();
    openBackup(ctx);
  });
  p.body.append(coll, backup);

  p.body.appendChild(notifySettings());

  // The manual, such as it is, hides in the margin. (Design note: obscure.)
  const help = document.createElement("button");
  help.className = "help-hidden";
  help.textContent = "?";
  help.setAttribute("aria-label", "About all this");
  help.addEventListener("click", () => {
    p.close();
    openHelp();
  });
  p.body.appendChild(help);
}

function notifySettings(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "notify-settings";
  const label = document.createElement("p");
  label.className = "muted";
  label.textContent = "Notifications";
  const row = document.createElement("div");
  row.className = "notify-row";
  const options: { pref: NotifyPref; text: string }[] = [
    { pref: "off", text: "Off" },
    { pref: "dire", text: "Dire only" },
    { pref: "all", text: "Any care drop" },
  ];
  const paint = (active: NotifyPref) => {
    row.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.pref === active);
    });
  };
  for (const o of options) {
    const b = document.createElement("button");
    b.className = "notify-opt";
    b.dataset.pref = o.pref;
    b.textContent = o.text;
    b.addEventListener("click", async () => {
      const effective = await setNotifyPref(o.pref);
      paint(effective);
      if (effective !== o.pref) {
        label.textContent = "Notifications (blocked by the browser)";
      }
    });
    row.appendChild(b);
  }
  wrap.append(label, row);
  paint(getNotifyPref());
  return wrap;
}

function heartBar(v: number): HTMLElement {
  const el = document.createElement("span");
  const full = Math.round(v);
  el.textContent = "♥".repeat(full) + "♡".repeat(Math.max(0, MAX_HEARTS - full));
  el.style.color = "#ff5c7a";
  el.style.letterSpacing = "1px";
  return el;
}

function pctBar(v: number): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "bar";
  const span = document.createElement("span");
  span.style.width = `${Math.max(0, Math.min(100, v))}%`;
  bar.appendChild(span);
  return bar;
}

// --- Help (deliberately vague — operations, not spoilers) ---------------------
export function openHelp(): void {
  const p = openPanel("A note", undefined);
  const body = document.createElement("div");
  body.className = "help-body";
  body.innerHTML = `
    <p>It eats when hungry. It plays when bored. It sleeps when the lantern is out.</p>
    <p>Messes fester. Illness lingers. Medicine works, when it's warranted.</p>
    <p>Some fusses are real. Some are theatre. Learn to tell the difference —
    it notices whether you can.</p>
    <p class="muted">Everything else, it will have to show you itself. What it becomes is
    a record of how it was raised. No, we won't be more specific.</p>`;
  p.body.appendChild(body);
}

// --- Collection & Farm ------------------------------------------------------
function portrait(key: string): HTMLCanvasElement {
  const src = buildCreatureCanvas(key, "neutral");
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 48;
  const cx = c.getContext("2d")!;
  cx.imageSmoothingEnabled = false;
  cx.drawImage(src, 0, 0, 48, 48);
  return c;
}

export function openCollection(ctx: MenuCtx): void {
  const p = openPanel("Collection", "Adults you've discovered.");
  const discovered = ctx.discovered();

  const grid = document.createElement("div");
  grid.className = "tile-grid";
  for (const form of ADULT_ORDER) {
    const found = discovered.has(form);
    const def = ADULTS[form];
    // Secret forms leave no trace until you've raised one.
    if (def.secret && !found) continue;
    const el = document.createElement("div");
    el.className = "tile";
    if (found) {
      // Built with createElement — innerHTML += would re-serialize the canvas
      // and silently wipe its drawn bitmap.
      el.appendChild(portrait(form));
      const name = document.createElement("span");
      name.className = "tile-name";
      name.textContent = def.name;
      const note = document.createElement("span");
      note.className = "tile-note";
      note.textContent = def.blurb;
      el.append(name, note);
    } else {
      el.appendChild(iconEl("question", 32));
      el.insertAdjacentHTML(
        "beforeend",
        `<span class="tile-name">???</span><span class="tile-note">Undiscovered</span>`,
      );
    }
    grid.appendChild(el);
  }
  p.body.appendChild(grid);

  const farm = ctx.farm();
  const h = document.createElement("h2");
  h.innerHTML = `${iconHTML("tractor", 18)} The Farm`;
  h.style.fontSize = "1.1rem";
  h.style.marginTop = "18px";
  p.body.appendChild(h);

  if (farm.length === 0) {
    const none = document.createElement("p");
    none.className = "muted";
    none.textContent = "No retirees yet. Your sprites are still with you.";
    p.body.appendChild(none);
  } else {
    const list = document.createElement("div");
    list.className = "farm-list";
    for (const e of farm) {
      const card = document.createElement("div");
      card.className = "farm-card";
      if (e.passedAway) {
        card.appendChild(iconEl("grave", 48));
      } else {
        card.appendChild(portrait(e.form ?? (e.finalStage === "egg" ? "egg" : e.finalStage)));
      }
      const meta = document.createElement("div");
      meta.className = "meta";
      const name = e.form ? ADULTS[e.form].name : STAGE_LABEL[e.finalStage];
      const fate = e.passedAway
        ? `Lived ${ageLabel(e.ageMs)} · died of ${e.cause ?? "unknown causes"}`
        : `Lived ${ageLabel(e.ageMs)} · retired ${new Date(e.retiredAt).toLocaleDateString()}`;
      const b = document.createElement("b");
      b.textContent = e.name;
      meta.appendChild(b);
      meta.appendChild(document.createTextNode(` — ${name}`));
      const sub = document.createElement("div");
      sub.textContent = fate;
      meta.appendChild(sub);
      card.appendChild(meta);
      list.appendChild(card);
    }
    p.body.appendChild(list);
  }
}

// --- Backup -----------------------------------------------------------------
export function openBackup(ctx: MenuCtx): void {
  const p = openPanel("Backup", "Copy this code to save your progress elsewhere.");
  const ta = document.createElement("textarea");
  ta.className = "code";
  ta.readOnly = true;
  ta.value = ctx.exportSave();
  const copy = document.createElement("button");
  copy.className = "btn";
  copy.textContent = "Copy code";
  copy.addEventListener("click", () => {
    // navigator.clipboard only exists in secure contexts (not plain-http LAN
    // testing) — fall back to select + execCommand there.
    ta.select();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(ta.value);
    } else {
      document.execCommand("copy");
    }
    copy.textContent = "Copied!";
  });

  const hr = document.createElement("p");
  hr.className = "muted";
  hr.textContent = "Paste a backup code below to restore (replaces current save):";
  const inp = document.createElement("textarea");
  inp.className = "code";
  inp.placeholder = "Paste code here…";
  const restore = document.createElement("button");
  restore.className = "btn secondary";
  restore.textContent = "Restore";
  restore.addEventListener("click", () => {
    if (ctx.importSave(inp.value)) {
      p.close();
      ctx.reload();
    } else {
      restore.textContent = "Invalid code";
    }
  });

  p.body.append(ta, copy, hr, inp, restore);
}
