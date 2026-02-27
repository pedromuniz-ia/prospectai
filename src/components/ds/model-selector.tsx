"use client";

import * as React from "react";
import { Check, ChevronsUpDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { listAvailableModels } from "@/lib/actions/ai-providers";

interface ModelSelectorProps {
  providerId: string | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ModelSelector({
  providerId,
  value,
  onChange,
  placeholder = "Selecionar modelo...",
}: ModelSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [models, setModels] = React.useState<{ id: string; name: string }[]>(
    []
  );
  const [loading, setLoading] = React.useState(false);
  const [customInput, setCustomInput] = React.useState("");

  const fetchModels = React.useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    try {
      const result = await listAvailableModels(providerId);
      setModels(result);
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  React.useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  if (!providerId) {
    return (
      <p className="flex h-9 items-center rounded-md border border-input px-3 text-sm text-muted-foreground">
        Salve o provider primeiro
      </p>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder="Buscar modelo..."
              value={customInput}
              onValueChange={setCustomInput}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? (
                  "Carregando modelos..."
                ) : customInput ? (
                  <button
                    className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      onChange(customInput);
                      setOpen(false);
                      setCustomInput("");
                    }}
                  >
                    Usar &quot;{customInput}&quot;
                  </button>
                ) : (
                  "Nenhum modelo encontrado."
                )}
              </CommandEmpty>
              <CommandGroup>
                {models.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => {
                      onChange(model.id);
                      setOpen(false);
                      setCustomInput("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === model.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {model.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void fetchModels()}
        disabled={loading}
        title="Atualizar modelos"
      >
        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
      </Button>
    </div>
  );
}
