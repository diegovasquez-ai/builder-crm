"use client";

import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type IconTone =
  | "primary"
  | "navy"
  | "beige"
  | "success"
  | "warning"
  | "info"
  | "destructive";

export type BadgeTone = "primary" | "success" | "warning" | "info" | "muted";

const iconToneStyles: Record<IconTone, string> = {
  primary: "bg-primary/10 text-primary",
  navy: "bg-foreground/10 text-foreground",
  beige: "bg-secondary text-foreground",
  success: "bg-emerald-500/10 text-emerald-700",
  warning: "bg-amber-500/10 text-amber-700",
  info: "bg-sky-500/10 text-sky-700",
  destructive: "bg-destructive/10 text-destructive",
};

const badgeToneStyles: Record<BadgeTone, string> = {
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  info: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  muted: "bg-muted text-muted-foreground border-border",
};

export interface EntityCardField {
  label: string;
  value: React.ReactNode;
  chipTone?: BadgeTone;
}

interface EntityCardProps {
  icon?: React.ReactNode;
  iconTone?: IconTone;
  iconLabel?: string;
  title: string;
  subtitle?: string;
  fields?: EntityCardField[];
  badge?: { label: string; tone?: BadgeTone };
  onClick?: () => void;
  onMenuClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export function EntityCard({
  icon,
  iconTone = "primary",
  iconLabel,
  title,
  subtitle,
  fields,
  badge,
  onClick,
  onMenuClick,
  className,
}: EntityCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group rounded-xl border border-border bg-card p-3.5 shadow-sm transition-all",
        onClick &&
          "cursor-pointer hover:border-primary/30 hover:shadow-md hover:-translate-y-px",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {(icon || iconLabel) && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold font-heading",
              iconToneStyles[iconTone],
            )}
          >
            {icon ?? iconLabel?.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-foreground truncate font-heading">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {badge && (
            <Badge
              variant="outline"
              className={cn(
                "h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wider",
                badgeToneStyles[badge.tone ?? "muted"],
              )}
            >
              {badge.label}
            </Badge>
          )}
          {onMenuClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMenuClick(e);
              }}
              className="text-muted-foreground hover:text-foreground p-1 rounded cursor-pointer"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {fields && fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-border/60">
          {fields.map((field, idx) => (
            <div key={idx} className="space-y-0.5 min-w-0">
              <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                {field.label}
              </p>
              {field.chipTone ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 px-1.5 text-[11px] font-medium normal-case tracking-normal",
                    badgeToneStyles[field.chipTone],
                  )}
                >
                  {field.value}
                </Badge>
              ) : (
                <p className="text-xs text-foreground truncate">
                  {field.value}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
