"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getConversations } from "@/lib/actions/messages";
import { getCampaigns } from "@/lib/actions/campaigns";
import { getInstances } from "@/lib/actions/whatsapp";
import { Badge } from "@/components/ui/badge";

export function StatusBar() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [unread, setUnread] = useState(0);
  const [needsReview, setNeedsReview] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [instanceLabel, setInstanceLabel] = useState("Nenhuma instância");
  const [dailyUsage, setDailyUsage] = useState("0/0 msgs");

  const load = useCallback(async () => {
    if (!organizationId) return;

    const [conversations, campaigns, instances] = await Promise.all([
      getConversations(organizationId, "all"),
      getCampaigns(organizationId),
      getInstances(organizationId),
    ]);

    setUnread(
      conversations.reduce((acc, row) => {
        return acc + row.unreadCount;
      }, 0)
    );

    setNeedsReview(
      conversations.reduce((acc, row) => {
        return acc + (row.needsHumanReview ? 1 : 0);
      }, 0)
    );

    setActiveCampaigns(campaigns.filter((campaign) => campaign.status === "active").length);

    const connected = instances.find((instance) => instance.status === "connected");
    if (!connected) {
      setInstanceLabel("Nenhuma instância");
      setDailyUsage("0/0 msgs");
      return;
    }

    setInstanceLabel(connected.phone ?? connected.instanceName);
    setDailyUsage(`${connected.dailyMessagesSent}/${connected.dailyMessageLimit} msgs`);
  }, [organizationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="flex flex-col gap-0.5 border-b border-border bg-background px-4 py-2 text-xs">
      <div className="flex items-center gap-4 text-muted-foreground">
        <span>
          <strong className="text-foreground">{unread}</strong> não lidas
        </span>
        <span>
          <strong className="text-foreground">{needsReview}</strong> aguardam revisão
        </span>
        <span>
          <strong className="text-foreground">{activeCampaigns}</strong> campanhas ativas
        </span>
      </div>
      <div className="flex items-center gap-4 text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            {instanceLabel}
          </Badge>
        </span>
        <span>{dailyUsage}</span>
        <span>entrega monitorada</span>
      </div>
    </div>
  );
}
