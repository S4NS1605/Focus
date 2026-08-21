import { useEffect, useState } from 'react';

const STORAGE_KEY = 'dismissed-insights';
const EXPIRY_HOURS = 24;

interface DismissedInsight {
  id: string;
  dismissedAt: number;
}

/** Maneja insights descartados: se guardan 24h y luego reaparecen. */
export const useDismissedInsights = () => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const now = Date.now();
    const items: DismissedInsight[] = JSON.parse(stored);
    const vigentes = items.filter((item) => now - item.dismissedAt < EXPIRY_HOURS * 3600000);

    if (vigentes.length !== items.length) {
      if (vigentes.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(vigentes));
      }
    }

    setDismissed(new Set(vigentes.map((item) => item.id)));
  }, []);

  const dismiss = (id: string) => {
    const items: DismissedInsight[] = [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      items.push(...JSON.parse(stored));
    }
    items.push({ id, dismissedAt: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const isDismissed = (id: string): boolean => dismissed.has(id);

  return { isDismissed, dismiss };
};
