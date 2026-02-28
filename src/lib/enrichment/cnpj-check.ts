export type CNPJEnrichment = {
    legalName: string | null;
    foundingDate: string | null;
    capitalSocial: number | null;
    primaryCnae: string | null;
    partners: Array<{ name: string; role: string }> | null;
};

const EMPTY_RESULT: CNPJEnrichment = {
    legalName: null,
    foundingDate: null,
    capitalSocial: null,
    primaryCnae: null,
    partners: null,
};

const CNPJ_LENGTH = 14;
const BRASIL_API_URL = "https://brasilapi.com.br/api/cnpj/v1";
const REQUEST_TIMEOUT_MS = 10_000;

interface BrasilAPIPartner {
    nome_socio?: string;
    nome?: string;
    qualificacao_socio?: string;
}

function sanitizeCNPJ(input: string): string {
    return input.replace(/\D/g, "");
}

function parsePartners(qsa: unknown): CNPJEnrichment["partners"] {
    if (!Array.isArray(qsa)) return null;

    return qsa.map((p: BrasilAPIPartner) => ({
        name: p.nome_socio || p.nome || "",
        role: p.qualificacao_socio || "Sócio",
    }));
}

function parseResponse(data: Record<string, unknown>): CNPJEnrichment {
    return {
        legalName: (data.razao_social as string) ?? null,
        foundingDate: (data.data_inicio_atividade as string) ?? null,
        capitalSocial: typeof data.capital_social === "number" ? data.capital_social : null,
        primaryCnae: (data.cnae_fiscal_descricao as string) ?? null,
        partners: parsePartners(data.qsa),
    };
}

export async function enrichWithCNPJ(cnpjInput: string): Promise<CNPJEnrichment> {
    const cnpj = sanitizeCNPJ(cnpjInput);
    if (cnpj.length !== CNPJ_LENGTH) return EMPTY_RESULT;

    try {
        const response = await fetch(`${BRASIL_API_URL}/${cnpj}`, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!response.ok) return EMPTY_RESULT;

        const data = await response.json();
        return parseResponse(data);
    } catch (error) {
        console.error("[CNPJ Enrichment Error]:", error);
        return EMPTY_RESULT;
    }
}
