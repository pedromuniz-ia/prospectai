import { randomInt } from "@/lib/helpers";

const emojis = ["", "🙂", "👋", "😊"];
const oiVariants = ["Oi", "Oii", "Oi!"];
const tudoBemVariants = ["tudo bem?", "td bem?", "tudo bem"];

export function selectVariant(
  variants: string[],
  lastUsedIndex: number
): { message: string; index: number } {
  if (!variants.length) {
    return { message: "", index: -1 };
  }

  if (variants.length === 1) {
    return { message: variants[0], index: 0 };
  }

  const availableIndexes = variants
    .map((_, index) => index)
    .filter((index) => index !== lastUsedIndex);

  const selectedIndex =
    availableIndexes[randomInt(0, Math.max(availableIndexes.length - 1, 0))] ?? 0;

  return {
    message: variants[selectedIndex],
    index: selectedIndex,
  };
}

function toggleEndingPunctuation(message: string) {
  if (message.endsWith("!")) return message.slice(0, -1);
  if (message.endsWith("?")) return `${message.slice(0, -1)}!`;
  return `${message}!`;
}

function randomizeGreeting(message: string) {
  const selected = oiVariants[randomInt(0, oiVariants.length - 1)];
  return message.replace(/^oi!?/i, selected);
}

function randomizeTudoBem(message: string) {
  const selected = tudoBemVariants[randomInt(0, tudoBemVariants.length - 1)];
  return message.replace(/tudo bem\??/i, selected);
}

export function applyMicroVariations(message: string): string {
  let result = message.trim();
  const operations = [
    () => {
      result = randomizeGreeting(result);
    },
    () => {
      result = randomizeTudoBem(result);
    },
    () => {
      result = toggleEndingPunctuation(result);
    },
    () => {
      const emoji = emojis[randomInt(0, emojis.length - 1)];
      result = result.replace(/\s+[🙂👋😊]$/, "").trim();
      if (emoji) result = `${result} ${emoji}`;
    },
    () => {
      result = result.charAt(0).toLowerCase() + result.slice(1);
    },
    () => {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    },
  ];

  const maxChanges = randomInt(0, 2);
  for (let i = 0; i < maxChanges; i += 1) {
    operations[randomInt(0, operations.length - 1)]();
  }

  return result;
}
