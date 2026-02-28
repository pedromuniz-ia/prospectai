export type CNPJEnrichment = {
    legalName: string | null;
    foundingDate: string | null;
    capitalSocial: number | null;
    primaryCnae: string | null;
    partners: Array<{ name: string; role: string }> | null;
};

const emptyResult: CNPJEnrichment = {
    legalName: null,
    foundingDate: null,
    capitalSocial: null,
    primaryCnae: null,
    partners: null,
};

export async function enrichWithCNPJ(cnpjInput: string): Promise<CNPJEnrichment> {
    const cnpj = cnpjInput.replace(/\D/g, "");
    if (cnpj.length !== 14) return emptyResult;

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
            signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) return emptyResult;

        const data = await response.json();

        return {
            legalName: data.razao_social ?? null,
            foundingDate: data.data_inicio_atividade ?? null,
            capitalSocial: typeof data.capital_social === "number" ? data.capital_social : null,
            primaryCnae: data.cnae_fiscal_descricao ?? null,
            partners: Array.isArray(data.qsa)
                ? data.qsa.map((p: Record<string, string>) => ({
                    name: p.nome_socio || p.nome,
                    role: p.qualificacao_socio || "Sócio"
                }))
                : null,
        };
    } catch (error) {
        console.error("[CNPJ Enrichment Error]:", error);
        return emptyResult;
    }
}
