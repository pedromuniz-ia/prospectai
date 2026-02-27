const maps = {
  leadStatus: {
    new: "Novo",
    enriched: "Qualificado",
    scored: "Pontuado",
    queued: "Na fila",
    contacted: "Contatado",
    replied: "Respondeu",
    interested: "Interessado",
    proposal: "Proposta",
    won: "Ganho",
    lost: "Perdido",
    blocked: "Bloqueado",
  },
  pipelineStage: {
    new: "Novo",
    approached: "Abordado",
    replied: "Respondeu",
    interested: "Interessado",
    proposal: "Proposta",
    won: "Ganho",
    lost: "Perdido",
  },
  campaignStatus: {
    draft: "Rascunho",
    active: "Ativa",
    paused: "Pausada",
    completed: "Concluída",
  },
  campaignObjective: {
    sell_website: "Vender Website",
    sell_ai_agent: "Vender Agente IA",
    sell_optimization: "Vender Otimização",
    sell_automation: "Vender Automação",
    custom: "Personalizado",
  },
  aiProvider: {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google Gemini",
    groq: "Groq",
    together: "Together AI",
    fireworks: "Fireworks AI",
    openai_compatible: "Custom (OpenAI Compatible)",
  },
  messageSource: {
    manual: "Manual",
    ai_auto: "IA (auto)",
    ai_approved: "IA (aprovada)",
    cadence: "Cadência",
    webhook: "WhatsApp",
  },
  scoringOperator: {
    eq: "é igual a",
    neq: "é diferente de",
    gt: "é maior que",
    lt: "é menor que",
    gte: "é pelo menos",
    lte: "é no máximo",
    in: "contém",
    not_in: "não contém",
  },
  scoringField: {
    hasWebsite: "Tem website",
    googleRating: "Avaliação Google",
    googleReviewCount: "Nº de avaliações",
    hasInstagram: "Tem Instagram",
    hasGoogleBusiness: "Tem Google Business",
    websiteStatus: "Status do website",
    hasSsl: "Tem SSL",
  },
  jobType: {
    apify_gmaps: "Google Maps",
    rdap_whois: "Verificação RDAP",
    website_check: "Verificação de Website",
  },
  jobStatus: {
    pending: "Pendente",
    running: "Em andamento",
    completed: "Concluído",
    failed: "Falhou",
  },
  instanceStatus: {
    disconnected: "Desconectado",
    connecting: "Conectando",
    connected: "Conectado",
    banned: "Banido",
  },
  notificationType: {
    lead_replied: "Lead respondeu",
    campaign_paused: "Campanha pausada",
    instance_disconnected: "Instância desconectada",
    ai_needs_review: "IA precisa de revisão",
    extraction_complete: "Extração concluída",
  },
  campaignLeadStatus: {
    pending: "Pendente",
    queued: "Na fila",
    sent: "Enviado",
    replied: "Respondeu",
    converted: "Convertido",
    rejected: "Rejeitado",
    skipped: "Ignorado",
  },
  messageStatus: {
    pending: "Pendente",
    sent: "Enviado",
    delivered: "Entregue",
    read: "Lido",
    failed: "Falhou",
  },
} as const;

export type TranslationDomain = keyof typeof maps;

export function t<D extends TranslationDomain>(
  domain: D,
  value: string
): string {
  const map = maps[domain] as Record<string, string>;
  return map[value] ?? value;
}

/** All entries for a given domain — useful for populating <Select> options */
export function entries<D extends TranslationDomain>(
  domain: D
): { value: string; label: string }[] {
  const map = maps[domain] as Record<string, string>;
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}

export function formatInterval(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? "s" : ""}`;
  }

  const hours = Math.floor(seconds / 3600);
  const remainingAfterHours = seconds % 3600;
  const minutes = Math.floor(remainingAfterHours / 60);
  const secs = remainingAfterHours % 60;

  if (hours > 0 && minutes === 0 && secs === 0) {
    return `${hours} hora${hours !== 1 ? "s" : ""}`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  if (secs === 0) {
    return `${minutes} minuto${minutes !== 1 ? "s" : ""}`;
  }

  return `${minutes} min ${secs}s`;
}

// Shorthand field labels for boolean scoring rules
const boolFieldShort: Record<string, { truthy: string; falsy: string }> = {
  hasWebsite: { truthy: "Tem website", falsy: "Sem website" },
  hasInstagram: { truthy: "Tem Instagram", falsy: "Sem Instagram" },
  hasGoogleBusiness: { truthy: "Tem Google Business", falsy: "Sem Google Business" },
  hasSsl: { truthy: "Tem SSL", falsy: "Sem SSL" },
};

export function formatScoringRule(rule: {
  field: string;
  operator: string;
  value: unknown;
  points: number;
}): string {
  const sign = rule.points >= 0 ? `+${rule.points}` : `${rule.points}`;

  // Boolean shorthand: "Sem website → +10 pts"
  if (
    boolFieldShort[rule.field] &&
    (rule.operator === "eq" || rule.operator === "neq")
  ) {
    const isTruthy =
      (rule.operator === "eq" && rule.value === true) ||
      (rule.operator === "neq" && rule.value === false);
    const label = isTruthy
      ? boolFieldShort[rule.field].truthy
      : boolFieldShort[rule.field].falsy;
    return `${label} → ${sign} pts`;
  }

  // Generic: "Avaliação Google é pelo menos 4 → +15 pts"
  const fieldLabel = t("scoringField", rule.field);
  const opLabel = t("scoringOperator", rule.operator);
  return `${fieldLabel} ${opLabel} ${String(rule.value)} → ${sign} pts`;
}
