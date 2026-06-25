"use client"

import { DropdownSelect } from "@/components/ui/dropdown-select"
import { Chart, type ChartMapping } from "@/components/chart"
import { ChartIcon } from "@/components/charts/chart-icons"
import {
  type ChartType,
  type CorrelationMethod,
  inferMapping,
  CHART_TYPE_SLOTS,
  CHART_TYPE_INFO,
} from "@/lib/variable-types"

interface ChartConfigPanelProps {
  columns: { name: string; type: string }[]
  data: Record<string, unknown>[]
  mapping: ChartMapping
  onChange: (mapping: ChartMapping) => void
}

const CORRELATION_METHODS: { value: CorrelationMethod; label: string }[] = [
  { value: "pearson", label: "Pearson" },
  { value: "spearman", label: "Spearman" },
  { value: "kendall", label: "Kendall" },
]

export function ChartConfigPanel({ columns, data, mapping, onChange }: ChartConfigPanelProps) {
  const slots = CHART_TYPE_SLOTS[mapping.chartType as ChartType] || {}

  function handleChartTypeChange(newType: ChartType) {
    const newMapping = inferMapping(columns, newType)
    onChange({ chartType: newType, ...newMapping })
  }

  return (
    <div className="space-y-3">
      {/* Chart type selector */}
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(CHART_TYPE_INFO) as ChartType[]).map((type) => {
          const info = CHART_TYPE_INFO[type]
          const active = mapping.chartType === type
          return (
            <button
              key={type}
              onClick={() => handleChartTypeChange(type)}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-md text-[11px] transition-all cursor-pointer ${
                active
                  ? "bg-[var(--foreground)] text-[var(--background)] font-medium"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              }`}
              title={info.description}
            >
              <ChartIcon type={info.icon} className="w-4 h-4" />
              <span>{info.label}</span>
            </button>
          )
        })}
      </div>

      {/* Correlation method */}
      {mapping.chartType === "correlation" && (
        <div className="flex gap-1.5">
          {CORRELATION_METHODS.map((m) => (
            <button
              key={m.value}
              onClick={() => onChange({ ...mapping, method: m.value })}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                mapping.method === m.value
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Mapping slots -- 简单列选择 */}
      {Object.keys(slots).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(slots).map(([slot, slotDef]) => {
            const currentValue = mapping[slot] as string | undefined
            return (
              <div key={slot} className="flex-1 min-w-[120px]">
                <label className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-1 block">
                  {slotDef.label}
                </label>
                <DropdownSelect
                  value={currentValue || ""}
                  placeholder={slotDef.required ? "选择列" : "可选"}
                  options={columns.map((c) => ({
                    value: c.name,
                    label: c.name,
                  }))}
                  onChange={(v) => onChange({ ...mapping, [slot]: v || undefined })}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Column list */}
      <div className="flex flex-wrap gap-1">
        {columns.map((c) => (
          <span key={c.name} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)] font-mono">
            {c.name}
          </span>
        ))}
      </div>

      {/* Chart */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <Chart mapping={mapping} data={data} />
      </div>
    </div>
  )
}
