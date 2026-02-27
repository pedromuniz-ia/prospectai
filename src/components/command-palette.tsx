"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";
import { searchLeadsQuick } from "@/lib/actions/leads";
import { MessageSquare, Rocket, Search, Settings, Smartphone, Users } from "lucide-react";

export function CommandPalette() {
  const router = useRouter();
  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Awaited<ReturnType<typeof searchLeadsQuick>>>([]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    if (!query.trim()) return;

    const timeout = setTimeout(async () => {
      const result = await searchLeadsQuick(organizationId, query, 10);
      setLeads(result);
    }, 180);

    return () => clearTimeout(timeout);
  }, [organizationId, query]);

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      // Reset state when dialog closes
      setQuery("");
      setLeads([]);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setLeads([]);
    }
  }

  const actions = useMemo(
    () => [
      {
        label: "Nova extração",
        icon: Search,
        action: () => router.push("/extraction"),
      },
      {
        label: "Criar campanha",
        icon: Rocket,
        action: () => router.push("/campaigns/new"),
      },
      {
        label: "Conectar WhatsApp",
        icon: Smartphone,
        action: () => router.push("/settings/whatsapp"),
      },
    ],
    [router]
  );

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Buscar lead, navegar ou executar ação..."
        value={query}
        onValueChange={handleQueryChange}
      />
      <CommandList>
        <CommandEmpty>Sem resultados.</CommandEmpty>

        <CommandGroup heading="Navegação">
          <CommandItem
            onSelect={() => {
              handleOpenChange(false);
              router.push("/inbox");
            }}
          >
            <MessageSquare className="h-4 w-4" />
            Ir para Inbox
          </CommandItem>
          <CommandItem
            onSelect={() => {
              handleOpenChange(false);
              router.push("/leads");
            }}
          >
            <Users className="h-4 w-4" />
            Ir para Leads
          </CommandItem>
          <CommandItem
            onSelect={() => {
              handleOpenChange(false);
              router.push("/settings/general");
            }}
          >
            <Settings className="h-4 w-4" />
            Ir para Configurações
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações rápidas">
          {actions.map((action) => (
            <CommandItem
              key={action.label}
              onSelect={() => {
                handleOpenChange(false);
                action.action();
              }}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {leads.length > 0 && (
          <>
            <CommandSeparator />

            <CommandGroup heading="Leads">
              {leads.map((lead) => (
                <CommandItem
                  key={lead.id}
                  onSelect={() => {
                    handleOpenChange(false);
                    router.push(`/leads?leadId=${lead.id}`);
                  }}
                >
                  <Users className="h-4 w-4" />
                  <span className="flex-1">{lead.name}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {lead.score} pts
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
