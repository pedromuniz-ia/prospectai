import { formatInterval } from "@/lib/i18n";

interface IntervalDisplayProps {
  min: number;
  max: number;
  unit?: "seconds" | "minutes";
  suffix?: string;
}

export function IntervalDisplay({
  min,
  max,
  unit = "seconds",
  suffix = "entre envios",
}: IntervalDisplayProps) {
  const minSeconds = unit === "minutes" ? min * 60 : min;
  const maxSeconds = unit === "minutes" ? max * 60 : max;

  return (
    <span className="text-sm text-muted-foreground">
      {formatInterval(minSeconds)}–{formatInterval(maxSeconds)} {suffix}
    </span>
  );
}
