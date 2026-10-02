import type { DealWithContact } from "@/types";
import type { PipelineFilters, PipelineSort } from "./types";

export function applyFilters<T extends DealWithContact>(
  deals: T[],
  filters: PipelineFilters | undefined
): T[] {
  if (!filters) return deals;
  return deals.filter((d) => {
    if (filters.minValue !== null && d.value < filters.minValue) return false;
    if (filters.maxValue !== null && d.value > filters.maxValue) return false;
    return true;
  });
}

export function applySort<T extends DealWithContact>(
  deals: T[],
  sort: PipelineSort | undefined
): T[] {
  if (!sort) return deals;
  const sign = sort.dir === "asc" ? 1 : -1;
  const copy = [...deals];
  copy.sort((a, b) => {
    let av: number;
    let bv: number;
    if (sort.field === "value") {
      av = a.value;
      bv = b.value;
    } else if (sort.field === "probability") {
      av = a.probability;
      bv = b.probability;
    } else {
      av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    }
    return (av - bv) * sign;
  });
  return copy;
}
