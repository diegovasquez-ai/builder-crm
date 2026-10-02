"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ActivityForm } from "@/components/activities/ActivityForm";
import {
  Phone,
  Mail,
  Users,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  Activity,
  Plus,
} from "lucide-react";
import { formatRelativeDate, formatDate } from "@/lib/constants";
import { ACTIVITY_TYPE_CONFIG } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { isToday, isYesterday, differenceInDays } from "date-fns";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { ActivityType } from "@/types";

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

function activityGroupLabel(date: Date): string {
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  const diff = differenceInDays(new Date(), date);
  if (diff < 7) return "Esta semana";
  if (diff < 30) return "Este mes";
  return "Antes";
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  contactName: string | null;
  contactId: string;
  scheduledAt: number | Date | null;
  completedAt: number | Date | null;
  createdAt: number | Date;
}

interface FollowUps {
  overdue: ActivityItem[];
  today: ActivityItem[];
  upcoming: ActivityItem[];
  unscheduled: ActivityItem[];
}

export default function ActivitiesPage() {
  const [allActivities, setActivities] = useState<ActivityItem[]>([]);
  const [followUps, setFollowUps] = useState<FollowUps | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadData = () => {
    Promise.all([
      fetch("/api/activities").then((r) => r.json()),
      fetch("/api/followups").then((r) => r.json()),
    ]).then(([acts, fups]) => {
      setActivities(acts);
      setFollowUps(fups);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Actividades"
          subtitle="Historial de interacciones y seguimientos pendientes"
        />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Actividades"
        subtitle="Historial de interacciones y seguimientos pendientes"
        actions={
          <Button onClick={() => setShowForm(true)} className="cursor-pointer">
            <Plus className="h-4 w-4" />
            Registrar
          </Button>
        }
      />

      <div className="space-y-6">
      <ActivityForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          loadData();
        }}
      />

      {/* Follow-ups section */}
      {followUps && (followUps.overdue.length > 0 || followUps.today.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {followUps.overdue.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/[0.03]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-destructive font-heading">
                  <span className="rounded-full p-1.5 bg-destructive/10">
                    <AlertCircle className="h-3.5 w-3.5" />
                  </span>
                  Vencidos ({followUps.overdue.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {followUps.overdue.map((f) => (
                  <div
                    key={f.id}
                    className="p-2.5 rounded-lg bg-card border border-destructive/15 text-sm"
                  >
                    <p className="font-medium leading-snug">{f.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {f.contactName} &middot; {formatDate(f.scheduledAt)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {followUps.today.length > 0 && (
            <Card className="border-amber-500/40 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 font-heading">
                  <span className="rounded-full p-1.5 bg-amber-100">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                  Hoy ({followUps.today.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {followUps.today.map((f) => (
                  <div
                    key={f.id}
                    className="p-2.5 rounded-lg bg-card border border-amber-500/20 text-sm"
                  >
                    <p className="font-medium leading-snug">{f.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {f.contactName}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* All activities timeline */}
      <Card className="surface-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight font-heading">
            Todas las Actividades
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Timeline cronologico
          </p>
        </CardHeader>
        <CardContent>
          {allActivities.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No hay actividades"
              description="Las actividades aparecen cuando registras llamadas, emails, reuniones o notas."
            />
          ) : (
            <ActivityTimeline activities={allActivities} />
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function ActivityTimeline({ activities }: { activities: ActivityItem[] }) {
  const groups = activities.reduce<Record<string, ActivityItem[]>>(
    (acc, item) => {
      const key = activityGroupLabel(new Date(item.createdAt));
      (acc[key] ??= []).push(item);
      return acc;
    },
    {},
  );

  const groupOrder = ["Hoy", "Ayer", "Esta semana", "Este mes", "Antes"].filter(
    (k) => groups[k],
  );

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute left-[19px] top-2 bottom-2 w-px bg-border/60"
      />
      {groupOrder.map((groupName, gIdx) => (
        <Fragment key={groupName}>
          <p
            className={cn(
              "relative bg-card pl-12 -ml-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground py-1.5 mb-2",
              gIdx > 0 && "mt-4",
            )}
          >
            {groupName}
          </p>
          <div className="space-y-3">
            {groups[groupName].map((activity) => {
              const Icon = typeIcons[activity.type] || FileText;
              const config =
                ACTIVITY_TYPE_CONFIG[activity.type as ActivityType];
              const styleCls =
                typeStyles[activity.type] ||
                "bg-muted text-muted-foreground";
              return (
                <div
                  key={activity.id}
                  className="relative flex gap-4 items-start"
                >
                  <div
                    className={cn(
                      "relative z-10 rounded-full p-2.5 shrink-0 ring-4 ring-card",
                      styleCls,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10.5px] h-5">
                        {config?.label || activity.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {activity.contactName ?? "Sin contacto"}
                      </span>
                      {activity.completedAt ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : activity.scheduledAt ? (
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                      ) : null}
                    </div>
                    <p className="text-sm mt-1.5 leading-snug">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeDate(activity.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
