"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormField, LoadingButton } from "@/components/ds";
import { createLead } from "@/lib/actions/leads";
import { entries } from "@/lib/i18n";
import { toast } from "sonner";

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onCreated: () => void;
}

const INITIAL = {
  name: "",
  phone: "",
  email: "",
  website: "",
  city: "",
  state: "",
  category: "",
  status: "new" as string,
};

export function LeadFormDialog({
  open,
  onOpenChange,
  organizationId,
  onCreated,
}: LeadFormDialogProps) {
  const [form, setForm] = useState(INITIAL);

  const set = (field: keyof typeof INITIAL, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("O nome do lead é obrigatório");
      return;
    }

    await createLead({
      organizationId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      category: form.category.trim() || null,
      status: form.status as "new",
      sourceType: "manual",
    });

    toast.success("Lead criado com sucesso");
    setForm(INITIAL);
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setForm(INITIAL);
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <FormField label="Nome" htmlFor="lead-name" required>
            <Input
              id="lead-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nome do negócio"
            />
          </FormField>

          <FormField label="Telefone" htmlFor="lead-phone">
            <Input
              id="lead-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+55 11 99999-0000"
            />
          </FormField>

          <FormField label="Email" htmlFor="lead-email">
            <Input
              id="lead-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="contato@empresa.com"
            />
          </FormField>

          <FormField label="Website" htmlFor="lead-website">
            <Input
              id="lead-website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://empresa.com"
            />
          </FormField>

          <FormField label="Cidade" htmlFor="lead-city">
            <Input
              id="lead-city"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="São Paulo"
            />
          </FormField>

          <FormField label="Estado" htmlFor="lead-state">
            <Input
              id="lead-state"
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
              placeholder="SP"
            />
          </FormField>

          <FormField label="Categoria" htmlFor="lead-category">
            <Input
              id="lead-category"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Restaurante, Clínica..."
            />
          </FormField>

          <FormField label="Status" htmlFor="lead-status">
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger id="lead-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entries("leadStatus").map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <LoadingButton onClick={handleSave}>Criar Lead</LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
