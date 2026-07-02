// Overlay screens: Food, Play (5 games), Care, Status, Help, Collection, Backup.
// Pure view code — every state change goes back through the MenuCtx callbacks.

import type { FoodId, GameId, PetState, FarmEntry, AdultForm } from "../pet/types";
import { FOODS, FOOD_ORDER, ADULTS, ADULT_ORDER } from "../pet/roster";
import { ageLabel } from "../pet/format";
import { MAX_HEARTS } from "../pet/state";
import {
  judgeHigherLower,
  judgeRps,
  rollCard,
  rpsAiMove,
  resolveFetch,
  pickHideSpot,
  randomWouldYou,
  HIDE_SPOTS,
} from "../pet/games";
import type { RpsMove } from "../pet/games";
import { buildCreatureCanvas } from "../render/sprites";

export interface MenuCtx {
  pet(): PetState;
  farm(): FarmEntry[];
  discovered(): Set<AdultForm>;
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

function tile(icon: string, name: string, onClick: () => void, note?: string): HTMLElement {
  const el = document.createElement("button");
  el.className = "tile";
  el.innerHTML = `<span class="tile-ico">${icon}</span><span class="tile-name">${name}</span>${
    note ? `<span class="tile-note">${note}</span>` : ""
  }`;
  el.addEventListener("click", onClick);
  return el;
}

// --- Food -------------------------------------------------------------------
export function openFood(ctx: MenuCtx): void {
  const p = openPanel("Kitchen", "What's on the menu?");
  const grid = document.createElement("div");
  grid.className = "tile-grid";
  for (const id of FOOD_ORDER) {
    const f = FOODS[id];
    grid.appendChild(
      tile(f.icon, f.name, () => {
        ctx.feed(id);
        p.close();
      }),
    );
  }
  p.body.appendChild(grid);
}

// --- Play (game picker) -----------------------------------------------------
const GAME_META: { id: GameId; icon: string; name: string }[] = [
  { id: "higherlower", icon: "🔢", name: "Higher / Lower" },
  { id: "fetch", icon: "🎾", name: "Fetch" },
  { id: "rps", icon: "✊", name: "Rock Paper Scissors" },
  { id: "hideseek", icon: "🙈", name: "Hide & Seek" },
  { id: "wouldyou", icon: "🤔", name: "Would You Rather" },
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
  p.body.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "game-body";
  p.body.appendChild(wrap);
  switch (game) {
    case "higherlower":
      p.setTitle("Higher or Lower", "Best of 5 rounds.");
      higherLower(ctx, p, wrap);
      break;
    case "fetch":
      p.setTitle("Fetch", "Stop the marker in the green.");
      fetchGame(ctx, p, wrap);
      break;
    case "rps":
      p.setTitle("Rock Paper Scissors", "Choose your weapon.");
      rps(ctx, p, wrap);
      break;
    case "hideseek":
      p.setTitle("Hide & Seek", "Where did it go?");
      hideSeek(ctx, p, wrap);
      break;
    case "wouldyou":
      p.setTitle("Would You Rather", "There are no right answers.");
      wouldYou(ctx, p, wrap);
      break;
  }
}

function endGameButton(ctx: MenuCtx, p: Panel, game: GameId, won: boolean, line?: string): HTMLElement {
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Done";
  btn.addEventListener("click", () => {
    ctx.finishGame(game, won, line);
    p.close();
  });
  return btn;
}

function higherLower(ctx: MenuCtx, p: Panel, wrap: HTMLElement): void {
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
  higher.textContent = "⬆ Higher";
  const lower = document.createElement("button");
  lower.className = "btn secondary";
  lower.textContent = "⬇ Lower";
  choices.append(higher, lower);

  const guess = (isHigher: boolean) => {
    let next = rollCard();
    while (next === current) next = rollCard();
    const outcome = judgeHigherLower(current, isHigher, next);
    current = next;
    round++;
    if (outcome === "win") wins++;
    result.textContent = outcome === "win" ? `${next} — nice!` : `${next} — nope.`;
    result.style.color = outcome === "win" ? "#2f8f2f" : "#c0492f";
    numEl.textContent = String(next);
    if (round >= total) finish();
    else info.textContent = `Round ${round + 1} of ${total} · ${wins} correct`;
  };
  const finish = () => {
    const won = wins >= 3;
    choices.remove();
    info.textContent = `${wins} / ${total} correct.`;
    result.textContent = won ? "You win!" : "You lose. The numbers cheated.";
    result.style.color = won ? "#2f8f2f" : "#c0492f";
    wrap.appendChild(endGameButton(ctx, p, "higherlower", won));
  };

  higher.addEventListener("click", () => guess(true));
  lower.addEventListener("click", () => guess(false));
  numEl.textContent = String(current);
  info.textContent = `Round 1 of ${total}`;
  wrap.append(numEl, info, result, choices);
}

function fetchGame(ctx: MenuCtx, p: Panel, wrap: HTMLElement): void {
  const track = document.createElement("div");
  track.className = "throw-track";
  const sweet = document.createElement("div");
  sweet.className = "sweet";
  const marker = document.createElement("div");
  marker.className = "marker";
  track.append(sweet, marker);
  const result = document.createElement("div");
  result.className = "game-result";
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "🎾 Throw!";

  let pos = 0;
  let dir = 1;
  let raf = 0;
  const animate = () => {
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
  // Stop the loop if the player backs out mid-throw (avoids a leaked rAF).
  p.onClose(() => cancelAnimationFrame(raf));

  btn.addEventListener("click", () => {
    cancelAnimationFrame(raf);
    const res = resolveFetch(pos);
    result.textContent = res.line;
    result.style.color = res.success ? "#2f8f2f" : "#c0492f";
    btn.remove();
    wrap.appendChild(endGameButton(ctx, p, "fetch", res.success));
  });

  const hint = document.createElement("p");
  hint.className = "muted";
  hint.textContent = "Tap Throw when the marker is in the green zone.";
  wrap.append(track, hint, result, btn);
}

function rps(ctx: MenuCtx, p: Panel, wrap: HTMLElement): void {
  const cheat = ctx.pet().form === "gremlin";
  const result = document.createElement("div");
  result.className = "game-result";
  const choices = document.createElement("div");
  choices.className = "game-choices";
  const moves: { m: RpsMove; label: string }[] = [
    { m: "rock", label: "✊ Rock" },
    { m: "paper", label: "✋ Paper" },
    { m: "scissors", label: "✌ Scissors" },
  ];
  for (const { m, label } of moves) {
    const b = document.createElement("button");
    b.className = "btn secondary";
    b.textContent = label;
    b.addEventListener("click", () => {
      const ai = rpsAiMove(m, cheat);
      const outcome = judgeRps(m, ai);
      const emoji = { rock: "✊", paper: "✋", scissors: "✌" }[ai];
      result.textContent =
        outcome === "tie"
          ? `${emoji} — a tie.`
          : outcome === "win"
            ? `${emoji} — you win!`
            : cheat
              ? `${emoji} — it definitely cheated.`
              : `${emoji} — you lose.`;
      result.style.color = outcome === "win" ? "#2f8f2f" : outcome === "lose" ? "#c0492f" : "#8a6f57";
      choices.remove();
      wrap.appendChild(endGameButton(ctx, p, "rps", outcome === "win"));
    });
    choices.appendChild(b);
  }
  wrap.append(result, choices);
}

function hideSeek(ctx: MenuCtx, p: Panel, wrap: HTMLElement): void {
  const spot = pickHideSpot();
  const result = document.createElement("div");
  result.className = "game-result";
  const grid = document.createElement("div");
  grid.className = "tile-grid";
  const icons: Record<string, string> = {
    "under the bed": "🛏",
    "behind the curtain": "🪟",
    "in the corner": "📐",
    "the plant": "🪴",
  };
  for (const s of HIDE_SPOTS) {
    grid.appendChild(
      tile(icons[s] ?? "❓", s, () => {
        const won = s === spot;
        result.textContent = won ? "Found you!" : `Nope — it was ${spot}.`;
        result.style.color = won ? "#2f8f2f" : "#c0492f";
        grid.remove();
        wrap.appendChild(endGameButton(ctx, p, "hideseek", won));
      }),
    );
  }
  wrap.append(result, grid);
}

function wouldYou(ctx: MenuCtx, p: Panel, wrap: HTMLElement): void {
  const q = randomWouldYou();
  const result = document.createElement("div");
  result.className = "game-result";
  const choices = document.createElement("div");
  choices.className = "game-choices";
  const a = document.createElement("button");
  a.className = "btn";
  a.textContent = q.a;
  const b = document.createElement("button");
  b.className = "btn secondary";
  b.textContent = q.b;
  const answer = (judge: string) => {
    result.textContent = judge;
    result.style.color = "#8a6f57";
    choices.remove();
    // Not win/lose — always a small happiness bump (SPEC §11).
    wrap.appendChild(endGameButton(ctx, p, "wouldyou", true, judge));
  };
  a.addEventListener("click", () => answer(q.judgeA));
  b.addEventListener("click", () => answer(q.judgeB));
  choices.append(a, b);
  wrap.append(result, choices);
}

// --- Care -------------------------------------------------------------------
export function openCare(ctx: MenuCtx): void {
  const p = openPanel("Care", "Look after your sprite.");
  const pet = ctx.pet();

  const med = document.createElement("button");
  med.className = "btn";
  med.textContent = pet.sick ? "💊 Give Medicine" : "💊 Give Medicine (not sick)";
  med.addEventListener("click", () => {
    ctx.medicine();
    p.close();
  });

  const disc = document.createElement("button");
  disc.className = "btn secondary";
  disc.textContent = "✋ Discipline";
  disc.addEventListener("click", () => {
    ctx.discipline();
    p.close();
  });

  const farm = document.createElement("button");
  farm.className = "btn danger";
  farm.textContent = "🚜 Send to Farm…";
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
  p.setTitle("Send to Farm?", "This is permanent. Your sprite retires forever.");
  p.body.innerHTML = "";
  const line = document.createElement("p");
  line.textContent =
    pet.stage === "adult"
      ? "“I always suspected agriculture.”"
      : pet.stage === "baby" || pet.stage === "egg"
        ? "“Farm? I just got here.”"
        : "“Will there be Wi-Fi?”";
  line.style.fontStyle = "italic";
  const confirm = document.createElement("button");
  confirm.className = "btn danger";
  confirm.textContent = "Yes, send to the farm";
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
  const rows: [string, string | HTMLElement][] = [
    ["Name", pet.name],
    ["Stage", pet.form ? `Adult · ${formName}` : STAGE_LABEL[pet.stage]],
    ["Age", ageLabel(now - pet.createdAt)],
    ["Weight", `${Math.round(pet.weight)}g`],
    ["Hunger", heartBar(pet.hunger)],
    ["Happiness", heartBar(pet.happiness)],
    ["Health", pctBar(pet.health)],
    ["Discipline", pctBar(pet.discipline)],
    ["Condition", pet.sick ? "🤒 Sick" : "🙂 Well"],
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

  const help = document.createElement("button");
  help.className = "btn secondary";
  help.textContent = "❓ How to play";
  help.addEventListener("click", () => {
    p.close();
    openHelp();
  });
  const coll = document.createElement("button");
  coll.className = "btn secondary";
  coll.textContent = "📖 Collection & Farm";
  coll.addEventListener("click", () => {
    p.close();
    openCollection(ctx);
  });
  const backup = document.createElement("button");
  backup.className = "btn secondary";
  backup.textContent = "💾 Backup save";
  backup.addEventListener("click", () => {
    p.close();
    openBackup(ctx);
  });
  p.body.append(help, coll, backup);
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

// --- Help -------------------------------------------------------------------
export function openHelp(): void {
  const p = openPanel("How to play", "Operations, not spoilers.");
  const body = document.createElement("div");
  body.className = "help-body";
  body.innerHTML = `
    <p>🍔 <b>Feed</b> when hunger drops. Proper meals fill more than snacks.</p>
    <p>🎮 <b>Play</b> games to keep happiness up. Your sprite may have a favourite.</p>
    <p>🧹 <b>Clean</b> up messes quickly — a dirty room hurts health.</p>
    <p>💊 <b>Medicine</b> cures illness. Only give it when your sprite is actually sick.</p>
    <p>✋ <b>Discipline</b> when it acts out or makes a fake fuss — not when it truly needs you.</p>
    <p>💡 <b>Lights</b> off at night so it can sleep.</p>
    <p class="muted">How your sprite grows up depends on how you raise it. Certain foods,
    habits, and routines quietly nudge it toward different adults. You'll have to
    experiment to find out how.</p>`;
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
    const el = document.createElement("div");
    el.className = "tile";
    if (found) {
      el.appendChild(portrait(form));
      el.innerHTML += `<span class="tile-name">${def.name}</span><span class="tile-note">${def.blurb}</span>`;
    } else {
      el.innerHTML = `<span class="tile-ico">❔</span><span class="tile-name">???</span><span class="tile-note">Undiscovered</span>`;
    }
    grid.appendChild(el);
  }
  p.body.appendChild(grid);

  const farm = ctx.farm();
  const h = document.createElement("h2");
  h.textContent = "🚜 The Farm";
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
      card.appendChild(portrait(e.form ?? (e.finalStage === "egg" ? "egg" : "generic")));
      const meta = document.createElement("div");
      meta.className = "meta";
      const name = e.form ? ADULTS[e.form].name : STAGE_LABEL[e.finalStage];
      meta.innerHTML = `<b>${e.name}</b> — ${name}<div>Lived ${ageLabel(e.ageMs)} · retired ${new Date(
        e.retiredAt,
      ).toLocaleDateString()}</div>`;
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
  copy.textContent = "📋 Copy code";
  copy.addEventListener("click", () => {
    ta.select();
    navigator.clipboard?.writeText(ta.value);
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
  restore.textContent = "↩ Restore";
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
