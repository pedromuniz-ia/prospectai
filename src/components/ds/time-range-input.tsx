"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

interface TimeRangeInputProps {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function TimeRangeInput({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}: TimeRangeInputProps) {
  return (
    <div className="flex items-center gap-2">
      <Select value={startValue} onValueChange={onStartChange}>
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Início" />
        </SelectTrigger>
        <SelectContent>
          {TIME_OPTIONS.map((time) => (
            <SelectItem key={time} value={time}>
              {time}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-sm text-muted-foreground">até</span>
      <Select value={endValue} onValueChange={onEndChange}>
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Fim" />
        </SelectTrigger>
        <SelectContent>
          {TIME_OPTIONS.map((time) => (
            <SelectItem key={time} value={time}>
              {time}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="ml-2 text-xs text-muted-foreground">
        {startValue} — {endValue}
      </span>
    </div>
  );
}
