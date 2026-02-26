import { describe, it, expect } from "vitest";
import {
  t,
  formatInterval,
  formatScoringRule,
} from "@/lib/i18n";

describe("i18n translation maps", () => {
  it("translates lead status enums to PT-BR", () => {
    expect(t("leadStatus", "new")).toBe("Novo");
    expect(t("leadStatus", "enriched")).toBe("Qualificado");
    expect(t("leadStatus", "contacted")).toBe("Contatado");
    expect(t("leadStatus", "won")).toBe("Ganho");
    expect(t("leadStatus", "blocked")).toBe("Bloqueado");
  });

  it("translates pipeline stage enums", () => {
    expect(t("pipelineStage", "approached")).toBe("Abordado");
    expect(t("pipelineStage", "interested")).toBe("Interessado");
    expect(t("pipelineStage", "won")).toBe("Ganho");
  });

  it("translates campaign status enums", () => {
    expect(t("campaignStatus", "draft")).toBe("Rascunho");
    expect(t("campaignStatus", "active")).toBe("Ativa");
    expect(t("campaignStatus", "paused")).toBe("Pausada");
    expect(t("campaignStatus", "completed")).toBe("Concluída");
  });

  it("translates campaign objective enums", () => {
    expect(t("campaignObjective", "sell_website")).toBe("Vender Website");
    expect(t("campaignObjective", "sell_ai_agent")).toBe("Vender Agente IA");
    expect(t("campaignObjective", "custom")).toBe("Personalizado");
  });

  it("translates AI provider enums", () => {
    expect(t("aiProvider", "openai")).toBe("OpenAI");
    expect(t("aiProvider", "anthropic")).toBe("Anthropic");
    expect(t("aiProvider", "google")).toBe("Google Gemini");
    expect(t("aiProvider", "openai_compatible")).toBe("Custom (OpenAI Compatible)");
  });

  it("translates message source enums", () => {
    expect(t("messageSource", "ai_auto")).toBe("IA (auto)");
    expect(t("messageSource", "webhook")).toBe("WhatsApp");
  });

  it("translates scoring operator enums", () => {
    expect(t("scoringOperator", "eq")).toBe("é igual a");
    expect(t("scoringOperator", "gte")).toBe("é pelo menos");
  });

  it("translates scoring field enums", () => {
    expect(t("scoringField", "hasWebsite")).toBe("Tem website");
    expect(t("scoringField", "googleRating")).toBe("Avaliação Google");
  });

  it("translates job type enums", () => {
    expect(t("jobType", "apify_gmaps")).toBe("Google Maps");
    expect(t("jobType", "rdap_whois")).toBe("Verificação RDAP");
  });

  it("translates job status enums", () => {
    expect(t("jobStatus", "running")).toBe("Em andamento");
    expect(t("jobStatus", "completed")).toBe("Concluído");
  });

  it("translates instance status enums", () => {
    expect(t("instanceStatus", "connected")).toBe("Conectado");
    expect(t("instanceStatus", "banned")).toBe("Banido");
  });

  it("translates notification type enums", () => {
    expect(t("notificationType", "lead_replied")).toBe("Lead respondeu");
    expect(t("notificationType", "campaign_paused")).toBe("Campanha pausada");
  });

  it("returns the raw value for unknown keys", () => {
    expect(t("leadStatus", "unknown_value" as any)).toBe("unknown_value");
  });
});

describe("formatInterval", () => {
  it("converts seconds to human-readable PT-BR", () => {
    expect(formatInterval(60)).toBe("1 minuto");
    expect(formatInterval(120)).toBe("2 minutos");
    expect(formatInterval(180)).toBe("3 minutos");
    expect(formatInterval(90)).toBe("1 min 30s");
    expect(formatInterval(30)).toBe("30 segundos");
    expect(formatInterval(3600)).toBe("1 hora");
    expect(formatInterval(7200)).toBe("2 horas");
  });
});

describe("formatScoringRule", () => {
  it("renders boolean rules in natural language", () => {
    expect(
      formatScoringRule({
        field: "hasWebsite",
        operator: "eq",
        value: false,
        points: 10,
      })
    ).toBe("Sem website → +10 pts");
  });

  it("renders numeric rules in natural language", () => {
    expect(
      formatScoringRule({
        field: "googleRating",
        operator: "gte",
        value: 4,
        points: 15,
      })
    ).toBe("Avaliação Google é pelo menos 4 → +15 pts");
  });

  it("renders negative points", () => {
    expect(
      formatScoringRule({
        field: "hasWebsite",
        operator: "eq",
        value: true,
        points: -5,
      })
    ).toBe("Tem website → -5 pts");
  });
});
