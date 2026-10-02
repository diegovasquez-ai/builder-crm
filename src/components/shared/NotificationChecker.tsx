"use client";

import { marca } from "@/lib/config";
import { useEffect, useCallback } from "react";

export function NotificationChecker() {
  const checkFollowUps = useCallback(async () => {
    // Only check if notifications are enabled
    if (typeof window === "undefined") return;
    if (localStorage.getItem("crm-notifications") !== "true") return;
    if (Notification.permission !== "granted") return;

    try {
      const res = await fetch("/api/followups");
      const data = await res.json();
      const overdueCount = data.overdue?.length || 0;

      if (overdueCount > 0) {
        new Notification(marca().nombreCorto, {
          body: `Tienes ${overdueCount} seguimiento${overdueCount > 1 ? "s" : ""} vencido${overdueCount > 1 ? "s" : ""}`,
          icon: "/favicon.ico",
          tag: "crm-followup", // Prevents duplicate notifications
        });
      }
    } catch {
      // Silently fail — notifications are not critical
    }
  }, []);

  useEffect(() => {
    // Check immediately on mount
    checkFollowUps();

    // Then check every 5 minutes
    const interval = setInterval(checkFollowUps, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkFollowUps]);

  // This component renders nothing — it's just a background checker
  return null;
}
