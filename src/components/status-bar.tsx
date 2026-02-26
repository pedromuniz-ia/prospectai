import { Badge } from "@/components/ui/badge";

export function StatusBar() {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border bg-background px-4 py-2 text-xs">
      <div className="flex items-center gap-4 text-muted-foreground">
        <span>
          <strong className="text-foreground">0</strong> não lidas
        </span>
        <span>
          <strong className="text-foreground">0</strong> aguardam revisão
        </span>
        <span>
          <strong className="text-foreground">0</strong> campanhas ativas
        </span>
      </div>
      <div className="flex items-center gap-4 text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            Nenhuma instância
          </Badge>
        </span>
        <span>0/0 msgs</span>
        <span>entrega —%</span>
      </div>
    </div>
  );
}
