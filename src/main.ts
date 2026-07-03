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
import {
  pickLine,
  shouldSpeak,
  teenFlickerLine,
  illnessAnnouncement,
  memorialLine,
  epitaph,
} from "./pet/dialogue";
import type { Category } from "./pet/dialogue";
import { determineAdultForm } from "./pet/evolution";
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
import { iconHTML, iconUrl } from "./render/icons";
import { notify } from "./ui/notifications";
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
let dying = false; // death act in progress — input paused

// Elements populated when the game screen mounts.
let els: {
  stage: HTMLDivElement;
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
  if (!pet) {
    mountHatch();
  } else if (pet.deadAt !== null) {
    // Died while we were away — no animation replay, straight to the memorial.
    mountMemorial();
  } else {
    // Mount first so the scene/HUD exist, then catch up — this way an evolution
    // or hatch that completed while the app was closed still plays its fanfare.
    mountGame();
    stepPet(Date.now(), true);
    commit();
  }
}

// --- Hatch screen -----------------------------------------------------------
function mountHatch(): void {
  stopTick();
  scene?.stop();
  scene = null;
  els = null;
  dying = false;
  app.innerHTML = `
    <div class="hatch-screen">
      ${iconHTML("egg", 56)}
      <h1>A new egg</h1>
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

// --- Memorial screen ---------------------------------------------------------
function mountMemorial(): void {
  if (!pet) return;
  stopTick();
  scene?.stop();
  scene = null;
  els = null;
  dying = false;
  const p = pet;
  const lived = (p.deadAt ?? Date.now()) - p.createdAt;
  app.innerHTML = `
    <div class="hatch-screen memorial">
      ${iconHTML("grave", 56)}
      <h1>${memorialLine(p.name, p.causeOfDeath)}</h1>
      <p class="muted">${epitaph()}</p>
      <p class="muted">It lived ${formatAge(lived)}.</p>
      <button class="btn" id="restbtn">Lay to rest</button>
    </div>`;
  app.querySelector("#restbtn")!.addEventListener("click", () => {
    farm = retireToFarm(p, Date.now());
    pet = null;
    mountHatch();
  });
}

function formatAge(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} minutes`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hours`;
  return `${Math.floor(h / 24)} days`;
}

// --- Game screen ------------------------------------------------------------
function mountGame(): void {
  dying = false;
  app.innerHTML = `
    <div class="hud">
      <div class="meters">
        <div class="meter-row">${iconHTML("burger", 16)}<div class="hearts" data-hunger></div></div>
        <div class="meter-row">${iconHTML("heartgold", 16)}<div class="hearts" data-happy></div></div>
        <div class="meter-row">${iconHTML("heart", 16)}<div class="health-bar"><div class="fill" data-health></div></div></div>
      </div>
      <div class="idcol">
        <div class="pet-name" data-name></div>
        <div class="pet-sub" data-sub></div>
        <div class="badge-sick" data-sick style="display:none">${iconHTML("thermometer", 14)} sick</div>
      </div>
    </div>
    <div class="stage" data-stage>
      <canvas id="scene"></canvas>
      <div class="speech-bubble" data-bubble></div>
      <div class="attention" data-attn style="display:none">${iconHTML("alert", 22)}</div>
    </div>
    <nav class="nav">
      <button data-action="status">${iconHTML("status", 26)}Status</button>
      <button data-action="food">${iconHTML("burger", 26)}Food</button>
      <button data-action="play">${iconHTML("play", 26)}Play</button>
      <button data-action="clean">${iconHTML("broom", 26)}Clean</button>
      <button data-action="care">${iconHTML("bandage", 26)}Care</button>
      <button data-action="light">${iconHTML("bulb", 26)}Light</button>
    </nav>`;

  const nav: Record<string, HTMLButtonElement> = {};
  app.querySelectorAll<HTMLButtonElement>(".nav button").forEach((b) => {
    nav[b.dataset.action!] = b;
  });
  els = {
    stage: app.querySelector("[data-stage]")!,
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
  nav.play.addEventListener("click", () => {
    if (!scene?.busy()) openPlay(ctx);
  });
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
  els.sick.style.display = pet.sick ? "flex" : "none";
  els.attn.style.display = pet.wantsAttention && !dying ? "block" : "none";

  // Nav alert cues (never reveals hidden state — just surfaces visible needs).
  toggleAlert(els.nav.food, pet.hunger <= 1);
  toggleAlert(els.nav.play, pet.happiness <= 1);
  toggleAlert(els.nav.clean, pet.poops > 0);
  toggleAlert(els.nav.care, pet.sick);
  els.nav.light.querySelector("img")!.src = iconUrl(pet.lightsOn ? "bulb" : "moon");

  scene.update({
    key: creatureKey(pet.stage, pet.form),
    mood: dying ? "sleep" : moodOf(pet),
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
/** Show a line in a bubble anchored just above the sprite's head. */
function say(line: string | null): void {
  if (!line || !els || !scene) return;
  const anchor = scene.creatureAnchor();
  const stageW = els.stage.clientWidth;
  // Keep the bubble on screen while still pointing at the creature.
  const x = Math.max(stageW * 0.22, Math.min(stageW * 0.78, anchor.x));
  els.bubble.style.left = `${x}px`;
  els.bubble.style.top = `${anchor.y}px`;
  els.bubble.textContent = line;
  els.bubble.classList.add("visible");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => els?.bubble.classList.remove("visible"), BUBBLE_MS);
}

/**
 * Speak a category line — maybe. Routine chatter rolls against the pet's
 * talkativeness (varies by age and creature); important feedback always lands.
 */
function sayCat(cat: Category): void {
  if (!pet) return;
  if (!shouldSpeak(pet, cat)) return;
  say(pickLine(pet, cat));
}

// --- Actions ----------------------------------------------------------------
function onTapPet(): void {
  if (!pet || dying || pet.deadAt !== null) return;
  if (scene?.busy()) return;
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
  if (!pet || dying) return;
  const { state, note } = feed(pet, food, Date.now());
  pet = state;
  if (note === "cant") {
    say(pet.stage === "egg" ? "*the egg does not eat*" : "Zzz…");
  } else if (note === "full") {
    sayCat("full");
    scene?.triggerPulse("shake");
  } else {
    if (pet && shouldSpeak(pet, feedCategory(food, note))) {
      say(pickLine(pet, feedCategory(food, note)));
    }
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
  if (!pet || dying) return;
  if (scene?.busy()) return;
  const { state, note } = clean(pet, Date.now());
  pet = state;
  if (note === "cleaned") {
    // Sweep first, then the pet reacts to the newly-legal floor.
    scene?.playClean(() => sayCat("clean"));
  }
  commit();
}

function doMedicine(): void {
  if (!pet || dying) return;
  const { state, note } = giveMedicine(pet, Date.now());
  pet = state;
  if (note === "cured") {
    sayCat("medicine");
    scene?.triggerPulse("happy");
  } else if (note === "dose") {
    // Plague: one shot down, one to go.
    sayCat("dose");
  } else if (note === "notneeded") {
    say("I'm not sick. But thank you, I guess.");
  }
  commit();
}

function doDiscipline(): void {
  if (!pet || dying) return;
  const { state, note } = discipline(pet, Date.now());
  pet = state;
  if (note === "correct") sayCat("discipline_correct");
  else if (note === "incorrect") {
    sayCat("discipline_incorrect");
    scene?.triggerPulse("shake");
  } else say("*too little to scold*");
  commit();
}

const DAY_DARK_LINES = ["It is not even dark.", "Mood lighting. Bold.", "Ambience, I suppose."];

function doLight(): void {
  if (!pet || dying) return;
  const now = Date.now();
  pet = toggleLight(pet, now);
  if (pet.asleep) sayCat("sleep");
  else if (!pet.lightsOn && !isNight(now)) say(pick(DAY_DARK_LINES));
  else sayCat("wake");
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
  if (!pet || dying) return false;
  const prevStage = pet.stage;
  const prevHunger = pet.hunger;
  const wasDead = pet.deadAt !== null;
  const elapsed = now - pet.lastUpdated;
  pet = applyElapsedDecay(pet, now);
  let events: string[] = [];
  if (withEvents) {
    const r = stepEvents(pet, elapsed);
    pet = r.state;
    events = r.events;
  }

  // Death — handled before anything else can chatter over it.
  if (!wasDead && pet.deadAt !== null) {
    beginDeath();
    return false;
  }

  const changed = pet.stage !== prevStage;
  if (changed) {
    handleStageChange(prevStage, pet.stage);
  } else if (events.includes("sick")) {
    // The Oregon Trail moment. Always announced, never diluted.
    if (pet.illness) say(illnessAnnouncement(pet.name, pet.illness));
    else sayCat("sick");
    notify("dire", "Cozy Sprites", pet.illness ? illnessAnnouncement(pet.name, pet.illness) : `${pet.name} is sick.`);
  } else if (events.includes("poop")) {
    sayCat("poop");
    notify("care", "Cozy Sprites", `${pet.name} made a mess.`);
  } else if (events.includes("call") || events.includes("fakecall")) {
    // Fake calls must sound exactly like real ones — that's the whole game.
    sayCat("call");
    notify("care", "Cozy Sprites", `${pet.name} wants your attention.`);
  }

  if (prevHunger > 1 && pet.hunger <= 1) {
    notify("care", "Cozy Sprites", `${pet.name} is getting hungry.`);
  }
  if (pet.health <= 15 && pet.health > 0 && !pet.sick && Math.random() < 0.2) {
    notify("dire", "Cozy Sprites", `${pet.name} is not doing well.`);
  }
  return changed;
}

/** Play the death act, then move to the memorial. */
function beginDeath(): void {
  if (!pet) return;
  dying = true;
  savePet(pet);
  render(); // sad/sleep face, no attention mark
  notify("dire", "Cozy Sprites", memorialLine(pet.name, pet.causeOfDeath));
  clearTimeout(bubbleTimer);
  els?.bubble.classList.remove("visible");
  if (scene) {
    scene.playDeath(() => mountMemorial());
  } else {
    mountMemorial();
  }
}

function tick(): void {
  if (!pet || dying) return;
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
  if (!pet || pet.asleep || dying) return;
  if (now < nextIdleAt) return;
  if (scene?.busy()) return;
  if (pet.stage === "teen" && Math.random() < 0.35) {
    // "The Audition" (SPEC §4): the leaning adult personality leaks through
    // occasionally, at normal idle cadence, never labeled.
    const leaning = determineAdultForm(pet.hidden, pet.health);
    say(teenFlickerLine(leaning));
  } else if (shouldSpeak(pet, "idle")) {
    say(pickLine(pet, "idle"));
  }
  nextIdleAt = now + rand(IDLE_MIN_MS, IDLE_MAX_MS);
}

// --- Context for menus ------------------------------------------------------
const ctx = {
  pet: () => pet!,
  farm: () => farm,
  scene: () => scene!,
  stageEl: () => els!.stage,
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

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") commit();
  else if (pet && !dying) {
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
