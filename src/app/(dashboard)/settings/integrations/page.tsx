"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Key,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  generateApiKey,
  getApiKeyInfo,
  revokeApiKey,
} from "@/lib/actions/api-keys";
import { ConfirmDialog, LoadingButton } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type KeyInfo = Awaited<ReturnType<typeof getApiKeyInfo>>;

export default function IntegrationsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [keyInfo, setKeyInfo] = useState<KeyInfo>(undefined);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadKey = useCallback(async () => {
    if (!organizationId) return;
    const info = await getApiKeyInfo(organizationId);
    setKeyInfo(info);
  }, [organizationId]);

  useEffect(() => {
    loadKey();
  }, [loadKey]);

  async function handleGenerate() {
    if (!organizationId) return;
    setGenerating(true);
    try {
      const result = await generateApiKey(organizationId);
      setRevealedKey(result.key);
      setCopied(false);
      await loadKey();
      toast.success("Chave gerada com sucesso");
    } catch {
      toast.error("Erro ao gerar chave");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    if (!organizationId) return;
    await revokeApiKey(organizationId);
    setKeyInfo(undefined);
    setRevealedKey(null);
    toast.success("Chave revogada");
  }

  function handleCopy() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    toast.success("Chave copiada");
    setTimeout(() => setCopied(false), 2000);
  }

  if (!organizationId) return null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">
          Use a API key para integrar com n8n, Zapier ou qualquer ferramenta externa.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">API Key</h3>
        </div>

        {/* Existing key display */}
        {keyInfo && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{keyInfo.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {keyInfo.keyPrefix}{"••••••••••••••••••••••••••••"}
                </p>
              </div>
              <ConfirmDialog
                title="Revogar API Key?"
                description="A chave atual será permanentemente invalidada. Qualquer integração usando esta chave parará de funcionar."
                onConfirm={handleRevoke}
                destructive
              >
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Revogar
                </Button>
              </ConfirmDialog>
            </div>
            {keyInfo.lastUsedAt && (
              <p className="text-xs text-muted-foreground">
                Último uso: {new Date(keyInfo.lastUsedAt).toLocaleString("pt-BR")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Criada em: {keyInfo.createdAt ? new Date(keyInfo.createdAt).toLocaleString("pt-BR") : "—"}
            </p>
          </div>
        )}

        {/* Revealed key (one-time display) */}
        {revealedKey && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <p className="text-xs font-medium text-amber-400">
              Copie esta chave agora. Ela não será exibida novamente.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-xs break-all select-all">
                {revealedKey}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Generate button */}
        <LoadingButton onClick={handleGenerate} loading={generating}>
          <Key className="mr-1.5 h-4 w-4" />
          {keyInfo ? "Gerar nova chave" : "Gerar chave"}
        </LoadingButton>

        {keyInfo && (
          <p className="text-xs text-muted-foreground">
            Gerar uma nova chave revoga a anterior automaticamente.
          </p>
        )}
      </Card>

      {/* Usage instructions */}
      <Card className="p-6 space-y-3">
        <h3 className="font-medium">Como usar</h3>
        <p className="text-sm text-muted-foreground">
          Use a API key para acessar seus leads via REST API. Compatível com n8n, Zapier, Make e qualquer cliente HTTP.
        </p>
        <div className="rounded-lg bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Endpoint</p>
          <code className="block text-xs font-mono">GET /api/v1/leads</code>
        </div>
        <div className="rounded-lg bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Header</p>
          <code className="block text-xs font-mono">
            Authorization: Bearer pak_sua_chave_aqui
          </code>
        </div>
        <div className="rounded-lg bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Parâmetros (query string)</p>
          <div className="text-xs text-muted-foreground space-y-1 font-mono">
            <p>min_score=60</p>
            <p>max_score=100</p>
            <p>has_whatsapp=true</p>
            <p>has_website=true</p>
            <p>classification=needs_website,needs_optimization</p>
            <p>status=enriched,scored</p>
            <p>since=2025-01-01</p>
            <p>limit=100 (max 500)</p>
            <p>offset=0</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
