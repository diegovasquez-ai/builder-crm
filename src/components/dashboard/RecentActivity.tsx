"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, Users, FileText, Clock } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  contactName: string | null;
  createdAt: number | Date;
}

const typeIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  follow_up: Clock,
};

const typeStyles: Record<string, string> = {
  call: "bg-sky-50 text-sky-600",
  email: "bg-violet-50 text-violet-600",
  meeting: "bg-emerald-50 text-emerald-600",
  note: "bg-amber-50 text-amber-600",
  follow_up: "bg-rose-50 text-rose-600",
};

interface RecentActivityProps {
  activities: ActivityItem[];
}

function groupLabel(date: Date): string {
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  const diff = differenceInDays(new Date(), date);
  if (diff < 7) return "Esta semana";
  return "Antes";
}

export function RecentActivity({ activities }: RecentActivityProps) {
  const items = activities.slice(0, 6).map((a) => ({
    ...a,
    createdAtDate: new Date(a.createdAt),
  }));

  const groups = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = groupLabel(item.createdAtDate);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  const groupOrder = ["Hoy", "Ayer", "Esta semana", "Antes"].filter((k) => groups[k]);

  return (
    <Card className="surface-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold tracking-tight font-heading">
          Actividad Reciente
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Ultimos eventos del equipo
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay actividad reciente
          </p>
        ) : (
          <div className="relative">
            {groupOrder.map((groupName, gIdx) => (
              <Fragment key={groupName}>
                <p
                  className={cn(
                    "text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2.5",
                    gIdx > 0 && "mt-5",
                  )}
                >
                  {groupName}
                </p>
                <div className="space-y-3">
                  {groups[groupName].map((activity) => {
                    const Icon = typeIcons[activity.type] || FileText;
                    const styleCls = typeStyles[activity.type] || "bg-muted text-muted-foreground";
                    return (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3"
                      >
                        <div
                          className={cn(
                            "rounded-full p-2 shrink-0 mt-0.5",
                            styleCls,
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[13px] leading-snug truncate">
                            {activity.description}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {activity.contactName ?? "Sin contacto"}
                            <span className="mx-1.5 text-border">·</span>
                            {formatDistanceToNow(activity.createdAtDate, {
                              addSuffix: true,
                              locale: es,
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Fragment>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
