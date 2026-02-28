export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatRelativeTime(input: Date | string | number | null | undefined): string {
  if (!input) return "-";

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "-";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const absSeconds = Math.abs(seconds);

  if (absSeconds < 60) return "agora";

  const units = [
    { label: "ano", seconds: 31_536_000 },
    { label: "mes", seconds: 2_592_000 },
    { label: "dia", seconds: 86_400 },
    { label: "h", seconds: 3_600 },
    { label: "min", seconds: 60 },
  ];

  for (const unit of units) {
    const value = Math.floor(absSeconds / unit.seconds);
    if (value >= 1) {
      if (unit.label === "h" || unit.label === "min") return `${value}${unit.label}`;
      const plural = value > 1 ? "s" : "";
      return `${value} ${unit.label}${plural}`;
    }
  }

  return "agora";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/\D/g, "");
  return normalized.length >= 8 ? normalized : null;
}

export function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;

  try {
    const withProtocol = input.startsWith("http") ? input : `https://${input}`;
    const host = new URL(withProtocol).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function toTitleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export function timeToMinutes(value: string): number {
  const [hh, mm] = value.split(":").map((token) => Number(token));
  return hh * 60 + mm;
}

export function nowInRange(start: string, end: string, now = new Date()): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes <= endMinutes) {
    return current >= startMinutes && current <= endMinutes;
  }

  return current >= startMinutes || current <= endMinutes;
}

const SOCIAL_HOSTS = new Set([
  "wa.me",
  "api.whatsapp.com",
  "chat.whatsapp.com",
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "fb.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "www.tiktok.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "linktr.ee",
  "bit.ly",
]);

export function isActualWebsite(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const withProtocol = url.startsWith("http") ? url : `https://${url}`;
    const host = new URL(withProtocol).hostname.toLowerCase();
    return !SOCIAL_HOSTS.has(host);
  } catch {
    return false;
  }
}
