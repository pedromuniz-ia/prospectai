import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EvolutionAPI,
  EvolutionAPIError,
  extractMessageText,
  detectMediaType,
  phoneFromJid,
  type MessagesUpsertData,
} from "../evolution-api";

const BASE_URL = "https://evo.example.com";
const API_KEY = "test-api-key";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe("EvolutionAPI", () => {
  let api: EvolutionAPI;

  beforeEach(() => {
    api = new EvolutionAPI(BASE_URL, API_KEY);
    vi.restoreAllMocks();
  });

  describe("createInstance", () => {
    it("sends correct request and returns response", async () => {
      const response = {
        instance: { instanceName: "test", instanceId: "abc123", integration: "WHATSAPP-BAILEYS", status: "created" },
        hash: { token: "hash-token" },
        qrcode: { base64: "base64-data", code: "qr-code" },
        settings: {},
      };

      vi.stubGlobal("fetch", mockFetch(201, response));

      const result = await api.createInstance({
        instanceName: "test",
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      });

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/instance/create`,
        expect.objectContaining({
          method: "POST",
          headers: { apikey: API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceName: "test",
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            rejectCall: false,
            groupsIgnore: false,
            alwaysOnline: true,
            readMessages: true,
            readStatus: true,
          }),
        })
      );
      expect(result.instance.instanceName).toBe("test");
      expect(result.hash.token).toBe("hash-token");
    });
  });

  describe("getConnectionState", () => {
    it("returns connection state", async () => {
      const response = { instance: { instanceName: "test", state: "open" } };
      vi.stubGlobal("fetch", mockFetch(200, response));

      const result = await api.getConnectionState("test");

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/instance/connectionState/test`,
        expect.objectContaining({ method: "GET" })
      );
      expect(result.instance.state).toBe("open");
    });

    it("encodes instance name in URL", async () => {
      vi.stubGlobal("fetch", mockFetch(200, { instance: { instanceName: "my instance", state: "close" } }));

      await api.getConnectionState("my instance");

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/instance/connectionState/my%20instance`,
        expect.anything()
      );
    });
  });

  describe("sendText", () => {
    it("sends text message", async () => {
      const response = {
        key: { remoteJid: "5511999@s.whatsapp.net", fromMe: true, id: "msg-1" },
        message: {},
        messageTimestamp: "1234567890",
        status: "PENDING",
      };
      vi.stubGlobal("fetch", mockFetch(200, response));

      const result = await api.sendText("test", {
        number: "5511999999999",
        text: "Hello!",
        delay: 1000,
      });

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/message/sendText/test`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            number: "5511999999999",
            text: "Hello!",
            delay: 1000,
          }),
        })
      );
      expect(result.key.id).toBe("msg-1");
    });
  });

  describe("setWebhook", () => {
    it("configures webhook", async () => {
      vi.stubGlobal("fetch", mockFetch(201, { webhook: {} }));

      await api.setWebhook("test", {
        enabled: true,
        url: "https://app.com/webhook",
        webhookByEvents: true,
        webhookBase64: true,
        events: ["MESSAGES_UPSERT"],
      });

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/webhook/set/test`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            enabled: true,
            url: "https://app.com/webhook",
            webhookByEvents: true,
            webhookBase64: true,
            events: ["MESSAGES_UPSERT"],
          }),
        })
      );
    });
  });

  describe("fetchInstances", () => {
    it("returns list of instances", async () => {
      const instances = [
        { instanceName: "inst-1", integration: "WHATSAPP-BAILEYS" },
        { instanceName: "inst-2", integration: "WHATSAPP-BAILEYS" },
      ];
      vi.stubGlobal("fetch", mockFetch(200, instances));

      const result = await api.fetchInstances();

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/instance/fetchInstances`,
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toHaveLength(2);
    });
  });

  describe("error handling", () => {
    it("throws EvolutionAPIError on 401", async () => {
      vi.stubGlobal("fetch", mockFetch(401, { error: "Unauthorized" }));

      await expect(api.fetchInstances()).rejects.toThrow(EvolutionAPIError);
      await expect(api.fetchInstances()).rejects.toMatchObject({
        status: 401,
      });
    });

    it("throws EvolutionAPIError on 404", async () => {
      vi.stubGlobal("fetch", mockFetch(404, { error: "Not Found" }));

      await expect(api.getConnectionState("missing")).rejects.toThrow(
        EvolutionAPIError
      );
    });

    it("throws EvolutionAPIError on 500", async () => {
      vi.stubGlobal("fetch", mockFetch(500, { error: "Internal Server Error" }));

      await expect(
        api.sendText("test", { number: "123", text: "hi" })
      ).rejects.toThrow(EvolutionAPIError);
    });

    it("includes response body in error", async () => {
      const errorBody = { status: 401, error: "Unauthorized", response: { message: ["Invalid API key"] } };
      vi.stubGlobal("fetch", mockFetch(401, errorBody));

      try {
        await api.fetchInstances();
      } catch (err) {
        expect(err).toBeInstanceOf(EvolutionAPIError);
        expect((err as EvolutionAPIError).response).toEqual(errorBody);
      }
    });
  });

  describe("logoutInstance", () => {
    it("sends DELETE request", async () => {
      vi.stubGlobal("fetch", mockFetch(200, { status: "SUCCESS" }));

      await api.logoutInstance("test");

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/instance/logout/test`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("deleteInstance", () => {
    it("sends DELETE request", async () => {
      vi.stubGlobal("fetch", mockFetch(200, { status: "SUCCESS" }));

      await api.deleteInstance("test");

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/instance/delete/test`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("setPresence", () => {
    it("sets presence to composing", async () => {
      vi.stubGlobal("fetch", mockFetch(200, {}));

      await api.setPresence("test", { presence: "composing" });

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/instance/setPresence/test`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ presence: "composing" }),
        })
      );
    });
  });
});

describe("Helper functions", () => {
  describe("phoneFromJid", () => {
    it("extracts phone from WhatsApp JID", () => {
      expect(phoneFromJid("5511999999999@s.whatsapp.net")).toBe("5511999999999");
    });

    it("handles group JID", () => {
      expect(phoneFromJid("123456@g.us")).toBe("123456");
    });
  });

  describe("extractMessageText", () => {
    it("extracts conversation text", () => {
      const data: MessagesUpsertData = {
        key: { remoteJid: "test@s.whatsapp.net", fromMe: false, id: "1" },
        message: { conversation: "Hello" },
      };
      expect(extractMessageText(data)).toBe("Hello");
    });

    it("extracts extended text", () => {
      const data: MessagesUpsertData = {
        key: { remoteJid: "test@s.whatsapp.net", fromMe: false, id: "1" },
        message: { extendedTextMessage: { text: "Extended hello" } },
      };
      expect(extractMessageText(data)).toBe("Extended hello");
    });

    it("extracts image caption", () => {
      const data: MessagesUpsertData = {
        key: { remoteJid: "test@s.whatsapp.net", fromMe: false, id: "1" },
        message: { imageMessage: { caption: "Check this out", url: "http://..." } },
      };
      expect(extractMessageText(data)).toBe("Check this out");
    });

    it("returns null for no message", () => {
      const data: MessagesUpsertData = {
        key: { remoteJid: "test@s.whatsapp.net", fromMe: false, id: "1" },
      };
      expect(extractMessageText(data)).toBeNull();
    });
  });

  describe("detectMediaType", () => {
    it("detects text message", () => {
      const data: MessagesUpsertData = {
        key: { remoteJid: "test@s.whatsapp.net", fromMe: false, id: "1" },
        message: { conversation: "Hello" },
      };
      expect(detectMediaType(data)).toBe("text");
    });

    it("detects image message", () => {
      const data: MessagesUpsertData = {
        key: { remoteJid: "test@s.whatsapp.net", fromMe: false, id: "1" },
        message: { imageMessage: { url: "http://..." } },
      };
      expect(detectMediaType(data)).toBe("image");
    });

    it("detects audio message", () => {
      const data: MessagesUpsertData = {
        key: { remoteJid: "test@s.whatsapp.net", fromMe: false, id: "1" },
        message: { audioMessage: { url: "http://..." } },
      };
      expect(detectMediaType(data)).toBe("audio");
    });

    it("detects video message", () => {
      const data: MessagesUpsertData = {
        key: { remoteJid: "test@s.whatsapp.net", fromMe: false, id: "1" },
        message: { videoMessage: { url: "http://..." } },
      };
      expect(detectMediaType(data)).toBe("video");
    });

    it("detects document message", () => {
      const data: MessagesUpsertData = {
        key: { remoteJid: "test@s.whatsapp.net", fromMe: false, id: "1" },
        message: { documentMessage: { fileName: "doc.pdf", url: "http://..." } },
      };
      expect(detectMediaType(data)).toBe("document");
    });

    it("returns null for no message", () => {
      const data: MessagesUpsertData = {
        key: { remoteJid: "test@s.whatsapp.net", fromMe: false, id: "1" },
      };
      expect(detectMediaType(data)).toBeNull();
    });
  });
});
