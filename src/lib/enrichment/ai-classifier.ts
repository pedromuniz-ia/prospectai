import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

export const classificationSchema = z.object({
  classification: z.enum([
    "needs_website",
    "needs_optimization",
    "needs_ai_agent",
    "needs_automation",
    "low_fit",
  ]),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(200),
  suggestedApproach: z.string().max(300),
});

export type LeadClassification = z.infer<typeof classificationSchema>;

type ClassificationLeadInput = {
  name: string | null;
  category: string | null;
  city: string | null;
  hasWebsite: boolean | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  websiteStatus: string | null;
  aiSummary?: string | null;
};

function heuristicClassification(lead: ClassificationLeadInput): LeadClassification {
  if (!lead.hasWebsite) {
    return {
      classification: "needs_website",
      confidence: 0.88,
      summary: "Lead sem website funcional e com potencial de aquisição rápida.",
      suggestedApproach:
        "Abordar com proposta objetiva de criação de site com entrega rápida e integração WhatsApp.",
    };
  }

  if ((lead.googleRating ?? 0) < 4 || (lead.googleReviewCount ?? 0) < 40) {
    return {
      classification: "needs_optimization",
      confidence: 0.78,
      summary: "Presença digital existente, mas com sinais de baixa performance comercial.",
      suggestedApproach:
        "Oferecer otimização do funil digital e ajustes de conversão com foco em aquisição local.",
    };
  }

  if ((lead.googleReviewCount ?? 0) >= 80) {
    return {
      classification: "needs_automation",
      confidence: 0.74,
      summary: "Lead com volume relevante e maior chance de ganho com automações operacionais.",
      suggestedApproach:
        "Posicionar automação de atendimento e recuperação de oportunidades com IA supervisionada.",
    };
  }

  return {
    classification: "needs_ai_agent",
    confidence: 0.67,
    summary: "Lead aderente para experimentação de assistente IA de pré-vendas.",
    suggestedApproach:
      "Testar agente IA para triagem e qualificação inicial, com handoff humano para fechamento.",
  };
}

export async function classifyLead(
  lead: ClassificationLeadInput,
  model?: LanguageModel
): Promise<LeadClassification> {
  if (!model) {
    return heuristicClassification(lead);
  }

  const prompt = [
    "Classifique este lead para prospeccao B2B via WhatsApp.",
    "Responda estritamente no schema definido.",
    `Nome: ${lead.name ?? "N/A"}`,
    `Categoria: ${lead.category ?? "N/A"}`,
    `Cidade: ${lead.city ?? "N/A"}`,
    `Tem website: ${String(lead.hasWebsite)}`,
    `Status website: ${lead.websiteStatus ?? "N/A"}`,
    `Google rating: ${lead.googleRating ?? "N/A"}`,
    `Google reviews: ${lead.googleReviewCount ?? "N/A"}`,
  ].join("\n");

  try {
    const { object } = await generateObject({
      model,
      schema: classificationSchema,
      prompt,
      temperature: 0.3,
    });

    return object;
  } catch {
    return heuristicClassification(lead);
  }
}
