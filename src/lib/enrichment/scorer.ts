export type RuleOperator = "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in";

export type ScoringRuleInput = {
  field: string;
  operator: RuleOperator;
  value: unknown;
  points: number;
  label: string;
  active?: boolean;
};

export type ScoreLeadResult = {
  score: number;
  breakdown: Record<string, number>;
  explanation: string;
};

function toComparable(value: unknown): unknown {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized === "true") return true;
    if (normalized === "false") return false;

    const asNumber = Number(normalized);
    if (!Number.isNaN(asNumber)) return asNumber;
    return normalized.toLowerCase();
  }

  return value;
}

function evaluateRule(current: unknown, operator: RuleOperator, expected: unknown): boolean {
  const currentValue = toComparable(current);
  const expectedValue = toComparable(expected);

  switch (operator) {
    case "eq":
      return currentValue === expectedValue;
    case "neq":
      return currentValue !== expectedValue;
    case "gt":
      return Number(currentValue) > Number(expectedValue);
    case "lt":
      return Number(currentValue) < Number(expectedValue);
    case "gte":
      return Number(currentValue) >= Number(expectedValue);
    case "lte":
      return Number(currentValue) <= Number(expectedValue);
    case "in": {
      const list = Array.isArray(expectedValue)
        ? expectedValue.map((item) => toComparable(item))
        : String(expectedValue)
            .split(",")
            .map((token) => toComparable(token));

      return list.includes(currentValue);
    }
    case "not_in": {
      const list = Array.isArray(expectedValue)
        ? expectedValue.map((item) => toComparable(item))
        : String(expectedValue)
            .split(",")
            .map((token) => toComparable(token));

      return !list.includes(currentValue);
    }
    default:
      return false;
  }
}

function parseValue(rawValue: unknown): unknown {
  if (typeof rawValue !== "string") return rawValue;

  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

export function scoreLead(
  lead: Record<string, unknown>,
  rules: ScoringRuleInput[]
): ScoreLeadResult {
  let score = 0;
  const breakdown: Record<string, number> = {};

  for (const rule of rules) {
    if (rule.active === false) continue;

    const fieldValue = lead[rule.field];
    const expected = parseValue(rule.value);

    if (evaluateRule(fieldValue, rule.operator, expected)) {
      score += rule.points;
      breakdown[rule.label] = (breakdown[rule.label] ?? 0) + rule.points;
    }
  }

  const explanation = Object.entries(breakdown)
    .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
    .slice(0, 3)
    .map(([label, points]) => `${label} (+${points})`)
    .join(" | ");

  return {
    score,
    breakdown,
    explanation: explanation || "Sem regras aplicadas",
  };
}

export function evaluateScoringRule(
  current: unknown,
  operator: RuleOperator,
  expected: unknown
) {
  return evaluateRule(current, operator, expected);
}
