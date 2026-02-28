"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Brain,
  Building2,
  Plug,
  Settings2,
  Smartphone,
  Target,
} from "lucide-react";

const settingsTabs = [
  { href: "/settings/general", label: "Conta", icon: Building2 },
  { href: "/settings/ai", label: "IA & Modelos", icon: Brain },
  { href: "/settings/scoring", label: "Lead Scoring", icon: Target },
  { href: "/settings/integrations", label: "Integrações", icon: Plug },
  { href: "/settings/advanced", label: "Avançado", icon: Settings2 },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Mobile: horizontal scrollable tabs */}
      <div className="relative md:hidden">
        <nav className="flex overflow-x-auto border-b border-border px-2 py-2">
          <div className="flex gap-1">
            {settingsTabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent" />
      </div>

      {/* Desktop: vertical sidebar */}
      <nav className="hidden md:block w-48 shrink-0 border-r border-border p-4">
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
