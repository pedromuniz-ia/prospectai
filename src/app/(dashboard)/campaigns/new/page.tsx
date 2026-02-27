"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { CampaignWizard } from "@/components/campaign-wizard";

export default function NewCampaignPage() {
  const router = useRouter();
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  if (!organizationId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Crie ou selecione uma organização para continuar.
      </div>
    );
  }

  return (
    <div className="p-5 md:p-6">
      <CampaignWizard
        organizationId={organizationId}
        onCreated={() => router.push("/campaigns")}
      />
    </div>
  );
}
