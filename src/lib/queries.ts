/**
 * Shared react-query hooks.
 *
 * These live outside the component files that use them so that editing a component does not
 * break React Fast Refresh (a module has to export components only for refresh to work).
 *
 * `retry: false` throughout: the most likely failure is that the Python API is not running,
 * and silently retrying three times just delays the message telling the user to start it.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchCategories,
  fetchHealth,
  fetchMedicines,
  fetchModelsOverview,
  fetchStorageRiskMetadata,
  type MedicineQuery,
} from "./api";

const FIVE_MINUTES = 5 * 60_000;

/** Polled so the shell notices the backend coming up or going down without a reload. */
export function useApiHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 20_000,
    retry: false,
    staleTime: 10_000,
  });
}

export function useCatalogCount() {
  return useQuery({
    queryKey: ["medicines", "count"],
    queryFn: () => fetchMedicines({ page: 1, pageSize: 1 }),
    select: (data) => data.total,
    retry: false,
    staleTime: FIVE_MINUTES,
  });
}

/** Full catalog — 25 rows, small enough to fetch in one page for selects and lookups. */
export function useAllMedicines() {
  return useQuery({
    queryKey: ["medicines", "all"],
    queryFn: () => fetchMedicines({ page: 1, pageSize: 100 }),
    select: (data) => data.items,
    retry: false,
    staleTime: FIVE_MINUTES,
  });
}

export function useMedicinePage(params: MedicineQuery) {
  return useQuery({
    queryKey: ["medicines", "page", params],
    queryFn: () => fetchMedicines(params),
    retry: false,
    // Keeps the current page on screen while the next loads instead of flashing empty.
    placeholderData: (previous) => previous,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["medicines", "categories"],
    queryFn: fetchCategories,
    retry: false,
    staleTime: FIVE_MINUTES,
  });
}

export function useModelsOverview() {
  return useQuery({
    queryKey: ["models"],
    queryFn: fetchModelsOverview,
    retry: false,
    staleTime: FIVE_MINUTES,
  });
}

export function useStorageRiskMetadata() {
  return useQuery({
    queryKey: ["storage-risk", "metadata"],
    queryFn: fetchStorageRiskMetadata,
    retry: false,
    staleTime: FIVE_MINUTES,
  });
}
