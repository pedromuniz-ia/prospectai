import { ApifyClient } from "apify-client";
import { extractDomain } from "@/lib/helpers";

type RawApifyItem = {
  title?: string;
  phone?: string;
  website?: string;
  url?: string;
  address?: string;
  city?: string;
  state?: string;
  categoryName?: string;
  categories?: string[];
  totalScore?: number;
  reviewsCount?: number;
  openingHours?: unknown;
  location?: { lat?: number; lng?: number };
};

export type ExtractedLead = {
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  businessHours: unknown;
  latitude: number | null;
  longitude: number | null;
  domain: string | null;
};

function mapItem(item: RawApifyItem): ExtractedLead | null {
  if (!item.title) return null;

  const parsedState = item.state ?? item.address?.split(",").at(-1)?.trim() ?? null;
  const website = item.website ?? item.url ?? null;

  return {
    name: item.title,
    phone: item.phone?.trim() ?? null,
    website,
    address: item.address ?? null,
    city: item.city ?? null,
    state: parsedState,
    category: item.categoryName ?? item.categories?.[0] ?? null,
    googleRating: typeof item.totalScore === "number" ? item.totalScore : null,
    googleReviewCount:
      typeof item.reviewsCount === "number" ? item.reviewsCount : null,
    businessHours: item.openingHours ?? null,
    latitude: typeof item.location?.lat === "number" ? item.location.lat : null,
    longitude: typeof item.location?.lng === "number" ? item.location.lng : null,
    domain: extractDomain(website),
  };
}

function getClient() {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("Missing APIFY_TOKEN environment variable");
  }

  return new ApifyClient({ token });
}

export async function runGoogleMapsScraper(input: {
  searchQuery: string;
  locationQuery: string;
  maxResults: number;
}): Promise<ExtractedLead[]> {
  const client = getClient();

  const run = await client.actor("compass/crawler-google-places").call({
    searchStringsArray: [`${input.searchQuery} ${input.locationQuery}`],
    maxCrawledPlacesPerSearch: input.maxResults,
    language: "pt-BR",
    countryCode: "br",
  });

  if (!run.defaultDatasetId) return [];

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return (items as RawApifyItem[])
    .map((item) => mapItem(item))
    .filter((item): item is ExtractedLead => Boolean(item));
}
