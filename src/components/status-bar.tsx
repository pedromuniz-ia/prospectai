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
  const [instanceLabel, setInstanceLabel] = useState("");
  const [dailyUsage, setDailyUsage] = useState("");
  const [extraInstances, setExtraInstances] = useState(0);

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

    const connectedInstances = instances.filter((i) => i.status === "connected");
    if (connectedInstances.length === 0) {
      setInstanceLabel("");
      setDailyUsage("");
      setExtraInstances(0);
      return;
    }

    const first = connectedInstances[0];
    setInstanceLabel(first.phone ?? first.instanceName);

    // Consolidated usage across all connected instances
    const totalSent = connectedInstances.reduce((sum, i) => sum + i.dailyMessagesSent, 0);
    const totalLimit = connectedInstances.reduce((sum, i) => sum + i.dailyMessageLimit, 0);
    setDailyUsage(`${totalSent}/${totalLimit} msgs`);
    setExtraInstances(connectedInstances.length - 1);
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

  // Hide status bar when no organization is selected
  if (!organizationId) return null;

  return (
    <div className="shrink-0 overflow-x-auto border-b border-border bg-background px-4 py-2 text-xs">
      <div className="flex items-center gap-3 whitespace-nowrap text-muted-foreground md:gap-4">
        <span>
          <strong className="text-foreground">{unread}</strong> não lidas
        </span>
        <span>
          <strong className="text-foreground">{needsReview}</strong> aguardam revisão
        </span>
        <span>
          <strong className="text-foreground">{activeCampaigns}</strong> campanhas ativas
        </span>
        {instanceLabel && (
          <>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                {instanceLabel}
                {extraInstances > 0 && ` (+${extraInstances})`}
              </Badge>
            </span>
            <span>{dailyUsage}</span>
            <span className="hidden sm:inline">WhatsApp ativo</span>
          </>
        )}
      </div>
    </div>
  );
}
