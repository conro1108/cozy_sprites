# Pet Thing — Game Design Spec (Draft v0.1)

> **Purpose of this doc:** This is a consolidation of raw design notes into one
> readable spec. Nothing here is locked in — it exists so we can read it
> together, mark up what we like / dislike / want to change, and turn it into
> a build plan. See **"Open Questions & Decisions Needed"** at the end for the
> things that still need a call.

---

## 1. One-Line Pitch

A mobile-first pixel pet that fills nearly the whole screen — classic
Tamagotchi care mechanics underneath, a slightly cursed personality layer on
top. Simple to use, not simple to fully understand.

---

## 2. Platform & Form Factor

**Target:** mobile web app first, built so it can later become:
- A PWA installed from the browser
- A wrapped iOS/Android app
- A native app reusing the same design and game logic

**Feel like an app, not a website:**
- Full-height layout, no browser-style scrolling during play
- Large touch targets
- Persistent bottom navigation
- Portrait-first
- Safe-area support (notches, home indicator)
- Fast load, offline-capable after first visit

**Desktop:** center a phone-shaped game area, or enlarge the environment —
don't redesign the layout for it.

**No device shell.** No permanent plastic-Tamagotchi frame — that wastes
screen space we want for the creature. The scene (the pet's room) should
consume roughly **75–85% of the viewport**. Bottom controls can *evoke* the
original toy's iconography without imitating a physical device. Optional
"LCD toy" visual theme could exist later, but default should feel like a
tiny digital habitat, not a simulated plastic object.

**Visual approach:**
- Low-resolution internal pixel canvas, crisp nearest-neighbor scaling
- Limited palette
- Simple looping animations
- Generous visual breathing room
- Menus as pixel overlays, not separate pages
- Dialogue appears briefly above/beside the creature
- Sparse background details — the pet stays the visual focus

---

## 3. Navigation

Six primary bottom-nav buttons (not eight or ten):

| Button | Contents |
|---|---|
| **Status** | Name, Age, Weight, Hunger, Happiness, Health, Discipline |
| **Food** | Burger, Cake, Carrot, Noodles, Cube |
| **Play** | Higher/Lower, Fetch, Rock/Paper/Scissors, Hide and Seek, Would You Rather |
| **Clean** | Immediate poop cleanup / brief cleaning animation |
| **Care** | Medicine, Discipline, (possibly) Send to Farm |
| **Light** | Toggle lights during sleep |

Tapping the pet directly is the misc-interaction layer, so a dedicated
"interact" button isn't needed.

---

## 4. Life Stages & Growth

Follows Tamagotchi Gen 2 structure, with one major addition: **extended,
low-maintenance adulthood** instead of a hard endpoint.

### Egg — ~5 minutes
- Rocks periodically. Clicking may shake it but doesn't change hatch timing.
- Rare pre-hatch line: *"Hello?"* / *"It is crowded."* / *"Soon."* / *"I have
  reconsidered."*

### Baby — 30 minutes
Deliberately hectic — this is where the player learns the controls:
- Hunger drops quickly
- Frequent pooping
- Needs a short nap
- May get sick once
- Simple nonsense dialogue
- Cannot be disciplined
- Lines: *"AA."* *"Why."* *"Round."* *"I just arrived."* *"More."* *"Too much
  world."*

### Child — ~24–48 hours
Establishes the hidden stats that determine evolution: care quality,
discipline, cake consumption, game preference. One generic child character is
enough to feed into multiple adult forms for v1 — no need for multiple child
designs yet.

### Teen — ~24–48 hours (same length as Child)

> **📌 Proposal — not from the original notes.** The source notes left "Teen"
> as a bare heading with no content. Everything below was drafted in this doc
> to fill that gap and needs a thumbs up/down/edit pass, same as anything
> else here.

**Core idea — "The Audition":** through Child, care quietly accumulates into
hidden stats. Teen is where that accumulation starts to leak through — the
creature flickers between fragments of 2–3 "candidate" adult personalities
before settling, like it hasn't been cast yet. Calibrated to **medium
legibility**: noticeable enough that attentive players can start
theorizing ("I think I see where this is going"), not so legible that it
exposes the hidden formula the rest of the spec is built around. In
practice: only one candidate-personality flavor leaks through at a time (not
a rotating blend of all of them), it never leaks more than once per idle
cycle, and it's always phrased as mood/flavor rather than anything
diagnostic.

**Mechanics:**

1. **Personality flicker.** Idle/contextual dialogue occasionally pulls from
   whichever adult personality the hidden stats currently lean toward, at the
   same cooldown/cadence as normal idle dialogue (not additional chatter).
   Leaning Dramatic Blob → an occasional moodier line creeps in. Leaning
   Gremlin → an occasional mischievous one. Never labeled, never confirmed.

2. **Discipline actually starts to matter here.** Baby/Child couldn't
   meaningfully be disciplined — Teen is the first real test of it. Teen
   throws more fake attention calls and small tantrums as boundary-testing
   behavior, and discipline choices made during this window quietly carry
   more weight in the evolution formula than they did in Child. The tone
   justifies the higher stakes without exposing a number: Teen just *feels*
   moodier and more consequential.

3. **Growth-pang idle animation** — an occasional visual glitch/wobble
   (rapid unstable growth), paired with a Teen-exclusive dialogue bank about
   not knowing what it is yet:
   - "I don't know what I am."
   - "This body is a rental."
   - "Everything itches."
   - "Do not look at me while I figure this out."
   - "I refuse to peak now."

4. **Secret-path tracking starts in earnest.** Unusual patterns (heavy
   night-time care → Ghost, cube overconsumption → Cube Being) begin
   counting toward the special-condition check specifically during Teen —
   thematically the last and most volatile stretch before the fork, so it
   fits that the weird stuff matters most here.

5. **Evolution reveal as a small payoff beat.** End of Teen: a brief
   transformation animation, then the new adult's very first-ever line — a
   "hello, this is who I am now" moment that bookends the egg's rare
   pre-hatch lines ("Hello?" etc.).

### Adult — the primary reward
Each adult has:
- Distinct visual design
- One clear comedic personality
- Unique dialogue library
- One favorite food, one disliked food
- Slight preference for one game
- 1–2 unique idle animations

Adulthood has **three soft phases** — the reward for longevity is more
*personality content*, not escalating difficulty:

- **Young adult** (~days 3–10): standard need decay, full activity, most new
  adult dialogue begins appearing.
- **Mature adult** (~days 10–30): no major difficulty increase; more dialogue
  unlocks; new idle animations; creature gets slightly more familiar/opinionated.
- **Elder adult** (~day 30+, generous threshold): cosmetic aging, sleeps more,
  pool of older/stranger dialogue, maybe slightly more illness-prone. Can
  still live indefinitely with reasonable care.

Example age-gated lines: *"The statute of limitations has expired."* /
something dementia-flavored.

### Evolution Logic
Stays close to classic Tamagotchi. Primary hidden factors:
- Total care mistakes
- Discipline level
- Cake consumption
- Most-played game
- One special condition per secret character

---

## 5. Send to Farm (retirement / soft reset)

The voluntary reset mechanism. Available after adulthood (or possibly at any
life stage — **TBD**).

**What happens:**
- Current pet leaves
- Its record saves to a **farm archive**
- Player can hatch a new egg
- Only one pet can ever be active at a time
- Retired pets **cannot** be restored as active — irreversible, and that's
  the point: it gives the choice emotional weight without being cruel.

**Farm archive entry per pet:**
Name, final form, age, date hatched, date sent to farm, static portrait. The
farm itself is just a scrollable gallery — doesn't need to be playable.

**Confirmation flow (must be deliberate since it's irreversible):**
1. Select "Send to Farm"
2. Creature responds with a form-specific line
3. Confirm button
4. Departure animation plays
5. New egg option appears

Sample lines (adult): *"I always suspected agriculture."* / *"Will there be
Wi-Fi?"* / *"At last, acreage."* / *"I have no transferable skills."* / *"This
feels legally questionable."* / *"I will become ungovernable."*

Sample lines (baby/child): *"Farm?"* / *"I just got here."* / *"Do they have
Cube?"*

---

## 6. Saving & Persistence

**No IP-based linking.**

**Proposed v1 approach:**
- Local browser storage for the active pet
- Randomly generated anonymous device ID (never shown to the player)
- IndexedDB (or similar) for durable browser-side storage
- Optional exportable backup code / save file

Active pet + farm archive both live locally under that anonymous identity.

**Known limitation:** save is lost if the player clears browser data, uses
private browsing, switches phones, switches browsers, or deletes the
installed web app + its data. Since pets may live for months, **a backup/
export option should exist even in v1** — this shouldn't be deferred.

One idea floated: a friendly "passphrase"-style backup code (easier to store,
feels friendlier) — but this requires server-side mapping unless the entire
save state can be encoded directly into the phrase. **Open question, see
below.**

---

## 7. Hidden Mechanics Philosophy

Core rule: the player should understand **what the buttons do**, not
**precisely how the creature is calculated.** The game should feel
observable, not documented.

**Expose:** Hunger, Happiness, Health, Discipline, Age, Weight, current
sickness, whether the pet wants attention.

**Hide:** exact care-mistake count, evolution scores, food preference
modifiers, exact health formulas, secret adult requirements, dialogue
rarity, old-age thresholds, sickness probability, weight breakpoints,
whether a strange event "mattered."

Players should learn things empirically —
> "This one seems to love carrots." / "I think too much cake contributed to
> this adult." / "The weird night event might have caused the ghost." /
> "I played fetch constantly and got the dog creature."

They should never see something like `FetchScore ≥ 8 and CareMistakes ≤ 3`.

**Help screen philosophy:** explain operations, stay vague about outcomes.
- ✅ "Meals restore more hunger than snacks." / "Discipline influences how
  your pet develops." / "Certain foods and habits can lead to unusual growth."
- ❌ "Every cake adds two snack points. Ten snack points unlock the blob path."

**Collection clues:** once discovered, a creature's collection entry gives a
vague hint, e.g.:
- *Loyal Dog Thing* — "Often appears when an active, well-cared-for teen
  develops an enthusiasm for fetch."
- *Cube Being* — "Reports suggest an irresponsible relationship with
  geometry."
- *Ghost* — "Some creatures develop differently when the rest of the world
  is asleep."

---

## 8. Tone & Dialogue

**Tone:** cute, dry, occasionally profane, macabre, mildly hostile,
existential, absurd, sometimes unexpectedly sincere. Not children's-app safe
— that's an explicit non-goal.

On-brand joke topics: death, drugs (played surreal, not literal), taxes,
work, religion, bodies, crime, the player's questionable caretaking, being
trapped in a screen, the oppressive nature of time, eating non-food things.

Guardrail: avoid being *relentlessly* edgy — dark lines land best mixed with
ordinary stupidity.

**Flavor examples:**
- Dark: "The void has excellent posture." / "I have prepared my will." / "God
  does not live in this resolution."
- Off-color: "I have committed tax fraud."
- Mildly threatening: "Sleep with one eye open." / "I know where the food
  button is." / "The walls are thin." / "I have begun planning."
- Weirdly sincere: "You always come back eventually." / "I like being your
  problem." / "This is a good rectangle." / "I was scared, but you were here."
- Pure nonsense: "Soup is a temporary government." / "A horse would hate
  this." / "My uncle is a website."

**Per-character dialogue boundaries** (each adult has a distinct voice):
- Scholar — rarely swears, clinical
- Gremlin — swears casually
- Dramatic Blob — talks about death constantly
- Flower Creature — disturbing things said cheerfully
- Office Creature — corporate language describing atrocities
- Fancy Menace — insults without profanity
- Ghost — unnerving, rarely explicit

**Delivery:**
- Speech bubble, 3–5 seconds, tappable to dismiss early
- No reply field, no dialogue history
- Rare lines may linger slightly longer
- **Dialogue never blocks an urgent care action**

**Triggers:** app open, tap pet, feed, play, clean, medicine, discipline,
wake, sleep, low meter, return after absence, age milestone, random idle,
strange event, send to farm. Some lines are context-independent so the
creature occasionally says something inexplicable.

**Frequency / cadence:**
- At most one automatic/idle line every 10–20 minutes while app is open
- One possible contextual line per action (not guaranteed)
- Cooldowns to prevent constant chatter — sometimes it should just stare

**Dialogue categories per adult** (general cheeky, sassy, nonsensical,
affectionate-but-weird, dramatic, action-specific for cake/carrot/medicine/
poop) — see full line lists in Appendix A.

**Notifications** (once wrapped as an app) are part of the character voice:
> "Milo is hungry." / "Milo claims to be dying. Hunger is at one heart." /
> "There is shit everywhere." / "Milo has developed a condition." / "Milo is
> awake and already furious." / "Milo found something legally ambiguous." /
> "Milo has been staring at the wall for 40 minutes."

---

## 9. Core Stats

| Stat | Shown as | Increases via | Decreases via |
|---|---|---|---|
| **Hunger** | 4-segment meter (hearts) | Food (meals > snacks) | Time |
| **Happiness** | 4-segment meter (hearts) | Games, favorite foods, praise/attention, character-specific interactions | Time, illness, losing games, being awake too long, incorrect scolding |
| **Health** | General meter + skull/sick-face icon when medicine is needed | Good care over time | Prolonged hunger, too much cake/junk, uncleaned poop, untreated illness, poor care over time |
| **Discipline** | Visible on Status screen | Correct discipline actions | Incorrect discipline actions (also dings happiness/health slightly) |

Health/formula precision intentionally not surfaced to the player (see §7).

---

## 10. The Room & Interaction

Minimal but alive environment. Ambient/automatic pet behaviors:
- Look out the window
- Crawl under the bed
- Stare into the corner
- Tap the glass
- Drag an object around
- Sleep in the wrong place

**Tap gesture:**
- Creature reacts, dialogue may appear
- Repeated tapping causes annoyance — e.g. "Enough." / "I am not a button." /
  "Control yourself." / "Reported."

---

## 11. Actions

Primary action set (close to Gen 2): Feed, Light, Play, Medicine, Clean,
Status, Discipline, Attention indicator.

### Discipline
Single unified discipline action (no separate comfort/correction systems).
Appropriate when the creature: calls despite no genuine need, refuses food
while hungry, refuses to play while unhappy, won't sleep when tired, or
throws a tantrum.
- Correct discipline → increases hidden discipline score
- Incorrect discipline → dings happiness/health slightly
- Reactions vary by character: "Fair." / "Rude." / "I regret nothing." / "You
  have no authority here." / "Understood." / "I will do it again."

### Games

**Higher or Lower**
- Gen 2 mechanic essentially unchanged
- Number appears, player guesses next number higher/lower, 5 rounds
- Win restores happiness
- Win line: "Obviously." | Loss lines: "The numbers cheated." / "That was
  your fault." / "Statistics are fake." / "Again."

**Fetch**
- Arrow/power meter, click to throw, creature runs after it, distance/timing
  determines outcome
- Successful throws restore more happiness
- No inventory, leveling, or catching complexity
- Outcomes: retrieves ball, misses, runs past it, brings back wrong object,
  refuses to return it, lies down halfway, eats it then spits it out
- Rare fetch objects (sock, stick) are visual jokes, not collectibles — game
  picks one at random, then returns to normal

> **📌 Proposal — not from the original notes.** The three games below were
> drafted in this doc, not the source notes. Each keeps the same one-input,
> no-inventory, no-leveling shape as Higher or Lower and Fetch.

**Rock, Paper, Scissors**
- One tap (or best-of-three) — classic and instantly legible, no tutorial
  needed
- Win restores happiness
- Personality carries the whole game: Gremlin visibly cheats and picks after
  you do; Little Scholar treats it as a probability exercise ("You have a
  33% tell"); Fancy Little Menace acts unbothered even when losing

**Hide and Seek**
- Reuses the room's existing ambient hiding spots (under the bed, behind the
  curtain, the corner — see §10). Pet picks one, player taps to guess, one
  shot per round
- Win restores happiness; a wrong guess gets a taunt, not a penalty
- No new mechanic or art needed beyond spots the room already has

**Would You Rather**
- Not a win/lose game — two absurd/cursed options appear, player taps one,
  pet delivers a short judgment line, happiness ticks up slightly regardless
  of choice
- Cheapest to build (pure dialogue, no animation), and doubles as a
  personality-reveal mechanism like the collection clues in §7
- Example: "Eat the cube or pet a stranger?" → picks cube → "Predictable.
  Disappointing. Correct."

### Food (5 items — enough for character, not inventory management)

| Item | Hunger | Happiness | Notes |
|---|---|---|---|
| **Burger** | +2 hearts | small/neutral | The default meal; most creatures accept it. Doesn't need to be a literal hamburger — can be the iconic pixel-burger shape. |
| **Cake** | +1 heart | +1 heart | The treat; too much reduces health / raises sickness risk |
| **Carrot** | +1 heart | — | Improves/protects health slightly; some creatures love it, some strongly dislike it — good source of personality reactions |
| **Noodles** | +2 hearts | — | Second proper meal, takes slightly longer to eat, can be a favorite |
| **Cube** (aka Nutrient/Block) | usually +1 heart | may increase | The mildly unhinged option — may trigger an odd animation, rarely dings health, certain creatures adore it. Gives the app its own identity. |

Each adult has exactly one favorite (bonus happiness) and one disliked item.
Food preference doesn't need its own UI screen — it's discovered through play.

Sample cube dialogue: "The cube understands." / "What flavor was that?" / "It
hummed." / "More geometry." / "This is not food." / "This is the best food."

---

## 12. Adult Roster

Notes suggest **8 regular adults + 2 secrets** for a full roster, but **6
regular adults for initial release** is called out as the better v1 scope.

| # | Name | Personality | Favorite | Dislikes | Preferred Game |
|---|---|---|---|---|---|
| 1 | **Loyal Dog Thing** | Enthusiastic, affectionate, not especially intelligent | Burger | Cube | Fetch |
| 2 | **Dramatic Blob** | Needy, theatrical, easily inconvenienced | Cake | Carrot | Higher/Lower (blames the numbers) |
| 3 | **Sleepy Moon** | Dreamy, calm, vaguely prophetic | Noodles | Burger | Either, reluctantly |
| 4 | **Gremlin** | Chaotic, dishonest, delighted by mess | Cube | Nothing (eats anything) | Fetch |
| 5 | **Little Scholar** | Serious, curious, confidently incorrect | Carrot | Cake | Higher/Lower |
| 6 | **Tired Office Creature** | Burned out, dry, strangely relatable | Noodles | Cube | Neither, but participates |
| 7 | **Fancy Little Menace** | Snobbish, judgmental, secretly affectionate | Cake | Burger | Higher/Lower |
| 8 | **Empty-Headed Flower Creature** | Cheerful, nonsensical, unbothered | Carrot | Nothing | Fetch |

**If trimming to 6 for v1**, need to pick which two of the above get cut —
see Open Questions.

**Secrets (post-v1 or stretch):**
- **Ghost** — unlocked via unusual sleep/nighttime care pattern. Lines: "I am
  probably here." / "The screen is thin tonight." / "Do not worry about the
  corner." / "I remember the egg." / "Something followed you in."
- **Cube Being** — unlocked via excessive-but-survivable cube consumption.
  Lines: "MORE GEOMETRY." / other existential lines.

Each adult also gets 1–2 unique idle animations / behavioral quirks (see
Appendix A for the full per-character behavior + line lists from the source
notes).

---

## 13. Appendix A — Full Per-Character Dialogue & Behavior Notes

> **Not a copy deck.** None of the lines below are meant to ship as-is or
> represent a complete/final list. Treat this as thorough inspiration and
> voice reference for whenever we actually sit down to write each
> character's real dialogue library — a starting point and tone-setter, not
> a checklist to fill in.

<details>
<summary>Expand for verbatim per-character detail from the original notes</summary>

**1. Loyal Dog Thing**
Lines: "You came back!" / "Throw it." / "Again." / "I found a smell." / "Best
day so far."
Behavior: Wags entire body; sometimes brings back the wrong thing during
fetch.

**2. Dramatic Blob**
Lines: "I grow weak." / "Remember me beautifully." / "A carrot? Now?" / "I
have suffered enough." / "Cake may save me." / "My condition is mysterious."
Behavior: Collapses when hunger hits 1 heart; recovers instantly when fed;
occasionally pretends to be sick.

**3. Sleepy Moon**
Lines: "I was somewhere else." / "The moon is thinking." / "Five more
minutes." / "I dreamed you were smaller." / "Night is a kind of soup." / "Do
we have to?"
Behavior: Naps during idle time; slowly floats or rocks; sometimes
sleepwalks.

**4. Gremlin**
Lines: "Wasn't me." / "I know a secret." / "Cube, peasant" / "No witnesses."
Behavior: Makes false attention calls; may move poop to the opposite side of
the screen; sometimes returns a spoon instead of the ball.

**5. Little Scholar**
Lines: "I am conducting research." / "The answer is seven." / "Cake disrupts
the mind." / "I have made a chart." / "My findings are upsetting." / "The
cube is theoretically food."
Behavior: Reads a tiny book; inspects food before eating; celebrates game
wins as scientific breakthroughs.

**6. Tired Office Creature**
Lines: "Another day." / "Per my last beep." / "I need a break." / "Let's
circle back." / "I was not trained for this."
Behavior: Carries a tiny bag/clipboard; stares into space; falls asleep
sitting up.

**7. Fancy Little Menace**
Lines: "How rustic." / "I suppose this will do." / "Do tidy up." / "You look
tired." / "You may remain."
Behavior: Turns away from disliked food; examines itself; pretends not to
enjoy games.

**8. Empty-Headed Flower Creature**
Lines: "Wow!" / "I forgot." / "The sun is nearby." / "Are we a vegetable?" /
"I love rectangle." / "Good morning, nighttime!"
Behavior: Watches invisible things cross the screen; spins for no reason;
sometimes forgets to retrieve the ball.

**General personality-agnostic bank** (used across characters as filler):

*General cheeky:* "Took you long enough." / "I was doing fine." / "You
again." / "Interesting choice." / "Bold."

*Sassy:* "Absolutely not." / "That was embarrassing." / "Try harder." / "I
expected little." / "We need to talk."

*Nonsensical:* "The moon owes me money." / "I cannot locate my elbows." /
"There is soup in the walls." / "The rectangle remembers." / "I dreamed about
taxes."

*Affectionate but weird:* "You may stay." / "I saved you a crumb." / "I like
your giant face." / "You are my preferred entity." / "I waited near the
glass." / "We are associates now."

*Dramatic:* "This is how I perish." / "Remember me." / "My suffering is
historic." / "Tell the others." / "The end comes swiftly."

*After cake:* "Finally, respect." / "Health is temporary." / "Again."
*After carrot:* "Cruel." / "This is a stick." / "I suppose."
*After medicine:* "Betrayal." / "I taste shapes." / "That fixed something."
*After pooping:* "Do not look." / "A gift." / "Handle this."

*Generic personality-neutral lines (early brainstorm, unattributed):*
"I have seen enough." / "Feed me, coward." / "A terrible development." /
"Cake fixes the spirit." / "I found nothing." / "The floor is suspicious." /
"I am incredibly busy." / "Do not perceive me." / "Again." / "No." /
"Something is approaching." / "It was probably the wind." / "I miss the egg."
/ "My bones are digital." / "Today has too many hours." / "I demand
enrichment." / "You live outside?" / "Unclear." / "This changes everything."
/ "I forgive the carrot."

</details>

---

## 14. Open Questions & Decisions Needed

Use this section to mark up together — things the notes raise but don't
resolve:

1. **Roster size for v1:** ship 6 adults or all 8? If 6, which two get cut
   (or held back as post-launch additions)?
2. **Teen stage:** the original notes left this as a heading with no
   content. §4 now has a drafted proposal ("The Audition" — personality
   flicker, discipline unlocking, secret-path tracking) filling the gap —
   needs a thumbs up/down/edit, not just a scope call.
3. **Send to Farm timing:** restricted to post-adulthood only, or allowed at
   any life stage (with stage-appropriate confirmation lines)?
4. **Backup/save mechanism:** passphrase-style backup code (friendlier, but
   needs either server-side mapping or a fully self-encoding save blob) vs.
   a plain exportable save file/string the player copies and stores
   themselves. Pick one for v1, or offer both later?
5. **Notifications:** requires push notification infrastructure once wrapped
   as an app — in scope for initial web version, or deferred to the
   app-wrapper phase?
6. **Secret characters (Ghost, Cube Being):** in scope for v1 launch, or
   held back as a post-launch content drop?
7. **Tone calibration:** the profanity/dark-humor examples give a wide range
   — worth agreeing on a hard ceiling (e.g., "damn/hell fine, harder swears
   no" or similar) before writing the full line libraries.
8. **Sickness/medicine system:** notes mention "current sickness" as a
   visible stat and medicine as an action, but don't specify how illness is
   triggered, how many illness types exist, or what medicine actually does
   beyond curing it. Needs its own mini-spec.
9. **Weight mechanic:** listed as a visible stat but its gameplay effect
   (if any beyond flavor/visual) isn't specified in the notes.
10. **Cross-platform scope for v1:** the notes describe a path to PWA →
    wrapped app → native, but is the *initial* build (this repo) targeting
    web-only, or should PWA installability be a day-one requirement?

---

## 15. Raw Notes While Reading (untriaged)

Running capture of loose thoughts as we read through together — not yet
resolved into spec changes. Sort/action these later.

1. **Food needs a third dimension.** Hunger and happiness both being
   restored by the same 5 items feels flat — food could use another axis
   (e.g. nutrition/quality, energy, or a preference-strength dial) so meals
   aren't just "two bars go up different amounts."
2. **Like the idea of one or more fully hidden stats** — tracked and
   impactful, but never surfaced to the player at all (unlike Hunger/
   Happiness/Health/Discipline, which are visible-but-unexplained per §9).
   Something with real weight that's never even shown as a meter, so
   players can't reverse-engineer it just by watching a bar move.
3. **Pushback on the single-discipline-action stance in §11.** The notes
   explicitly reject splitting discipline into separate comfort/correction
   systems ("keep the classic single discipline action"), but there's real
   interest in a carrot/stick pair instead of scold-only — some kind of
   praise/reward action alongside correction. Bonus: each adult's reaction
   to *both* sides (not just to being scolded) could be a personality axis —
   e.g. one character preens under praise, another finds it suspicious.
   Needs a word better than "carrot/stick."
