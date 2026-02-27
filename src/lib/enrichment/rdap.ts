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

  const response = await fetch(`https://rdap.registro.br/domain/${domain}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) return emptyResult;

  const payload = (await response.json()) as {
    entities?: Array<{ vcardArray?: unknown; roles?: string[] }>;
    events?: Array<{ eventAction?: string; eventDate?: string }>;
  };

  const entities = payload.entities ?? [];

  const contactEntity =
    entities.find((entity) => entity.roles?.includes("registrant")) ??
    entities.find((entity) => entity.roles?.includes("administrative")) ??
    entities[0];

  const registrarEntity = entities.find((entity) =>
    entity.roles?.includes("registrar")
  );

  const creationEvent = payload.events?.find((event) =>
    ["registration", "registered", "creation"].includes(
      (event.eventAction ?? "").toLowerCase()
    )
  );

  const whoisEmail = parseVcardField(contactEntity?.vcardArray, "email");
  const whoisResponsible = parseVcardField(contactEntity?.vcardArray, "fn");
  const domainRegistrar = parseVcardField(registrarEntity?.vcardArray, "fn");

  return {
    whoisEmail,
    whoisResponsible,
    domainRegistrar,
    domainCreatedAt: creationEvent?.eventDate ?? null,
  };
}
