"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PanelRight, SkipForward } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxPageContent />
    </Suspense>
  );
}

function InboxSkeleton() {
  return (
    <div className="h-full p-4">
      <Card className="flex h-full overflow-hidden border-border/70 bg-card/70">
        <div className="hidden xl:block w-80 border-r border-border/70 p-3 space-y-3">
          <div className="h-8 rounded-md bg-muted animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-md bg-muted/50 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="border-b border-border/70 px-4 py-3">
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
            <div className="mt-1.5 h-3.5 w-56 rounded bg-muted/50 animate-pulse" />
          </div>
          <div className="flex-1 p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`h-12 rounded-xl bg-muted/40 animate-pulse ${i % 2 === 0 ? "w-3/5 ml-auto" : "w-2/3"}`}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
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
  const [contextOpen, setContextOpen] = useState(false);

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

  function handleSelectNext() {
    const currentIndex = conversations.findIndex(
      (conversation) => conversation.leadId === selectedLeadId
    );
    const nextConversation = conversations[currentIndex + 1] ?? conversations[0];
    if (nextConversation) setLeadInUrl(nextConversation.leadId);
  }

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.leadId === selectedLeadId),
    [conversations, selectedLeadId]
  );

  return (
    <div className="relative h-full overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(59,130,246,.13),transparent_40%),radial-gradient(circle_at_90%_15%,rgba(16,185,129,.11),transparent_36%)]" />

      <Card className="relative flex h-full overflow-hidden border-border/70 bg-card/70 backdrop-blur-sm">
        {/* Left: conversation list */}
        <ConversationList
          rows={conversations}
          selectedLeadId={selectedLeadId}
          filter={filter}
          onFilterChange={setFilter}
          onSelect={(leadId) => setLeadInUrl(leadId)}
        />

        {/* Center: chat */}
        <div className="flex h-full min-w-0 flex-1 flex-col bg-card/30">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {selectedConversation?.leadName ?? "Selecione uma conversa"}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedConversation
                  ? `${selectedConversation.score} pts · ${selectedConversation.lastMessage.relative}`
                  : "Fila priorizada por score + recência"}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {conversations.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleSelectNext}
                  title="Próxima conversa"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="xl:hidden"
                onClick={() => setContextOpen(true)}
                title="Ver detalhes do lead"
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-12 rounded-xl bg-muted/40 animate-pulse ${i % 2 === 0 ? "w-3/5 ml-auto" : "w-2/3"}`}
                />
              ))}
            </div>
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

        {/* Right: lead context — inline on xl, Sheet below */}
        <aside className="hidden xl:block w-72 shrink-0">
          <LeadContext data={context} onStageChange={handleStageChange} />
        </aside>

        <Sheet open={contextOpen} onOpenChange={setContextOpen}>
          <SheetContent side="right" className="w-[85vw] max-w-md p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border/70 px-4 py-3">
              <SheetTitle>Detalhes do lead</SheetTitle>
            </SheetHeader>
            <LeadContext data={context} onStageChange={handleStageChange} />
          </SheetContent>
        </Sheet>
      </Card>
    </div>
  );
}
