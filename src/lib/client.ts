"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data as T;
}

export type ApiState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  setData: (updater: T | ((prev: T | null) => T | null)) => void;
};

export function useApi<T>(url: string | null, deps: unknown[] = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnce = useRef(false);

  const load = useCallback(
    async (silent: boolean) => {
      if (!url) {
        setLoading(false);
        return;
      }
      if (silent) setRefreshing(true);
      else if (!loadedOnce.current) setLoading(true);
      try {
        const result = await apiRequest<T>(url);
        setData(result);
        setError(null);
        loadedOnce.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [url],
  );

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const update = useCallback((updater: T | ((prev: T | null) => T | null)) => {
    setData((prev) => (typeof updater === "function" ? (updater as (p: T | null) => T | null)(prev) : updater));
  }, []);

  return { data, error, loading, refreshing, refresh, setData: update };
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
