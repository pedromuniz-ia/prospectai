"use client";

import { Building2, ShieldAlert, Users } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function GeneralSettingsPage() {
  const activeOrg = authClient.useActiveOrganization();
  const organization = activeOrg.data;

  return (
    <div className="space-y-4 p-6">
      <Card className="border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold">Configurações gerais</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Informações da organização e governança de acesso.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Nome da organização
            </Label>
            <Input value={organization?.name ?? ""} readOnly />
          </div>
          <div>
            <Label className="mb-1 inline-flex text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Slug
            </Label>
            <Input value={organization?.slug ?? ""} readOnly />
          </div>
        </div>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Convites de equipe</h2>
          <Badge variant="outline">MVP</Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Convites da organização via Better Auth (fluxo de convite pode ser integrado aqui).
        </p>

        <div className="mt-3 flex gap-2">
          <Input placeholder="email@empresa.com" />
          <Button variant="outline">Enviar convite</Button>
        </div>
      </Card>

      <Card className="border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-4 w-4" />
          <h2 className="text-base font-semibold">Danger zone</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Exclusão da organização remove campanhas, leads e histórico de mensagens.
        </p>
        <Button className="mt-3" variant="destructive" disabled>
          Excluir organização (bloqueado no MVP)
        </Button>
      </Card>
    </div>
  );
}
