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
  skyPhase,
  applyGameResult,
  stepEvents,
  tap,
  pat as patPet,
  toggleLight,
  tooSickToPlay,
  tooSickToEat,
  retirementPhase,
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
  isDying,
  dyingLine,
  rareIdleLine,
  RARE_IDLE_CHANCE,
  attentionCallLine,
  attentionSatisfiedLine,
  attentionSpoiledLine,
  attentionWrongLine,
  retirementLine,
  departedNote,
  describeCondition,
} from "./pet/dialogue";
import type { Category } from "./pet/dialogue";
import { determineAdultForm } from "./pet/evolution";
import { applyDevAction } from "./pet/devtools";
import type { DevAction } from "./pet/devtools";
import { spriteWon } from "./pet/games";
import type { MatchResult } from "./pet/games";
import {
  exportSave,
  importSave,
  loadDiscoveredForms,
  loadFarm,
  loadPet,
  retireToFarm,
  saveDiscoveredForms,
  savePet,
  getDeviceId,
  wipeFarm,
} from "./pet/persistence";
import { Scene } from "./render/scene";
import { creatureKey } from "./render/sprites";
import type { Mood } from "./render/sprites";
import { iconEl, iconHTML, iconUrl } from "./render/icons";
import { notify } from "./ui/notifications";
import { playSfx, playSong, reviveAudio, unlockAudio } from "./ui/audio";
import {
  initMenus,
  openCare,
  openCollection,
  openFood,
  openPlay,
  openStatus,
  closeActiveGame,
  handleStageTap,
} from "./ui/menus";
import { randomName } from "./pet/names";

const TICK_MS = 3_000;
const BUBBLE_MS = 4_000;
// Real-clock cadence: chatty enough that a check-in visit usually catches a
// line, quiet enough that a tab left open isn't a ticker.
const IDLE_MIN_MS = 5 * 60_000;
const IDLE_MAX_MS = 12 * 60_000;
// The rare "easter egg" flourish — roughly once an hour.
const FLOURISH_MIN_MS = 30 * 60_000;
const FLOURISH_MAX_MS = 60 * 60_000;
// The egg gets exactly one unprompted line during incubation (not a chatty
// countdown) — timed to land well before it hatches (TIMING.egg = 60s).
const EGG_BROOD_MIN_MS = 15_000;
const EGG_BROOD_MAX_MS = 35_000;
// ...and exactly one more if you keep poking it.
const EGG_TAP_POPUP_THRESHOLD = 5;

const app = document.querySelector<HTMLDivElement>("#app")!;
getDeviceId(); // ensure anonymous device identity exists

let pet: PetState | null = null;
let farm = loadFarm();
let scene: Scene | null = null;
let petCanvas: HTMLCanvasElement | null = null; // for gesture hit-testing against creatureBounds()
let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
let anchorRaf = 0; // rAF loop keeping bubble/attention pinned to the sprite
let nextIdleAt = 0;
let nextFlourishAt = 0;
let eggBroodAt = 0;
let eggBroodShown = false;
let eggTapCount = 0;
let eggTapShown = false;
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
  energy: HTMLDivElement;
  happy: HTMLDivElement;
  health: HTMLDivElement;
  nav: Record<string, HTMLButtonElement>;
} | null = null;

initMenus(app);
boot();

function boot(): void {
  // Audio can only start from inside a real gesture, so every tap nudges the
  // context awake. Cheap once it's already running — not just-once, because a
  // backgrounded PWA can suspend or tear down the context before the next tap.
  // Both ends of the tap: iOS only grants user activation (which starting
  // audio requires) at gesture end, so pointerdown alone can't revive a
  // context the OS killed while backgrounded — the pointerup is what takes.
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("pointerup", unlockAudio);
  pet = loadPet();
  if (!pet) {
    mountHatch();
  } else if (pet.deadAt !== null) {
    // Died while we were away — no animation replay, straight to the memorial.
    mountMemorial();
  } else if (pet.departedAt !== null) {
    // Walked itself to the farm at a dawn we slept through.
    beginDeparture(false);
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
  stopAnchorLoop();
  scene?.stop();
  scene = null;
  petCanvas = null;
  els = null;
  dying = false;
  const proposed = randomName();
  app.innerHTML = `
    <div class="hatch-screen">
      ${iconHTML("egg", 56)}
      <h1>A new egg</h1>
      <p class="muted">Something is about to hatch. What will you call it?</p>
      <div class="name-row">
        <input id="petname" maxlength="12" placeholder="Name your sprite" value="${proposed}" />
        <button class="btn secondary reroll" id="reroll" type="button" title="Suggest another name" aria-label="Suggest another name">${iconHTML("dice", 22)}</button>
      </div>
      <button class="btn" id="hatchbtn">Begin</button>
      <button class="btn secondary" id="collbtn" type="button">Collection &amp; Farm</button>
    </div>`;
  const input = app.querySelector<HTMLInputElement>("#petname")!;
  const begin = () => {
    const name = input.value.trim() || proposed;
    pet = createPet(name, Date.now());
    savePet(pet);
    mountGame();
  };
  app.querySelector("#hatchbtn")!.addEventListener("click", begin);
  const reroll = app.querySelector<HTMLButtonElement>("#reroll")!;
  const die = reroll.querySelector("img")!;
  reroll.addEventListener("click", () => {
    input.value = randomName();
    // Tumble the die: restart the CSS roll and flash through faces mid-air.
    const allFaces = ["dice1", "dice2", "dice3", "dice4", "dice", "dice6"] as const;
    const animFaces = ["dice2", "dice6", "dice"] as const;
    const finalFace = allFaces[Math.floor(Math.random() * allFaces.length)];
    reroll.classList.remove("rolling");
    void reroll.offsetWidth; // reflow so the animation retriggers
    reroll.classList.add("rolling");
    animFaces.forEach((face, i) => {
      setTimeout(() => {
        die.src = iconUrl(i === animFaces.length - 1 ? finalFace : face);
      }, 130 * (i + 1));
    });
  });
  app.querySelector("#collbtn")!.addEventListener("click", () => openCollection(ctx));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") begin();
  });
}

// --- Memorial screen ---------------------------------------------------------
function mountMemorial(): void {
  if (!pet) return;
  stopTick();
  stopAnchorLoop();
  scene?.stop();
  scene = null;
  petCanvas = null;
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
        <div class="meter-row">${iconHTML("burger", 16)}<div class="hearts" data-energy></div></div>
        <div class="meter-row">${iconHTML("smiley", 16)}<div class="hearts" data-happy></div></div>
        <div class="meter-row">${iconHTML("speechdots", 16)}<div class="condition" data-health></div></div>
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
      <button data-action="care">${iconHTML("bandage", 26)}Care</button>
      <button data-action="clean">${iconHTML("broom", 26)}Clean</button>
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
    energy: app.querySelector("[data-energy]")!,
    happy: app.querySelector("[data-happy]")!,
    health: app.querySelector("[data-health]")!,
    nav,
  };

  const canvas = app.querySelector<HTMLCanvasElement>("#scene")!;
  scene = new Scene(canvas);
  petCanvas = canvas;
  // The dog thing doesn't hum a little tune like everyone else — it barks.
  scene.onIdleSong(() => (pet?.form === "dog" ? playSfx("bark") : playSong()));
  scene.start();
  bindPetGestures(canvas);

  nav.status.addEventListener("click", () => openStatus(ctx, Date.now()));
  nav.food.addEventListener("click", () => {
    if (pet?.stage === "egg") {
      // No food in the egg phase — it is busy forming.
      say("*the egg does not eat. the egg prepares.*");
      return;
    }
    if (pet?.asleep) {
      // Fast asleep — the bowl can wait until morning.
      say("Zzz…");
      return;
    }
    if (pet && tooSickToEat(pet)) {
      // Some illnesses kill the appetite outright — medicine first, food after.
      // (The milder ones — sniffles, the vapors, goblin flu — still eat fine.)
      say(SICK_EAT_LINES[Math.floor(Math.random() * SICK_EAT_LINES.length)]);
      return;
    }
    // Don't open over a running act (a fetch chase, an rps reveal…), but a
    // live in-scene game picker (higher/lower, fetch, etc.) yields — hitting
    // Food should stop it and open the kitchen, not silently no-op.
    if (scene?.busy()) return;
    closeActiveGame();
    openFood(ctx);
  });
  nav.play.addEventListener("click", () => {
    if (pet?.stage === "egg") {
      // No games in the egg phase — it is busy forming.
      say("*the egg does not play. the egg prepares.*");
      return;
    }
    if (pet?.asleep) {
      // Fast asleep — no fetch, no cube, no anything until it wakes.
      say("Zzz…");
      return;
    }
    if (pet && tooSickToPlay(pet)) {
      // Some illnesses are too much for games — medicine first, glory after.
      // (The milder ones — sniffles, a bad tummy — don't stop playtime.)
      say(SICK_PLAY_LINES[Math.floor(Math.random() * SICK_PLAY_LINES.length)]);
      return;
    }
    // Don't open over a running act, but a live game picker yields — hitting
    // Play again should swap to a fresh pick, not get stuck behind the old one.
    if (scene?.busy()) return;
    closeActiveGame();
    openPlay(ctx);
  });
  nav.clean.addEventListener("click", doClean);
  nav.care.addEventListener("click", () => {
    if (pet?.stage === "egg") {
      // No medicine or scolding in the egg phase — it is busy forming.
      say("*the egg needs no care. the egg prepares.*");
      return;
    }
    if (pet?.asleep) {
      // Fast asleep — medicine and discipline wait until morning, same as food and play.
      say("Zzz…");
      return;
    }
    openCare(ctx);
  });
  nav.light.addEventListener("click", doLight);

  nextIdleAt = Date.now() + rand(IDLE_MIN_MS, IDLE_MAX_MS);
  nextFlourishAt = Date.now() + rand(FLOURISH_MIN_MS, FLOURISH_MAX_MS);
  if (pet?.stage === "egg") {
    eggBroodAt = Date.now() + rand(EGG_BROOD_MIN_MS, EGG_BROOD_MAX_MS);
    eggBroodShown = false;
    eggTapCount = 0;
    eggTapShown = false;
  }
  render();
  startTick();
  startAnchorLoop();
}

// --- Rendering --------------------------------------------------------------
function render(): void {
  if (!pet || !els || !scene) return;
  const now = Date.now();
  renderHearts(els.energy, pet.energy);
  renderHearts(els.happy, pet.happiness);
  els.health.textContent = describeCondition(pet, now);
  els.name.textContent = pet.name;
  els.sub.textContent = pet.form ? ADULTS[pet.form].name : stageLabel(pet.stage);
  els.sick.style.display = pet.sick ? "flex" : "none";
  els.attn.style.display = pet.wantsAttention && !dying ? "block" : "none";

  // Teens leak a hint of the adult they're becoming; a fake call reads as a
  // visible tantrum (see scene). The leaning is computed deterministically so
  // the accent doesn't flicker between tied candidates frame to frame.
  const variant =
    pet.stage === "teen" ? determineAdultForm(pet.hidden, pet.health, () => 0, pet.name) : null;
  const tantrum = pet.wantsAttention && pet.fakeCall && !dying;
  const zoomies = pet.zoomies && !dying;

  // Nav alert cues (never reveals hidden state — just surfaces visible needs).
  toggleAlert(els.nav.food, pet.energy <= 1);
  toggleAlert(els.nav.play, pet.happiness <= 1);
  toggleAlert(els.nav.clean, pet.poops > 0);
  toggleAlert(els.nav.care, pet.sick);
  els.nav.light.querySelector("img")!.src = iconUrl(pet.lightsOn ? "bulb" : "bulboff");

  scene.update({
    key: creatureKey(pet.stage, pet.form),
    mood: dying ? "sleep" : moodOf(pet),
    poops: pet.poops,
    sky: skyPhase(now),
    asleep: pet.asleep,
    lightsOn: pet.lightsOn,
    variant,
    tantrum,
    zoomies,
    activity: activityOf(pet, now),
    // Same puddle art for dysentery and a bad-diet mess still on the floor.
    runny: (pet.sick && pet.illness === "dysentery") || pet.hasBadPoop,
  });
}

/** How energetic the creature is: babies bounce, elders blob (drives the
 *  scene's rest/yawn cadence and walk speed). */
function activityOf(p: PetState, now: number): number {
  switch (p.stage) {
    case "baby":
      return 1;
    case "child":
      return 0.95;
    case "teen":
      return 0.75;
    case "adult": {
      // Adults mellow with age: sprightly at first, sedate old-timers later.
      const ageInAdult = now - p.stageStartedAt;
      return Math.max(0.4, 0.7 - (ageInAdult / (20 * 60_000)) * 0.3);
    }
    default:
      return 1;
  }
}

function renderHearts(container: HTMLElement, value: number): void {
  container.innerHTML = "";
  // Snap to half-heart steps so the meter ticks down discretely, then draw each
  // slot as a hand-placed pixel heart (full / half / empty) matching the row
  // icons — no smooth glyph fill.
  const q = Math.round(value * 2) / 2;
  for (let i = 0; i < MAX_HEARTS; i++) {
    const filled = q - i;
    const name = filled >= 1 ? "heart" : filled >= 0.5 ? "hearthalf" : "heartempty";
    container.appendChild(iconEl(name, 16));
  }
}

function toggleAlert(btn: HTMLButtonElement, on: boolean): void {
  btn.classList.toggle("alert", on);
}

function moodOf(p: PetState): Mood {
  if (p.asleep) return "sleep";
  if (p.sick || p.energy <= 1 || p.happiness <= 1) return "sad";
  if (p.happiness >= 3.5 && p.health > 60) return "happy";
  return "neutral";
}

function stageLabel(stage: PetState["stage"]): string {
  return { egg: "Egg", baby: "Baby", child: "Child", teen: "Teen", adult: "Adult" }[stage];
}

// --- Speech -----------------------------------------------------------------
/** Pin the bubble and attention mark to the creature's current position. */
function positionAnchored(): void {
  if (!els || !scene) return;
  const anchor = scene.creatureAnchor();
  const stageW = els.stage.clientWidth;
  if (els.bubble.classList.contains("visible")) {
    // Clamp by the bubble's *measured* size so no edge ever leaves the stage,
    // however long the line or wherever the sprite has wandered.
    const pad = 6;
    const halfW = els.bubble.offsetWidth / 2;
    const x = Math.max(halfW + pad, Math.min(stageW - halfW - pad, anchor.x));
    // The CSS transform lifts the bubble by its own height + ~10px tail, so
    // the anchor must sit at least that far down for the top edge to stay in.
    const minY = els.bubble.offsetHeight + 10 + pad;
    els.bubble.style.left = `${x}px`;
    els.bubble.style.top = `${Math.max(minY, anchor.y)}px`;
  }
  if (els.attn.style.display !== "none") {
    els.attn.style.left = `${Math.min(stageW - 24, Math.max(4, anchor.x + 14))}px`;
    els.attn.style.top = `${Math.max(4, anchor.y - 28)}px`;
  }
}

/** rAF loop: the sprite wanders, so anything anchored to it must follow. */
function startAnchorLoop(): void {
  stopAnchorLoop();
  const loop = () => {
    positionAnchored();
    anchorRaf = requestAnimationFrame(loop);
  };
  anchorRaf = requestAnimationFrame(loop);
}
function stopAnchorLoop(): void {
  cancelAnimationFrame(anchorRaf);
}

/** Show a line in a bubble anchored just above the sprite's head. */
function say(line: string | null): void {
  if (!line || !els || !scene) return;
  els.bubble.textContent = line;
  els.bubble.classList.add("visible");
  positionAnchored();
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
// --- Pet gestures -----------------------------------------------------------
// A pat and a poke are different things, so they're different gestures. A quick
// jab is a poke; holding still or rubbing is a pat. You cannot pat something by
// stabbing it, and the input shouldn't pretend otherwise. Scratchies also need
// an actual back-and-forth — a single straight swipe is not rubbing — and both
// gestures only count when they land on the pet itself, not anywhere on stage.
const HOLD_MS = 260; // press this long without leaving and it's a pat
const RUB_PX = 10; // …or move this far while down (with a reversal) and it's a rub

let gestureMoved = 0;
let gestureX = 0;
let gestureY = 0;
let gestureDown = false;
let gestureSpent = false; // the pat already fired; don't also poke on release
let gestureAxis: "x" | "y" | null = null; // dominant movement axis, locked in on first real step
let gestureDirSign = 0; // sign of the last step along that axis
let gestureReversed = false; // seen the stroke double back at least once — a rub, not a swipe
let holdTimer: ReturnType<typeof setTimeout> | undefined;
/** Suppresses a repeat "that's enough" line for an unbroken run of pats. */
let saidEnough = false;

/** Is the last-tracked pointer position over the pet's sprite? Gates every
 *  gesture reaction to the pet itself instead of the whole stage. */
function pointerOnPet(): boolean {
  if (!scene || !petCanvas) return false;
  const rect = petCanvas.getBoundingClientRect();
  const b = scene.creatureBounds();
  const px = gestureX - rect.left;
  const py = gestureY - rect.top;
  return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
}

function bindPetGestures(canvas: HTMLCanvasElement): void {
  canvas.addEventListener("pointerdown", (e) => {
    gestureDown = true;
    gestureSpent = false;
    gestureMoved = 0;
    gestureAxis = null;
    gestureDirSign = 0;
    gestureReversed = false;
    gestureX = e.clientX;
    gestureY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    // Fire on the hold itself rather than on release — waiting for the finger
    // to lift would make a deliberate, gentle gesture feel unacknowledged.
    holdTimer = setTimeout(() => {
      if (gestureDown && !gestureSpent) {
        gestureSpent = true;
        doPat();
      }
    }, HOLD_MS);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!gestureDown) return;
    const stepX = e.clientX - gestureX;
    const stepY = e.clientY - gestureY;
    gestureMoved += Math.hypot(stepX, stepY);
    gestureX = e.clientX;
    gestureY = e.clientY;

    if (gestureAxis === null && (Math.abs(stepX) > 1 || Math.abs(stepY) > 1)) {
      gestureAxis = Math.abs(stepX) >= Math.abs(stepY) ? "x" : "y";
    }
    if (gestureAxis) {
      const step = gestureAxis === "x" ? stepX : stepY;
      if (Math.abs(step) > 0.5) {
        const sign = Math.sign(step);
        if (gestureDirSign !== 0 && sign !== gestureDirSign) gestureReversed = true;
        gestureDirSign = sign;
      }
    }

    if (!gestureSpent && gestureReversed && gestureMoved >= RUB_PX) {
      gestureSpent = true;
      doPat();
    }
  });

  const end = () => {
    clearTimeout(holdTimer);
    if (!gestureDown) return;
    gestureDown = false;
    // Short, still, and released: that's a poke.
    if (!gestureSpent) onTapPet();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}

function doPat(): void {
  if (!pet || dying || pet.deadAt !== null) return;
  if (scene?.busy()) return;
  // A live in-scene game owns the stage — reaching past its controls to touch
  // the pet dismisses it, same as tapping outside any other panel would.
  if (app.querySelector(".stage-controls")) {
    closeActiveGame();
    return;
  }
  // Scratchies only count when they land on the pet, not anywhere on stage.
  if (!pointerOnPet()) return;
  const { state, reaction } = patPet(pet, Date.now());
  pet = state;
  switch (reaction) {
    case "cant":
      if (pet.asleep) say("Zzz…");
      break;
    case "answered":
      // It asked to be patted, and was. The whole point of the gesture.
      say(attentionSatisfiedLine("pat"));
      scene?.triggerPulse("love");
      playSfx("love");
      saidEnough = false;
      break;
    case "spoiled":
      say(attentionSpoiledLine());
      scene?.triggerPulse("happy");
      playSfx("happy");
      saidEnough = false;
      break;
    case "enough":
      // Never punished, just no longer paying. Say so once, not every stroke.
      if (!saidEnough) {
        saidEnough = true;
        say(pickLine(pet, "pat_enough"));
      }
      scene?.triggerPulse("nudge");
      playSfx("pat");
      break;
    case "enjoyed":
      // Either it says something, or it just shuts its eyes and enjoys it —
      // shown instead of told, so the two never land on the same pat.
      if (shouldSpeak(pet, "pat")) say(pickLine(pet, "pat"));
      else scene?.patSquint();
      scene?.triggerPulse("love");
      playSfx("pat");
      saidEnough = false;
      break;
  }
  commit();
}

function onTapPet(): void {
  if (!pet || dying || pet.deadAt !== null) return;
  if (scene?.busy()) return;
  if (app.querySelector(".stage-controls")) {
    // A game may want first look at a stage tap — hide & seek's guess phase,
    // for one, lets you tap the hiding spot directly. Only fall back to
    // dismissing the game if nothing on stage claims the tap.
    if (petCanvas) {
      const rect = petCanvas.getBoundingClientRect();
      if (handleStageTap(gestureX - rect.left, gestureY - rect.top)) return;
    }
    closeActiveGame();
    return;
  }
  // A poke only counts when it lands on the pet, not anywhere on stage.
  if (!pointerOnPet()) return;
  const r = tap(pet, Date.now());
  pet = r.state;
  if (pet.stage === "egg") {
    // Body language only, mostly — it doesn't chatter back per poke. Just
    // one suspenseful line the first time you've clearly pestered it.
    eggTapCount++;
    scene?.triggerPulse(r.reaction === "annoyed" ? "shake" : "nudge");
    playSfx(r.reaction === "annoyed" ? "annoyed" : "tap");
    if (!eggTapShown && eggTapCount >= EGG_TAP_POPUP_THRESHOLD) {
      eggTapShown = true;
      say(pickLine(pet, "tap"));
    }
    commit();
    return;
  }
  switch (r.reaction) {
    case "answered":
      // The cute payoff: it asked for a pat and got one.
      say(attentionSatisfiedLine("pat"));
      scene?.triggerPulse("love");
      playSfx("love");
      break;
    case "spoiled":
      // You comforted a tantrum. It's ecstatic. The ledger weeps.
      say(attentionSpoiledLine());
      scene?.triggerPulse("happy");
      playSfx("happy");
      break;
    case "hint":
      // Including a pat-call: it wanted holding, you jabbed it.
      if (r.want) say(attentionWrongLine(r.want));
      scene?.triggerPulse("nudge");
      playSfx("tap");
      break;
    case "annoyed":
      sayCat("annoyed");
      scene?.triggerPulse("shake");
      playSfx("annoyed");
      break;
    case "react":
      // The first poke in a while always earns a line.
      say(pickLine(pet, "tap"));
      scene?.triggerPulse("nudge");
      playSfx("tap");
      break;
    case "ignore":
      // Pokes between "hello" and "enough" get body language only.
      scene?.triggerPulse("nudge");
      playSfx("tap");
      break;
    case "peek":
      // Asleep, first poke in a while: one eye cracks open, no line.
      scene?.crackEye();
      playSfx("tap");
      break;
    case "shush":
      // Asleep, poked again: still cracks the eye, but now it says something.
      scene?.crackEye();
      sayCat("shush");
      playSfx("tap");
      break;
  }
  commit();
}

function doFeed(food: FoodId): void {
  if (!pet || dying) return;
  const { state, note, call } = feed(pet, food, Date.now());
  pet = state;
  if (note === "cant") {
    say(pet.stage === "egg" ? "*the egg does not eat*" : "Zzz…");
  } else if (note === "toosick") {
    // Struck too sick to eat between opening the menu and tapping a food —
    // feed()'s backstop caught it. Same beat as the nav-gate refusal.
    say(SICK_EAT_LINES[Math.floor(Math.random() * SICK_EAT_LINES.length)]);
  } else if (note === "full") {
    sayCat("full");
    scene?.triggerPulse("shake");
    playSfx("refuse");
  } else if (note === "soupcure") {
    // Soup landed on a soup-curable illness. The cure outranks any snack call
    // it happened to satisfy — that's the moment worth reacting to.
    sayCat("soup_cure");
    scene?.triggerPulse("love");
    playSfx("medicine");
  } else if (call === "satisfied") {
    // It called for a snack and the snack arrived. Peak service.
    say(attentionSatisfiedLine("snack"));
    scene?.triggerPulse("love");
    playSfx("love");
  } else if (call === "spoiled") {
    say(attentionSpoiledLine());
    scene?.triggerPulse("happy");
    playSfx("happy");
  } else {
    if (pet && shouldSpeak(pet, feedCategory(food, note))) {
      say(pickLine(pet, feedCategory(food, note)));
    }
    scene?.triggerPulse("eat");
    playSfx(note === "disliked" ? "refuse" : "eat");
  }
  commit();
}

function feedCategory(food: FoodId, note?: string): Category {
  if (note === "favorite") return "feed_favorite";
  if (note === "disliked") return "feed_disliked";
  if (food === "cube") return "cube";
  if (food === "cake") return "cake";
  if (food === "carrot") return "carrot";
  if (food === "soup") return "soup";
  return "feed";
}

function doClean(): void {
  if (!pet || dying) return;
  if (scene?.busy()) return;
  const { state, note } = clean(pet, Date.now());
  pet = state;
  if (note === "cleaned") {
    // Sweep first, then the pet reacts to the newly-legal floor.
    playSfx("clean");
    scene?.playClean(() => sayCat("clean"));
  } else if (note === "nothing" && !pet.asleep && pet.stage !== "egg") {
    // Sweeping an already-clean meadow gets commentary.
    sayCat("clean_nothing");
  }
  commit();
}

function doMedicine(): void {
  if (!pet || dying) return;
  const { state, note } = giveMedicine(pet, Date.now());
  pet = state;
  if (note === "cant") {
    say(pet.stage === "egg" ? "*the egg needs no medicine*" : "Zzz…");
  } else if (note === "cured") {
    sayCat("medicine");
    scene?.triggerPulse("happy");
    playSfx("medicine");
  } else if (note === "dose") {
    // Plague: one shot down, one to go.
    sayCat("dose");
    playSfx("medicine");
  } else if (note === "toosoon") {
    // Plague pacing: the second dose needs the first to settle in.
    say("The last dose is still negotiating. Give it an hour.");
    playSfx("refuse");
  } else if (note === "notneeded") {
    say("I'm not sick. But thank you, I guess.");
    playSfx("refuse");
  }
  commit();
}

function doDiscipline(): void {
  if (!pet || dying) return;
  const { state, note } = discipline(pet, Date.now());
  pet = state;
  if (note === "correct") {
    sayCat("discipline_correct");
    playSfx("refuse");
  } else if (note === "incorrect") {
    sayCat("discipline_incorrect");
    scene?.triggerPulse("shake");
    playSfx("annoyed");
  } else if (pet.stage === "egg") {
    say("*the egg cannot be scolded*");
  } else if (pet.asleep) {
    say("Zzz…");
  } else say("*too little to scold*");
  commit();
}

const DAY_DARK_LINES = [
  "It is not even dark.",
  "Mood lighting. Bold.",
  "Ambience, I suppose.",
  "This is a choice.",
  "It's not bedtime.",
  "No naps for me.",
];

const SICK_PLAY_LINES = [
  "No games. I am unwell.",
  "Too wobbly to play.",
  "Medicine first. Glory later.",
  "*declines, feverishly*",
];

const SICK_EAT_LINES = [
  "No food. I am unwell.",
  "The thought alone is too much.",
  "Medicine first. Food later.",
  "*turns away from the bowl*",
];

function doLight(): void {
  if (!pet || dying) return;
  const now = Date.now();
  pet = toggleLight(pet, now);
  if (pet.asleep) closeActiveGame();
  // The egg stays quiet — see its dedicated brood/tap dialogue beats.
  if (pet.stage !== "egg") {
    if (pet.asleep) sayCat("sleep");
    else if (!pet.lightsOn && !isNight(now)) say(pick(DAY_DARK_LINES));
    else sayCat("wake");
  }
  commit();
}

function doFinishGame(game: GameId, won: MatchResult, line?: string | null, reach = 0): void {
  if (!pet || dying) return;
  // Would You Rather is never win/lose — only a slight bump.
  const r = applyGameResult(pet, game, game === "wouldyou" ? false : won, Date.now(), reach);
  pet = r.state;
  if (r.note === "cant") {
    // Night fell mid-game and it nodded off — no reward, no verdict.
    commit();
    return;
  }
  if (r.call === "satisfied") {
    // It called for a game and a game was played. Delight, then the verdict.
    say(line ?? attentionSatisfiedLine("play"));
    scene?.triggerPulse("love");
    playSfx("love");
  } else if (r.call === "spoiled") {
    say(attentionSpoiledLine());
    scene?.triggerPulse("happy");
    playSfx("happy");
  } else if (won === "tie") {
    // Nobody's win, nobody's loss — no gloat, no jingle to pick a side.
    say(line ?? "A tie. Neither of us has the upper hand.");
    playSfx("tie");
  } else {
    // Its reaction and its bounce follow *its* result (in RPS it gloats when it
    // beats you); the jingle stays on yours — it scores the "You win" banner.
    const itWon = spriteWon(game, won);
    if (line === null) {
      // Deliberately silent this time (see FetchResult.line) — no caption,
      // the animation carries it alone.
    } else if (line) {
      say(line);
    } else {
      sayCat(itWon ? "win" : "lose");
    }
    if (itWon || game === "wouldyou") scene?.triggerPulse("happy");
    // Would You Rather has no verdict to sound out — it's all opinion.
    if (game !== "wouldyou") playSfx(won ? "win" : "lose");
  }
  commit();
}

/** A Dev Tools lever. The state change is devtools.ts's job; this replays the
 *  same stage feedback the organic event would have earned, so a forced mess
 *  still squats and a forced evolution still gets its flash. */
function doDevAction(action: DevAction): void {
  if (!pet || dying) return;
  const prev = pet;
  pet = applyDevAction(pet, action, Date.now());
  switch (action.type) {
    case "poop":
      if (pet.poops > prev.poops) scene?.playPoop();
      break;
    case "illness":
      if (!prev.sick && pet.sick && pet.illness) {
        say(illnessAnnouncement(pet.name, pet.illness));
      }
      break;
    case "call":
      if (!prev.wantsAttention && pet.wantsAttention) say(attentionCallLine(pet.attentionWant));
      break;
    case "grow":
      if (pet.stage !== prev.stage) handleStageChange(prev.stage, pet.stage);
      break;
    case "become":
      // A costume change gets the flash but not the milestone chatter — the
      // same body-swap moment as evolving, without pretending a life happened.
      if (pet.stage !== prev.stage || pet.form !== prev.form) {
        scene?.triggerEvolve();
        playSfx("evolve");
      }
      break;
    case "retire-ready":
      if (retirementPhase(prev) !== "ready" && retirementPhase(pet) === "ready") {
        say(retirementLine("ready"));
      }
      break;
    // timeline and zoomies show themselves — render() reads them off state.
  }
  commit();
}

function doSendToFarm(): void {
  if (!pet) return;
  // A ready retiree gets walked over properly — farewell screen, the works.
  if (retirementPhase(pet) === "ready") {
    beginDeparture(true);
    return;
  }
  farm = retireToFarm(pet, Date.now());
  pet = null;
  mountHatch();
}

function commit(): void {
  // Death can be set by any action (feed/clean/tap/games all apply elapsed
  // decay), not just the tick — catch it here so the death act always plays.
  if (pet && pet.deadAt !== null && !dying) {
    beginDeath();
    return;
  }
  if (pet) {
    // pet.form is a single scalar, not a log — Dev Tools' "become" (and later
    // organic re-evolution) overwrite it in place. Without recording it here
    // the instant it's set, whatever form it used to hold just vanishes from
    // the Collection the next time the same pet's body changes again.
    if (pet.form && !loadDiscoveredForms().includes(pet.form)) {
      saveDiscoveredForms([...loadDiscoveredForms(), pet.form]);
    }
    savePet(pet);
  }
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
  const prevEnergy = pet.energy;
  const prevAsleep = pet.asleep;
  const prevIllness = pet.illness;
  const wasDead = pet.deadAt !== null;
  const wasNight = isNight(pet.lastUpdated);
  const prevPhase = retirementPhase(pet);
  const elapsed = now - pet.lastUpdated;
  // Snapshot the lantern BEFORE decay: applyElapsedDecay relights it at dawn, so
  // by the time it returns, every overnight span looks like it was spent awake.
  // stepEvents has to judge the night by how it actually was. See its docblock.
  const lightsOnDuringSpan = pet.lightsOn;
  pet = applyElapsedDecay(pet, now);
  let events: string[] = [];
  if (withEvents) {
    const r = stepEvents(pet, elapsed, undefined, lightsOnDuringSpan);
    pet = r.state;
    events = r.events;
  }

  // Nightfall can put the pet to sleep on its own (lights left off) — any
  // in-progress stage game shouldn't keep running over a sleeping pet.
  if (!prevAsleep && pet.asleep) closeActiveGame();

  // Death — handled before anything else can chatter over it.
  if (!wasDead && pet.deadAt !== null) {
    beginDeath();
    return false;
  }

  // A ready retiree we kept waiting finally left with the sunrise.
  if (pet.departedAt !== null) {
    beginDeparture(false);
    return false;
  }

  const phase = retirementPhase(pet);
  const changed = pet.stage !== prevStage;
  if (changed) {
    handleStageChange(prevStage, pet.stage);
  } else if (phase !== prevPhase && phase === "ready") {
    // The long goodbye reaches its door. From here the Care menu offers the walk.
    say(retirementLine("ready"));
    notify("care", "The Meadow", `${pet.name} is ready for the farm.`);
  } else if (phase !== prevPhase && phase === "restless") {
    say(retirementLine("restless"));
  } else if (events.includes("sick")) {
    // The Oregon Trail moment. Always announced, never diluted.
    if (pet.illness) say(illnessAnnouncement(pet.name, pet.illness));
    else sayCat("sick");
    notify("dire", "The Meadow", pet.illness ? illnessAnnouncement(pet.name, pet.illness) : `${pet.name} is sick.`);
  } else if (events.includes("poop")) {
    // The squat plays where it stands; the mess lands there too (see scene).
    scene?.playPoop();
    sayCat(events.includes("poop-bad") ? "poop_bad" : "poop");
    notify("care", "The Meadow", `${pet.name} made a mess.`);
  } else if (events.includes("call") || events.includes("fakecall")) {
    // Every call names its want. Fake calls use the same lines — that's the con.
    say(attentionCallLine(pet.attentionWant));
    notify("care", "The Meadow", `${pet.name} wants your attention.`);
  } else if (prevAsleep && !pet.asleep && pet.lightsOn) {
    // The lantern relit itself with the dawn — nobody touched the switch.
    sayCat("wake");
  } else if (prevIllness === "vapors" && !pet.sick) {
    // Cured itself mid-nap — the lights are still off, so this doesn't route
    // through the dawn "wake" branch above.
    sayCat("nap_cure");
    notify("care", "The Meadow", `${pet.name}'s nap worked — the vapors are gone.`);
  } else if (!wasNight && isNight(now) && !pet.asleep && pet.stage !== "egg") {
    // Dusk with the lantern still lit: the bedtime nudge. Sleeping through the
    // night is worth health; missing it entirely is a care mistake at dawn.
    say("*yawns* The lantern is very on.");
    notify("care", "The Meadow", `${pet.name} is sleepy — lights out?`);
  }

  if (prevEnergy > 1 && pet.energy <= 1) {
    notify("care", "The Meadow", `${pet.name} is getting hungry.`);
  }
  if (pet.health <= 15 && pet.health > 0 && !pet.sick && Math.random() < 0.2) {
    notify("dire", "The Meadow", `${pet.name} is not doing well.`);
  }
  return changed;
}

/** Play the death act, then move to the memorial. */
function beginDeath(): void {
  if (!pet) return;
  dying = true;
  savePet(pet);
  render(); // sad/sleep face, no attention mark
  playSfx("death");
  notify("dire", "The Meadow", memorialLine(pet.name, pet.causeOfDeath));
  clearTimeout(bubbleTimer);
  els?.bubble.classList.remove("visible");
  // Any in-scene game controls die with their player.
  app.querySelectorAll(".stage-controls").forEach((el) => el.remove());
  if (scene) {
    scene.playDeath(() => mountMemorial());
  } else {
    mountMemorial();
  }
}

/**
 * The retirement send-off, shared by the escorted walk and the dawn
 * self-departure. Retires the pet into the farm archive immediately (so a
 * closed tab can't resurrect it), then shows the farewell screen.
 */
function beginDeparture(walked: boolean): void {
  if (!pet) return;
  const p = pet;
  farm = retireToFarm(p, Date.now());
  pet = null;
  stopTick();
  stopAnchorLoop();
  scene?.stop();
  scene = null;
  petCanvas = null;
  els = null;
  dying = false;
  const lived = (p.departedAt ?? Date.now()) - p.createdAt;
  const detail = walked
    ? "They waved until you couldn't see them anymore. Then, presumably, fields."
    : `They left a note: “${departedNote()}”`;
  app.innerHTML = `
    <div class="hatch-screen memorial">
      ${iconHTML("barn", 56)}
      <h1>${walked ? `You walked ${p.name} to the farm.` : `${p.name} set off for the farm at dawn.`}</h1>
      <p class="muted">${detail}</p>
      <p class="muted">A good long run: ${formatAge(lived)}.</p>
      <button class="btn" id="departbtn">${walked ? "Wave goodbye" : "Keep the note"}</button>
    </div>`;
  app.querySelector("#departbtn")!.addEventListener("click", () => mountHatch());
}

function tick(): void {
  if (!pet || dying) return;
  const now = Date.now();
  if (!stepPet(now, true)) maybeIdleLine(now);
  maybeFlourish(now);
  commit();
}

/** Fire the rare celebratory flourish when its timer comes due. */
function maybeFlourish(now: number): void {
  if (!pet || pet.asleep || dying || pet.stage === "egg") return;
  if (now < nextFlourishAt) return;
  if (scene?.busy()) return;
  scene?.triggerFlourish();
  nextFlourishAt = now + rand(FLOURISH_MIN_MS, FLOURISH_MAX_MS);
}

/** How long scene.triggerEvolve() runs. Lines wait for the flash to clear. */
const EVOLVE_MS = 1_400;

/**
 * Every stage boundary is a moment. Growing up used to be silent for two of
 * the four transitions (baby→child, child→teen) — the sprite just swapped
 * mid-idle and you'd miss it if you blinked. Now they all get the same
 * flash-and-settle; only the sound and the line change.
 */
function handleStageChange(from: PetState["stage"], to: PetState["stage"]): void {
  if (!pet) return;
  void from;
  scene?.triggerEvolve();
  playSfx(to === "baby" ? "hatch" : "evolve");
  if (to === "baby") {
    say(pickLine(pet, "hatch"));
  } else if (to === "adult") {
    // The adult's first-ever line (the evolution payoff), once it's landed.
    setTimeout(() => {
      if (pet && !dying) say(pickLine(pet, "idle"));
    }, EVOLVE_MS);
  }
}

function maybeIdleLine(now: number): void {
  if (!pet || pet.asleep || dying) return;
  if (pet.stage === "egg") {
    // No idle chatter while it's still an egg — just one suspenseful beat,
    // timed once per incubation (see EGG_BROOD_MIN/MAX_MS).
    if (!eggBroodShown && now >= eggBroodAt && !scene?.busy()) {
      eggBroodShown = true;
      say(pickLine(pet, "hatch"));
    }
    return;
  }
  if (now < nextIdleAt) return;
  if (scene?.busy()) return;
  if (isDying(pet)) {
    // The end is close: the chatter turns to the matter at hand, names the
    // circumstance, and comes more often than idle small talk.
    say(dyingLine(pet));
    nextIdleAt = now + rand(IDLE_MIN_MS / 3, IDLE_MAX_MS / 3);
    return;
  }
  const phase = retirementPhase(pet);
  if (phase !== "none" && Math.random() < 0.4) {
    // The long goodbye colors the small talk: fields, fences, horizons.
    say(retirementLine(phase));
    nextIdleAt = now + rand(IDLE_MIN_MS, IDLE_MAX_MS);
    return;
  }
  if (pet.stage === "teen" && Math.random() < 0.35) {
    // "The Audition": the leaning adult personality leaks through
    // occasionally, at normal idle cadence, never labeled.
    const leaning = determineAdultForm(pet.hidden, pet.health, Math.random, pet.name);
    say(teenFlickerLine(leaning));
  } else if (Math.random() < RARE_IDLE_CHANCE) {
    // Once in a while, a line from somewhere else entirely.
    say(rareIdleLine());
  } else if (shouldSpeak(pet, "idle")) {
    say(pickLine(pet, "idle"));
  }
  nextIdleAt = now + rand(IDLE_MIN_MS, IDLE_MAX_MS);
}

// Discovered forms are normally just derived from the farm archive, but
// resetFarm() below wipes that archive — so union in the persisted snapshot
// too, or discoveries would vanish along with the retirees.
function computeDiscovered(): Set<AdultForm> {
  const set = new Set<AdultForm>(loadDiscoveredForms());
  for (const e of farm) if (e.form) set.add(e.form);
  if (pet?.form) set.add(pet.form);
  return set;
}

// --- Context for menus ------------------------------------------------------
const ctx = {
  pet: () => pet!,
  farm: () => farm,
  scene: () => scene!,
  stageEl: () => els!.stage,
  discovered: computeDiscovered,
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
  resetFarm: (): void => {
    wipeFarm(Array.from(computeDiscovered()));
    farm = [];
  },
  devAction: doDevAction,
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
  else {
    // Not a gesture — this can't start audio (iOS would hand back a dead
    // context), it just discards whatever iOS broke so the next tap rebuilds.
    reviveAudio();
    if (pet && !dying) {
      stepPet(Date.now(), true);
      commit();
    }
  }
});

// Register the offline service worker in production builds only.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
