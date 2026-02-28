import { ApifyClient } from "apify-client";

export type LinkedinEnrichment = {
    employeeCountRange: string | null;
    industry: string | null;
    headquarters: string | null;
};

const emptyResult: LinkedinEnrichment = {
    employeeCountRange: null,
    industry: null,
    headquarters: null,
};

export async function enrichWithLinkedin(linkedinUrl: string): Promise<LinkedinEnrichment> {
    const token = process.env.APIFY_TOKEN;
    if (!token || !linkedinUrl.includes("linkedin.com/company/")) return emptyResult;

    try {
        const client = new ApifyClient({ token });

        const run = await client.actor("apify/linkedin-company-scraper").call({
            urls: [linkedinUrl],
            limit: 1
        });

        if (!run.defaultDatasetId) return emptyResult;

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        const profile = items[0] as Record<string, unknown> | undefined;

        if (!profile) return emptyResult;

        return {
            employeeCountRange: typeof profile.employeeCountRange === "string" ? profile.employeeCountRange : null,
            industry: typeof profile.industry === "string" ? profile.industry : null,
            headquarters: typeof profile.headquarter === "string" ? profile.headquarter : null,
        };
    } catch (error) {
        console.error("[LinkedIn Enrichment Error]:", error);
        return emptyResult;
    }
}
