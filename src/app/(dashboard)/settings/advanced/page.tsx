"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Download, Link2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { checkApifyTokenStatus, exportOrganizationData } from "@/lib/actions/advanced";
import { FormField, LoadingButton } from "@/components/ds";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdvancedSettingsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const webhookUrl = `${appUrl}/api/webhooks/evolution`;

  const [apifyConfigured, setApifyConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    checkApifyTokenStatus().then((result) => setApifyConfigured(result.configured));
  }, []);

  async function handleCopyWebhook() {
    await navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada para a área de transferência.");
  }

  async function handleExport() {
    if (!organizationId) return;

    const payload = await exportOrganizationData(organizationId);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prospectai-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();

    URL.revokeObjectURL(url);
    toast.success("Export gerado.");
  }

  return (
    <div className="space-y-4 p-6">
      <Card className="border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold">Avançado</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Webhooks, export de dados e parâmetros operacionais.
        </p>

        <div className="mt-4">
          <FormField label="Webhook Evolution API" helper="Configure esta URL no painel da Evolution API para receber mensagens.">
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <LoadingButton variant="outline" size="icon" onClick={handleCopyWebhook} title="Copiar URL">
                <Copy className="h-4 w-4" />
              </LoadingButton>
            </div>
          </FormField>
        </div>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Exportar dados</h2>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Export completo (JSON) para backup ou auditoria.
        </p>
        <LoadingButton className="mt-3" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Baixar export
        </LoadingButton>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Token Apify</h2>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Necessário para extração de leads via Google Maps. Configure no ambiente de deploy.
        </p>
        <div className="mt-3">
          {apifyConfigured === null ? (
            <Badge variant="outline">Verificando...</Badge>
          ) : apifyConfigured ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Configurado
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Não configurado
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}
