// Overlay screens: Food, Play (6 games), Care, Status, Help, Collection, Backup.
// Pure view code — every state change goes back through the MenuCtx callbacks.
// Games run *in the scene*: panels only collect input, then hand off to scene
// acts, and all result text comes out of the sprite's mouth.

import { ILLNESSES } from "../pet/types";
import type { FoodId, GameId, IllnessId, PetState, FarmEntry, AdultForm } from "../pet/types";
import { FOODS, FOOD_ORDER, ADULTS, ADULT_ORDER } from "../pet/roster";
import { ageLabel } from "../pet/format";
import { formatDebugReport } from "../pet/debug";
import { MAX_HEARTS, TIMELINE_SPEED, retirementPhase } from "../pet/state";
import { DEV_STAT_RANGE } from "../pet/devtools";
import type { DevAction, DevHidden, DevStat } from "../pet/devtools";
import { farmConfirmLine, farewellWalkLine, describeCondition } from "../pet/dialogue";
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
  extendHum,
  humMatches,
  cubeHumLine,
  GAME_NAMES,
  CUBE_FACES,
  CUBE_HUM_TARGET,
} from "../pet/games";
import type { RpsMove, MatchResult } from "../pet/games";
import { buildHistory, historyTruncated, rowTime } from "../pet/history";
import { buildCreatureCanvas, type Mood } from "../render/sprites";
import { iconEl, iconHTML, iconUrl, digitMaskUrl } from "../render/icons";
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
  finishGame(game: GameId, won: MatchResult, line?: string | null, reach?: number): void;
  sayLine(text: string): void;
  sendToFarm(): void;
  exportSave(): string;
  importSave(code: string): boolean;
  reload(): void;
  resetFarm(): void;
  /** Pull a Dev Tools lever (timeline switch, forced event). */
  devAction(action: DevAction): void;
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
    // Harmless if this panel was never a registered game (see cubeHum).
    activeGameClose = null;
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

/** navigator.clipboard only exists in secure contexts (not plain-http LAN
 *  testing) — fall back to a detached textarea + execCommand there. Shared by
 *  the backup code copy and the debug report copy. */
function copyText(text: string): void {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

// --- Active in-scene game tracking ------------------------------------------
// Stage-controls games (higher/lower, fetch, rps, hide & seek, would-you) render
// straight onto the stage with no backdrop of their own, so unlike a Panel there
// was nothing to tap-away or to force-closed when another nav button wants the
// stage. Every such game registers its own teardown here on start; whoever gets
// it back (a nav icon, a background tap) just calls closeActiveGame().
let activeGameClose: (() => void) | null = null;

/** Wrap a game's close/dismiss fn so it self-deregisters on every exit path
 *  (Done button, natural finish, or a forced close) and register it as the
 *  currently active game. Use the returned fn in place of the raw one. */
function registerActiveGame(close: () => void): () => void {
  const wrapped = () => {
    activeGameClose = null;
    close();
  };
  activeGameClose = wrapped;
  return wrapped;
}

/** Force-close whatever in-scene game is currently running, if any. Safe to
 *  call when nothing's active. */
export function closeActiveGame(): void {
  activeGameClose?.();
}

/** Registered by the active in-scene game when it wants first look at a stage
 *  tap before the default "tap away dismisses the game" behavior — currently
 *  just hide & seek's guess phase, so tapping the hiding spot itself works.
 *  Coordinates are canvas-relative CSS px. Return true to consume the tap. */
let stageTapHandler: ((x: number, y: number) => boolean) | null = null;

/** Offer a stage tap to the active game's handler, if any. Returns whether it
 *  was consumed — the caller should skip its own tap-away behavior if so. */
export function handleStageTap(x: number, y: number): boolean {
  return stageTapHandler?.(x, y) ?? false;
}

/** Compact control strip overlaid on the stage for in-scene games. Pass
 *  `bottom` to pin it low instead of up top (e.g. prompts within thumb reach). */
function stageOverlay(
  ctx: MenuCtx,
  position: "top" | "bottom" = "top",
): { el: HTMLDivElement; close: () => void } {
  const el = document.createElement("div");
  el.className = position === "bottom" ? "stage-controls stage-controls-bottom" : "stage-controls";
  ctx.stageEl().appendChild(el);
  return { el, close: () => el.remove() };
}

/** Two strips: a display strip up top and a selector strip down at the bottom,
 *  within thumb reach. For games where the choices want to sit low. */
function splitOverlay(ctx: MenuCtx): {
  top: HTMLDivElement;
  bottom: HTMLDivElement;
  close: () => void;
} {
  const top = document.createElement("div");
  top.className = "stage-controls";
  const bottom = document.createElement("div");
  bottom.className = "stage-controls stage-controls-bottom";
  ctx.stageEl().append(top, bottom);
  return {
    top,
    bottom,
    close: () => {
      top.remove();
      bottom.remove();
    },
  };
}

/** Small dismiss button for in-scene game loops ("that's enough for now"). */
function doneButton(onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "btn secondary btn-small";
  b.textContent = "Done";
  b.addEventListener("click", onClick);
  return b;
}

/** The small corner ✕ used by every in-scene game to bail mid-round. */
function closeCorner(onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "hl-close";
  b.setAttribute("aria-label", "Close");
  b.textContent = "✕";
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
  salad: "salad",
  cube: "cube",
  soup: "soup",
};

export function openFood(ctx: MenuCtx): void {
  // Nudge toward the pot when soup would actually cure what's going around —
  // otherwise the folk remedy is a mechanic nobody ever discovers.
  const sick = ctx.pet();
  const soupHelps = sick.sick && sick.illness !== null && ILLNESSES[sick.illness].soupCure;
  const p = openPanel("Food", soupHelps ? "Something warm might help." : "What's on the menu?");
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
const GAME_META: { id: GameId; icon: IconName; name: string }[] = (
  [
    { id: "higherlower", icon: "dice" },
    { id: "fetch", icon: "ball" },
    { id: "rps", icon: "rock" },
    { id: "hideseek", icon: "magnifying" },
    { id: "wouldyou", icon: "question" },
    { id: "cubehum", icon: "cube" },
  ] as { id: GameId; icon: IconName }[]
).map((g) => ({ ...g, name: GAME_NAMES[g.id] }));

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
      p.close();
      higherLower(ctx);
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
      p.close();
      cubeHum(ctx);
      break;
  }
}

// In-scene game shaped like rock-paper-scissors: the pet lays down its card
// first, you call whether yours will come up higher or lower, then a quick
// tumble flips your card to see if you were right. Played as a best-of-5: a row
// of pips tracks each call, and the final tally shows in the pips before the pet
// weighs in and you can go again. Numbers are drawn in the pixel digit font so
// the whole thing sits in the same style as the rest of the game.
const HL_ROUNDS = 5;

function higherLower(ctx: MenuCtx): void {
  // Display (cards, pips) up top over the pet; the selector sits down at the
  // bottom within thumb reach.
  const { top, bottom, close: rawClose } = splitOverlay(ctx);
  const close = registerActiveGame(rawClose);
  // A small corner close, not a full-width bar — you can bail mid-match, but the
  // match's own end screen is the usual way out.
  const closeBtn = closeCorner(close);

  const hint = document.createElement("p");
  hint.className = "stage-hint";

  // Best-of-5 progress: one pip per round, filled green (won) or red (lost).
  const pipRow = document.createElement("div");
  pipRow.className = "hl-pips";
  const pips: HTMLSpanElement[] = [];
  for (let i = 0; i < HL_ROUNDS; i++) {
    const pip = document.createElement("span");
    pip.className = "hl-pip";
    pips.push(pip);
    pipRow.appendChild(pip);
  }

  // Known card sits on the right; your revealed card on the left.
  const cards = document.createElement("div");
  cards.className = "hl-cards";
  const yours = makeCard("hl-yours");
  const theirs = makeCard("hl-theirs");
  const vs = document.createElement("span");
  vs.className = "hl-vs";
  vs.textContent = "vs";
  cards.append(yours.card, vs, theirs.card);

  const choices = document.createElement("div");
  choices.className = "game-choices";
  const higher = document.createElement("button");
  higher.className = "btn btn-small";
  higher.textContent = "▲ Higher";
  const lower = document.createElement("button");
  lower.className = "btn secondary btn-small";
  lower.textContent = "▼ Lower";
  choices.append(higher, lower);

  // The end-of-match beat: a short verdict line up top by the pips, and two
  // ways forward down at the bottom — go again, or call it. The emotion is
  // carried by the filled pips, the win/lose chime, and the pet — no bespoke
  // celebration graphic.
  const result = document.createElement("div");
  result.className = "hl-result";
  result.style.display = "none";
  const resultText = document.createElement("p");
  resultText.className = "stage-hint hl-result-text";
  result.append(resultText);

  const resultButtons = document.createElement("div");
  resultButtons.className = "game-choices";
  resultButtons.style.display = "none";
  const again = document.createElement("button");
  again.className = "btn btn-small";
  again.textContent = "Play again";
  again.addEventListener("click", () => startMatch());
  resultButtons.append(again, doneButton(close));

  let them = rollCard();
  let round = 0;
  let wins = 0;
  let rolling = false;

  const newRound = () => {
    them = rollCard();
    theirs.set(them);
    yours.card.classList.remove("won", "lost");
    yours.card.classList.add("facedown");
    yours.set("?");
    higher.disabled = false;
    lower.disabled = false;
    rolling = false;
    hint.textContent = `Round ${round + 1} of ${HL_ROUNDS} — higher or lower?`;
  };

  const startMatch = () => {
    round = 0;
    wins = 0;
    for (const pip of pips) pip.className = "hl-pip";
    result.style.display = "none";
    resultButtons.style.display = "none";
    cards.style.display = "";
    choices.style.display = "";
    pipRow.style.display = "";
    newRound();
  };

  const finishMatch = () => {
    const won = wins >= 3;
    cards.style.display = "none";
    choices.style.display = "none";
    hint.textContent = "";
    resultText.textContent = won
      ? `You win — ${wins} of ${HL_ROUNDS}`
      : `Beaten — ${wins} of ${HL_ROUNDS}`;
    result.classList.toggle("won", won);
    result.classList.toggle("lost", !won);
    result.style.display = "";
    resultButtons.style.display = "";
    playSfx(won ? "win" : "lose");
    // The pet weighs in on the whole match — voice and reward — via the same
    // finishGame handoff every game uses.
    ctx.finishGame("higherlower", won);
  };

  const guess = (isHigher: boolean) => {
    if (rolling || !top.isConnected) return;
    rolling = true;
    higher.disabled = true;
    lower.disabled = true;
    hint.textContent = isHigher ? "Higher…" : "Lower…";

    let mine = rollCard();
    while (mine === them) mine = rollCard(); // no ties — always a verdict
    const won = judgeHigherLower(them, isHigher, mine) === "win";

    // Flip your card over with a slot-machine tumble, then settle on the draw.
    playSfx("roll");
    yours.card.classList.remove("facedown");
    yours.card.classList.add("rolling");
    const tumble = setInterval(() => {
      yours.set(rollCard());
    }, 70);

    setTimeout(() => {
      clearInterval(tumble);
      if (!top.isConnected) return; // torn out mid-roll (sleep, death, restore)
      yours.set(mine);
      yours.card.classList.remove("rolling");
      yours.card.classList.add(won ? "won" : "lost");
      // A light per-round cue (not the big win/lose fanfare — that's saved for
      // the final tally) plus the pip filling in.
      playSfx(won ? "found" : "empty");
      pips[round].classList.add(won ? "won" : "lost");
      if (won) wins++;
      round++;

      setTimeout(() => {
        if (!top.isConnected) return;
        if (round >= HL_ROUNDS) finishMatch();
        else newRound();
      }, 900);
    }, 620);
  };

  higher.addEventListener("click", () => guess(true));
  lower.addEventListener("click", () => guess(false));
  startMatch();
  top.append(closeBtn, hint, pipRow, cards, result);
  bottom.append(choices, resultButtons);
}

/** A single Higher/Lower card. `set` swaps the pixel digit shown (or "?"). */
function makeCard(cls: string): { card: HTMLDivElement; set: (ch: string | number) => void } {
  const card = document.createElement("div");
  card.className = `hl-card ${cls}`;
  const num = document.createElement("span");
  num.className = "hl-num";
  card.appendChild(num);
  const set = (ch: string | number) => {
    num.style.setProperty("--m", `url("${digitMaskUrl(String(ch))}")`);
  };
  return { card, set };
}

// Panel-input game: the cube hums a growing sequence of its four faces; you hum
// it back. Match all the way to CUBE_HUM_TARGET to win. The verdict — like every
// game — comes out of the sprite's mouth via finishGame().
const CUBE_PAD_COLORS = ["#8f86c4", "#d6f2fa", "#6fb8cc", "#b3abe0"];

// In-scene game: hint and status up top over the pet, the 2x2 pad grid down
// at the bottom within thumb reach — same shape as higher/lower, rps, and
// would-you-rather.
function cubeHum(ctx: MenuCtx): void {
  const { top, bottom, close: rawClose } = splitOverlay(ctx);

  const closeBtn = document.createElement("button");
  closeBtn.className = "hl-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "✕";

  const info = document.createElement("p");
  info.className = "stage-hint";
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

  // Walking away (X button, tap-outside, another nav tap) shouldn't forfeit
  // rounds already cleared — credit whatever's banked, same scoring as a miss.
  const close = registerActiveGame(() => {
    if (!resolved) {
      resolved = true;
      const won = cleared >= CUBE_HUM_TARGET;
      ctx.finishGame("cubehum", won, cubeHumLine(won), cleared);
    }
    rawClose();
  });
  closeBtn.addEventListener("click", close);

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
        // The strip can be torn out mid-hum (close, save restore) — don't keep
        // flashing a detached node or reopen input on a dead overlay.
        if (!top.isConnected || resolved) return;
        flash(face);
        playTone(face); // each face has its own pitch — the hum is a melody
        if (idx === seq.length - 1) {
          setTimeout(() => {
            if (!top.isConnected || resolved) return;
            accepting = true;
            status.textContent = "Hum it back.";
          }, 420);
        }
      }, 480 + idx * 520);
    });
  };

  const finishAndClose = () => {
    if (resolved) return;
    accepting = false;
    // The game only ever ends on a missed note — sound the broken chain.
    playSfx("cubewrong");
    // Clearing the target length means the cube was impressed; the reward keeps
    // climbing with `cleared` regardless (see cubeHumCredit / applyGameResult).
    const won = cleared >= CUBE_HUM_TARGET;
    status.textContent = won ? "…" : "✕";
    setTimeout(() => close(), 520);
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
        if (top.isConnected && !resolved) playCubeClear(cleared);
      }, 180);
      setTimeout(() => {
        if (top.isConnected && !resolved) playSeq();
      }, 720);
    } else {
      playTone(face); // hum back the note you just pressed, in its own pitch
    }
  };

  top.append(closeBtn, info, status);
  bottom.append(pads);
  playSeq();
}

// In-scene game: throw meter over the stage, animation in the scene.
// Loops: after each throw plays out, the meter comes right back.
function fetchGame(ctx: MenuCtx): void {
  // Just the slider up top; the throw is a little ball you tap down low, so
  // nothing but a small ball ever sits over the pet.
  const { el: top, close: closeTop } = stageOverlay(ctx);
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

  // The throw itself: a cute bobbing ball floating near the bottom.
  const ball = document.createElement("button");
  ball.className = "fetch-ball";
  ball.setAttribute("aria-label", "Throw the ball");
  ball.appendChild(iconEl("ball", 48));
  ctx.stageEl().appendChild(ball);
  const close = () => {
    closeTop();
    ball.remove();
  };

  let pos = 0;
  let dir = 1;
  let raf = 0;
  const animate = () => {
    // The overlay can be torn out from under us (death act, save restore) —
    // don't keep a zombie rAF loop mutating a detached node.
    if (!top.isConnected) return;
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
  const dismiss = registerActiveGame(() => {
    cancelAnimationFrame(raf);
    close();
  });

  ball.addEventListener("click", () => {
    const res = resolveFetch(pos, undefined, ctx.pet().stage, spot);
    dismiss();
    playSfx("throw"); // the ball leaves your hand
    if (ctx.pet().form === "dog") playSfx("bark"); // fetch is its favorite game — it says so
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
  hint.textContent = "Tap the ball on the green.";
  top.append(closeCorner(dismiss), hint, track);
}

const RPS_ROUNDS = 3;
const RPS_WINS_NEEDED = 2; // best of 3 — majority of 3 rounds; short of that, the match ties

// In-scene game: pick a move down at the bottom, watch it fly up into the
// countdown at the sprite. Played as a best-of-3, same shape as
// higher/lower — a pip per round (green/red/yellow), then the pet weighs in
// once on the whole match and you can go again. A tied round still counts:
// if neither side reaches the win threshold across all 3 rounds, the match
// itself is a tie.
function rps(ctx: MenuCtx): void {
  const cheat = ctx.pet().form === "gremlin";
  // Display up top over the pet; the three moves sit in a selector strip down
  // at the bottom, within thumb reach — same shape as higher/lower's cards
  // and would-you-rather's answers.
  const { top, bottom, close: rawClose } = splitOverlay(ctx);
  const close = registerActiveGame(rawClose);
  const closeBtn = closeCorner(close);

  const hint = document.createElement("p");
  hint.className = "stage-hint";

  // Best-of-3 progress: one pip per round, filled green (won), red (lost),
  // or yellow (tied) — same component as higher/lower's match tally.
  const pipRow = document.createElement("div");
  pipRow.className = "hl-pips";
  const pips: HTMLSpanElement[] = [];
  for (let i = 0; i < RPS_ROUNDS; i++) {
    const pip = document.createElement("span");
    pip.className = "hl-pip";
    pips.push(pip);
    pipRow.appendChild(pip);
  }

  const choices = document.createElement("div");
  choices.className = "rps-choices";
  const moves: { m: RpsMove; icon: IconName; label: string }[] = [
    { m: "rock", icon: "rock", label: "Rock" },
    { m: "paper", icon: "paper", label: "Paper" },
    { m: "scissors", icon: "scissors", label: "Scissors" },
  ];

  // The end-of-match beat: a verdict line up top by the pips, and two ways
  // forward down at the bottom — same pattern as higher/lower.
  const result = document.createElement("div");
  result.className = "hl-result";
  result.style.display = "none";
  const resultText = document.createElement("p");
  resultText.className = "stage-hint hl-result-text";
  result.append(resultText);

  const resultButtons = document.createElement("div");
  resultButtons.className = "game-choices";
  resultButtons.style.display = "none";
  const again = document.createElement("button");
  again.className = "btn btn-small";
  again.textContent = "Play again";
  again.addEventListener("click", () => startMatch());
  resultButtons.append(again, doneButton(close));

  let round = 0; // rounds settled so far, decisive or tied
  let wins = 0;
  let losses = 0;
  let picked = false;

  const newRound = () => {
    picked = false;
    choices.classList.remove("rps-chosen");
    hint.textContent =
      round === 0 ? `Round 1 of ${RPS_ROUNDS} — choose your weapon.` : `Round ${round + 1} of ${RPS_ROUNDS} — choose again.`;
  };

  const startMatch = () => {
    round = 0;
    wins = 0;
    losses = 0;
    for (const pip of pips) pip.className = "hl-pip";
    result.style.display = "none";
    resultButtons.style.display = "none";
    choices.style.display = "";
    newRound();
  };

  const finishMatch = () => {
    // Neither side reaching the win threshold across all 3 rounds is a match
    // tie — the same "splits the difference" spirit as a single tied round.
    const won: MatchResult = wins >= RPS_WINS_NEEDED ? true : losses >= RPS_WINS_NEEDED ? false : "tie";
    choices.style.display = "none";
    hint.textContent = "";
    resultText.textContent =
      won === "tie" ? `Tied — ${wins} of ${round}` : won ? `You win — ${wins} of ${round}` : `Beaten — ${wins} of ${round}`;
    result.classList.toggle("won", won === true);
    result.classList.toggle("lost", won === false);
    result.classList.toggle("tied", won === "tie");
    result.style.display = "";
    resultButtons.style.display = "";
    playSfx(won === "tie" ? "tie" : won ? "win" : "lose");
    // The pet weighs in on the whole match, not each throw — same handoff
    // every other match-shaped game uses.
    ctx.finishGame("rps", won);
  };

  for (const { m, icon, label } of moves) {
    const b = document.createElement("button");
    b.className = "rps-choice";
    b.setAttribute("aria-label", label);
    b.appendChild(iconEl(icon, 30));
    b.addEventListener("click", () => {
      if (picked || !top.isConnected) return; // one throw per round — no double-taps mid-flight
      picked = true;
      choices.classList.add("rps-chosen");
      const ai = rpsAiMove(m, cheat);
      const outcome = judgeRps(m, ai);
      ctx.scene().playRps(m as IconName, ai as IconName, outcome, () => {
        if (!top.isConnected) return; // torn out mid-reveal (sleep, death, restore)
        if (outcome === "tie") {
          ctx.sayLine("A tie. How embarrassing for us both.");
        } else if (outcome === "lose" && cheat && Math.random() < 0.3) {
          // The pick-after-you animation already shows the cheat; this is
          // just an occasional confession, not every losing round.
          ctx.sayLine("I definitely cheated.");
        }
        const pipClass = outcome === "tie" ? "tied" : outcome === "win" ? "won" : "lost";
        pips[round].classList.add(pipClass);
        if (outcome === "win") wins++;
        else if (outcome === "lose") losses++;
        round++;
        // Play out all 3 rounds regardless of when the match is already
        // decided — same as higher/lower's full 5.
        if (round >= RPS_ROUNDS) {
          finishMatch();
        } else {
          newRound();
        }
      });
    });
    choices.appendChild(b);
  }

  startMatch();
  top.append(closeBtn, hint, pipRow, result);
  bottom.append(choices, resultButtons);
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
    // Prompt up top over the pet; the guess itself is a tap on the scene, so
    // there's nothing to anchor at the bottom.
    const { el, close: rawClose } = stageOverlay(ctx);
    // Navigating away entirely (a nav tap, opening another panel) skips the
    // guess phase without resolving it. The creature is still off-scene then,
    // so bring it back — otherwise it's stuck invisible until the next round.
    let resolved = false;
    const close = registerActiveGame(() => {
      stageTapHandler = null;
      rawClose();
      if (!resolved) ctx.scene().playReveal(spot);
    });
    const closeBtn = closeCorner(close);

    const hint = document.createElement("p");
    hint.className = "stage-hint";
    hint.textContent = "Where did it go? Tap the stump, flowers, fence, or mushroom.";

    const guess = (won: boolean) => {
      resolved = true;
      close();
      // Sound the reveal now, at the start of the ~1.4s pop-out — the
      // win/lose verdict still lands later, at the animation's end.
      playSfx(won ? "found" : "empty");
      ctx.scene().playReveal(spot, () => {
        ctx.finishGame("hideseek", won, hideSeekLine(won, spot));
        if (canReplay(ctx)) hideSeekAgain(ctx);
      });
    };

    // Any tap on the stage is the guess — landing on the real spot wins,
    // landing anywhere else (a wrong spot, empty grass) just loses. It never
    // falls through to "exit the game".
    stageTapHandler = (x, y) => {
      const s = ctx.scene().hideSpotAt(x, y);
      guess(s === spot);
      return true;
    };

    el.append(closeBtn, hint);
  });
}

/** The between-rounds beat: hide again, or call it. */
function hideSeekAgain(ctx: MenuCtx): void {
  const { el, close: rawClose } = stageOverlay(ctx, "bottom");
  const close = registerActiveGame(rawClose);
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
  // Prompt up top over the pet; the two answers sit down at the bottom, in reach.
  const { top, bottom, close: rawClose } = splitOverlay(ctx);
  const close = registerActiveGame(rawClose);
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
  top.append(hint);
  bottom.append(choices, doneButton(close));
}

// --- Care -------------------------------------------------------------------
export function openCare(ctx: MenuCtx): void {
  const p = openPanel("Care", "Look after your sprite.");
  const pet = ctx.pet();

  const grid = document.createElement("div");
  grid.className = "tile-grid centered";
  // Like the Food button, the label never advertises the pet's condition —
  // reading whether it's actually sick is part of the game.
  grid.appendChild(
    tile("pill", "Give Medicine", () => {
      ctx.medicine();
      p.close();
    }),
  );
  const young = pet.stage === "baby" || pet.stage === "egg";
  grid.appendChild(
    tile(
      "whistle",
      "Discipline",
      () => {
        ctx.discipline();
        p.close();
      },
      young ? "No effect yet" : undefined,
    ),
  );
  p.body.appendChild(grid);
}

/** The retirement walk: no danger styling, no dire warning — it asked to go. */
function confirmWalk(ctx: MenuCtx, p: Panel): void {
  const pet = ctx.pet();
  p.setTitle("Walk them to the farm?", `${pet.name} is ready. They've been ready.`);
  p.body.innerHTML = "";
  const line = document.createElement("p");
  line.textContent = farewellWalkLine();
  line.style.fontStyle = "italic";
  const confirm = document.createElement("button");
  confirm.className = "btn";
  confirm.textContent = "Walk together";
  confirm.addEventListener("click", () => {
    ctx.sendToFarm();
    p.close();
  });
  const cancel = document.createElement("button");
  cancel.className = "btn secondary";
  cancel.textContent = "One more day";
  cancel.addEventListener("click", p.close);
  p.body.append(line, confirm, cancel);
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
  const condition = describeCondition(pet, now);
  const rows: [string, string | HTMLElement][] = [
    ["Name", pet.name],
    ["Stage", pet.form ? `Adult · ${formName}` : STAGE_LABEL[pet.stage]],
    ["Age", ageLabel(now - pet.createdAt)],
    ["Weight", `${Math.round(pet.weight)}g`],
    ["Energy", heartBar(pet.energy)],
    ["Happiness", heartBar(pet.happiness)],
    ["Health", pctBar(pet.health)],
    ["Discipline", pctBar(pet.discipline, "var(--accent)")],
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

  // Right below Condition, before the admin buttons — this reads as a fork in
  // the pet's fate, not a settings item. A ready retiree isn't "sent"
  // anywhere — you walk them over. Same destination, entirely different button.
  const ready = retirementPhase(pet) === "ready";
  const farmBtn = document.createElement("button");
  farmBtn.className = ready
    ? "btn btn-iconed farm-btn"
    : "btn danger-outline btn-iconed farm-btn";
  farmBtn.appendChild(iconEl("barn", 18));
  farmBtn.appendChild(document.createTextNode(ready ? "Walk them to the farm" : "Send to Farm…"));
  farmBtn.addEventListener("click", () => (ready ? confirmWalk(ctx, p) : confirmFarm(ctx, p)));
  p.body.appendChild(farmBtn);

  // "Collection", not "Collection & Farm" — keeps the farm a surprise
  // until a pet actually retires there.
  const adminRow = document.createElement("div");
  adminRow.className = "btn-pair";
  const coll = document.createElement("button");
  coll.className = "btn secondary btn-iconed";
  coll.appendChild(iconEl("book", 18));
  coll.appendChild(document.createTextNode("Collection"));
  coll.addEventListener("click", () => {
    p.close();
    openCollection(ctx);
  });
  const backup = document.createElement("button");
  backup.className = "btn secondary btn-iconed";
  backup.appendChild(iconEl("disk", 18));
  backup.appendChild(document.createTextNode("Backup save"));
  backup.addEventListener("click", () => {
    p.close();
    openBackup(ctx);
  });
  adminRow.append(coll, backup);
  p.body.appendChild(adminRow);

  p.body.appendChild(soundSettings());
  p.body.appendChild(notifySettings());

  // The margin dwellers: dev tools bottom-left, the manual bottom-right.
  // Both deliberately obscure — neither is part of the game proper.
  const footer = document.createElement("div");
  footer.className = "panel-footer";
  const gear = document.createElement("button");
  gear.className = "help-hidden";
  gear.textContent = "⚙";
  gear.setAttribute("aria-label", "Dev tools");
  gear.addEventListener("click", () => {
    p.close();
    openDevTools(ctx);
  });
  const help = document.createElement("button");
  help.className = "help-hidden";
  help.textContent = "?";
  help.setAttribute("aria-label", "About all this");
  help.addEventListener("click", () => {
    p.close();
    openHelp();
  });
  footer.append(gear, help);
  p.body.appendChild(footer);
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
  // Match the home-screen care meters: a row of pixel-art hearts snapped to
  // half-heart steps (full / half / empty), not font glyphs.
  const el = document.createElement("span");
  el.className = "heart-meter";
  const q = Math.round(v * 2) / 2;
  for (let i = 0; i < MAX_HEARTS; i++) {
    const filled = q - i;
    const name = filled >= 1 ? "heart" : filled >= 0.5 ? "hearthalf" : "heartempty";
    el.appendChild(iconEl(name, 16));
  }
  return el;
}

function pctBar(v: number, fill = "var(--health)"): HTMLElement {
  // Same chrome as the home-screen health bar: square, bordered, tan track.
  // Health fills green to match home; discipline passes its own accent.
  const bar = document.createElement("div");
  bar.className = "bar";
  const span = document.createElement("span");
  span.style.width = `${Math.max(0, Math.min(100, v))}%`;
  span.style.background = fill;
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
  return key === "ghost" || key === "humcube" || key === "cosmos";
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
    el.appendChild(txt);
    // Only entries retired since diagnostics existed carry the full final
    // snapshot — see FarmEntry.final. Same diagnostic tool as the Backup
    // panel's, just scoped to whichever grave or resident was tapped.
    if (e.final) {
      const dbg = document.createElement("button");
      dbg.className = "farm-info-debug";
      dbg.textContent = "Debug report";
      dbg.addEventListener("click", (ev) => {
        ev.stopPropagation();
        copyText(formatDebugReport(e.final!));
        dbg.textContent = "Copied!";
      });
      el.appendChild(dbg);
    }
    const x = document.createElement("button");
    x.className = "farm-info-close";
    x.setAttribute("aria-label", "Close");
    x.textContent = "✕";
    x.addEventListener("click", hide);
    el.appendChild(x);
    el.classList.add("open");
  };

  return { el, show, hide };
}

/** Dress the paddock: sky and festival trimmings up top, a barn and fence on
 *  the horizon, and picnic/campfire/pond furniture down in the walkable band —
 *  depth-sorted with the same 1000 − bottom rule the walkers use. On festival
 *  nights the sky turns to dusk: moon and stars instead of sun and clouds,
 *  paper lanterns instead of bunting, and fireflies over the grass. */
function decoratePasture(pasture: HTMLElement, festival: boolean, onBarnTap?: () => void): void {
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

  // The horizon: a barn, a fence line, a far tree. The barn doubles as a
  // hidden "reset progress" switch — no visible affordance, you just have to
  // know to tap it.
  const barn = add("barn", "far", "14%", "57%", 3, 2);
  if (onBarnTap) {
    // .prop normally has pointer-events: none so taps fall through to the
    // grass — this class opts the barn back in so it can actually be tapped.
    barn.classList.add("barn-hotspot");
    barn.addEventListener("click", (e) => {
      e.stopPropagation(); // don't let the pasture click-to-dismiss swallow it
      onBarnTap();
    });
  }
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
      // Discovered secrets wear a golden frame + star so they read as rare
      // catches, not just another face in the regular crew. The one ultra
      // secret gets a whole starfield of its own (see .tile.cosmic) — a
      // different order of rare.
      if (def.secret) {
        el.classList.add(def.ultra ? "cosmic" : "secret");
        const badge = document.createElement("span");
        badge.className = "secret-badge";
        badge.appendChild(iconEl(def.ultra ? "sparkle" : "star", 16));
        el.appendChild(badge);
      }
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

  const farmSection = document.createElement("div");
  p.body.appendChild(farmSection);

  // Rebuilt in place after a reset so the reveal stays on this screen instead
  // of dumping the player back out to the sprite scene.
  const renderFarm = () => {
    farmSection.replaceChildren();
    const h = document.createElement("h2");
    h.innerHTML = `${iconHTML("barn", 18)} The Farm`;
    h.style.fontSize = "1.1rem";
    h.style.marginTop = "18px";
    farmSection.appendChild(h);
    // Always render the yard, even with nobody in it yet — the barn out on
    // the horizon is the (undocumented) way in to resetFarm(), so it has to
    // exist whether or not you've retired anyone.
    farmSection.appendChild(
      farmYard(ctx.farm(), () => confirmResetFarm(ctx, renderFarm)),
    );
  };
  renderFarm();
}

function confirmResetFarm(ctx: MenuCtx, onReset: () => void): void {
  const p = openPanel(
    "Reset the farm?",
    "This is permanent. Every retiree and gravestone is gone for good.",
  );
  const line = document.createElement("p");
  line.textContent =
    "Your Collection of discovered adults is kept — only the farm archive and graveyard are cleared.";
  line.style.fontStyle = "italic";
  const confirm = document.createElement("button");
  confirm.className = "btn danger";
  confirm.textContent = "Wipe the farm";
  confirm.addEventListener("click", () => {
    ctx.resetFarm();
    p.close();
    onReset();
  });
  const cancel = document.createElement("button");
  cancel.className = "btn secondary";
  cancel.textContent = "Never mind";
  cancel.addEventListener("click", p.close);
  p.body.append(line, confirm, cancel);
}

/** The farm as a little diorama: retirees loafing among the scenery, an info
 *  strip that fills in whoever you tap, and a fenced graveyard plot below with
 *  every headstone bearing its keeper's full name. */
function farmYard(farm: FarmEntry[], onBarnTap?: () => void): HTMLElement {
  const yard = document.createElement("div");
  yard.className = "farm-yard";

  const formName = (e: FarmEntry) =>
    e.form ? ADULTS[e.form].name : STAGE_LABEL[e.finalStage];
  const info = farmInfoStrip(formName);

  const festival = festivalTonight();
  const pasture = document.createElement("div");
  pasture.className = "pasture";
  decoratePasture(pasture, festival, onBarnTap);
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

// --- Dev Tools ---------------------------------------------------------------
// The gear in the Status margin. Timeline switching, loaded dice for every
// event the game normally rolls for, and the diagnostic views (History, the
// debug report) that used to hide in the Backup panel.
export function openDevTools(ctx: MenuCtx): void {
  const p = openPanel("Dev Tools", "Levers behind the meadow.");

  const section = (text: string) => {
    const el = document.createElement("p");
    el.className = "muted";
    el.textContent = text;
    p.body.appendChild(el);
    return el;
  };

  // Timeline: real wall-clock pacing, or everything at demo speed.
  const tlWrap = document.createElement("div");
  tlWrap.className = "notify-settings";
  const tlLabel = document.createElement("p");
  tlLabel.className = "muted";
  tlLabel.textContent = `Timeline — demo runs game-time ${TIMELINE_SPEED.demo}× faster`;
  const tlRow = document.createElement("div");
  tlRow.className = "notify-row";
  const paintTimeline = () => {
    const active = ctx.pet().timeline === "demo" ? "demo" : "real";
    tlRow.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.tl === active);
    });
  };
  for (const t of ["real", "demo"] as const) {
    const b = document.createElement("button");
    b.className = "notify-opt";
    b.dataset.tl = t;
    b.textContent = t === "real" ? "Real" : "Demo";
    b.addEventListener("click", () => {
      ctx.devAction({ type: "timeline", timeline: t });
      paintTimeline();
    });
    tlRow.appendChild(b);
  }
  tlWrap.append(tlLabel, tlRow);
  p.body.appendChild(tlWrap);
  paintTimeline();

  // Stat levers stay in the panel (you're dialing a number in, not watching a
  // moment) — every tap repaints all the readouts from the fresh state.
  const repaints: (() => void)[] = [];
  const repaintAll = () => repaints.forEach((f) => f());
  const r1 = (v: number) => Math.round(v * 10) / 10;

  const leverRow = (
    parent: HTMLElement,
    label: string,
    current: () => number,
    buttons: { text: string; target: () => number }[],
    dispatch: (value: number) => void,
  ) => {
    const row = document.createElement("div");
    row.className = "dev-stat";
    const name = document.createElement("span");
    name.className = "dev-stat-label";
    name.textContent = label;
    const value = document.createElement("span");
    value.className = "dev-stat-value";
    repaints.push(() => {
      value.textContent = String(r1(current()));
    });
    row.appendChild(name);
    for (const { text, target } of buttons) {
      const b = document.createElement("button");
      b.className = "btn secondary btn-small dev-step";
      b.textContent = text;
      b.setAttribute("aria-label", `${text} ${label}`);
      b.addEventListener("click", () => {
        dispatch(target());
        repaintAll();
      });
      // The readout sits between the − and + steppers.
      if (text === "−") row.append(b, value);
      else row.appendChild(b);
    }
    parent.appendChild(row);
  };

  section("Set a stat:");
  const stats = document.createElement("div");
  stats.className = "dev-stats";
  const statRow = (stat: DevStat, label: string, step: number) => {
    const current = () => ctx.pet()[stat];
    const { min, max } = DEV_STAT_RANGE[stat];
    leverRow(
      stats,
      label,
      current,
      [
        { text: "min", target: () => min },
        { text: "−", target: () => current() - step },
        { text: "+", target: () => current() + step },
        { text: "max", target: () => max },
      ],
      (value) => ctx.devAction({ type: "stat", stat, value }),
    );
  };
  statRow("energy", "Energy", 0.5);
  statRow("happiness", "Happiness", 0.5);
  statRow("health", "Health", 10);
  statRow("discipline", "Discipline", 10);
  statRow("weight", "Weight", 1);
  p.body.appendChild(stats);

  // The hidden ledger: evolution's actual inputs (see determineAdultForm)
  // plus the care-mistake counter — nudged, not set, since they're tallies.
  section("Hidden ledger:");
  const ledger = document.createElement("div");
  ledger.className = "dev-stats";
  const hiddenRow = (stat: DevHidden, label: string) => {
    const current = () => ctx.pet().hidden[stat];
    leverRow(
      ledger,
      label,
      current,
      [
        { text: "−", target: () => -1 },
        { text: "+", target: () => 1 },
      ],
      (delta) => ctx.devAction({ type: "hidden", stat, delta }),
    );
  };
  hiddenRow("careMistakes", "Care mistakes");
  hiddenRow("discipline", "Discipline (hidden)");
  hiddenRow("nightCare", "Night care");
  hiddenRow("cakeEaten", "Cake eaten");
  hiddenRow("cubeEaten", "Cubes eaten");
  hiddenRow("carrotEaten", "Carrots eaten");
  p.body.appendChild(ledger);
  repaintAll();

  // Forced events close the panel — the payoff (the squat, the call bubble,
  // the evolution flash) plays out on the stage underneath.
  const devBtn = (grid: HTMLElement, text: string, action: DevAction) => {
    const b = document.createElement("button");
    b.className = "btn secondary btn-small";
    b.textContent = text;
    b.addEventListener("click", () => {
      p.close();
      ctx.devAction(action);
    });
    grid.appendChild(b);
  };

  section("Force an event:");
  const events = document.createElement("div");
  events.className = "dev-grid";
  devBtn(events, "Mess", { type: "poop", bad: false });
  devBtn(events, "Bad mess", { type: "poop", bad: true });
  devBtn(events, "Attention call", { type: "call", fake: false });
  devBtn(events, "Fake call", { type: "call", fake: true });
  devBtn(events, "Zoomies", { type: "zoomies" });
  devBtn(events, "Grow up", { type: "grow" });
  devBtn(events, "Ready to retire", { type: "retire-ready" });
  p.body.appendChild(events);

  section("Inflict an illness:");
  const illnesses = document.createElement("div");
  illnesses.className = "dev-grid";
  for (const id of Object.keys(ILLNESSES) as IllnessId[]) {
    devBtn(illnesses, ILLNESSES[id].label, { type: "illness", illness: id });
  }
  p.body.appendChild(illnesses);

  // Two views onto the same diagnostic trail, both deliberately understated —
  // neither is a save format. History reads it in plain language, in-game; the
  // debug report dumps it verbatim for pasting somewhere else.
  section("For explaining what happened, in detail:");
  const debugRow = document.createElement("div");
  debugRow.className = "btn-pair";
  const historyBtn = document.createElement("button");
  historyBtn.className = "btn secondary btn-small";
  historyBtn.textContent = "History";
  historyBtn.addEventListener("click", () => {
    p.close();
    openHistory(ctx);
  });
  const debugBtn = document.createElement("button");
  debugBtn.className = "btn secondary btn-small";
  debugBtn.textContent = "Copy debug report";
  debugBtn.addEventListener("click", () => {
    copyText(formatDebugReport(ctx.pet()));
    debugBtn.textContent = "Copied!";
  });
  debugRow.append(historyBtn, debugBtn);
  p.body.appendChild(debugRow);
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
    copyText(ta.value);
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

/** The pet's life, in plain language and in reverse — the diagnostic trail as
 *  something you'd actually read. Vitals (the hourly numbers) default on:
 *  they're what you want when you're asking "why did it get sick". */
export function openHistory(ctx: MenuCtx): void {
  const pet = ctx.pet();
  const p = openPanel(pet.name, "History");
  let showVitals = true;

  // Same chrome as the sound/notification toggles — same shape of decision.
  const toggle = document.createElement("div");
  toggle.className = "notify-settings";
  const toggleLabel = document.createElement("p");
  toggleLabel.className = "muted";
  toggleLabel.textContent = "Vitals";
  const toggleRow = document.createElement("div");
  toggleRow.className = "notify-row";

  const list = document.createElement("div");
  list.className = "history-list";

  const paint = () => {
    toggleRow.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", (b.dataset.on === "1") === showVitals);
    });
    list.innerHTML = "";
    const days = buildHistory(ctx.pet(), { includeVitals: showVitals });
    if (days.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted history-empty";
      empty.textContent = "Nothing has happened yet.";
      list.appendChild(empty);
      return;
    }
    // The ring is capped (see state.ts) — if it has evicted anything, say so
    // rather than showing a trail that looks complete but isn't.
    if (historyTruncated(ctx.pet())) {
      const warn = document.createElement("p");
      warn.className = "muted history-truncated";
      warn.textContent = "Only the most recent events are kept — older ones have been forgotten.";
      list.appendChild(warn);
    }
    for (const day of days) {
      const head = document.createElement("h3");
      head.className = "history-day";
      head.textContent = day.label;
      list.appendChild(head);
      for (const row of day.rows) {
        const el = document.createElement("div");
        el.className = row.kind === "vitals" ? "history-row vitals" : "history-row";
        const icon = document.createElement("span");
        icon.className = "history-icon";
        icon.textContent = row.icon;
        const time = document.createElement("span");
        time.className = "history-time";
        time.textContent = rowTime(row.t);
        const text = document.createElement("span");
        text.className = "history-text";
        text.textContent = row.text;
        el.append(icon, time, text);
        list.appendChild(el);
      }
    }
  };

  for (const opt of [
    { on: true, text: "Show" },
    { on: false, text: "Hide" },
  ]) {
    const b = document.createElement("button");
    b.className = "notify-opt";
    b.dataset.on = opt.on ? "1" : "0";
    b.textContent = opt.text;
    b.addEventListener("click", () => {
      showVitals = opt.on;
      paint();
    });
    toggleRow.appendChild(b);
  }
  toggle.append(toggleLabel, toggleRow);

  const back = document.createElement("button");
  back.className = "btn secondary btn-small";
  back.textContent = "Back to Dev Tools";
  back.addEventListener("click", () => {
    p.close();
    openDevTools(ctx);
  });

  p.body.append(toggle, list, back);
  paint();
}
