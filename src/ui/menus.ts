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
  rollFetchSpot,
  fetchSuccessHalfWidth,
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
import { buildCreatureCanvas, type Mood } from "../render/sprites";
import { iconEl, iconHTML, iconUrl } from "../render/icons";
import { propEl, propUrl, propSize, type PropName } from "../render/props";
import type { IconName } from "../render/icons";
import type { Scene } from "../render/scene";
import { festivalTonight } from "./festival";
import { getNotifyPref, setNotifyPref } from "./notifications";
import type { NotifyPref } from "./notifications";
import { isMuted, setMuted, playSfx, playTone, playCubeClear, unlockAudio } from "./audio";

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
  finishGame(game: GameId, won: boolean, line?: string, reach?: number): void;
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
    if (round >= total) return; // game over — ignore stray taps during the wrap-up
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
      // A closing beat: tally on screen, buttons dead, then an explicit
      // win/lose banner (with its own chime) before the panel hands the
      // verdict to the pet — so the game ends on a beat, not a vanish.
      const won = wins >= 3;
      higher.disabled = true;
      lower.disabled = true;
      info.textContent = `That's ${total} — ${wins} of ${total} correct.`;
      setTimeout(() => {
        result.textContent = won ? "You win!" : "You lose.";
        result.style.color = won ? "#2f8f2f" : "#c0492f";
        playSfx(won ? "win" : "lose");
      }, 700);
      setTimeout(() => {
        p.close();
        ctx.finishGame("higherlower", won);
      }, 1400);
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
  let cleared = 0; // longest hum fully reproduced — drives the reward

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
        playTone(face); // each face has its own pitch — the hum is a melody
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

  const finishAndClose = () => {
    if (resolved) return;
    resolved = true;
    accepting = false;
    // The game only ever ends on a missed note — sound the broken chain.
    playSfx("cubewrong");
    // Clearing the target length means the cube was impressed; the reward keeps
    // climbing with `cleared` regardless (see cubeHumCredit / applyGameResult).
    const won = cleared >= CUBE_HUM_TARGET;
    status.textContent = won ? "…" : "✕";
    setTimeout(() => {
      p.close();
      ctx.finishGame("cubehum", won, cubeHumLine(won), cleared);
    }, 520);
  };

  const onTap = (face: number) => {
    if (!accepting || resolved) return;
    flash(face);
    input.push(face);
    if (!humMatches(seq, input)) {
      finishAndClose();
      return;
    }
    if (input.length === seq.length) {
      // Cleared this round. The hum is endless — it just keeps getting longer
      // until you miss, and every round cleared is worth a little more.
      cleared = seq.length;
      accepting = false;
      playTone(face); // echo the last note, same as every other tap
      status.textContent = "Yes. Again, longer.";
      seq = extendHum(seq);
      setTimeout(() => {
        // Let the echoed note finish before the round-complete flourish.
        if (wrap.isConnected && !resolved) playCubeClear(cleared);
      }, 180);
      setTimeout(() => {
        if (wrap.isConnected && !resolved) playSeq();
      }, 720);
    } else {
      playTone(face); // hum back the note you just pressed, in its own pitch
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
  // Fresh sweet spot every throw — it moves and changes width, so some are
  // easy and some are tight. Draw the green to match exactly where we'll judge.
  const spot = rollFetchSpot();
  const hw = fetchSuccessHalfWidth(spot.span);
  sweet.style.left = `${(spot.center - hw) * 100}%`;
  sweet.style.width = `${hw * 2 * 100}%`;
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
    const res = resolveFetch(pos, undefined, ctx.pet().stage, spot);
    dismiss();
    playSfx("throw"); // the ball leaves your hand
    // The chase runs ~2.5s; when it comes back with a prize, chirp partway
    // through — well before the win/lose verdict lands at the animation's end.
    if (res.success) setTimeout(() => playSfx("fetchback"), 1700);
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
  // Sometimes it hides… imperfectly, and a scrap of head stays showing at the
  // spot. A freebie round for anyone paying attention.
  const peek = Math.random() < 0.3 ? spot : null;
  playSfx("hide"); // scurries off
  ctx.scene().playHide(peek, () => {
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
        // Sound the reveal now, at the start of the ~1.4s pop-out — the
        // win/lose verdict still lands later, at the animation's end.
        playSfx(won ? "found" : "empty");
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
    // Not win/lose — always a small happiness bump.
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

  p.body.appendChild(soundSettings());
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

/** Sound on/off. Borrows the notification toggle's chrome — same shape of
 *  decision, no reason to invent a second one. */
function soundSettings(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "notify-settings";
  const label = document.createElement("p");
  label.className = "muted";
  label.textContent = "Sound";
  const row = document.createElement("div");
  row.className = "notify-row";
  const paint = () => {
    row.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", (b.dataset.on === "1") === !isMuted());
    });
  };
  for (const opt of [
    { on: false, text: "Off" },
    { on: true, text: "On" },
  ]) {
    const b = document.createElement("button");
    b.className = "notify-opt";
    b.dataset.on = opt.on ? "1" : "0";
    b.textContent = opt.text;
    b.addEventListener("click", () => {
      setMuted(!opt.on);
      paint();
      // Turning it on plays the proof. This click is a gesture, so it's also
      // the moment the audio context is allowed to wake up.
      if (opt.on) {
        unlockAudio();
        playSfx("happy");
      }
    });
    row.appendChild(b);
  }
  wrap.append(label, row);
  paint();
  return wrap;
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
  return critterCanvas(key, "neutral", 48);
}

/** A creature sprite scaled up (nearest-neighbour) into its own canvas. */
function critterCanvas(key: string, mood: Mood, size: number): HTMLCanvasElement {
  const src = buildCreatureCanvas(key, mood);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const cx = c.getContext("2d")!;
  cx.imageSmoothingEnabled = false;
  cx.drawImage(src, 0, 0, size, size);
  return c;
}

/** One wandering resident of the pasture. `x` is its centre and `b` its distance
 *  from the pasture floor (its depth); `tx/tb` are where it's ambling to.
 *  Grounded residents walk in discrete bursts — walk, stand, turn — while
 *  `floats` residents (ghost, cube) drift the old dreamy way. */
interface Grazer {
  fig: HTMLElement;
  x: number;
  b: number;
  tx: number;
  tb: number;
  chill: number; // ms left standing still before it picks a new spot
  floats: boolean;
  facing: 1 | -1; // 1 = facing right; applied as a scaleX flip
  pace: number; // personal walk-speed multiplier
}

/** A gathering point in the pasture — retirees drift over and hang out in a
 *  loose ring around it. `xf` is a fraction of the paddock width, `b` px from
 *  the floor, and rMin/rMax the ring they settle into. */
interface SocialSpot {
  xf: number;
  b: number;
  rMin: number;
  rMax: number;
}

/** Solid scenery the walkers get nudged out of (nobody stands in the fire,
 *  walks through the hay, or wades into the pond). `dx` offsets the centre in
 *  px from the fractional anchor so wide shapes can be built from two lobes. */
interface Obstacle {
  xf: number;
  dx?: number;
  b: number;
  r: number;
}

// The pasture's furniture doubles as its social calendar: the picnic blanket,
// the campfire, the pond, the shade of the oak and the veggie garden are all
// places a little party might strike up.
const SOCIAL_SPOTS: SocialSpot[] = [
  { xf: 0.28, b: 72, rMin: 20, rMax: 34 }, // picnic blanket
  { xf: 0.57, b: 30, rMin: 20, rMax: 32 }, // campfire
  { xf: 0.82, b: 62, rMin: 24, rMax: 38 }, // pond
  { xf: 0.1, b: 112, rMin: 18, rMax: 28 }, // under the oak
  { xf: 0.42, b: 128, rMin: 26, rMax: 34 }, // around the garden bed
];
const CAMPFIRE_SPOT = SOCIAL_SPOTS[1]; // festival nights orbit the fire
const OBSTACLES: Obstacle[] = [
  { xf: 0.57, b: 28, r: 18 }, // the campfire itself
  { xf: 0.68, b: 96, r: 26 }, // the hay bale
  { xf: 0.82, dx: -18, b: 60, r: 26 }, // pond, west shore
  { xf: 0.82, dx: 18, b: 60, r: 26 }, // pond, east shore
  { xf: 0.1, b: 112, r: 12 }, // the oak's trunk
  { xf: 0.42, b: 128, r: 24 }, // the garden bed (nobody tramples the carrots)
  { xf: 0.9, b: 118, r: 10 }, // the scarecrow
  { xf: 0.47, b: 40, r: 12 }, // the fireside log
];

/** A little social sim: retirees roam the paddock in 2D (side to side *and* in
 *  depth), pause to loiter, and often wander over to hang out near a neighbour —
 *  while a separation pass keeps them from overlapping or walking through each
 *  other. Every so often a Stardew-style gathering starts: most of the paddock
 *  ambles over to the picnic, the campfire or the pond and loiters there
 *  together, trading little hearts and hums. Runs on rAF and self-stops once
 *  the pasture leaves the DOM, so closing or reopening the panel never leaves
 *  a loop running or stacks a second one. On festival nights the socialising
 *  runs hotter: gatherings come sooner, linger closer together in time, and
 *  lean heavily toward the campfire. */
function startMilling(pasture: HTMLElement, grazers: Grazer[], festival: boolean): void {
  const rand = (a: number, z: number) => a + Math.random() * (z - a);
  const clamp = (v: number, a: number, z: number) => (v < a ? a : v > z ? z : v);
  const SEP = 30; // min centre-to-centre gap at the same depth
  const WALK_SPEED = 0.045; // px per ms — a purposeful little trot
  const FLOAT_SPEED = 0.022; // ghosts and cubes drift, unhurried
  let last = performance.now();
  let inited = false;

  // A gathering is a small party (3–5), not the whole paddock: each member
  // gets an evenly spaced slot on a fixed ring around the spot, so groups
  // read as a neat circle instead of a blob.
  let gathering: SocialSpot | null = null;
  let party: Grazer[] = [];
  let partyBase = 0; // where slot 0 sits on the ring
  let gatherUntil = 0;
  let nextGather = last + (festival ? rand(2500, 7000) : rand(5000, 12000));
  let nextEmote = last + rand(2500, 6000);

  const bounds = () => {
    const W = pasture.clientWidth;
    const H = pasture.clientHeight;
    return { W, H, minB: 12, maxB: Math.max(40, H * 0.55), pad: 24 };
  };

  const obstacleX = (o: Obstacle, bn: ReturnType<typeof bounds>) => o.xf * bn.W + (o.dx ?? 0);

  // Shift a point out of every obstacle footprint. Applied to *targets* (not
  // just live positions) so nobody picks an unreachable spot inside the pond
  // and then jitters forever against its shore.
  const clearPoint = (p: { x: number; b: number }, bn: ReturnType<typeof bounds>) => {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const o of OBSTACLES) {
        const ex = p.x - obstacleX(o, bn);
        const ey = (p.b - o.b) * 1.7;
        const dist = Math.hypot(ex, ey);
        if (dist < o.r) {
          const push = o.r - dist + 1;
          if (dist > 0.01) {
            p.x += (ex / dist) * push;
            p.b += (ey / dist / 1.7) * push;
          } else {
            p.x += o.r + 1; // dead centre — pick a side
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
    p.x = clamp(p.x, bn.pad, bn.W - bn.pad);
    p.b = clamp(p.b, bn.minB, bn.maxB);
  };

  const setTarget = (g: Grazer, x: number, b: number, bn: ReturnType<typeof bounds>) => {
    const t = { x: clamp(x, bn.pad, bn.W - bn.pad), b: clamp(b, bn.minB, bn.maxB) };
    clearPoint(t, bn);
    g.tx = t.x;
    g.tb = t.b;
  };

  // A party member's assigned seat: evenly spaced slots on a fixed ring.
  const slotTarget = (g: Grazer, bn: ReturnType<typeof bounds>) => {
    const spot = gathering!;
    const i = party.indexOf(g);
    const a = partyBase + (i / party.length) * Math.PI * 2;
    const r = (spot.rMin + spot.rMax) / 2;
    setTarget(
      g,
      spot.xf * bn.W + Math.cos(a) * r + rand(-3, 3),
      spot.b + Math.sin(a) * r * 0.55 + rand(-2, 2),
      bn,
    );
  };

  const retarget = (g: Grazer, bn: ReturnType<typeof bounds>) => {
    // Party members hold their seat — mostly they just keep standing there,
    // occasionally shuffling back onto their slot.
    if (gathering && party.includes(g)) {
      slotTarget(g, bn);
      return;
    }
    // Otherwise often go stand beside someone (a tidy gap apart, not on top
    // of them), or pick a fresh patch of grass.
    if (grazers.length > 1 && Math.random() < 0.45) {
      const friends = grazers.filter((f) => f !== g && !party.includes(f));
      if (friends.length > 0) {
        const friend = friends[Math.floor(Math.random() * friends.length)];
        const side = g.x < friend.x ? -1 : 1; // approach the nearer side
        setTarget(g, friend.x + side * (SEP + rand(2, 8)), friend.b + rand(-6, 6), bn);
        return;
      }
    }
    setTarget(g, rand(bn.pad, bn.W - bn.pad), rand(bn.minB, bn.maxB), bn);
  };

  // Face a point of interest (only when it's meaningfully to one side).
  const faceToward = (g: Grazer, x: number) => {
    if (Math.abs(x - g.x) > 3) g.facing = x > g.x ? 1 : -1;
  };

  const nearestNeighbour = (g: Grazer, within: number): Grazer | null => {
    let best: Grazer | null = null;
    let bestD = within;
    for (const o of grazers) {
      if (o === g) continue;
      const d = Math.hypot(o.x - g.x, (o.b - g.b) * 1.7);
      if (d < bestD) {
        best = o;
        bestD = d;
      }
    }
    return best;
  };

  // A tiny feeling, floated up from a chatting pair: heart, hummed note, sparkle.
  const emote = (g: Grazer) => {
    const roll = Math.random();
    const img = document.createElement("img");
    img.className = "emote";
    img.src = roll < 0.45 ? iconUrl("heart") : roll < 0.8 ? propUrl("note") : iconUrl("sparkle");
    img.style.left = `${g.x.toFixed(1)}px`;
    img.style.bottom = `${(g.b + 40).toFixed(1)}px`;
    img.style.zIndex = String(Math.round(1001 - g.b));
    img.addEventListener("animationend", () => img.remove());
    pasture.appendChild(img);
  };

  const frame = (now: number) => {
    if (!pasture.isConnected) return; // panel closed — stop the loop
    const dt = Math.min(50, now - last);
    last = now;
    const bn = bounds();
    if (bn.W === 0) {
      requestAnimationFrame(frame); // not laid out yet
      return;
    }
    if (!inited) {
      for (const g of grazers) {
        const p = { x: rand(bn.pad, bn.W - bn.pad), b: rand(bn.minB, bn.maxB) };
        clearPoint(p, bn); // nobody spawns inside the pond
        g.x = g.tx = p.x;
        g.b = g.tb = p.b;
        g.chill = rand(0, 1800);
      }
      inited = true;
      pasture.classList.add("ready"); // fade them in now that they're placed
    }

    // Social calendar: a small party forms now and then, breaks up later.
    if (gathering && now > gatherUntil) {
      gathering = null;
      party = [];
      nextGather = now + (festival ? rand(6000, 12000) : rand(9000, 20000));
    } else if (!gathering && now > nextGather && grazers.length >= 2) {
      gathering =
        festival && Math.random() < 0.5
          ? CAMPFIRE_SPOT
          : SOCIAL_SPOTS[Math.floor(Math.random() * SOCIAL_SPOTS.length)];
      gatherUntil = now + rand(12000, 22000);
      partyBase = rand(0, Math.PI * 2);
      const size = Math.min(grazers.length, 3 + (Math.random() < 0.4 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0));
      party = [...grazers].sort(() => Math.random() - 0.5).slice(0, size);
      for (const g of party) {
        slotTarget(g, bn);
        g.chill = rand(0, 900); // finish the current thought, then head over
      }
    }

    // Steer each toward its target (or count down its loiter). Grounded
    // residents move in discrete bursts: walk (hopping), arrive, turn toward
    // whatever's interesting, stand properly still, repeat. Floaters drift.
    for (const g of grazers) {
      if (g.chill > 0) {
        g.chill -= dt;
        g.fig.classList.remove("walking");
        continue;
      }
      const dx = g.tx - g.x;
      const db = g.tb - g.b;
      const d = Math.hypot(dx, db);
      if (d < 2) {
        // Arrived — hang out; party members settle in for a proper sit.
        const inParty = gathering !== null && party.includes(g);
        g.chill = inParty ? rand(3200, 8000) : rand(1800, 5000);
        if (g.floats) g.chill *= 0.45; // the restless dead (and geometry)
        g.fig.classList.remove("walking");
        // Turn toward the fire/friends — or whoever's standing closest.
        if (inParty && gathering) {
          faceToward(g, gathering.xf * bn.W);
        } else {
          const buddy = nearestNeighbour(g, 64);
          if (buddy) {
            faceToward(g, buddy.x);
            // ...and they often glance back. A small, complete interaction.
            if (buddy.chill > 0 && Math.random() < 0.6) faceToward(buddy, g.x);
          }
        }
        retarget(g, bn);
      } else {
        const speed = g.floats ? FLOAT_SPEED : WALK_SPEED * g.pace;
        const step = Math.min(d, speed * dt);
        g.x += (dx / d) * step;
        g.b += (db / d) * step;
        if (!g.floats) g.fig.classList.add("walking");
        if (Math.abs(dx) > 2) g.facing = dx > 0 ? 1 : -1; // face where you're going
      }
    }

    // Separation: push apart any pair whose footprints overlap. Depth counts
    // extra, so front/back neighbours may visually overlap (occlusion) but two
    // at the same depth never merge or pass through.
    for (let i = 0; i < grazers.length; i++) {
      for (let j = i + 1; j < grazers.length; j++) {
        const a = grazers[i];
        const c = grazers[j];
        const ex = a.x - c.x;
        const ey = (a.b - c.b) * 1.7;
        const dist = Math.hypot(ex, ey);
        if (dist < SEP && dist > 0.01) {
          const push = (SEP - dist) / 2;
          a.x += (ex / dist) * push;
          a.b += (ey / dist / 1.7) * push;
          c.x -= (ex / dist) * push;
          c.b -= (ey / dist / 1.7) * push;
        }
      }
    }

    // Nudge anyone out of solid scenery.
    for (const g of grazers) {
      for (const o of OBSTACLES) {
        const ex = g.x - obstacleX(o, bn);
        const ey = (g.b - o.b) * 1.7;
        const dist = Math.hypot(ex, ey);
        if (dist < o.r && dist > 0.01) {
          const push = o.r - dist;
          g.x += (ex / dist) * push;
          g.b += (ey / dist / 1.7) * push;
        }
      }
    }

    // Neighbours loitering together occasionally trade a little emote.
    if (now > nextEmote) {
      const gap = gathering ? rand(1400, 3200) : rand(3000, 7000);
      nextEmote = now + (festival ? gap * 0.7 : gap);
      outer: for (let i = 0; i < grazers.length; i++) {
        for (let j = i + 1; j < grazers.length; j++) {
          const a = grazers[i];
          const c = grazers[j];
          if (a.chill <= 0 || c.chill <= 0) continue;
          if (Math.hypot(a.x - c.x, (a.b - c.b) * 1.7) < 56) {
            emote(Math.random() < 0.5 ? a : c);
            break outer;
          }
        }
      }
    }

    // Clamp to the paddock and paint. Nearer (smaller b) sits lower and in
    // front; facing rides along as a flip on the fig's own transform.
    for (const g of grazers) {
      g.x = clamp(g.x, bn.pad, bn.W - bn.pad);
      g.b = clamp(g.b, bn.minB, bn.maxB);
      g.fig.style.left = `${g.x.toFixed(1)}px`;
      g.fig.style.bottom = `${g.b.toFixed(1)}px`;
      g.fig.style.zIndex = String(Math.round(1000 - g.b));
      g.fig.style.transform = `translateX(-50%) scaleX(${g.facing})`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** True for residents that hover rather than walk (they keep the dreamy bob). */
function floater(key: string): boolean {
  return key === "ghost" || key === "humcube";
}

/** A pasture resident: just the roaming sprite — its story pops up on tap. */
function pastureCritter(key: string, name: string, onTap: () => void): HTMLElement {
  const fig = document.createElement("figure");
  fig.className = `critter ${floater(key) ? "floats" : "walks"}`;
  fig.setAttribute("role", "button");
  fig.setAttribute("aria-label", name);
  const cv = critterCanvas(key, "happy", 38);
  cv.style.animationDelay = `${(Math.random() * 2).toFixed(2)}s`; // desync the bob
  fig.appendChild(cv);
  fig.addEventListener("click", (e) => {
    e.stopPropagation(); // don't let the pasture click-to-dismiss swallow it
    onTap();
  });
  return fig;
}

/** A headstone engraved with the pet's full name — never truncated. */
function gravePlot(name: string, onTap: () => void): HTMLElement {
  const fig = document.createElement("figure");
  fig.className = "grave-plot";
  fig.setAttribute("role", "button");
  fig.setAttribute("aria-label", name);
  fig.appendChild(propEl("headstone", 3));
  const cap = document.createElement("figcaption");
  cap.textContent = name;
  fig.appendChild(cap);
  fig.addEventListener("click", (e) => {
    e.stopPropagation();
    onTap();
  });
  return fig;
}

/** The tap-for-info card: one strip under the pasture that fills with whoever
 *  was tapped. Tapping the same resident (or the grass, or ✕) dismisses it. */
interface FarmInfo {
  el: HTMLElement;
  show: (e: FarmEntry, fig: HTMLElement) => void;
  hide: () => void;
}

function farmInfoStrip(formName: (e: FarmEntry) => string): FarmInfo {
  const el = document.createElement("div");
  el.className = "farm-info";
  let selected: HTMLElement | null = null;
  let current: FarmEntry | null = null;

  const hide = () => {
    el.classList.remove("open");
    el.replaceChildren();
    selected?.classList.remove("selected");
    selected = null;
    current = null;
  };

  const show = (e: FarmEntry, fig: HTMLElement) => {
    if (current === e) {
      hide(); // second tap toggles off
      return;
    }
    selected?.classList.remove("selected");
    selected = fig;
    current = e;
    fig.classList.add("selected");
    el.replaceChildren();
    // Portrait shows the creature as it lived — even for the departed.
    const key = e.form ?? (e.finalStage === "egg" ? "egg" : e.finalStage);
    el.appendChild(critterCanvas(key, e.passedAway ? "neutral" : "happy", 44));
    const txt = document.createElement("div");
    txt.className = "farm-info-text";
    const nm = document.createElement("strong");
    nm.textContent = e.name;
    const detail = document.createElement("span");
    detail.textContent = e.passedAway
      ? `${formName(e)} · lived ${ageLabel(e.ageMs)} · died of ${e.cause ?? "unknown causes"}`
      : `${formName(e)} · lived ${ageLabel(e.ageMs)} · retired ${new Date(
          e.retiredAt,
        ).toLocaleDateString()}`;
    txt.append(nm, detail);
    const x = document.createElement("button");
    x.className = "farm-info-close";
    x.setAttribute("aria-label", "Close");
    x.textContent = "✕";
    x.addEventListener("click", hide);
    el.append(txt, x);
    el.classList.add("open");
  };

  return { el, show, hide };
}

/** Dress the paddock: sky and festival trimmings up top, a barn and fence on
 *  the horizon, and picnic/campfire/pond furniture down in the walkable band —
 *  depth-sorted with the same 1000 − bottom rule the walkers use. On festival
 *  nights the sky turns to dusk: moon and stars instead of sun and clouds,
 *  paper lanterns instead of bunting, and fireflies over the grass. */
function decoratePasture(pasture: HTMLElement, festival: boolean): void {
  const add = (
    name: PropName,
    cls: string,
    left: string,
    bottom: string,
    scale: number,
    z?: number,
  ) => {
    const el = propEl(name, scale);
    el.classList.add("prop");
    if (cls) el.classList.add(...cls.split(" "));
    el.style.left = left;
    el.style.bottom = bottom;
    if (z !== undefined) el.style.zIndex = String(z);
    pasture.appendChild(el);
    return el;
  };
  const band = (name: PropName, cls: string, left: string, b: number, scale = 3) =>
    add(name, cls, left, `${b}px`, scale, 1000 - b);

  // A tiled strip along the top edge — bunting by day, lanterns by night.
  const strip = (name: PropName, cls: string) => {
    const el = document.createElement("div");
    el.className = cls;
    const sz = propSize(name);
    el.style.backgroundImage = `url(${propUrl(name)})`;
    el.style.backgroundSize = `${sz.w * 3}px ${sz.h * 3}px`;
    el.style.height = `${sz.h * 3}px`;
    pasture.appendChild(el);
  };

  if (festival) {
    // Dusk sky: moon, a scatter of stars, lantern light, fireflies low over
    // the grass.
    pasture.classList.add("night");
    const moon = propEl("moon", 3);
    moon.classList.add("moon");
    pasture.appendChild(moon);
    for (let i = 0; i < 8; i++) {
      const star = document.createElement("div");
      star.className = "star";
      star.style.left = `${(4 + Math.random() * 92).toFixed(1)}%`;
      star.style.top = `${(5 + Math.random() * 30).toFixed(1)}%`;
      star.style.animationDelay = `${(Math.random() * 2.4).toFixed(2)}s`;
      pasture.appendChild(star);
    }
    strip("lanterns", "lantern-line");
    for (let i = 0; i < 3; i++) {
      const fly = document.createElement("div");
      fly.className = "firefly";
      fly.style.left = `${(10 + Math.random() * 80).toFixed(1)}%`;
      fly.style.bottom = `${(20 + Math.random() * 90).toFixed(0)}px`;
      fly.style.animationDuration = `${(4 + Math.random() * 4).toFixed(1)}s, ${(
        1.8 + Math.random()
      ).toFixed(1)}s`;
      pasture.appendChild(fly);
    }
  } else {
    // Sky: sun, drifting clouds, and bunting strung along the top for the vibe.
    const sun = propEl("sun", 3);
    sun.classList.add("sun");
    pasture.appendChild(sun);
    const cloudA = propEl("cloud", 2);
    cloudA.classList.add("prop", "cloud", "cloud-a");
    const cloudB = propEl("cloud", 3);
    cloudB.classList.add("prop", "cloud", "cloud-b");
    pasture.append(cloudA, cloudB);
    strip("bunting", "bunting");
  }

  // The horizon: a barn, a fence line, a far tree.
  add("barn", "far", "14%", "57%", 3, 2);
  strip("fence", "fence-line");
  add("tree", "far", "92%", "53%", 3, 3);

  // The paddock floor. Upright furniture (campfire, hay) depth-sorts against
  // the walkers; flat ground cover (blanket, pond, flowers) sits at a low
  // fixed z so a sprite overlapping it always reads as standing on it, never
  // hidden behind it.
  const flat = (name: PropName, left: string, b: number, scale = 3) =>
    add(name, "", left, `${b}px`, scale, 600);
  flat("picnic", "28%", 64);
  band("campfire", "fire", "57%", 22);
  band("log", "", "47%", 40);
  flat("pond", "82%", 56);
  band("hay", "", "68%", 94);
  // The back of the paddock: a proper oak to loaf under, the veggie garden,
  // and a scarecrow keeping an eye on everyone.
  band("tree", "", "10%", 112, 4);
  flat("garden", "42%", 128);
  band("scarecrow", "", "90%", 118);
  flat("flowers", "8%", 24);
  flat("flowers", "45%", 98, 2);
  flat("flowers", "94%", 102, 2);
  flat("flowers", "22%", 138, 2);
  flat("tuft", "18%", 46, 2);
  flat("tuft", "38%", 14, 2);
  flat("tuft", "63%", 74, 2);
  flat("tuft", "88%", 20, 2);
  flat("tuft", "30%", 116, 2);
  flat("tuft", "58%", 134, 2);
}

export function openCollection(ctx: MenuCtx): void {
  const p = openPanel("Collection", "Adults you've discovered.");
  const discovered = ctx.discovered();

  const grid = document.createElement("div");
  // `centered` keeps a short final row (e.g. the lone secret) centred rather
  // than stranded at the left edge.
  grid.className = "tile-grid centered";
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
    p.body.appendChild(farmYard(farm));
  }
}

/** The farm as a little diorama: retirees loafing among the scenery, an info
 *  strip that fills in whoever you tap, and a fenced graveyard plot below with
 *  every headstone bearing its keeper's full name. */
function farmYard(farm: FarmEntry[]): HTMLElement {
  const yard = document.createElement("div");
  yard.className = "farm-yard";

  const formName = (e: FarmEntry) =>
    e.form ? ADULTS[e.form].name : STAGE_LABEL[e.finalStage];
  const info = farmInfoStrip(formName);

  const festival = festivalTonight();
  const pasture = document.createElement("div");
  pasture.className = "pasture";
  decoratePasture(pasture, festival);
  pasture.addEventListener("click", () => info.hide()); // tap the grass to dismiss

  const living = farm.filter((e) => !e.passedAway);
  if (living.length === 0) {
    const quiet = document.createElement("p");
    quiet.className = "pasture-empty";
    quiet.textContent = festival
      ? "Lanterns are lit, but nobody's home tonight."
      : "The pasture is quiet today.";
    pasture.appendChild(quiet);
  } else {
    const grazers: Grazer[] = [];
    for (const e of living) {
      const key = e.form ?? (e.finalStage === "egg" ? "egg" : e.finalStage);
      const fig = pastureCritter(key, e.name, () => info.show(e, fig));
      pasture.appendChild(fig);
      grazers.push({
        fig,
        x: 0,
        b: 0,
        tx: 0,
        tb: 0,
        chill: 0,
        floats: floater(key),
        facing: Math.random() < 0.5 ? -1 : 1,
        pace: 0.85 + Math.random() * 0.35,
      });
    }
    startMilling(pasture, grazers, festival);
  }
  yard.appendChild(pasture);
  yard.appendChild(info.el);

  const dead = farm.filter((e) => e.passedAway);
  if (dead.length > 0) {
    const graveyard = document.createElement("div");
    graveyard.className = "graveyard";
    graveyard.addEventListener("click", () => info.hide());
    const sign = document.createElement("span");
    sign.className = "graveyard-sign";
    sign.textContent = "Rest ye here";
    graveyard.appendChild(sign);
    for (const e of dead) {
      const fig = gravePlot(e.name, () => info.show(e, fig));
      graveyard.appendChild(fig);
    }
    yard.appendChild(graveyard);
  }

  return yard;
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
