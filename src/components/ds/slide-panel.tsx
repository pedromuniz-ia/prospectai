"use client";

import * as React from "react";
import { PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface SlidePanelProps {
  title: string;
  /** Desktop: inline fixed column. Mobile: Sheet slide-over. */
  children: React.ReactNode;
  /** Width class for inline mode, e.g. "w-80" */
  inlineWidth?: string;
  className?: string;
}

export function SlidePanel({
  title,
  children,
  inlineWidth = "w-80",
  className,
}: SlidePanelProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Toggle button — visible only below xl */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="xl:hidden"
        onClick={() => setOpen(true)}
        aria-label={`Abrir ${title}`}
      >
        <PanelRight className="h-4 w-4" />
      </Button>

      {/* Inline panel — xl and above */}
      <aside
        className={cn(
          "hidden xl:flex xl:flex-col xl:border-l xl:border-border/70",
          inlineWidth,
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>

      {/* Sheet — below xl */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[85vw] max-w-md sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
