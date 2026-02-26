import { describe, expect, it } from "vitest";
import {
  buildDispatchPlan,
  calculateStaggeredDelay,
  isWithinScheduleWindow,
} from "@/lib/cadence/scheduler-core";

describe("isWithinScheduleWindow", () => {
  it("returns true when inside configured hours and day", () => {
    const now = new Date("2026-02-23T10:30:00"); // Monday

    expect(
      isWithinScheduleWindow(
        {
          scheduleStart: "09:00",
          scheduleEnd: "18:00",
          scheduleDays: ["mon", "tue", "wed"],
        },
        now
      )
    ).toBe(true);
  });

  it("returns false outside schedule day", () => {
    const now = new Date("2026-02-22T10:30:00"); // Sunday

    expect(
      isWithinScheduleWindow(
        {
          scheduleStart: "09:00",
          scheduleEnd: "18:00",
          scheduleDays: ["mon", "tue", "wed"],
        },
        now
      )
    ).toBe(false);
  });
});

describe("calculateStaggeredDelay", () => {
  it("builds first message delay in short range", () => {
    const delay = calculateStaggeredDelay(0, 180, 300);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(30_000);
  });

  it("adds long pause around each 15th lead", () => {
    const delay = calculateStaggeredDelay(14, 180, 300);
    const minExpectedWithoutPause = 180 * 14 * 1000;
    expect(delay).toBeGreaterThanOrEqual(minExpectedWithoutPause + 600_000);
  });
});

describe("buildDispatchPlan", () => {
  it("returns a delay per lead", () => {
    const plan = buildDispatchPlan(20, 180, 300);
    expect(plan).toHaveLength(20);
    expect(plan[0]).toBeGreaterThanOrEqual(0);
    expect(plan[19]).toBeGreaterThan(plan[1]);
  });
});
