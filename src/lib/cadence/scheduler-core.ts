import { randomInt } from "@/lib/helpers";

export type ScheduleInput = {
  scheduleStart: string | null;
  scheduleEnd: string | null;
  scheduleDays: string[] | null;
};

const weekdayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function parseMinutes(time: string) {
  const [hh, mm] = time.split(":").map((value) => Number(value));
  return hh * 60 + mm;
}

export function isWithinScheduleWindow(
  schedule: ScheduleInput,
  now = new Date()
): boolean {
  const start = schedule.scheduleStart ?? "09:00";
  const end = schedule.scheduleEnd ?? "18:00";
  const days = schedule.scheduleDays?.length
    ? schedule.scheduleDays
    : ["mon", "tue", "wed", "thu", "fri", "sat"];

  const day = weekdayMap[now.getDay()];
  if (!days.includes(day)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseMinutes(start);
  const endMinutes = parseMinutes(end);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

export function calculateStaggeredDelay(
  index: number,
  minInterval: number,
  maxInterval: number
): number {
  if (index === 0) {
    return randomInt(0, 30) * 1_000;
  }

  const base = randomInt(minInterval, maxInterval) * index * 1_000;
  const longPause = (index + 1) % 15 === 0 ? randomInt(600, 1200) * 1_000 : 0;
  return base + longPause;
}

export function buildDispatchPlan(
  total: number,
  minInterval: number,
  maxInterval: number
): number[] {
  const delays: number[] = [];

  for (let index = 0; index < total; index += 1) {
    delays.push(calculateStaggeredDelay(index, minInterval, maxInterval));
  }

  return delays;
}
