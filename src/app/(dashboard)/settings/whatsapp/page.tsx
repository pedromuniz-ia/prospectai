"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import {
  getInstances,
  connectInstance,
  disconnectInstance,
  deleteInstance,
  refreshInstanceStatus,
} from "@/lib/actions/whatsapp";
import {
  ConfirmDialog,
  EmptyState,
  FormField,
  LoadingButton,
  StatusBadge,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Smartphone,
  Plus,
  RefreshCw,
  Trash2,
  LogOut,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

type Instance = Awaited<ReturnType<typeof getInstances>>[number];

export default function WhatsAppSettingsPage() {
  const { data: session } = authClient.useSession();
  const activeOrg = authClient.useActiveOrganization();

  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pollingInstanceId, setPollingInstanceId] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState(25);

  const orgId = activeOrg.data?.id;

  const loadInstances = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await getInstances(orgId);
      setInstances(data);
    } catch {
      toast.error("Erro ao carregar instâncias");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  // QR code countdown timer
  useEffect(() => {
    if (!qrCode) return;
    setQrCountdown(25);
    const timer = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [qrCode]);

  // Poll for QR code connection
  useEffect(() => {
    if (!pollingInstanceId) return;

    const interval = setInterval(async () => {
      try {
        const status = await refreshInstanceStatus(pollingInstanceId);
        if (status === "connected") {
          setPollingInstanceId(null);
          setQrCode(null);
          setConnectDialogOpen(false);
          setNewInstanceName("");
          toast.success("WhatsApp conectado!");
          loadInstances();
        } else {
          loadInstances();
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingInstanceId, loadInstances]);

  async function handleConnect() {
    if (!orgId || !newInstanceName.trim()) return;

    setConnecting(true);
    try {
      const instance = await connectInstance(orgId, newInstanceName.trim());
      if (instance.qrCode) {
        setQrCode(instance.qrCode);
        setPollingInstanceId(instance.id);
      }
      await loadInstances();
      toast.success("Instância criada — escaneie o QR Code");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao conectar instância"
      );
    } finally {
      setConnecting(false);
    }
  }

  async function handleRegenerateQr() {
    if (!pollingInstanceId || !orgId) return;
    setConnecting(true);
    try {
      const instance = await connectInstance(orgId, newInstanceName.trim());
      if (instance.qrCode) {
        setQrCode(instance.qrCode);
      }
    } catch {
      toast.error("Erro ao gerar novo QR Code");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(instanceId: string) {
    try {
      await disconnectInstance(instanceId);
      toast.success("Instância desconectada");
      loadInstances();
    } catch {
      toast.error("Erro ao desconectar");
    }
  }

  async function handleDelete(instanceId: string) {
    await deleteInstance(instanceId);
    toast.success("Instância removida");
    loadInstances();
  }

  async function handleRefresh(instanceId: string) {
    try {
      await refreshInstanceStatus(instanceId);
      loadInstances();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas instâncias do WhatsApp
          </p>
        </div>

        <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Conectar número
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conectar WhatsApp</DialogTitle>
            </DialogHeader>

            {qrCode ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <Image
                  src={
                    qrCode.startsWith("data:")
                      ? qrCode
                      : `data:image/png;base64,${qrCode}`
                  }
                  alt="QR Code"
                  width={256}
                  height={256}
                  className="h-64 w-64 rounded-lg"
                  unoptimized
                />
                <p className="text-center text-sm text-muted-foreground">
                  Abra o WhatsApp no celular e escaneie o QR Code
                </p>
                {qrCountdown > 0 ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Expira em {qrCountdown}s
                  </div>
                ) : (
                  <LoadingButton
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateQr}
                  >
                    Gerar novo QR
                  </LoadingButton>
                )}
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <FormField
                  label="Nome da instância"
                  htmlFor="instance-name"
                  helper="Dê um nome para identificar este número. Ex: Comercial, Suporte"
                >
                  <Input
                    id="instance-name"
                    placeholder="ex: comercial-01"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    disabled={connecting}
                  />
                </FormField>
                <LoadingButton
                  onClick={handleConnect}
                  disabled={!newInstanceName.trim()}
                  loading={connecting}
                  className="w-full"
                >
                  Gerar QR Code
                </LoadingButton>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : instances.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="Nenhuma instância conectada"
          description="Conecte um número de WhatsApp para enviar mensagens automaticamente."
          action={{
            label: "Conectar número",
            onClick: () => setConnectDialogOpen(true),
          }}
        />
      ) : (
        <div className="space-y-3">
          {instances.map((instance) => {
            const usagePercent =
              instance.dailyMessageLimit > 0
                ? Math.round(
                    (instance.dailyMessagesSent / instance.dailyMessageLimit) * 100
                  )
                : 0;

            return (
              <Card
                key={instance.id}
                className="p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {instance.instanceName}
                        </p>
                        <StatusBadge domain="instanceStatus" value={instance.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {instance.phone ?? "Sem número"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRefresh(instance.id)}
                      title="Atualizar status"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>

                    {instance.status === "connected" ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDisconnect(instance.id)}
                        title="Desconectar"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    ) : (
                      <ConfirmDialog
                        title="Remover instância"
                        description={`Deseja remover "${instance.instanceName}"? Esta ação não pode ser desfeita.`}
                        confirmText="Remover"
                        destructive
                        onConfirm={() => handleDelete(instance.id)}
                      >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Remover instância"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </ConfirmDialog>
                    )}
                  </div>
                </div>

                {/* Daily usage bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Uso diário</span>
                    <span>
                      {instance.dailyMessagesSent}/{instance.dailyMessageLimit} msgs
                    </span>
                  </div>
                  <Progress value={usagePercent} className="h-1.5" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
