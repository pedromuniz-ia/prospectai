import { generateText } from "ai";
import { type aiProviders } from "@/db/schema/ai-providers";
import { type campaigns } from "@/db/schema/campaigns";
import { type leads } from "@/db/schema/leads";
import { getModel } from "@/lib/ai/provider-registry";

type AIProviderRow = typeof aiProviders.$inferSelect;
type CampaignRow = typeof campaigns.$inferSelect;
type LeadRow = typeof leads.$inferSelect;

type MessageInput = {
  direction: "inbound" | "outbound";
  content: string;
};

function interpolatePrompt(template: string, lead: LeadRow): string {
  return template
    .replaceAll("{name}", lead.name)
    .replaceAll("{category}", lead.category ?? "negocio local")
    .replaceAll("{city}", lead.city ?? "sua cidade")
    .replaceAll("{score}", String(lead.score));
}

function fallbackReply(lead: LeadRow) {
  return `Oi! Obrigado pelo retorno. Vi que seu negocio (${lead.name}) pode ganhar mais previsibilidade no WhatsApp com um fluxo simples de atendimento. Posso te mostrar em 2 minutos?`;
}

export async function generateReply(input: {
  lead: LeadRow;
  messages: MessageInput[];
  campaign: CampaignRow;
  provider: AIProviderRow;
}) {
  const model = getModel(input.provider);

  const systemPrompt = interpolatePrompt(
    input.campaign.aiSystemPrompt ||
      "Voce e um SDR cordial e objetivo. Responda em portugues brasileiro, em ate 2 frases curtas, sempre convidando para o proximo passo.",
    input.lead
  );

  const history = input.messages.map((message) => ({
    role: message.direction === "inbound" ? ("user" as const) : ("assistant" as const),
    content: message.content,
  }));

  try {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      messages: history,
      temperature: input.campaign.aiTemperature,
      maxOutputTokens: 300,
    });

    return text.trim();
  } catch {
    return fallbackReply(input.lead);
  }
}
