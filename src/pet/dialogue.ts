// Dialogue banks + selection. Voice shifts by life stage and adult form.
// Tone per SPEC §8: cute, dry, occasionally macabre, sometimes sincere.
// House rule: profanity caps out at "hell", used sparingly.

import { ILLNESSES } from "./types";
import type { AdultForm, IllnessId, PetState, Stage } from "./types";

export type Category =
  | "hatch"
  | "idle"
  | "tap"
  | "annoyed"
  | "feed"
  | "feed_favorite"
  | "feed_disliked"
  | "full"
  | "poop"
  | "cake"
  | "carrot"
  | "cube"
  | "medicine"
  | "dose" // first plague shot: cured of nothing yet
  | "clean"
  | "sick"
  | "win"
  | "lose"
  | "call"
  | "discipline_correct"
  | "discipline_incorrect"
  | "sleep"
  | "wake"
  | "farm";

type Bank = Partial<Record<Category, string[]>>;

// --- Stage banks (egg / baby / child / teen have their own voice) ------------
const EGG: Bank = {
  hatch: ["Hello?", "It is crowded.", "Soon.", "I have reconsidered.", "Do not rush me."],
  idle: [
    "...",
    "*rocks slightly*",
    "It is crowded.",
    "Almost.",
    "I am busy forming.",
    "*a muffled thump*",
    "Five more minutes.",
    "I can hear everything, you know.",
  ],
  tap: ["*wobbles*", "Not yet.", "Patience.", "Occupied.", "*knocks back*"],
};

const BABY: Bank = {
  hatch: ["I just arrived.", "AA.", "Round.", "You are enormous.", "Which one is me?"],
  idle: [
    "AA.",
    "Why.",
    "Round.",
    "More.",
    "Too much world.",
    "I just arrived.",
    "The floor and I are friends.",
    "Big. Everything big.",
    "I saw a dust. Incredible.",
    "Nap? Nap.",
  ],
  tap: ["Hi.", "Hi!", "?", "You.", "Again!", "*happy wiggle*"],
  feed: ["More.", "Yum.", "Again!", "Food good.", "In it goes."],
  full: ["No.", "Full.", "Too round already."],
  poop: ["Oops.", "Sorry.", "It happened.", "I panicked."],
  clean: ["Yay.", "Clean!", "Nice."],
  sick: ["Feel bad.", "Ow.", "No good.", "Inside hurts."],
  sleep: ["Night night.", "Zzz.", "Dark now."],
  wake: ["Up!", "Morning!", "Again, day!"],
};

const CHILD: Bank = {
  idle: [
    "I found nothing.",
    "The floor is suspicious.",
    "I am incredibly busy.",
    "Unclear.",
    "What's that?",
    "I have a plan. It's secret.",
    "Do bugs know they're bugs?",
    "I counted to a hundred. Twice.",
    "I'm going to be something great.",
    "Watch this. Wait. Watch.",
    "I made up a song about soup.",
  ],
  tap: ["Hi again.", "You!", "Interesting.", "Bold.", "Tag. You're it.", "I knew you'd be back."],
  feed: ["Is there dessert?", "Acceptable trade.", "I earned this."],
  clean: ["I was saving that.", "Fine. Cleanliness.", "You missed a spot. Kidding."],
  sick: ["I don't feel like me.", "Everything is wobbly.", "Am I dying? Be honest."],
  win: ["I'm basically a legend.", "Did you see that?!", "Champion. Me."],
  lose: ["Best of a thousand.", "I let you win.", "The game is broken."],
};

const TEEN: Bank = {
  idle: [
    "I don't know what I am.",
    "This body is a rental.",
    "Everything itches.",
    "Do not look at me while I figure this out.",
    "I refuse to peak now.",
    "I'm going through something.",
    "Nobody understands. Especially me.",
    "I've changed. Or I'm about to. Unclear.",
    "Don't wait up.",
    "It's a phase. Probably. Hopefully.",
  ],
  tap: ["Don't perceive me.", "Whatever.", "Ugh.", "I'm busy becoming.", "Personal space.", "...hi. Tell no one."],
  call: ["Nothing. Forget it.", "I didn't call you.", "...maybe.", "Forget I said anything."],
  feed: ["I guess.", "Fine.", "I was going to eat anyway."],
  sick: ["Great. Perfect. Sick too.", "This tracks.", "Leave the medicine and go."],
  sleep: ["Finally.", "Don't read into it, but... thanks.", "Lights out. Good."],
};

// --- General fallback bank (used when a form/stage lacks a category) ---------
const GENERAL: Bank = {
  idle: [
    "Took you long enough.",
    "You again.",
    "Interesting choice.",
    "The void has excellent posture.",
    "Soup is a temporary government.",
    "My uncle is a website.",
    "I have committed tax fraud.",
    "The walls are thin.",
    "You always come back eventually.",
    "This is a good rectangle.",
    "The moon owes me money.",
    "I cannot locate my elbows.",
    "Do not perceive me.",
    "Today has too many hours.",
    "I have opinions about birds.",
    "A leaf fell. I allowed it.",
    "Somewhere, a door closed. Rude.",
    "I remembered something embarrassing from years ago. I am years old.",
    "The wind said my name. I said nothing back. Power move.",
    "I organized my thoughts. Both of them.",
    "What the hell is a mortgage.",
    "I've been standing here on purpose.",
    "If anyone asks, I was magnificent today.",
    "The sun is free. Suspicious.",
    "I would simply win a fight with a goose.",
    "Grass. Unbelievable stuff.",
  ],
  tap: [
    "Hey.",
    "You may stay.",
    "I like your giant face.",
    "We are associates now.",
    "I waited near the glass.",
    "Yes?",
    "That's my whole body, you know.",
    "Noted. Continue.",
    "One free pat. Redeemed.",
  ],
  annoyed: [
    "Enough.",
    "I am not a button.",
    "Control yourself.",
    "Reported.",
    "The walls are thin.",
    "I will bite. Lovingly. But still.",
    "Boundaries. Look it up.",
  ],
  feed: [
    "Finally.",
    "Acceptable.",
    "More.",
    "I suppose.",
    "This will do.",
    "Sustenance acquired.",
    "I was wasting away. Dramatically.",
    "My compliments to whoever.",
  ],
  feed_favorite: [
    "Finally, respect.",
    "This is the best food.",
    "You remembered.",
    "At last.",
    "Today is historically significant.",
    "You get me. You truly get me.",
  ],
  feed_disliked: [
    "Cruel.",
    "This is a stick.",
    "Absolutely not.",
    "I will remember this.",
    "Is this a punishment?",
    "Our relationship has changed.",
  ],
  cake: ["Finally, respect.", "Health is temporary.", "Again.", "Cake understands me.", "Don't tell the carrot."],
  carrot: [
    "Cruel.",
    "This is a stick.",
    "I suppose.",
    "I forgive the carrot.",
    "Crunchy penance.",
    "Fine. Vitamins. Whatever.",
  ],
  cube: [
    "The cube understands.",
    "What flavor was that?",
    "It hummed.",
    "This is not food.",
    "More geometry.",
    "It tasted like a low sound.",
    "I saw something in there.",
  ],
  full: [
    "I am full.",
    "No. I am at capacity.",
    "Do I look like storage?",
    "Later.",
    "Physically impossible. Emotionally? Also no.",
  ],
  medicine: [
    "Betrayal.",
    "I taste shapes.",
    "That fixed something.",
    "Ugh. Effective.",
    "Science, probably.",
    "I feel less doomed. Slightly.",
  ],
  dose: [
    "One down. I still feel historic.",
    "It's working. Slowly. Keep going.",
    "The plague and I are negotiating.",
    "More. The doom persists.",
  ],
  poop: ["Do not look.", "A gift.", "Handle this.", "We don't need to discuss it.", "Nature is disgusting. I contribute."],
  clean: [
    "Thank you. Unfortunately.",
    "Much better.",
    "The floor is legal again.",
    "A fresh start.",
    "We shall never speak of it.",
    "Civilization returns.",
  ],
  sick: [
    "I have prepared my will.",
    "A terrible development.",
    "I have a condition.",
    "This is how I perish.",
    "Avenge me. Or at least feed me.",
    "Tell my story. Embellish it.",
  ],
  win: ["Obviously.", "Easy.", "As predicted.", "Skill. Pure skill.", "Write this down."],
  lose: [
    "The numbers cheated.",
    "That was your fault.",
    "Statistics are fake.",
    "Again.",
    "I demand a recount.",
    "The wind interfered.",
  ],
  call: ["Hey.", "Come here.", "I require you.", "Psst.", "You. Now. Please.", "Attention. Urgently. Casually."],
  discipline_correct: ["Fair.", "Understood.", "Rude, but fair.", "...I did do that.", "Justice. Annoying."],
  discipline_incorrect: [
    "Rude.",
    "You have no authority here.",
    "I regret nothing.",
    "I will do it again.",
    "Wrongfully accused. Historic.",
    "I was framed. By circumstances.",
  ],
  sleep: ["Goodnight.", "Five more minutes.", "The moon is thinking.", "Off I go.", "Wake me if anything is beautiful."],
  wake: ["Ugh, morning.", "I was somewhere else.", "Who authorized daylight.", "The dream had better snacks."],
  farm: [
    "I always suspected agriculture.",
    "Will there be Wi-Fi?",
    "I have no transferable skills.",
    "I will become ungovernable.",
  ],
};

// --- Per-adult voices (SPEC §12/§13). Only distinctive categories overridden.
const ADULT: Record<AdultForm, Bank> = {
  dog: {
    idle: [
      "You came back!",
      "Throw it.",
      "Again.",
      "I found a smell.",
      "Best day so far.",
      "I love the door. It makes you.",
      "I guarded everything while you were gone.",
      "A bird!! Okay it's gone. A bird though!!",
      "I would die for you. Casually. No pressure.",
    ],
    win: ["Best day so far!", "We did it!", "Again again again!", "We're a team!!"],
    lose: ["We'll get it next time!!", "I had fun anyway!", "The winning was inside us all along."],
    farm: ["A farm?! With smells??", "I will guard the acreage.", "Will you visit?"],
    feed_favorite: ["BURGER. BURGER.", "Best food. Best you.", "Yes yes yes."],
    tap: ["Yes!! Hello!!", "More of this.", "I have been so good."],
  },
  blob: {
    idle: [
      "I grow weak.",
      "Remember me beautifully.",
      "My condition is mysterious.",
      "I have suffered enough.",
      "The light... it flatters me.",
      "If I fade, water the plant.",
      "I felt a draft. This may be the end.",
      "My memoirs are nearly complete. Chapter one: hunger.",
    ],
    lose: ["The numbers betrayed me.", "This is how I perish.", "Remember me.", "Defeat. My oldest friend."],
    sick: ["It is finally happening.", "Cake may save me.", "Tell the others.", "I always knew it would end rurally... wait, wrong speech."],
    carrot: ["A carrot? Now?", "Cruel and unusual.", "You wish to see me suffer."],
    farm: ["I will perish rurally.", "The fields will mourn me.", "So this is goodbye."],
  },
  gremlin: {
    idle: [
      "Wasn't me.",
      "I know a secret.",
      "Cube, peasant.",
      "No witnesses.",
      "Hehehe.",
      "I hid something. Somewhere. Forever.",
      "The rules are more like suggestions.",
      "I licked something important. Guess.",
    ],
    win: ["I cheated. So?", "No witnesses.", "Skill issue, yours.", "The evidence is gone."],
    cube: ["MORE GEOMETRY.", "The cube is mine now.", "Give cube. Give."],
    poop: ["I moved it. For fun.", "You'll never find them all.", "Whoops. On purpose."],
    farm: ["I will unionize the chickens.", "Finally, room to commit crimes.", "The barn won't know what hit it."],
  },
  scholar: {
    idle: [
      "I am conducting research.",
      "The answer is seven.",
      "I have made a chart.",
      "My findings are upsetting.",
      "The cube is theoretically food.",
      "Preliminary results: the floor is floor.",
      "I've disproven the ceiling. Twice.",
      "Citation needed. From you. Now.",
    ],
    win: ["A breakthrough!", "As my model predicted.", "Peer review confirms: I win."],
    cake: ["Cake disrupts the mind.", "Empirically unwise.", "I'll allow it. Once."],
    carrot: ["Nutritionally optimal.", "Excellent. Rigorous.", "The correct choice."],
    farm: ["Fieldwork. Literal fieldwork.", "I shall study the soil.", "Grant me tenure, barn."],
  },
  office: {
    idle: [
      "Another day.",
      "Per my last beep.",
      "Let's circle back.",
      "I was not trained for this.",
      "I need a break.",
      "My calendar says no.",
      "This meadow could have been an email.",
      "I'm at capacity. Emotionally. Physically. Legally.",
    ],
    win: ["Noted. Moving on.", "Great, a win. Anyway.", "Let's not make this weird."],
    lose: ["Figures.", "Circling back to my loss.", "As expected of a Monday."],
    farm: ["Early retirement. Finally.", "Please forward my calls to the barn.", "I accept the severance."],
  },
  menace: {
    idle: [
      "How rustic.",
      "I suppose this will do.",
      "Do tidy up.",
      "You look tired.",
      "You may remain.",
      "The garden is adequate. Barely.",
      "I have judged everyone today. Quietly.",
      "Fetch my... actually, fetch everything.",
    ],
    win: ["Naturally.", "Was there ever a doubt?", "How droll that you tried."],
    feed_disliked: ["A burger? For me? How insulting.", "Take it away.", "I said no."],
    farm: ["I shall summer in the countryside.", "The peasants will adore me.", "Do send my things."],
  },
  ghost: {
    idle: [
      "...",
      "The dark was kind to me.",
      "I remember the lantern.",
      "You cared for me when you couldn't see me.",
      "I am here. Mostly.",
      "The night knows my name. So do you.",
      "*a cold, friendly draft*",
    ],
    tap: ["*your hand passes through, warmly*", "Felt that. Somehow.", "..."],
    win: ["I saw the outcome before it happened.", "The odds fear me.", "..."],
    sick: ["Can I even be sick? Apparently.", "This is embarrassing for both of us."],
    sleep: ["The dark is home.", "At last.", "*fades slightly, contentedly*"],
    farm: ["I will haunt it gently.", "The barn and I will get along.", "Every farm needs one of me."],
  },
};

function bankForStage(stage: Stage): Bank {
  switch (stage) {
    case "egg":
      return EGG;
    case "baby":
      return BABY;
    case "child":
      return CHILD;
    case "teen":
      return TEEN;
    default:
      return GENERAL;
  }
}

export function pickLine(
  state: PetState,
  category: Category,
  rng: () => number = Math.random,
): string | null {
  // Adult voice takes priority, then stage voice, then the general bank.
  const sources: Bank[] = [];
  if (state.stage === "adult" && state.form) sources.push(ADULT[state.form]);
  sources.push(bankForStage(state.stage));
  sources.push(GENERAL);

  for (const bank of sources) {
    const lines = bank[category];
    if (lines && lines.length) return lines[Math.floor(rng() * lines.length)];
  }
  return null;
}

/** Occasionally the pet leaks a candidate-adult flavour line during Teen
 *  (SPEC §4 "The Audition"). Returns a moodier line if leaning that way. */
export function teenFlickerLine(
  leaning: AdultForm,
  rng: () => number = Math.random,
): string | null {
  const bank = ADULT[leaning].idle;
  if (!bank) return null;
  return bank[Math.floor(rng() * bank.length)];
}

// --- Chattiness --------------------------------------------------------------
// Not every interaction earns a line (design note: less noise, more charm).
// Important feedback always speaks; routine chatter rolls against a per-stage /
// per-form talkativeness.

const ALWAYS_SPEAK: ReadonlySet<Category> = new Set([
  "hatch",
  "sick",
  "medicine",
  "dose",
  "call",
  "win",
  "lose",
  "full",
  "annoyed",
  "feed_favorite",
  "feed_disliked",
  "discipline_correct",
  "discipline_incorrect",
  "farm",
]);

// Tuned down from the first pass — routine chatter was landing too often and
// crowding out the moments that matter. Important feedback still always speaks
// (see ALWAYS_SPEAK); these only govern incidental idle/tap/feed lines.
const STAGE_CHATTINESS: Record<Stage, number> = {
  egg: 0.28,
  baby: 0.36,
  child: 0.5, // still the chatty kid, relatively
  teen: 0.22, // won't talk to you
  adult: 0.38, // overridden per form below
};

const FORM_CHATTINESS: Record<AdultForm, number> = {
  dog: 0.62,
  blob: 0.5,
  gremlin: 0.45,
  scholar: 0.4,
  office: 0.28,
  menace: 0.4,
  ghost: 0.18,
};

export function speakChance(state: PetState, category: Category): number {
  if (ALWAYS_SPEAK.has(category)) return 1;
  if (state.stage === "adult" && state.form) return FORM_CHATTINESS[state.form];
  return STAGE_CHATTINESS[state.stage];
}

export function shouldSpeak(
  state: PetState,
  category: Category,
  rng: () => number = Math.random,
): boolean {
  return rng() < speakChance(state, category);
}

// --- Illness announcements (the joy of OG Oregon Trail) ----------------------
const ILLNESS_TEMPLATES = [
  (n: string, ill: string) => `${n} has ${ill}.`,
  (n: string, ill: string) => `${n} has come down with ${ill}.`,
  (n: string, ill: string) => `Bad news. ${n} has ${ill}.`,
];

export function illnessAnnouncement(
  name: string,
  illness: IllnessId,
  rng: () => number = Math.random,
): string {
  const t = ILLNESS_TEMPLATES[Math.floor(rng() * ILLNESS_TEMPLATES.length)];
  return t(name, ILLNESSES[illness].label);
}

// --- Farm confirmation lines — darker the younger they are -------------------
// Sending an adult off is a retirement. Sending a baby is a decision you should
// feel. The button still works; the copy just looks you in the eye first.
const FARM_CONFIRM: Record<Stage, string[]> = {
  adult: [
    "“I always suspected agriculture.”",
    "“Will there be Wi-Fi?”",
    "“I suppose every story ends in a field.”",
  ],
  teen: [
    "“Is this because of what I was becoming?”",
    "“I never even got to find out what I am.”",
    "“Fine. Whatever. ...will you think about me?”",
  ],
  child: [
    "“But I just learned to like it here.”",
    "“Will you wave until I can't see you anymore?”",
    "“I'll be brave. Is that what you want me to be?”",
  ],
  baby: [
    "“I don't understand. Where are you going?”",
    "“I just arrived. I just arrived.”",
    "“Okay. I trust you. I don't know any better.”",
  ],
  egg: [
    "The egg cannot pack. It has no things.",
    "The egg trusts you completely. It has never known anything else.",
    "It hasn't even seen you yet.",
  ],
};

export function farmConfirmLine(
  stage: Stage,
  rng: () => number = Math.random,
): string {
  const lines = FARM_CONFIRM[stage];
  return lines[Math.floor(rng() * lines.length)];
}

// --- Memorial copy ------------------------------------------------------------
export function memorialLine(name: string, cause: string | null): string {
  return cause ? `${name} has died of ${cause}.` : `${name} has died.`;
}

const EPITAPHS = [
  "It was a good rectangle.",
  "The walls are quieter now.",
  "It never did find its elbows.",
  "The moon still owes it money.",
  "Beloved. Round. Occasionally legal.",
  "It suspected agriculture until the very end.",
];

export function epitaph(rng: () => number = Math.random): string {
  return EPITAPHS[Math.floor(rng() * EPITAPHS.length)];
}
