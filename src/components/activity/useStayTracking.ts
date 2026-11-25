"use client";

import { useEffect } from "react";

/**
 * G.4 板块停留统计：用 IntersectionObserver 记录 [data-stay] 元素可见时长，
 * 页面隐藏或卸载时一次性上报，避免频繁请求。
 */
export function useStayTracking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const enteredAt = new Map<string, number>();
    const totals = new Map<string, number>();
    let disposed = false;

    const collect = () => {
      const now = Date.now();
      for (const [section, startedAt] of enteredAt) {
        totals.set(
          section,
          (totals.get(section) || 0) + Math.round((now - startedAt) / 1000),
        );
      }
      enteredAt.clear();
    };

    const flush = () => {
      collect();
      const items = [...totals]
        .filter(([, staySec]) => staySec > 0)
        .map(([section, staySec]) => ({ section, staySec }));
      totals.clear();
      if (!items.length) return;

      const payload = JSON.stringify({ items });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/browse", new Blob([payload], {
          type: "application/json",
        }));
      } else {
        void fetch("/api/browse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        for (const entry of entries) {
          const section = (entry.target as HTMLElement).dataset.stay;
          if (!section) continue;
          if (entry.isIntersecting) {
            if (!enteredAt.has(section)) enteredAt.set(section, now);
          } else if (enteredAt.has(section)) {
            const startedAt = enteredAt.get(section) ?? now;
            totals.set(
              section,
              (totals.get(section) || 0) + Math.round((now - startedAt) / 1000),
            );
            enteredAt.delete(section);
          }
        }
      },
      { threshold: 0.35 },
    );

    const targets = document.querySelectorAll<HTMLElement>("[data-stay]");
    targets.forEach((target) => observer.observe(target));

    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [enabled]);
}
