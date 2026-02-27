import { describe, expect, it } from "vitest";
import {
  applyMicroVariations,
  selectVariant,
} from "@/lib/cadence/message-variants";

describe("selectVariant", () => {
  it("never returns same index consecutively when possible", () => {
    const variants = ["A", "B", "C"];
    const lastIndex = 1;

    for (let i = 0; i < 25; i += 1) {
      const selected = selectVariant(variants, lastIndex);
      expect(selected.index).not.toBe(lastIndex);
      expect(variants).toContain(selected.message);
    }
  });

  it("returns single variant when list has one item", () => {
    const selected = selectVariant(["Only"], 0);
    expect(selected).toEqual({ message: "Only", index: 0 });
  });
});

describe("applyMicroVariations", () => {
  it("keeps content but may apply humanization changes", () => {
    const original = "Oi, tudo bem? Tenho uma ideia para aumentar seus leads";

    const attempts = Array.from({ length: 20 }, () =>
      applyMicroVariations(original)
    );

    expect(attempts.some((result) => result !== original)).toBe(true);
    expect(attempts.every((result) => result.length > 5)).toBe(true);
  });
});
