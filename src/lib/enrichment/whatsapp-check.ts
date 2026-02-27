import { getEvolutionAPI } from "@/lib/evolution-api";

export type WhatsappCheckResult = {
  hasWhatsapp: boolean;
  isBusinessAccount: boolean | null;
  businessDescription: string | null;
  businessEmail: string | null;
  businessWebsite: string | null;
  businessCategory: string | null;
};

const emptyResult: WhatsappCheckResult = {
  hasWhatsapp: false,
  isBusinessAccount: null,
  businessDescription: null,
  businessEmail: null,
  businessWebsite: null,
  businessCategory: null,
};

export async function checkWhatsapp(
  phone: string,
  instanceName: string
): Promise<WhatsappCheckResult> {
  try {
    const api = getEvolutionAPI();

    const [check] = await api.checkWhatsappNumbers(instanceName, [phone]);
    if (!check?.exists) return emptyResult;

    try {
      const business = await api.fetchBusinessProfile(instanceName, phone);
      return {
        hasWhatsapp: true,
        isBusinessAccount: true,
        businessDescription: business.description ?? null,
        businessEmail: business.email ?? null,
        businessWebsite: business.website?.[0] ?? null,
        businessCategory: business.category ?? null,
      };
    } catch {
      return {
        hasWhatsapp: true,
        isBusinessAccount: false,
        businessDescription: null,
        businessEmail: null,
        businessWebsite: null,
        businessCategory: null,
      };
    }
  } catch {
    return emptyResult;
  }
}
