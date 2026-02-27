import { type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { type aiProviders } from "@/db/schema/ai-providers";

type AIProviderRow = typeof aiProviders.$inferSelect;

function resolveBaseUrl(provider: AIProviderRow): string | undefined {
  if (provider.provider === "openai_compatible") return provider.baseUrl ?? undefined;

  if (provider.provider === "groq") return "https://api.groq.com/openai/v1";
  if (provider.provider === "together") return "https://api.together.xyz/v1";
  if (provider.provider === "fireworks") {
    return "https://api.fireworks.ai/inference/v1";
  }

  return provider.baseUrl ?? undefined;
}

/** Returns the base URL for API calls (used for listing models, etc.) */
export function getProviderBaseUrl(provider: AIProviderRow): string {
  switch (provider.provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "google":
      return "https://generativelanguage.googleapis.com/v1beta";
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "together":
      return "https://api.together.xyz/v1";
    case "fireworks":
      return "https://api.fireworks.ai/inference/v1";
    case "openai_compatible":
      return provider.baseUrl ?? "";
    default:
      return "";
  }
}

export function getModel(provider: AIProviderRow): LanguageModel {
  switch (provider.provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: provider.apiKey,
      });
      return openai(provider.defaultModel);
    }

    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: provider.apiKey,
      });
      return anthropic(provider.defaultModel);
    }

    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: provider.apiKey,
      });
      return google(provider.defaultModel);
    }

    case "groq":
    case "together":
    case "fireworks":
    case "openai_compatible": {
      const custom = createOpenAI({
        apiKey: provider.apiKey,
        baseURL: resolveBaseUrl(provider),
        name: provider.label,
      });
      return custom(provider.defaultModel);
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider.provider}`);
  }
}
