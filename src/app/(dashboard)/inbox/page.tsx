"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  generateAiReplySuggestion,
  getConversations,
  getLeadConversationContext,
  getMessages,
  markAsRead,
  sendMessage,
  updateConversationStage,
} from "@/lib/actions/messages";
import { getTemplates } from "@/lib/actions/templates";
import { ConversationList } from "@/app/(dashboard)/inbox/conversation-list";
import { ChatView } from "@/app/(dashboard)/inbox/chat-view";
import { LeadContext } from "@/app/(dashboard)/inbox/lead-context";
import { Card } from "@/components/ui/card";

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Carregando Inbox...</div>}>
      <InboxPageContent />
    </Suspense>
  );
}

function InboxPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeOrg = authClient.useActiveOrganization();
  const organizationId = activeOrg.data?.id;

  const [filter, setFilter] = useState<"needs_action" | "all" | "unread" | "awaiting_ai" | "needs_review">("needs_action");
  const [conversations, setConversations] = useState<Awaited<ReturnType<typeof getConversations>>>([]);
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof getMessages>>>([]);
  const [context, setContext] = useState<Awaited<ReturnType<typeof getLeadConversationContext>> | null>(null);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof getTemplates>>>([]);
  const [loading, setLoading] = useState(true);
  const [aiSuggestion, setAiSuggestion] = useState("");

  const selectedLeadId = searchParams.get("leadId");

  const setLeadInUrl = useCallback(
    (leadId: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!leadId) next.delete("leadId");
      else next.set("leadId", leadId);
      router.replace(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const loadConversations = useCallback(async () => {
    if (!organizationId) return;

    const rows = await getConversations(organizationId, filter);
    setConversations(rows);

    if (!selectedLeadId && rows[0]) {
      setLeadInUrl(rows[0].leadId);
    }
  }, [filter, organizationId, selectedLeadId, setLeadInUrl]);

  const loadSelectedConversation = useCallback(async () => {
    if (!selectedLeadId) {
      setMessages([]);
      setContext(null);
      return;
    }

    const [messageRows, contextData] = await Promise.all([
      getMessages(selectedLeadId),
      getLeadConversationContext(selectedLeadId),
    ]);

    setMessages(messageRows);
    setContext(contextData);

    await markAsRead(selectedLeadId);
  }, [selectedLeadId]);

  const loadTemplates = useCallback(async () => {
    if (!organizationId) return;
    const rows = await getTemplates(organizationId);
    setTemplates(rows);
  }, [organizationId]);

  const fullLoad = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadConversations(), loadTemplates()]);
      await loadSelectedConversation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar Inbox");
    } finally {
      setLoading(false);
    }
  }, [loadConversations, loadSelectedConversation, loadTemplates]);

  useEffect(() => {
    fullLoad();
  }, [fullLoad]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      loadSelectedConversation();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadConversations, loadSelectedConversation]);

  async function handleSend(content: string, source: "manual" | "ai_approved") {
    if (!selectedLeadId) return;

    await sendMessage({
      leadId: selectedLeadId,
      content,
      source,
    });

    if (source === "ai_approved") {
      setAiSuggestion("");
    }

    await loadSelectedConversation();
    await loadConversations();
  }

  async function handleGenerate() {
    if (!selectedLeadId) return;

    const result = await generateAiReplySuggestion(selectedLeadId);
    setAiSuggestion(result.text);
  }

  async function handleStageChange(stage: "interested" | "proposal" | "won" | "lost") {
    if (!context?.campaignContext?.campaignLeadId) return;

    await updateConversationStage(context.campaignContext.campaignLeadId, stage);
    toast.success("Pipeline atualizado.");

    await loadSelectedConversation();
    await loadConversations();
  }

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.leadId === selectedLeadId),
    [conversations, selectedLeadId]
  );

  return (
    <div className="relative h-full overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(59,130,246,.13),transparent_40%),radial-gradient(circle_at_90%_15%,rgba(16,185,129,.11),transparent_36%)]" />

      <Card className="relative grid h-full grid-cols-1 overflow-hidden border-border/70 bg-card/70 backdrop-blur-sm xl:grid-cols-[20rem_1fr_18rem]">
        <ConversationList
          rows={conversations}
          selectedLeadId={selectedLeadId}
          filter={filter}
          onFilterChange={setFilter}
          onSelect={(leadId) => setLeadInUrl(leadId)}
          onSelectNext={() => {
            const currentIndex = conversations.findIndex(
              (conversation) => conversation.leadId === selectedLeadId
            );
            const nextConversation = conversations[currentIndex + 1] ?? conversations[0];
            if (nextConversation) setLeadInUrl(nextConversation.leadId);
          }}
        />

        <div className="flex h-full flex-col bg-card/30">
          <div className="border-b border-border/70 px-4 py-3">
            <p className="text-sm font-semibold">
              {selectedConversation?.leadName ?? "Selecione uma conversa"}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedConversation
                ? `${selectedConversation.score} pts · ${selectedConversation.lastMessage.relative}`
                : "Fila priorizada por score + recência"}
            </p>
          </div>

          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Carregando conversa...</div>
          ) : (
            <ChatView
              messages={messages}
              templates={templates}
              aiSuggestion={aiSuggestion}
              onChangeSuggestion={setAiSuggestion}
              onDismissSuggestion={() => setAiSuggestion("")}
              onSend={handleSend}
              onGenerate={handleGenerate}
            />
          )}
        </div>

        <LeadContext data={context} onStageChange={handleStageChange} />
      </Card>
    </div>
  );
}
