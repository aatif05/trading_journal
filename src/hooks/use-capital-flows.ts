"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type CapitalFlow,
  type CapitalFlows,
  FUND_FLOWS_STORAGE_KEY,
  parseCapitalFlows,
  serializeCapitalFlows,
  updateCapitalFlow,
} from "@/lib/fund-management";

export function useCapitalFlows() {
  const [flows, setFlows] = useState<CapitalFlows>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = parseCapitalFlows(window.localStorage.getItem(FUND_FLOWS_STORAGE_KEY));
    const hydrate = window.setTimeout(() => {
      setFlows(stored);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(FUND_FLOWS_STORAGE_KEY, serializeCapitalFlows(flows));
    }
  }, [flows, hydrated]);

  const updateFlow = useCallback(
    (year: number, month: number, field: keyof CapitalFlow, value: number) => {
      setFlows((current) => updateCapitalFlow(current, year, month, field, value));
    },
    [],
  );

  return { flows, hydrated, updateFlow };
}
