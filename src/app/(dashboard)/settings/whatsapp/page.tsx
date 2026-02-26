"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import {
  getInstances,
  connectInstance,
  disconnectInstance,
  deleteInstance,
  refreshInstanceStatus,
} from "@/lib/actions/whatsapp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

type Instance = Awaited<ReturnType<typeof getInstances>>[number];

const statusConfig = {
  connected: { label: "Conectado", variant: "default" as const, icon: Wifi },
  connecting: { label: "Conectando", variant: "secondary" as const, icon: Loader2 },
  disconnected: { label: "Desconectado", variant: "outline" as const, icon: WifiOff },
  banned: { label: "Banido", variant: "destructive" as const, icon: WifiOff },
} as const;

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
          // Refresh instances to get updated QR code
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
    try {
      await deleteInstance(instanceId);
      toast.success("Instância removida");
      loadInstances();
    } catch {
      toast.error("Erro ao remover");
    }
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aguardando conexão...
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="instance-name">Nome da instância</Label>
                  <Input
                    id="instance-name"
                    placeholder="ex: prospectai-01"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    disabled={connecting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificador único para esta conexão
                  </p>
                </div>
                <Button
                  onClick={handleConnect}
                  disabled={connecting || !newInstanceName.trim()}
                  className="w-full"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Gerar QR Code"
                  )}
                </Button>
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
        <Card className="flex flex-col items-center gap-3 py-12">
          <Smartphone className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma instância conectada
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {instances.map((instance) => {
            const config = statusConfig[instance.status as keyof typeof statusConfig] ??
              statusConfig.disconnected;
            const StatusIcon = config.icon;

            return (
              <Card
                key={instance.id}
                className="flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <StatusIcon
                    className={`h-5 w-5 ${
                      instance.status === "connected"
                        ? "text-green-500"
                        : instance.status === "connecting"
                          ? "animate-spin text-yellow-500"
                          : "text-muted-foreground"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {instance.instanceName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {instance.phone ?? "Sem número"}
                      {" · "}
                      {instance.dailyMessagesSent}/{instance.dailyMessageLimit} msgs hoje
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={config.variant}>{config.label}</Badge>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRefresh(instance.id)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>

                  {instance.status === "connected" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDisconnect(instance.id)}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(instance.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
