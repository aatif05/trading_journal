"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { type CapitalFlow, type CapitalFlows, updateCapitalFlow } from "@/lib/fund-management";

const fetcher = (url: string) => fetch(url).then((response) => { if (!response.ok) throw new Error("Unable to load journal"); return response.json(); });

export function useCapitalFlows() {
  const { data, error, mutate } = useSWR<{ flows: CapitalFlows }>("/api/journal", fetcher, { revalidateOnFocus: false });
  const flows = useMemo(() => data?.flows ?? {}, [data?.flows]);
  const updateFlow = useCallback((year: number, month: number, field: keyof CapitalFlow, value: number) => {
    const next = updateCapitalFlow(flows, year, month, field, value);
    void mutate({ flows: next }, false);
    void fetch("/api/journal", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flows: next }) });
  }, [flows, mutate]);
  return { flows, hydrated: Boolean(data) || Boolean(error), updateFlow };
}
