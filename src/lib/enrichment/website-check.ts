import { extractDomain } from "@/lib/helpers";

export type WebsiteStatus = "active" | "inactive" | "parked" | "error";

export type WebsiteCheckResult = {
  websiteStatus: WebsiteStatus;
  hasSsl: boolean;
  email: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  cnpj: string | null;
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const INSTAGRAM_URL_REGEX = /https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9._]+)/i;
const LINKEDIN_URL_REGEX = /https?:\/\/(www\.)?linkedin\.com\/company\/([a-zA-Z0-9_-]+)/i;
const CNPJ_REGEX = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;

const IGNORED_EMAIL_DOMAINS = [
  "google.com",
  "wix.com",
  "godaddy.com",
  "namecheap.com",
  "wordpress.com",
  "example.com",
  "sentry.io",
  "doubleclick.net",
  "clerk.dev",
  "supabase.co",
  "vercel.app",
];

const parkedPatterns = [
  /this domain is parked/i,
  /buy this domain/i,
  /sedo/i,
  /godaddy/i,
  /domain for sale/i,
];

const commonPaths = ["/", "/contato", "/contact", "/fale-conosco", "/about"];

async function fetchPage(url: string) {
  return fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(7_000),
    headers: {
      "User-Agent": "ProspectAI/1.0 (+https://prospectai.local)",
    },
  });
}

function parseEmail(html: string): string | null {
  const matches = html.match(EMAIL_REGEX);
  if (!matches?.length) return null;

  // Unique list of valid emails
  const candidates = Array.from(new Set(matches.map((e) => e.toLowerCase())));

  const filtered = candidates.filter((email) => {
    const domain = email.split("@")[1];
    return !IGNORED_EMAIL_DOMAINS.includes(domain);
  });

  // Prioritize emails that don't look like tech support or generic info if possible
  // but return the first valid one if not.
  return filtered[0] ?? null;
}

function parseInstagram(html: string): string | null {
  const match = html.match(INSTAGRAM_URL_REGEX);
  if (!match) return null;

  // Clean the URL — Remove trailing slashes or query params
  try {
    const url = new URL(match[0]);
    return `https://www.instagram.com/${url.pathname.split("/")[1]}`;
  } catch {
    return match[0];
  }
}

function parseLinkedin(html: string): string | null {
  const match = html.match(LINKEDIN_URL_REGEX);
  if (!match) return null;
  return `https://www.linkedin.com/company/${match[1]}`;
}

function parseCnpj(html: string): string | null {
  const matches = html.match(CNPJ_REGEX);
  if (!matches?.length) return null;
  return matches[0].replace(/\D/g, "");
}

export async function checkWebsite(domainInput: string): Promise<WebsiteCheckResult> {
  const domain = extractDomain(domainInput);
  if (!domain) {
    return {
      websiteStatus: "error",
      hasSsl: false,
      email: null,
      instagramUrl: null,
      linkedinUrl: null,
      cnpj: null,
    };
  }

  const httpsBase = `https://${domain}`;
  const httpBase = `http://${domain}`;

  let baseUrl = httpsBase;
  let hasSsl = true;

  let baseResponse: Response | null = null;

  try {
    baseResponse = await fetchPage(httpsBase);
  } catch {
    hasSsl = false;
    baseUrl = httpBase;
    try {
      baseResponse = await fetchPage(httpBase);
    } catch {
      return {
        websiteStatus: "error",
        hasSsl: false,
        email: null,
        instagramUrl: null,
        linkedinUrl: null,
        cnpj: null,
      };
    }
  }

  if (!baseResponse) {
    return {
      websiteStatus: "error",
      hasSsl,
      email: null,
      instagramUrl: null,
      linkedinUrl: null,
      cnpj: null,
    };
  }

  if (baseResponse.status >= 400) {
    return {
      websiteStatus: "inactive",
      hasSsl,
      email: null,
      instagramUrl: null,
      linkedinUrl: null,
      cnpj: null,
    };
  }

  let websiteStatus: WebsiteStatus = "active";
  let email: string | null = null;
  let instagramUrl: string | null = null;
  let linkedinUrl: string | null = null;
  let cnpj: string | null = null;

  for (const path of commonPaths) {
    try {
      const response = await fetchPage(`${baseUrl}${path}`);
      if (!response.ok) continue;

      const html = await response.text();
      if (parkedPatterns.some((pattern) => pattern.test(html))) {
        websiteStatus = "parked";
      }

      if (!email) {
        email = parseEmail(html);
      }

      if (!instagramUrl) {
        instagramUrl = parseInstagram(html);
      }

      if (!linkedinUrl) {
        linkedinUrl = parseLinkedin(html);
      }

      if (!cnpj) {
        cnpj = parseCnpj(html);
      }

      if (email && instagramUrl && linkedinUrl && cnpj && websiteStatus !== "parked") break;
    } catch {
      // Ignore specific path failures and keep checking others.
    }
  }

  return {
    websiteStatus,
    hasSsl,
    email,
    instagramUrl,
    linkedinUrl,
    cnpj,
  };
}
