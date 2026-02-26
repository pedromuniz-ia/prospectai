"use client";

import { useMemo, useState } from "react";
import { Bot, Send, Slash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/helpers";

type MessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  source: "manual" | "ai_auto" | "ai_approved" | "cadence" | "webhook" | null;
  createdAt: Date;
};

type TemplateRow = {
  id: string;
  shortcut: string;
  title: string;
  content: string;
};

const sourceLabel: Record<string, string> = {
  cadence: "cadência",
  ai_auto: "IA auto",
  ai_approved: "IA aprovada",
  manual: "manual",
  webhook: "webhook",
};

export function ChatView({
  messages,
  templates,
  aiSuggestion,
  onChangeSuggestion,
  onDismissSuggestion,
  onSend,
  onGenerate,
}: {
  messages: MessageRow[];
  templates: TemplateRow[];
  aiSuggestion: string;
  onChangeSuggestion: (value: string) => void;
  onDismissSuggestion: () => void;
  onSend: (content: string, source: "manual" | "ai_approved") => Promise<void>;
  onGenerate: () => Promise<void>;
}) {
  const [compose, setCompose] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  const history = [...messages].reverse();

  const shortcutQuery = compose.match(/\/([a-z0-9-]*)$/i)?.[1] ?? null;
  const filteredTemplates = useMemo(() => {
    if (shortcutQuery === null) return [];
    return templates
      .filter((template) => template.shortcut.includes(shortcutQuery.toLowerCase()))
      .slice(0, 6);
  }, [shortcutQuery, templates]);

  async function handleSend(content: string, source: "manual" | "ai_approved") {
    const payload = content.trim();
    if (!payload) return;

    setSending(true);
    try {
      await onSend(payload, source);
      if (source === "manual") {
        setCompose("");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await onGenerate();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {history.length === 0 ? (
          <div className="text-muted-foreground text-sm">Sem mensagens nesta conversa.</div>
        ) : (
          history.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-2xl border px-3 py-2",
                message.direction === "outbound"
                  ? "bg-primary/15 border-primary/35 ml-auto"
                  : "bg-card border-border/70"
              )}
            >
              <p className="text-sm leading-relaxed">{message.content}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{formatRelativeTime(message.createdAt)}</span>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {sourceLabel[message.source ?? "manual"] ?? message.source}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>

      {aiSuggestion && (
        <div className="border-t border-border/70 bg-card/70 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.09em] text-primary">
            <Bot className="h-3.5 w-3.5" />
            Sugestão IA
          </div>
          <Textarea
            value={aiSuggestion}
            onChange={(event) => onChangeSuggestion(event.target.value)}
            rows={3}
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => handleSend(aiSuggestion, "ai_approved")} disabled={sending}>
              Enviar
            </Button>
            <Button size="sm" variant="outline" onClick={onDismissSuggestion}>
              Pular
            </Button>
          </div>
        </div>
      )}

      <div className="border-t border-border/70 bg-card/70 p-3">
        <div className="relative">
          <Textarea
            value={compose}
            onChange={(event) => setCompose(event.target.value)}
            placeholder="Digite sua mensagem... (use /shortcut para snippets)"
            rows={3}
          />

          {filteredTemplates.length > 0 && (
            <div className="bg-popover absolute right-0 bottom-full left-0 mb-2 rounded-lg border p-1 shadow-md">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setCompose(template.content);
                  }}
                  className="hover:bg-accent flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left"
                >
                  <Slash className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium">/{template.shortcut}</p>
                    <p className="text-muted-foreground line-clamp-1 text-xs">
                      {template.title}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
            <Bot className="mr-2 h-4 w-4" />
            {generating ? "Gerando..." : "Gerar com IA"}
          </Button>

          <Button size="sm" onClick={() => handleSend(compose, "manual")} disabled={sending}>
            <Send className="mr-2 h-4 w-4" />
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
