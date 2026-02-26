"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Smartphone, Brain, Target, FileText, Settings2 } from "lucide-react";

const settingsTabs = [
  { href: "/settings/whatsapp", label: "WhatsApp", icon: Smartphone },
  { href: "/settings/ai", label: "IA & Modelos", icon: Brain },
  { href: "/settings/scoring", label: "Lead Scoring", icon: Target },
  { href: "/settings/templates", label: "Templates", icon: FileText },
  { href: "/settings/advanced", label: "Avançado", icon: Settings2 },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      <nav className="w-48 border-r border-border p-4">
        <h2 className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Configurações
        </h2>
        <div className="flex flex-col gap-1">
          {settingsTabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
