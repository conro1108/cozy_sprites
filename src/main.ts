import "./style.css";
import {
  MAX_HEARTS,
  applyElapsedDecay,
  clean,
  createPet,
  discipline,
  feed,
  giveMedicine,
  isNight,
  applyGameResult,
  stepEvents,
  tap,
  toggleLight,
} from "./pet/state";
import type { AdultForm, FoodId, GameId, PetState } from "./pet/types";
import { ADULTS } from "./pet/roster";
import { pickLine } from "./pet/dialogue";
import type { Category } from "./pet/dialogue";
import {
  exportSave,
  importSave,
  loadFarm,
  loadPet,
  retireToFarm,
  savePet,
  getDeviceId,
} from "./pet/persistence";
import { Scene } from "./render/scene";
import { creatureKey } from "./render/sprites";
import type { Mood } from "./render/sprites";
import { initMenus, openCare, openFood, openPlay, openStatus } from "./ui/menus";

const TICK_MS = 3_000;
const BUBBLE_MS = 4_000;
const IDLE_MIN_MS = 45_000; // demo cadence (SPEC §8 wants 10–20 min in prod)
const IDLE_MAX_MS = 90_000;

const app = document.querySelector<HTMLDivElement>("#app")!;
getDeviceId(); // ensure anonymous device identity exists (SPEC §6)

let pet: PetState | null = null;
let farm = loadFarm();
let scene: Scene | null = null;
let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
let nextIdleAt = 0;
let tickHandle: ReturnType<typeof setInterval> | undefined;

// Elements populated when the game screen mounts.
let els: {
  bubble: HTMLDivElement;
  attn: HTMLDivElement;
  name: HTMLDivElement;
  sub: HTMLDivElement;
  sick: HTMLDivElement;
  hunger: HTMLDivElement;
  happy: HTMLDivElement;
  health: HTMLDivElement;
  nav: Record<string, HTMLButtonElement>;
} | null = null;

initMenus(app);
boot();

function boot(): void {
  pet = loadPet();
  if (pet) {
    // Mount first so the scene/HUD exist, then catch up — this way an evolution
    // or hatch that completed while the app was closed still plays its fanfare.
    mountGame();
    stepPet(Date.now(), true);
    commit();
  } else {
    mountHatch();
  }
}

// --- Hatch screen -----------------------------------------------------------
function mountHatch(): void {
  stopTick();
  scene?.stop();
  scene = null;
  els = null;
  app.innerHTML = `
    <div class="hatch-screen">
      <h1>🥚 A new egg</h1>
      <p class="muted">Something is about to hatch. What will you call it?</p>
      <input id="petname" maxlength="12" placeholder="Name your sprite" value="Milo" />
      <button class="btn" id="hatchbtn">Begin</button>
    </div>`;
  const input = app.querySelector<HTMLInputElement>("#petname")!;
  const begin = () => {
    const name = input.value.trim() || "Milo";
    pet = createPet(name, Date.now());
    savePet(pet);
    mountGame();
    say(pickLine(pet!, "hatch"));
  };
  app.querySelector("#hatchbtn")!.addEventListener("click", begin);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") begin();
  });
}

// --- Game screen ------------------------------------------------------------
function mountGame(): void {
  app.innerHTML = `
    <div class="hud">
      <div class="meters">
        <div class="meter-row"><span class="icon">🍔</span><div class="hearts" data-hunger></div></div>
        <div class="meter-row"><span class="icon">💛</span><div class="hearts" data-happy></div></div>
        <div class="meter-row"><span class="icon">❤️</span><div class="health-bar"><div class="fill" data-health></div></div></div>
      </div>
      <div class="idcol">
        <div class="pet-name" data-name></div>
        <div class="pet-sub" data-sub></div>
        <div class="badge-sick" data-sick style="display:none">🤒 sick</div>
      </div>
    </div>
    <div class="stage">
      <canvas id="scene"></canvas>
      <div class="speech-bubble" data-bubble></div>
      <div class="attention" data-attn style="display:none">❗</div>
    </div>
    <nav class="nav">
      <button data-action="status"><span class="ico">📋</span>Status</button>
      <button data-action="food"><span class="ico">🍔</span>Food</button>
      <button data-action="play"><span class="ico">🎮</span>Play</button>
      <button data-action="clean"><span class="ico">🧹</span>Clean</button>
      <button data-action="care"><span class="ico">🩹</span>Care</button>
      <button data-action="light"><span class="ico">💡</span>Light</button>
    </nav>`;

  const nav: Record<string, HTMLButtonElement> = {};
  app.querySelectorAll<HTMLButtonElement>(".nav button").forEach((b) => {
    nav[b.dataset.action!] = b;
  });
  els = {
    bubble: app.querySelector("[data-bubble]")!,
    attn: app.querySelector("[data-attn]")!,
    name: app.querySelector("[data-name]")!,
    sub: app.querySelector("[data-sub]")!,
    sick: app.querySelector("[data-sick]")!,
    hunger: app.querySelector("[data-hunger]")!,
    happy: app.querySelector("[data-happy]")!,
    health: app.querySelector("[data-health]")!,
    nav,
  };

  const canvas = app.querySelector<HTMLCanvasElement>("#scene")!;
  scene = new Scene(canvas);
  scene.start();
  canvas.addEventListener("click", onTapPet);

  nav.status.addEventListener("click", () => openStatus(ctx, Date.now()));
  nav.food.addEventListener("click", () => openFood(ctx));
  nav.play.addEventListener("click", () => openPlay(ctx));
  nav.clean.addEventListener("click", doClean);
  nav.care.addEventListener("click", () => openCare(ctx));
  nav.light.addEventListener("click", doLight);

  nextIdleAt = Date.now() + rand(IDLE_MIN_MS, IDLE_MAX_MS);
  render();
  startTick();
}

// --- Rendering --------------------------------------------------------------
function render(): void {
  if (!pet || !els || !scene) return;
  const now = Date.now();
  renderHearts(els.hunger, pet.hunger);
  renderHearts(els.happy, pet.happiness);
  els.health.style.width = `${pet.health}%`;
  els.name.textContent = pet.name;
  els.sub.textContent = pet.form ? ADULTS[pet.form].name : stageLabel(pet.stage);
  els.sick.style.display = pet.sick ? "block" : "none";
  els.attn.style.display = pet.wantsAttention ? "block" : "none";

  // Nav alert cues (never reveals hidden state — just surfaces visible needs).
  toggleAlert(els.nav.food, pet.hunger <= 1);
  toggleAlert(els.nav.play, pet.happiness <= 1);
  toggleAlert(els.nav.clean, pet.poops > 0);
  toggleAlert(els.nav.care, pet.sick);
  els.nav.light.querySelector(".ico")!.textContent = pet.lightsOn ? "💡" : "🌙";

  scene.update({
    key: creatureKey(pet.stage, pet.form),
    mood: moodOf(pet),
    poops: pet.poops,
    night: isNight(now),
    asleep: pet.asleep,
    lightsOn: pet.lightsOn,
  });
}

function renderHearts(container: HTMLElement, value: number): void {
  container.innerHTML = "";
  for (let i = 0; i < MAX_HEARTS; i++) {
    const heart = document.createElement("div");
    heart.className = "heart";
    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = `${Math.max(0, Math.min(1, value - i)) * 100}%`;
    heart.appendChild(fill);
    container.appendChild(heart);
  }
}

function toggleAlert(btn: HTMLButtonElement, on: boolean): void {
  btn.classList.toggle("alert", on);
}

function moodOf(p: PetState): Mood {
  if (p.asleep) return "sleep";
  if (p.sick || p.hunger <= 1 || p.happiness <= 1) return "sad";
  if (p.happiness >= 3.5 && p.health > 60) return "happy";
  return "neutral";
}

function stageLabel(stage: PetState["stage"]): string {
  return { egg: "Egg", baby: "Baby", child: "Child", teen: "Teen", adult: "Adult" }[stage];
}

// --- Speech -----------------------------------------------------------------
function say(line: string | null): void {
  if (!line || !els) return;
  els.bubble.textContent = line;
  els.bubble.classList.add("visible");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => els?.bubble.classList.remove("visible"), BUBBLE_MS);
}

function sayCat(cat: Category): void {
  if (pet) say(pickLine(pet, cat));
}

// --- Actions ----------------------------------------------------------------
function onTapPet(): void {
  if (!pet) return;
  const r = tap(pet, Date.now());
  pet = r.state;
  if (r.annoyed) {
    sayCat("annoyed");
    scene?.triggerPulse("shake");
  } else if (r.answered) {
    sayCat("tap");
    scene?.triggerPulse("happy");
  } else {
    sayCat("tap");
  }
  commit();
}

function doFeed(food: FoodId): void {
  if (!pet) return;
  const { state, note } = feed(pet, food, Date.now());
  pet = state;
  if (note === "cant") {
    say(pet.stage === "egg" ? "*the egg does not eat*" : "Zzz…");
  } else {
    say(pickLine(pet, feedCategory(food, note)));
    scene?.triggerPulse("eat");
  }
  commit();
}

function feedCategory(food: FoodId, note?: string): Category {
  if (note === "favorite") return "feed_favorite";
  if (note === "disliked") return "feed_disliked";
  if (food === "cube") return "cube";
  if (food === "cake") return "cake";
  if (food === "carrot") return "carrot";
  return "feed";
}

function doClean(): void {
  if (!pet) return;
  const { state, note } = clean(pet, Date.now());
  pet = state;
  if (note === "cleaned") sayCat("clean");
  commit();
}

function doMedicine(): void {
  if (!pet) return;
  const { state, note } = giveMedicine(pet, Date.now());
  pet = state;
  if (note === "cured") {
    sayCat("medicine");
    scene?.triggerPulse("happy");
  } else if (note === "notneeded") {
    say("I'm not sick. But thank you, I guess.");
  }
  commit();
}

function doDiscipline(): void {
  if (!pet) return;
  const { state, note } = discipline(pet, Date.now());
  pet = state;
  if (note === "correct") sayCat("discipline_correct");
  else if (note === "incorrect") {
    sayCat("discipline_incorrect");
    scene?.triggerPulse("shake");
  } else say("*too little to scold*");
  commit();
}

function doLight(): void {
  if (!pet) return;
  pet = toggleLight(pet, Date.now());
  say(pet.asleep ? pickLine(pet, "sleep") : pickLine(pet, "wake"));
  commit();
}

function doFinishGame(game: GameId, won: boolean, line?: string): void {
  if (!pet) return;
  // Would You Rather is never win/lose — only a slight bump (SPEC §11).
  pet = applyGameResult(pet, game, game === "wouldyou" ? false : won, Date.now());
  if (line) say(line);
  else sayCat(won ? "win" : "lose");
  if (won || game === "wouldyou") scene?.triggerPulse("happy");
  commit();
}

function doSendToFarm(): void {
  if (!pet) return;
  farm = retireToFarm(pet, Date.now());
  pet = null;
  mountHatch();
}

function commit(): void {
  if (pet) savePet(pet);
  render();
}

// --- Tick loop --------------------------------------------------------------
function startTick(): void {
  stopTick();
  tickHandle = setInterval(tick, TICK_MS);
}
function stopTick(): void {
  if (tickHandle) clearInterval(tickHandle);
}

/**
 * Advance the pet to `now`: decay, optional world events, and — crucially —
 * fire the hatch/evolve fanfare if a stage boundary was crossed. Shared by the
 * tick loop, cold boot, and returning-to-foreground so transitions that happen
 * while backgrounded aren't silently missed. Returns whether the stage changed.
 */
function stepPet(now: number, withEvents: boolean): boolean {
  if (!pet) return false;
  const prevStage = pet.stage;
  const elapsed = now - pet.lastUpdated;
  pet = applyElapsedDecay(pet, now);
  if (withEvents) pet = stepEvents(pet, elapsed).state;
  const changed = pet.stage !== prevStage;
  if (changed) handleStageChange(prevStage, pet.stage);
  return changed;
}

function tick(): void {
  if (!pet) return;
  const now = Date.now();
  if (!stepPet(now, true)) maybeIdleLine(now);
  commit();
}

function handleStageChange(from: PetState["stage"], to: PetState["stage"]): void {
  if (!pet) return;
  if (to === "baby") {
    say(pickLine(pet, "hatch"));
    scene?.triggerPulse("happy");
  } else if (to === "adult") {
    scene?.triggerPulse("evolve");
    // The adult's first-ever line (SPEC §4 evolution payoff).
    setTimeout(() => {
      if (pet) say(pickLine(pet, "idle"));
    }, 700);
  } else {
    void from;
  }
}

function maybeIdleLine(now: number): void {
  if (!pet || pet.asleep) return;
  if (now < nextIdleAt) return;
  if (Math.random() < 0.6) sayCat("idle");
  nextIdleAt = now + rand(IDLE_MIN_MS, IDLE_MAX_MS);
}

// --- Context for menus ------------------------------------------------------
const ctx = {
  pet: () => pet!,
  farm: () => farm,
  discovered: (): Set<AdultForm> => {
    const set = new Set<AdultForm>();
    for (const e of farm) if (e.form) set.add(e.form);
    if (pet?.form) set.add(pet.form);
    return set;
  },
  feed: doFeed,
  clean: doClean,
  medicine: doMedicine,
  discipline: doDiscipline,
  finishGame: doFinishGame,
  sayLine: say,
  sendToFarm: doSendToFarm,
  exportSave,
  importSave,
  reload: () => {
    scene?.stop();
    farm = loadFarm();
    boot();
  },
};

// --- Utils ------------------------------------------------------------------
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") commit();
  else if (pet) {
    stepPet(Date.now(), true);
    commit();
  }
});

// Register the offline service worker in production builds only.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
