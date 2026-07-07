# Areas — design notes (loose, living)

A place to think out loud about giving the pet more than one place to be. Not a
spec. Expect this to change as we play with it.

## The point (and the trap)

The trap is areas becoming a **backdrop picker** — tap a button, the fence
becomes a bookshelf, nothing else changes, you never move again. We avoid that
by making areas mean something *to the pet*, through feeling and rhythm, not
bolt-on mechanics ("go here for +0.3 happiness" is how a toy becomes a chore).

## The model: three lenses, three axes

The nice thing is these layer instead of fighting — each hangs off something the
game already has.

- **Routine = the driver** (day/night clock). Where the pet is, and what it does
  there, is shaped by time of day. This is the moment-to-moment "why am I here."
- **Access = the growth spine** (life stages). Which areas exist at all expands
  as the pet grows up. Coming-of-age, not a level-up reward.
- **Character = the flavor** (adult form). Where the pet *belongs*, and the small
  details, are colored by who it became.

## The spine (unlocks as it grows)

Each stage's personality already matches an area's mood, so unlocking reads as
growing up.

| Stage | Opens | Why it fits |
|---|---|---|
| Baby  | **Nest** (also the permanent night/home) | a baby's world is small and safe |
| Child | **Clearing** (today's scene) | the world opens up to play |
| Teen  | **Beyond the fence** | teens push boundaries — literally |
| Adult | **A room that's uniquely theirs** (form-flavored) | who you became → where you belong |

The Nest is **permanent** — the pet always heads back to it at night, even as an
adult (still sleeps in the nest it hatched in). Daytime areas are what expand.

## Routine as the driver

Pet self-transitions on the day/night boundary: **night → Nest (automatic),
day → back out.** The world has a shape even for a passive player.

Activities differ per area — that's what keeps them from being interchangeable:

- **Clearing (day):** full care loop — all six games, feed, clean, discipline.
- **Nest (night):** quiet only — tuck-in, lullaby, nursing it when sick (care for
  it *in bed*). No games. (This is literally the asleep-can't-play guard we
  already shipped — areas just formalize it.)
- **Beyond the fence (day, teen+):** low-stakes discovery — foraging, finding the
  lost balls/socks (callback to the fetch gags), rare props. Not a grind.

## Character flavor (adult form) — the marquee

Form already comes from hidden care stats (night-care → Ghost, etc.). Let that
carry through spatially, and go **fully bespoke: each of the nine forms gets its
own room.** Ghost → dim attic, Scholar → reading nook, Blob → sunbeam, Gremlin →
shadowy under-stair, etc. — its own backdrop, props, lighting, idle lines,
maybe a resident critter. (It's all tokens and the whole thing is a tiny static
site, so nine bespoke rooms is fine — the constraint is taste, not bytes.)

You only ever see *your* form's room per pet, which turns it into the real
replay hook: earning a different form (via different care) reveals a different
home. Completing the set means living nine different lives.

**No separate "places" screen** — a room is 1:1 with a form, so it just becomes
part of that form's existing entry in the **Collection** (the nine-form grid we
already have). Discovering the form reveals its room as one more facet of who
they are, next to the portrait and blurb — maybe a room thumbnail on the tile,
or a fuller view when you tap it. This also means rooms inherit the form's own
discovery treatment for free: normal undiscovered forms already show a `?`
teaser, secret ones already leave no trace until earned.

## Rules we like

- **Evolution → area access, never area → evolution.** Areas don't feed back into
  hidden-stat scoring. Avoids the min-max spiral ("must visit the attic to get
  the Ghost"). The loop care → form → the room that form earns already exists
  narratively without a new stat axis.
- **Rooms, not instances.** One continuous pet; needs keep flowing everywhere, so
  exploring is never punished. The pull to move is emotional (wants to go home,
  wants to show you something), never a penalty timer.
- **Transitions are diegetic and pet-led.** Tap a threshold (gap in the fence,
  burrow mouth), the *pet* walks through it. Not an abstract nav button or swipe.
  A crossfade-with-walk-off is a fine first cut as long as the pet is what moves.

## Decided

- **Adult form-room: fully bespoke, all nine.** It's the marquee feature and the
  replay hook, not a deferred nicety. (It's all tokens on a tiny static site — no
  reason to skimp.)
- **Binary day/night only.** No dusk — a third time-state is effectively a
  whole-game new concept, out of scope.
- **Adult sleeps in its own form-room.** The pet *outgrows the Nest*: form-room
  becomes the night-home at adulthood (Ghost sleeps in its attic, Scholar in its
  study). The Nest is the baby/child/teen home you age out of — a growing-up arc.
- **No separate places screen.** Rooms fold into the existing form Collection
  entries (rooms are 1:1 with forms), and inherit the form's discovery treatment
  (normal → `?` teaser, secret → hidden).

## Still open

Nothing pressing. Next real questions are per-area *content* — what "beyond the
fence" actually holds, what the Nest's night interactions are (tuck-in, lullaby,
nursing), and what nine rooms we want — but those are for when we start building.

## Rough first slice, when we build

Two areas that justify themselves through systems we already have: **Clearing**
(day, existing) + **Nest** (night, where the pet takes itself to sleep). Proves
transition + per-area props + per-area activities + the home-at-dusk rhythm while
inventing almost nothing. "Beyond the fence" is the obvious, lore-loaded third.
