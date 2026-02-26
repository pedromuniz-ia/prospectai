"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ButtonProps = React.ComponentProps<typeof Button>;

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
}

export function LoadingButton({
  loading = false,
  disabled,
  children,
  onClick,
  ...props
}: LoadingButtonProps) {
  const [pending, setPending] = React.useState(false);
  const isLoading = loading || pending;

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (isLoading || !onClick) return;
    setPending(true);
    try {
      await (onClick as (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>)(e);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button disabled={isLoading || disabled} onClick={handleClick} {...props}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
