import { describe, it, expect, vi } from "vitest";
import { runGoogleMapsScraper } from "./apify";

// Integration test — requires a real APIFY_TOKEN, skip in CI
const hasToken = !!process.env.APIFY_TOKEN;
describe.skipIf(!hasToken)("Apify Integration (TDD)", () => {
    it("should successfully fetch leads from Google Maps", async () => {
        // Increase timeout for real API call
        const results = await runGoogleMapsScraper({
            searchStrings: ["Restaurante em Senador Canedo, GO"],
            maxResults: 2,
        });

        console.log(`[TDD] Found ${results.length} leads during validation.`);

        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);

        if (results.length > 0) {
            const first = results[0];
            expect(first.name).toBeDefined();
            expect(typeof first.name).toBe("string");
            console.log(`[TDD] Sample lead: ${first.name} (${first.city})`);
        } else {
            console.warn("[TDD] No results returned from Apify. This might be a search query issue or token limit.");
        }
    }, 60000); // 1 minute timeout for scraper

    it("should handle multiple search strings simultaneously", async () => {
        const results = await runGoogleMapsScraper({
            searchStrings: [
                "Dentista em Goiânia, GO",
                "Clínica em Aparecida de Goiânia, GO"
            ],
            maxResults: 5,
        });

        console.log(`[TDD] Multi-search found ${results.length} total leads.`);
        expect(results.length).toBeGreaterThan(0);
    }, 90000);
});
