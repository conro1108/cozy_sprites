# Cozy Sprites — State of the Union

A pocket pet. Hatch it, raise it, watch who it becomes. This is a plain-language
tour of how the game actually works today — not a design wishlist (see
`AREAS.md` for that), just what's live.

## The arc

**Egg → Baby → Child → Teen → Adult.** One straight line, no branching stage
tree — the *branching* all happens in which of ten adult personalities you
land on. Each stage has its own rhythm:

- **Egg** — inert. Nothing drains, nothing can go wrong. It just waits to hatch.
- **Baby** — hectic on purpose. Needs fall fast, it hatches already hungry, and
  it can't yet be disciplined — you're just learning the controls together.
- **Child / Teen** — the long middle. Needs drain at a calmer pace. Teens start
  testing boundaries: more attention calls, and a good chunk of them are fake.
- **Adult** — the destination. Growth stops; personality is locked in and the
  game becomes about maintaining, not raising. Adulthood isn't forever either
  — see Retirement, below.

A pet only ages while it's awake — sleep (see below) effectively pauses the
clock, so neglecting bedtime is the fast way through childhood, not the slow one.

## The four visible meters

| Meter | What moves it | What happens at empty |
|---|---|---|
| **Hunger** | Food fills it, time drains it | Health bleeds down |
| **Happiness** | Play, pats, favorite foods fill it; time drains it | Same — health bleeds down |
| **Health** | Rises on good sustained care, falls from hunger, sickness, mess, and bad discipline calls | Pet is in mortal danger (see Death) |
| **Discipline** | Rises when you correctly call out a fake demand, falls when you get it wrong | No direct penalty — it's a track record, and it quietly steers who the pet grows into |

Hunger and happiness are the day-to-day dial you're turning. Health is the
lagging scorecard for how well you've been turning it — it only really moves
when things have been good *or* bad for a while, not from a single meal.

## Mess and sickness

Poop shows up on its own regular schedule per life stage — it's not something
food triggers directly. What food's fiber content decides is *quality*: a
recent diet heavy in fiber means the next poop is a clean one that even helps
health a little; a low-fiber run means a bad one that costs more health and
raises the odds of falling sick. Leave any poop sitting on the floor and it
drags on health and raises sickness odds further. Sickness itself is random
but weighted: bad health, an unclean floor, and a heavy cake habit all load
the dice. Medicine cures it — most ailments in one dose, the plague takes two.
Giving medicine when nothing's wrong is a small ding against you (don't cry
wolf with the medicine cabinet).

## Day, night, and sleep

There's a day/night cycle. At night, turning the lights off lets the pet
sleep — sleeping pets can't be fed, played with, or patted, but they also stop
aging and their needs drain much more slowly. A full night of proper sleep
(fed, clean, well) is rewarded with a small health bonus at dawn. Leaving the
lights on at night means it stays up instead: needs still drain (just slower
than daytime) but health chips away directly for every hour it's kept awake,
and pulling a real all-nighter is logged as a care mistake by morning. Morning
relights the lantern on its own — nobody has to remember to do it.

Caring for the pet specifically at night, in the dark, is its own quiet thread
— more on that below.

## Attention calls, and the honesty game

Periodically the pet calls for something: a pat, a snack, or play. Some calls
are **genuine** — it actually needs that thing. From the teen stage onward,
some are **fake** — testing you. The whole discipline system is about telling
the two apart:

- Meet a **genuine** call → happiness reward, discipline untouched.
- Meet a **fake** call → the pet is delighted, but you've spoiled it: a mark
  against you.
- **Discipline** a fake call correctly → discipline goes up.
- **Discipline** a genuine call by mistake → discipline, happiness, and health
  all take a hit. Don't scold real hunger.

Separately, poking the pet (as opposed to answering a real call) is a light
running gag: the first poke gets a reaction, a poking streak gets progressively
ignored, and pushing a streak too far annoys it. A **pat** is the gentle,
always-welcome counterpart — it never backfires, it just eventually stops
paying out if you overdo it.

## Feeding, playing, and favorites

Six foods across three health tiers — healthy (carrot, salad), neutral
(soup, burger), and the treats (cake, the mysterious cube) — and six
mini-games (Higher/Lower, Fetch, Rock-Paper-Scissors, Hide & Seek, Would You
Rather, and the secret-feeling Cube's Hum). Every adult form has a favorite
food (a bonus when fed) and usually a disliked one (a small penalty) —
before adulthood, nobody has any opinions yet.

## Death

The one hard failure state, and it's slow and telegraphed: health has to sit
at rock bottom for a *sustained* stretch before the pet actually dies. A bad
week doesn't kill it; abandoning it does. Eggs can't die at all. Death ends in
a memorial and a fresh egg — the finished pet joins the Farm archive.

## Retirement

Adults don't die of old age — they retire. Every adult quietly accrues a
daytime "life" clock that ticks faster or slower depending on how it's doing
(thriving pets age toward retirement slowly; a neglected one gets there
sooner). It passes through two visible phases — **restless**, then
**ready** — before it's actually time to go. Once ready, you can walk it to
the farm yourself for a proper send-off; leave it waiting long enough and it
departs on its own with the sunrise instead, gracefully, no drama. Either way
it joins the Farm archive as a retiree rather than a memorial.

The Farm itself isn't just a list — retired sprites loaf around a little
paddock scene together, wandering and occasionally gathering, so past pets
stay a small ongoing sight rather than a static gravestone wall.

## A rare good mood: zoomies

Every so often — never while sick, mid-call, or already off zooming, and only
when happiness and health are both solidly good — the pet is seized by a
short, joyful burst of pure energy and zooms around the screen for a few
seconds. It's a moment to notice, not a state to manage: there's nothing to
do about it and no penalty either way, it just runs its course and stops.

## Becoming someone: the ten adult forms

You are never shown a formula. The personality that emerges is a quiet read of
*how* you raised it — what it ate, what it played, how honest you were with
discipline, whether you ever cared for it in the dark. Six forms are visible
from the start; three are earnable secrets nobody tells you about until you
land one; one is a double-secret that no upbringing can earn at all.

| Form | Emerges from |
|---|---|
| **Loyal Dog Thing** | A fetch enthusiast, consistently well cared for |
| **Dramatic Blob** | A cake habit, plus a bit of drama and mild neglect |
| **Gremlin** | Pure chaos: a real pile of care mistakes with no discipline reining it in |
| **Little Scholar** | High discipline, a Higher/Lower streak, and going easy on cake |
| **Tired Office Creature** | The default — nothing about the upbringing strongly committed to anything |
| **Fancy Little Menace** | High discipline, refined (cake-leaning) taste, very few mistakes |
| **Quiet Ghost** *(secret)* | Raised mostly at night — care consistently given with the lights off |
| **The Humming Cube** *(secret)* | A real cube diet paired with a devotion to the Cube's Hum game — calm, not chaotic |
| **The Blessed Carrot** *(secret)* | Total dietary purity: carrots, every single meal, no exceptions |
| **The Little Cosmos** *(double-secret)* | Nothing — pure luck, unconnected to how it was raised |

If the upbringing genuinely didn't lean anywhere — a real toss-up between two
paths — the game breaks the tie randomly rather than always picking the same
winner, so an ambiguous raising doesn't always resolve the same way twice.

Once the form is set, it colors everything downstream: favorite/disliked food,
preferred game, how much it enjoys being patted, and its entire dialogue voice.

## Pathways to adulthood, in more depth

Every candidate form is quietly scored the whole time you're raising the pet,
off the same handful of ingredients: what it ate, what it played, how good
your discipline calls were, and whether care happened in the dark. At the
teen→adult boundary, whichever form scored highest wins. Nothing is visible
to the player — the table above is the honest summary, this is the fuller
story of how the ten actually compete with each other.

- **Loyal Dog Thing** wants two things at once: fetch played more than
  anything else, and a genuinely well-cared-for run (good health, discipline
  calls mostly right). It's forgiving of ordinary wear and tear — a couple of
  slip-ups won't cost it the path — but real neglect will.

- **Dramatic Blob** is driven almost entirely by cake, with a secondary taste
  for Higher/Lower. Crucially it *wants* some mess in the record — a
  moderate band of care mistakes reads as "pampered and a little neglected,"
  its whole vibe. Too clean a record and it drifts toward Menace instead;
  too chaotic and it drifts toward Gremlin.

- **Gremlin** is pure, undiluted chaos: a real pile of care mistakes, with a
  bonus kick once low discipline is there too to make it structural rather
  than incidental. Diet plays no part — the cube is a neutral food here, not
  a bad one; eating plenty of it calmly and with good discipline doesn't read
  as Gremlin at all, it reads as the Humming Cube below. Cube just happens to
  be this form's favorite food once it's already a Gremlin, which is a
  cosmetic/dialogue detail, not one of the ingredients that gets it there.

- **Little Scholar** is discipline plus curiosity, expressed as vegetables:
  a strong discipline record, a Higher/Lower habit, and actively avoiding
  cake. It's the same "disciplined" foundation as Menace but pointed in the
  opposite dietary direction — Scholar earns points for *not* eating cake,
  Menace earns points *for* it.

- **Tired Office Creature** is the floor everyone else has to clear. It
  starts with a baseline no other form gets, and picks up a small extra
  nudge from a diet that's merely balanced — not devoted to anything, not
  avoiding anything either. A raising that never firmly committed to a
  personality lands here by default, which is the point: this is what
  "fine, nothing remarkable happened" looks like as a pet.

- **Fancy Little Menace** is discipline again, but paired with a real
  appetite for cake and an unusually clean mistake record — stricter about
  mistakes than Scholar is. Read together with Scholar and Blob, cake is
  doing three different jobs depending on its company: disciplined
  restraint reads Scholar, disciplined indulgence reads Menace, undisciplined
  indulgence reads Blob.

- **Quiet Ghost** *(secret)* is on a steep, single-ingredient curve: care
  given specifically at night, with the lights off, has to be the dominant
  pattern of the whole upbringing, not just an occasional late feeding. Cross
  that threshold and almost nothing else about the raising matters.

- **The Humming Cube** *(secret)* shares its favorite food with Gremlin —
  the cube — but arrives from the opposite temperament: a real cube diet
  plus genuinely favoring the Cube's Hum game above the other five, without
  the chaos (mistakes, low discipline) that defines Gremlin. Same food,
  opposite spirit, different animal entirely.

- **The Blessed Carrot** *(secret)* is the one absolute rule in the whole
  system: every single meal has to be a carrot, with no exceptions and
  enough meals eaten for the vow to mean something. One burger, even one,
  and this path is off the table for good — there's no partial credit, which
  is what makes it worth chasing.

- **The Little Cosmos** *(double-secret)* takes no part in the scoring above
  at all — nothing you do can aim for it. After the scoring settles on a
  winner, there's a flat, tiny chance (about 1 in 100) that the night sky
  quietly keeps the pet instead, regardless of how it was raised. The one
  exception is a pet that was headed for Gremlin — the sky doesn't want those.

When the scoring comes out close — two or more forms within a hair of each
other — the game treats that as a genuine toss-up and rolls between the
near-tied candidates rather than mechanically favoring one, so the rare
ambiguous raising doesn't always resolve to the identical adult. The Little
Cosmos's luck-based roll happens on top of that, after a candidate has
already been picked.
