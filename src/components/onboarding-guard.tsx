"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const activeOrg = authClient.useActiveOrganization();
  const { data: session } = authClient.useSession();

  const [checked, setChecked] = useState(false);
  const [needsOrg, setNeedsOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Wait for auth state to settle
    if (!session) return;
    if (activeOrg.isPending) return;

    if (activeOrg.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- needed to gate rendering until org is confirmed
      setChecked(true);
      return;
    }

    // No active org — check if user has any org and set first as active
    authClient.organization.list().then(({ data: orgs }) => {
      if (orgs && orgs.length > 0) {
        authClient.organization
          .setActive({ organizationId: orgs[0].id })
          .then(() => setChecked(true));
      } else {
        // Truly no org — show creation dialog
        setNeedsOrg(true);
        setChecked(true);
        // Pre-fill with user's name
        if (session.user?.name) {
          setOrgName(`${session.user.name}'s Workspace`);
        }
      }
    });
  }, [session, activeOrg.data, activeOrg.isPending]);

  async function handleCreateOrg() {
    if (!orgName.trim()) return;
    setCreating(true);
    setError("");

    const slug =
      orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" +
      Date.now();

    const result = await authClient.organization.create({
      name: orgName.trim(),
      slug,
    });

    if (result.error) {
      setError(result.error.message ?? "Erro ao criar workspace");
      setCreating(false);
      return;
    }

    setNeedsOrg(false);
    setCreating(false);
  }

  // Still loading
  if (!checked || activeOrg.isPending) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {children}
      <Dialog open={needsOrg} onOpenChange={() => {}}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="[&>button:last-child]:hidden"
        >
          <DialogHeader>
            <DialogTitle>Crie seu workspace</DialogTitle>
            <DialogDescription>
              Você precisa de um workspace para usar o ProspectAI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="org-name">Nome do workspace</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Minha Empresa"
                disabled={creating}
                onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
              />
            </div>
            <Button
              onClick={handleCreateOrg}
              disabled={creating || !orgName.trim()}
              className="w-full"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar workspace"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
