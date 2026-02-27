"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Users,
  Database,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/extraction", label: "Extração", icon: Database },
];

const bottomItems = [
  { href: "/settings/general", label: "Configurações", icon: Settings },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}

      <Separator className="my-2" />

      {bottomItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/") || pathname.startsWith("/settings");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar — hidden below md breakpoint */
export function Sidebar() {
  return (
    <aside className="hidden md:flex h-full w-56 flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="font-display text-lg tracking-tight">
          ProspectAI
        </Link>
      </div>
      <SidebarNav />
    </aside>
  );
}

/** Mobile sidebar — Sheet drawer, only rendered below md */
export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <div className="flex h-14 items-center border-b border-border px-4">
            <Link
              href="/"
              className="font-display text-lg tracking-tight"
              onClick={() => setOpen(false)}
            >
              ProspectAI
            </Link>
          </div>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
