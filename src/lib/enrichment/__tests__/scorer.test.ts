import { describe, expect, it } from "vitest";
import { evaluateScoringRule, scoreLead, type ScoringRuleInput } from "@/lib/enrichment/scorer";

describe("evaluateScoringRule", () => {
  it("supports equality and inequality operators", () => {
    expect(evaluateScoringRule(false, "eq", false)).toBe(true);
    expect(evaluateScoringRule("restaurante", "neq", "clinica")).toBe(true);
  });

  it("supports numeric comparison operators", () => {
    expect(evaluateScoringRule(10, "gt", 9)).toBe(true);
    expect(evaluateScoringRule(10, "gte", 10)).toBe(true);
    expect(evaluateScoringRule(10, "lt", 11)).toBe(true);
    expect(evaluateScoringRule(10, "lte", 10)).toBe(true);
  });

  it("supports list operators", () => {
    expect(evaluateScoringRule("sao paulo", "in", ["rio", "sao paulo"])).
      toBe(true);
    expect(evaluateScoringRule("rio", "not_in", ["sao paulo", "campinas"]))
      .toBe(true);
  });
});

describe("scoreLead", () => {
  it("calculates total score and breakdown", () => {
    const lead = {
      hasWebsite: false,
      googleReviewCount: 12,
      city: "Sao Paulo",
      category: "restaurante",
      score: 0,
    };

    const rules: ScoringRuleInput[] = [
      {
        field: "hasWebsite",
        operator: "eq",
        value: false,
        points: 30,
        label: "Sem website",
      },
      {
        field: "googleReviewCount",
        operator: "lt",
        value: 20,
        points: 15,
        label: "Poucas avaliacoes",
      },
      {
        field: "city",
        operator: "in",
        value: ["Sao Paulo", "Campinas"],
        points: 5,
        label: "Cidade alvo",
      },
    ];

    const result = scoreLead(lead, rules);

    expect(result.score).toBe(50);
    expect(result.breakdown).toEqual({
      "Sem website": 30,
      "Poucas avaliacoes": 15,
      "Cidade alvo": 5,
    });
    expect(result.explanation).toContain("Sem website (+30)");
  });

  it("skips inactive rules and returns fallback explanation", () => {
    const result = scoreLead(
      { hasWebsite: true },
      [
        {
          field: "hasWebsite",
          operator: "eq",
          value: false,
          points: 30,
          label: "Sem website",
          active: false,
        },
      ]
    );

    expect(result.score).toBe(0);
    expect(result.explanation).toBe("Sem regras aplicadas");
  });
});
