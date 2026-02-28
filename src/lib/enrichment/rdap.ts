import { extractDomain } from "@/lib/helpers";

export type RDAPEnrichment = {
  whoisEmail: string | null;
  whoisResponsible: string | null;
  domainRegistrar: string | null;
  domainCreatedAt: string | null;
};

const emptyResult: RDAPEnrichment = {
  whoisEmail: null,
  whoisResponsible: null,
  domainRegistrar: null,
  domainCreatedAt: null,
};

function parseVcardField(
  vcardArray: unknown,
  fieldName: "email" | "fn"
): string | null {
  if (!Array.isArray(vcardArray) || !Array.isArray(vcardArray[1])) return null;

  const fields = vcardArray[1] as unknown[];
  for (const field of fields) {
    if (!Array.isArray(field)) continue;
    if (field[0] === fieldName && typeof field[3] === "string") {
      return field[3].trim();
    }
  }

  return null;
}

export async function enrichWithRDAP(domainInput: string): Promise<RDAPEnrichment> {
  const domain = extractDomain(domainInput);
  if (!domain || !domain.endsWith(".com.br")) return emptyResult;

  let response: Response;
  try {
    response = await fetch(`https://rdap.registro.br/domain/${domain}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return emptyResult;
  }

  if (!response.ok) return emptyResult;

  let payload: {
    entities?: Array<{
      roles?: string[];
      vcardArray?: unknown;
      entities?: Array<{
        roles?: string[];
        vcardArray?: unknown;
      }>;
    }>;
    events?: Array<{
      eventAction?: string;
      eventDate?: string;
    }>;
  };

  try {
    payload = await response.json();
  } catch {
    return emptyResult;
  }

  const entities = payload.entities ?? [];

  let whoisEmail: string | null = null;
  let whoisResponsible: string | null = null;
  let domainRegistrar: string | null = null;

  const creationEvent = payload.events?.find((event) =>
    ["registration", "registered", "creation"].includes(
      (event.eventAction ?? "").toLowerCase()
    )
  );

  // Parse according to the extension logic (checking nested entities)
  for (const entity of entities) {
    // 1. Look in nested entities first
    if (entity.entities && Array.isArray(entity.entities)) {
      for (const nestedEntity of entity.entities) {
        if (!whoisEmail) whoisEmail = parseVcardField(nestedEntity.vcardArray, "email");
        if (!whoisResponsible) whoisResponsible = parseVcardField(nestedEntity.vcardArray, "fn");
      }
    }

    // 2. Look in the main entity
    if (!whoisEmail) whoisEmail = parseVcardField(entity.vcardArray, "email");
    if (!whoisResponsible) whoisResponsible = parseVcardField(entity.vcardArray, "fn");

    // Check if this is the registrar
    if (entity.roles?.includes("registrar") && !domainRegistrar) {
      domainRegistrar = parseVcardField(entity.vcardArray, "fn");
    }
  }

  return {
    whoisEmail,
    whoisResponsible,
    domainRegistrar: domainRegistrar ?? null,
    domainCreatedAt: creationEvent?.eventDate ?? null,
  };
}
