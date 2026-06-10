"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Filter, RotateCcw, Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  SLA_STATUS_LABELS,
  type RequestStatus,
  type RequestType,
  type TicketPriority,
  type SlaStatusKey,
} from "@/lib/constants";
import type { HandlerOption } from "@/lib/ticket-queries";

interface TicketFiltersProps {
  handlers: HandlerOption[];
}

export function TicketFilters({ handlers }: TicketFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const getParam = (key: string): string => searchParams.get(key) ?? "";
  const getArrayParam = (key: string): string[] => {
    const v = searchParams.get(key);
    return v ? v.split(",").filter(Boolean) : [];
  };

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      startTransition(() => {
        router.push(`?${params.toString()}`);
      });
    },
    [router, searchParams],
  );

  const toggleArrayParam = useCallback(
    (key: string, value: string) => {
      const current = getArrayParam(key);
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      updateParams({ [key]: next.length > 0 ? next.join(",") : null });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, updateParams],
  );

  const resetFilters = () => {
    startTransition(() => {
      router.push("?");
    });
  };

  const hasFilters = searchParams.toString().length > 0;

  const handleExport = () => {
    const params = new URLSearchParams(searchParams.toString());
    window.open(`/api/ticket/export?${params.toString()}`, "_blank");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari judul tiket..."
            value={getParam("search")}
            onChange={(e) => updateParams({ search: e.target.value || null })}
            className="pl-9"
          />
        </div>

        {/* Status filter */}
        <MultiSelectFilter
          label="Status"
          icon={<Filter className="h-3.5 w-3.5" />}
          options={Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          selected={getArrayParam("status")}
          onToggle={(value) => toggleArrayParam("status", value)}
        />

        {/* Priority filter */}
        <MultiSelectFilter
          label="Prioritas"
          options={Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          selected={getArrayParam("priority")}
          onToggle={(value) => toggleArrayParam("priority", value)}
        />

        {/* Type filter */}
        <MultiSelectFilter
          label="Tipe"
          options={Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          selected={getArrayParam("type")}
          onToggle={(value) => toggleArrayParam("type", value)}
        />

        {/* SLA Status filter */}
        <MultiSelectFilter
          label="SLA"
          options={Object.entries(SLA_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          selected={getArrayParam("slaStatus")}
          onToggle={(value) => toggleArrayParam("slaStatus", value)}
        />

        {/* Handler filter */}
        {handlers.length > 0 && (
          <Select
            value={getParam("handledBy") || "__all__"}
            onValueChange={(value) =>
              updateParams({ handledBy: value === "__all__" ? null : value })
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Handler" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua Handler</SelectItem>
              {handlers.map((h) => (
                <SelectItem key={h.id} value={String(h.id)}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Second row: date range + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Dari</span>
          <Input
            type="date"
            value={getParam("dateFrom")}
            onChange={(e) => updateParams({ dateFrom: e.target.value || null })}
            className="w-[150px] h-8"
          />
          <span>s/d</span>
          <Input
            type="date"
            value={getParam("dateTo")}
            onChange={(e) => updateParams({ dateTo: e.target.value || null })}
            className="w-[150px] h-8"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {isPending && (
        <div className="text-xs text-muted-foreground">Memuat...</div>
      )}
    </div>
  );
}

// ── Multi-select filter popover ──

interface MultiSelectFilterProps {
  label: string;
  icon?: React.ReactNode;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}

function MultiSelectFilter({
  label,
  icon,
  options,
  selected,
  onToggle,
}: MultiSelectFilterProps) {
  const count = selected.length;

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted transition-colors data-[popup-open]:bg-muted"
      >
        {icon}
        {label}
        {count > 0 && (
          <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {count}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1.5">
        <div className="flex flex-col gap-0.5">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => onToggle(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
