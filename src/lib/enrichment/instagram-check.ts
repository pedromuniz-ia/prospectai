import { ApifyClient } from "apify-client";

export type InstagramCheckResult = {
  username: string | null;
  followersCount: number | null;
  biography: string | null;
  externalUrl: string | null;
  isBusinessAccount: boolean | null;
  businessCategory: string | null;
  profileUrl: string | null;
};

const emptyResult: InstagramCheckResult = {
  username: null,
  followersCount: null,
  biography: null,
  externalUrl: null,
  isBusinessAccount: null,
  businessCategory: null,
  profileUrl: null,
};

export async function checkInstagram(
  instagramUrl: string
): Promise<InstagramCheckResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return emptyResult;

  try {
    const client = new ApifyClient({ token });
    const match = instagramUrl.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
    if (!match) return emptyResult;
    const username = match[1];

    const run = await client.actor("apify/instagram-profile-scraper").call({
      usernames: [username],
    });

    if (!run.defaultDatasetId) return emptyResult;

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const profile = items[0] as Record<string, unknown> | undefined;
    if (!profile) return emptyResult;

    return {
      username: typeof profile.username === "string" ? profile.username : null,
      followersCount: typeof profile.followersCount === "number" ? profile.followersCount : null,
      biography: typeof profile.biography === "string" ? profile.biography : null,
      externalUrl: typeof profile.externalUrl === "string" ? profile.externalUrl : null,
      isBusinessAccount: typeof profile.isBusinessAccount === "boolean" ? profile.isBusinessAccount : null,
      businessCategory: typeof profile.businessCategoryName === "string" ? profile.businessCategoryName : null,
      profileUrl: `https://instagram.com/${username}`,
    };
  } catch {
    return emptyResult;
  }
}
