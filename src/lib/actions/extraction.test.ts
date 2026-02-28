import { describe, it, expect, vi, beforeAll } from "vitest";
import { parseExtractionPrompt } from "./extraction";

describe("Extraction Prompt Parsing (TDD)", () => {
    const orgId = "test-org";

    it("should split query and location using regex-based local engine", async () => {
        // We target the local fallback since AI quota is hit and this ensures functional consistency
        const prompt = "Dentistas em Goiânia e Anápolis";

        // We don't need a real DB provider here as our code handles !provider via the same logic as the catch block
        const result = await parseExtractionPrompt(orgId, prompt);

        expect(result.query).toBe("Dentistas");
        expect(result.locations).toContain("Goiânia");
        expect(result.locations).toContain("Anápolis");
    });

    it("should handle prompts without 'em/no/na' by returning reasonable defaults", async () => {
        const prompt = "Academia de Crossfit";
        const result = await parseExtractionPrompt(orgId, prompt);

        expect(result.query).toBe("Academia de Crossfit");
        // Default location should be used if parsing fails to find it
        expect(Array.isArray(result.locations)).toBe(true);
    });

    it("should handle complex multiple locations", async () => {
        const prompt = "Restaurantes em São Paulo, Rio de Janeiro e Curitiba";
        const result = await parseExtractionPrompt(orgId, prompt);

        expect(result.query).toBe("Restaurantes");
        expect(result.locations.length).toBeGreaterThanOrEqual(2);
    });
});
