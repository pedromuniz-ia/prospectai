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
  CommandShortcut,
} from "@/components/ui/command";
import { authClient } from "@/lib/auth-client";
import { searchLeadsQuick } from "@/lib/actions/leads";
import { Rocket, Search, Settings, Sparkles, Users } from "lucide-react";

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
        icon: Sparkles,
        action: () => router.push("/settings/whatsapp"),
      },
    ],
    [router]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
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
              setOpen(false);
              router.push("/inbox");
            }}
          >
            <Sparkles className="h-4 w-4" />
            Ir para Inbox
            <CommandShortcut>G I</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              router.push("/leads");
            }}
          >
            <Users className="h-4 w-4" />
            Ir para Leads
            <CommandShortcut>G L</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              router.push("/settings");
            }}
          >
            <Settings className="h-4 w-4" />
            Ir para Configurações
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações rápidas">
          {actions.map((action) => (
            <CommandItem
              key={action.label}
              onSelect={() => {
                setOpen(false);
                action.action();
              }}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Leads">
          {leads.map((lead) => (
            <CommandItem
              key={lead.id}
              onSelect={() => {
                setOpen(false);
                router.push(`/leads?leadId=${lead.id}`);
              }}
            >
              <Users className="h-4 w-4" />
              {lead.name}
              <CommandShortcut>{lead.score}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
