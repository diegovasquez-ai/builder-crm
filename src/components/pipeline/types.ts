export interface PipelineFilters {
  minValue: number | null;
  maxValue: number | null;
}

export type SortField = "createdAt" | "value" | "probability";
export type SortDir = "asc" | "desc";

export interface PipelineSort {
  field: SortField;
  dir: SortDir;
}

export const DEFAULT_FILTERS: PipelineFilters = {
  minValue: null,
  maxValue: null,
};

export const DEFAULT_SORT: PipelineSort = {
  field: "createdAt",
  dir: "desc",
};

export function activeFilterCount(filters: PipelineFilters): number {
  let n = 0;
  if (filters.minValue !== null) n++;
  if (filters.maxValue !== null) n++;
  return n;
}
