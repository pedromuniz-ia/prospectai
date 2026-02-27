"use client";

import { Building2, Info, Lock, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { ConfirmDialog, FormField } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
          <FormField label="Nome da organização">
            <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/50 px-3">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">{organization?.name ?? "—"}</span>
            </div>
          </FormField>
          <FormField label="Identificador">
            <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/50 px-3">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">{organization?.slug ?? "—"}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Identificador único da organização, usado em URLs internas.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </FormField>
        </div>
      </Card>

      <Card className="border-border/70 bg-card/75 p-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Convites de equipe</h2>
        </div>
        <div className="mt-3 rounded-lg border border-dashed border-border/70 p-6 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">Em breve</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Convites de equipe e controle de acesso estarão disponíveis em uma atualização futura.
          </p>
        </div>
      </Card>

      <Card className="border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-4 w-4" />
          <h2 className="text-base font-semibold">Zona de risco</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Exclusão da organização remove campanhas, leads e histórico de mensagens. Esta ação é irreversível.
        </p>
        <ConfirmDialog
          title="Excluir organização"
          description={`Digite "${organization?.name ?? ""}" para confirmar a exclusão permanente.`}
          confirmText="Excluir permanentemente"
          destructive
          onConfirm={async () => {
            toast.error("Funcionalidade ainda não disponível.");
          }}
        >
          <Button className="mt-3" variant="destructive">
            Excluir organização
          </Button>
        </ConfirmDialog>
      </Card>
    </div>
  );
}
