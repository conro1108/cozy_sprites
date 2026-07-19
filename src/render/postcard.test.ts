import { describe, expect, it } from "vitest";
import { postcardDate, postcardSubtitle } from "./postcard";
import { createPet } from "../pet/state";
import { ADULTS } from "../pet/roster";
import type { PetState } from "../pet/types";

const T0 = new Date(2026, 6, 18, 12, 0, 0).getTime();

function pet(patch: Partial<PetState>): PetState {
  return { ...createPet("Milo", T0), ...patch };
}

describe("postcardSubtitle", () => {
  it("uses the stage until there's a form to be proud of", () => {
    expect(postcardSubtitle(pet({ stage: "baby" }))).toBe("Baby");
    expect(postcardSubtitle(pet({ stage: "teen" }))).toBe("Teen");
  });

  it("adults go by their form name", () => {
    expect(postcardSubtitle(pet({ stage: "adult", form: "scholar" }))).toBe(
      ADULTS.scholar.name,
    );
  });
});

describe("postcardDate", () => {
  it("renders a real date with the year on it", () => {
    expect(postcardDate(T0)).toContain("2026");
  });
});
