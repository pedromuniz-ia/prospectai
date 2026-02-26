import { z } from "zod";

// ── Types ──

export const createInstanceInputSchema = z.object({
  instanceName: z.string(),
  integration: z.enum(["WHATSAPP-BAILEYS", "WHATSAPP-BUSINESS"]).default("WHATSAPP-BAILEYS"),
  qrcode: z.boolean().default(true),
  number: z.string().optional(),
  rejectCall: z.boolean().default(false),
  groupsIgnore: z.boolean().default(false),
  alwaysOnline: z.boolean().default(true),
  readMessages: z.boolean().default(true),
  readStatus: z.boolean().default(true),
  webhook: z
    .object({
      url: z.string(),
      byEvents: z.boolean().default(true),
      base64: z.boolean().default(true),
      events: z.array(z.string()).default([
        "MESSAGES_UPSERT",
        "QRCODE_UPDATED",
        "CONNECTION_UPDATE",
        "MESSAGES_UPDATE",
      ]),
    })
    .optional(),
});

export type CreateInstanceInput = z.input<typeof createInstanceInputSchema>;

export interface CreateInstanceResponse {
  instance: {
    instanceName: string;
    instanceId?: string;
    integration: string;
    status: string;
  };
  hash: {
    token: string;
  };
  qrcode?: {
    base64: string;
    code: string;
  };
  settings: Record<string, unknown>;
}

export interface SendTextInput {
  number: string;
  text: string;
  delay?: number;
  linkPreview?: boolean;
}

export interface SendTextResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: Record<string, unknown>;
  messageTimestamp: string;
  status: string;
}

export interface ConnectionState {
  instance: {
    instanceName: string;
    state: "open" | "close" | "connecting";
  };
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  webhookByEvents: boolean;
  webhookBase64: boolean;
  events: string[];
}

export interface EvolutionInstance {
  instanceName: string;
  instanceId?: string;
  integration: string;
  number?: string;
  status?: string;
  qrcode?: boolean;
}

export interface SetPresenceInput {
  presence: "available" | "unavailable" | "composing" | "recording" | "paused";
}

// ── Webhook Event Types ──

export interface WebhookEvent {
  event: string;
  instance: string;
  data: unknown;
  apikey?: string;
}

export interface MessagesUpsertData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { caption?: string; url?: string };
    audioMessage?: { url?: string };
    videoMessage?: { caption?: string; url?: string };
    documentMessage?: { fileName?: string; url?: string };
  };
  messageTimestamp?: number;
  messageType?: string;
}

export interface ConnectionUpdateData {
  state: "open" | "close" | "connecting";
  statusReason?: number;
}

export interface QRCodeUpdateData {
  code: string;
  base64: string;
}

export interface MessagesUpdateData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  update: {
    status?: number; // 2 = sent, 3 = delivered, 4 = read
  };
}

// ── Error ──

export class EvolutionAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "EvolutionAPIError";
  }
}

// ── Client ──

export class EvolutionAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      apikey: this.apiKey,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      throw new EvolutionAPIError(
        `Evolution API error: ${res.status} ${res.statusText}`,
        res.status,
        errorBody
      );
    }

    return res.json() as Promise<T>;
  }

  // POST /instance/create
  async createInstance(
    input: CreateInstanceInput
  ): Promise<CreateInstanceResponse> {
    const parsed = createInstanceInputSchema.parse(input);
    return this.request<CreateInstanceResponse>(
      "POST",
      "/instance/create",
      parsed
    );
  }

  // GET /instance/connectionState/{instance}
  async getConnectionState(instanceName: string): Promise<ConnectionState> {
    return this.request<ConnectionState>(
      "GET",
      `/instance/connectionState/${encodeURIComponent(instanceName)}`
    );
  }

  // POST /message/sendText/{instance}
  async sendText(
    instanceName: string,
    input: SendTextInput
  ): Promise<SendTextResponse> {
    return this.request<SendTextResponse>(
      "POST",
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      input
    );
  }

  // POST /webhook/set/{instance}
  async setWebhook(
    instanceName: string,
    config: WebhookConfig
  ): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/webhook/set/${encodeURIComponent(instanceName)}`,
      config
    );
  }

  // GET /instance/fetchInstances
  async fetchInstances(): Promise<EvolutionInstance[]> {
    return this.request<EvolutionInstance[]>(
      "GET",
      "/instance/fetchInstances"
    );
  }

  // DELETE /instance/logout/{instance}
  async logoutInstance(instanceName: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/instance/logout/${encodeURIComponent(instanceName)}`
    );
  }

  // DELETE /instance/delete/{instance}
  async deleteInstance(instanceName: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/instance/delete/${encodeURIComponent(instanceName)}`
    );
  }

  // POST /instance/setPresence/{instance}
  async setPresence(
    instanceName: string,
    input: SetPresenceInput
  ): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/instance/setPresence/${encodeURIComponent(instanceName)}`,
      input
    );
  }
}

// ── Singleton ──

let instance: EvolutionAPI | null = null;

export function getEvolutionAPI(): EvolutionAPI {
  if (!instance) {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error(
        "Missing EVOLUTION_API_URL or EVOLUTION_API_KEY environment variables"
      );
    }
    instance = new EvolutionAPI(baseUrl, apiKey);
  }
  return instance;
}

// ── Helpers ──

/** Extract phone number from WhatsApp JID (e.g., "5511999999999@s.whatsapp.net" → "5511999999999") */
export function phoneFromJid(jid: string): string {
  return jid.split("@")[0];
}

/** Extract text content from a webhook message */
export function extractMessageText(data: MessagesUpsertData): string | null {
  const msg = data.message;
  if (!msg) return null;
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.videoMessage?.caption ??
    null
  );
}

/** Detect media type from webhook message */
export function detectMediaType(
  data: MessagesUpsertData
): "text" | "image" | "audio" | "video" | "document" | null {
  const msg = data.message;
  if (!msg) return null;
  if (msg.imageMessage) return "image";
  if (msg.audioMessage) return "audio";
  if (msg.videoMessage) return "video";
  if (msg.documentMessage) return "document";
  if (msg.conversation || msg.extendedTextMessage) return "text";
  return null;
}
