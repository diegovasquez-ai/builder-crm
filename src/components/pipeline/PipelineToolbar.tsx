"use client";

import { Filter, ArrowUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  type PipelineFilters,
  type PipelineSort,
  type SortDir,
  type SortField,
} from "./types";

interface PipelineToolbarProps {
  filters: PipelineFilters;
  onFiltersChange: (filters: PipelineFilters) => void;
  sort: PipelineSort;
  onSortChange: (sort: PipelineSort) => void;
}

export function PipelineToolbar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
}: PipelineToolbarProps) {
  const filterCount = activeFilterCount(filters);

  return (
    <div className="flex items-center justify-end gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium transition-colors hover:bg-muted/40 cursor-pointer",
                  filterCount > 0 && "border-primary/40 text-primary"
                )}
              />
            }
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros{filterCount > 0 && ` (${filterCount})`}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor mín. (MXN)</Label>
                  <Input
                    type="number"
                    value={
                      filters.minValue !== null ? filters.minValue / 100 : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      onFiltersChange({
                        ...filters,
                        minValue: v === "" ? null : Math.round(Number(v) * 100),
                      });
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor máx. (MXN)</Label>
                  <Input
                    type="number"
                    value={
                      filters.maxValue !== null ? filters.maxValue / 100 : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      onFiltersChange({
                        ...filters,
                        maxValue: v === "" ? null : Math.round(Number(v) * 100),
                      });
                    }}
                    placeholder="∞"
                  />
                </div>
              </div>

              {filterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFiltersChange(DEFAULT_FILTERS)}
                  className="w-full cursor-pointer"
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium transition-colors hover:bg-muted/40 cursor-pointer",
                  (sort.field !== DEFAULT_SORT.field ||
                    sort.dir !== DEFAULT_SORT.dir) &&
                    "border-primary/40 text-primary"
                )}
              />
            }
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            Ordenar
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="space-y-2">
              <Label className="text-xs">Campo</Label>
              <Select
                value={sort.field}
                onValueChange={(v) =>
                  v && onSortChange({ ...sort, field: v as SortField })
                }
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Fecha de creación</SelectItem>
                  <SelectItem value="value">Valor</SelectItem>
                  <SelectItem value="probability">Probabilidad</SelectItem>
                </SelectContent>
              </Select>

              <Label className="text-xs">Dirección</Label>
              <Select
                value={sort.dir}
                onValueChange={(v) =>
                  v && onSortChange({ ...sort, dir: v as SortDir })
                }
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descendente</SelectItem>
                  <SelectItem value="asc">Ascendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>
    </div>
  );
}
