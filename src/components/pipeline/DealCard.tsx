"use client";

import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/constants";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Phone,
  MessageCircle,
  Tag,
  FileText,
  CheckSquare,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { avatarBg, getInitials } from "@/lib/avatar";

interface DealCardProps {
  id: string;
  title: string;
  value: number;
  contactName: string | null;
  probability: number;
  docCount?: number;
}

export function DealCard({
  id,
  title,
  value,
  contactName,
  probability,
  docCount = 0,
}: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative p-3.5 cursor-grab active:cursor-grabbing border-border/60 hover:border-primary/30 hover:shadow-md transition-all"
    >
      <GripVertical
        aria-hidden
        className="absolute top-2 right-2 h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <div className="space-y-2.5">
        <p className="text-[13px] font-semibold leading-snug line-clamp-2 pr-4">
          {title}
        </p>

        <p className="text-base font-bold tabular-nums text-foreground">
          {formatCurrency(value)}
        </p>

        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-semibold",
              avatarBg(contactName ?? "?"),
            )}
          >
            {getInitials(contactName)}
          </div>
          <span className="text-[11.5px] text-muted-foreground truncate flex-1">
            {contactName || "Sin contacto"}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${probability}%` }}
            />
          </div>
          <span className="text-[10.5px] font-medium text-muted-foreground tabular-nums">
            {probability}%
          </span>
        </div>

        <div className="flex items-center gap-3 pt-1.5 mt-1 border-t border-border/40 text-muted-foreground/70">
          <Phone className="h-3.5 w-3.5" aria-hidden />
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          <Tag className="h-3.5 w-3.5" aria-hidden />
          {docCount > 0 ? (
            <span
              className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-primary"
              title={`${docCount} documento${docCount === 1 ? "" : "s"} en la ficha`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
              {docCount}
            </span>
          ) : (
            <FileText className="h-3.5 w-3.5" aria-hidden />
          )}
          <CheckSquare className="h-3.5 w-3.5" aria-hidden />
          <Calendar className="h-3.5 w-3.5" aria-hidden />
        </div>
      </div>
    </Card>
  );
}
