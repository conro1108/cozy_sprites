import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SFX, isMuted, setMuted, playTone, playCubeClear } from "./audio";
import type { SfxName } from "./audio";

const NAMES = Object.keys(SFX) as SfxName[];

describe("sfx table", () => {
  it("covers every declared sound", () => {
    // The union and the table are maintained by hand; if they drift, a call
    // site silently plays `undefined` and throws inside the audio graph.
    expect(NAMES.length).toBeGreaterThan(0);
    for (const name of NAMES) expect(SFX[name].length).toBeGreaterThan(0);
  });

  it("only schedules audible, positive-length tones", () => {
    for (const name of NAMES) {
      for (const tone of SFX[name]) {
        // exponentialRampToValueAtTime throws on a zero/negative target, and a
        // zero-length tone would invert its own envelope.
        expect(tone.freq).toBeGreaterThan(20);
        expect(tone.freq).toBeLessThan(20_000);
        expect(tone.dur).toBeGreaterThan(0);
        expect(tone.at).toBeGreaterThanOrEqual(0);
        if (tone.to !== undefined) {
          expect(tone.to).toBeGreaterThan(20);
          expect(tone.to).toBeLessThan(20_000);
        }
        if (tone.gain !== undefined) {
          expect(tone.gain).toBeGreaterThan(0);
          expect(tone.gain).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("keeps every effect short enough to fire repeatedly", () => {
    // These play on taps and feeds. Anything that outlasts the action becomes
    // a drone once the player does the action twice.
    for (const name of NAMES) {
      const end = Math.max(...SFX[name].map((t) => t.at + t.dur));
      expect(end, `${name} runs ${end}s`).toBeLessThanOrEqual(1);
    }
  });

  it("gives the envelope room to attack before it releases", () => {
    // scheduleTone ramps to peak over 8ms; a shorter tone would release before
    // it ever got there and click.
    for (const name of NAMES) {
      for (const tone of SFX[name]) expect(tone.dur).toBeGreaterThan(0.008);
    }
  });

  it("carries the sounds main.ts wires by exact name", () => {
    // main.ts calls playSfx("pat"); a rename here would silently break it.
    expect(SFX).toHaveProperty("pat");
  });
});

describe("pitched cube tones", () => {
  it("play without a WebAudio context and never throw", () => {
    // Headless node has no AudioContext — these must no-op, not explode, so a
    // silent test env still exercises the call sites.
    for (const step of [0, 1, 3, 7, 12]) expect(() => playTone(step)).not.toThrow();
    for (const streak of [0, 1, 4, 20]) expect(() => playCubeClear(streak)).not.toThrow();
  });
});

describe("mute preference", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    // The test env is plain node — no localStorage. Stub the two methods audio
    // actually uses.
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    };
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("defaults to unmuted", () => {
    expect(isMuted()).toBe(false);
  });

  it("round-trips the preference", () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it("stays unmuted when storage is unavailable", () => {
    // Private-browsing Safari throws from localStorage. Silence would be a
    // strange thing to infer from that.
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(isMuted()).toBe(false);
    expect(() => setMuted(true)).not.toThrow();
  });
});
