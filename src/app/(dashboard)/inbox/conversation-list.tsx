"use client";

import { useState } from "react";
import { Circle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ds";
import { cn } from "@/lib/utils";

type ConversationRow = {
  leadId: string;
  leadName: string;
  score: number;
  status: string;
  unreadCount: number;
  needsHumanReview: boolean;
  lastMessage: {
    content: string;
    direction: "inbound" | "outbound";
    relative: string;
  };
};

type FilterValue = "needs_action" | "all" | "unread" | "awaiting_ai" | "needs_review";

const filters: { key: FilterValue; label: string }[] = [
  { key: "needs_action", label: "Precisa ação" },
  { key: "all", label: "Todas" },
  { key: "unread", label: "Não lidas" },
  { key: "awaiting_ai", label: "IA pendente" },
];

function toneByConversation(conversation: ConversationRow) {
  if (conversation.needsHumanReview) return "text-amber-300";
  if (conversation.lastMessage.direction === "inbound") return "text-emerald-300";
  if (conversation.status === "lost") return "text-red-300";
  return "text-zinc-300";
}

export function ConversationList({
  rows,
  selectedLeadId,
  filter,
  onFilterChange,
  onSelect,
}: {
  rows: ConversationRow[];
  selectedLeadId: string | null;
  filter: FilterValue;
  onFilterChange: (filter: FilterValue) => void;
  onSelect: (leadId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredRows = search.trim()
    ? rows.filter((row) =>
        row.leadName.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <div className="flex h-full flex-col border-r border-border/70 bg-card/50">
      <div className="border-b border-border/70 p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="grid grid-cols-2 gap-1">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onFilterChange(item.key)}
              className={cn(
                "rounded-md px-2 py-1 text-left text-xs transition-colors",
                filter === item.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredRows.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">Sem conversas neste filtro.</div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredRows.map((row) => (
              <button
                key={row.leadId}
                type="button"
                onClick={() => onSelect(row.leadId)}
                aria-label={`Conversa com ${row.leadName}`}
                className={cn(
                  "w-full px-3 py-3 text-left transition-colors hover:bg-muted/40",
                  selectedLeadId === row.leadId && "bg-primary/10"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-medium">{row.leadName}</p>
                  <StatusBadge domain="leadStatus" value={row.status} />
                </div>

                <p className={cn("mt-1 line-clamp-1 text-xs", toneByConversation(row))}>
                  {row.lastMessage.content}
                </p>

                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{row.lastMessage.relative}</span>
                  <div className="flex items-center gap-1">
                    {row.unreadCount > 0 && (
                      <>
                        <Circle className="h-2 w-2 fill-current" />
                        {row.unreadCount}
                      </>
                    )}
                    {row.needsHumanReview && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        revisão
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
