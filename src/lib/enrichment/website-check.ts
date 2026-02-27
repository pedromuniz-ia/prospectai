import { extractDomain } from "@/lib/helpers";

export type WebsiteStatus = "active" | "inactive" | "parked" | "error";

export type WebsiteCheckResult = {
  websiteStatus: WebsiteStatus;
  hasSsl: boolean;
  email: string | null;
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
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

  const filtered = matches.find((email) => !email.endsWith("@example.com"));
  return filtered ?? matches[0] ?? null;
}

export async function checkWebsite(domainInput: string): Promise<WebsiteCheckResult> {
  const domain = extractDomain(domainInput);
  if (!domain) {
    return {
      websiteStatus: "error",
      hasSsl: false,
      email: null,
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
      };
    }
  }

  if (!baseResponse) {
    return {
      websiteStatus: "error",
      hasSsl,
      email: null,
    };
  }

  if (baseResponse.status >= 400) {
    return {
      websiteStatus: "inactive",
      hasSsl,
      email: null,
    };
  }

  let websiteStatus: WebsiteStatus = "active";
  let email: string | null = null;

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

      if (email && websiteStatus !== "parked") break;
    } catch {
      // Ignore specific path failures and keep checking others.
    }
  }

  return {
    websiteStatus,
    hasSsl,
    email,
  };
}
