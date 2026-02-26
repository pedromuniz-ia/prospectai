"use client";

import { Download, Link2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { exportOrganizationData } from "@/lib/actions/advanced";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdvancedSettingsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const webhookUrl = `${appUrl}/api/webhooks/evolution`;

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
          <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">Webhook Evolution API</Label>
          <Input readOnly value={webhookUrl} />
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
        <Button className="mt-3" onClick={handleExport}>
          Baixar export
        </Button>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Token Apify</h2>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure `APIFY_TOKEN` no ambiente de runtime (`.env.local` / produção) para extração.
        </p>
        <Input readOnly value={process.env.APIFY_TOKEN ? "Configurado" : "Não configurado"} />
      </Card>
    </div>
  );
}
