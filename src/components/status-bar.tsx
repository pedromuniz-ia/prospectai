"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getInstances } from "@/lib/actions/whatsapp";
import { Badge } from "@/components/ui/badge";

export function StatusBar() {
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [instanceLabel, setInstanceLabel] = useState("");
  const [dailyUsage, setDailyUsage] = useState("");
  const [extraInstances, setExtraInstances] = useState(0);

  const load = useCallback(async () => {
    if (!organizationId) return;

    const instances = await getInstances(organizationId);

    const connectedInstances = instances.filter((i) => i.status === "connected");
    if (connectedInstances.length === 0) {
      setInstanceLabel("");
      setDailyUsage("");
      setExtraInstances(0);
      return;
    }

    const first = connectedInstances[0];
    setInstanceLabel(first.phone ?? first.instanceName);

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

  if (!organizationId) return null;

  // Hide if no instance connected
  if (!instanceLabel) return null;

  return (
    <div className="shrink-0 overflow-x-auto border-b border-border bg-background px-4 py-2 text-xs">
      <div className="flex items-center gap-3 whitespace-nowrap text-muted-foreground md:gap-4">
        <span className="flex items-center gap-1.5">
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            {instanceLabel}
            {extraInstances > 0 && ` (+${extraInstances})`}
          </Badge>
        </span>
        <span>{dailyUsage}</span>
        <span className="hidden sm:inline">WhatsApp ativo</span>
      </div>
    </div>
  );
}
