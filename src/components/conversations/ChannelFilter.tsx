"use client";

import { cn } from "@/lib/utils";
import { CHANNELS, CHANNEL_LABELS, type Channel } from "@/lib/channels/types";
import { CHANNEL_COLORS, ChannelIcon } from "@/components/icons/channels";

interface Props {
  value: Channel | "all";
  onChange: (value: Channel | "all") => void;
  counts: Record<string, number>;
}

export function ChannelFilter({ value, onChange, counts }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border/60 bg-card overflow-x-auto">
      <Pill
        active={value === "all"}
        onClick={() => onChange("all")}
        label="Todos"
        count={total}
      />
      {CHANNELS.map((channel) => (
        <Pill
          key={channel}
          active={value === channel}
          onClick={() => onChange(channel)}
          label={CHANNEL_LABELS[channel]}
          count={counts[channel] ?? 0}
          icon={
            <ChannelIcon
              channel={channel}
              className={cn("h-3 w-3", value === channel ? "" : CHANNEL_COLORS[channel])}
            />
          }
        />
      ))}
    </div>
  );
}

function Pill({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-medium transition-colors cursor-pointer",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted/50 text-muted-foreground hover:bg-muted"
      )}
    >
      {icon}
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
