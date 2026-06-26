"use client"

import { useState } from "react"
import { DropdownSelect } from "@/components/ui/dropdown-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Chart, type ChartMapping } from "@/components/chart"
import { ChartIcon } from "@/components/charts/chart-icons"
import {
  type ChartType,
  type CorrelationMethod,
  CHART_TYPE_SLOTS,
  CHART_TYPE_INFO,
} from "@/lib/variable-types"
import { Eye, EyeOff } from "lucide-react"

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

const GROUP_WARN_THRESHOLD = 20

export function ChartConfigPanel({ columns, data, mapping, onChange }: ChartConfigPanelProps) {
  const chartType = (mapping.chartType as ChartType) || "table"
  const slots = CHART_TYPE_SLOTS[chartType] || {}

  // Legend toggle
  const [showLegend, setShowLegend] = useState(true)

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    message: string
    pendingMapping: ChartMapping | null
  }>({
    open: false,
    message: "",
    pendingMapping: null,
  })

  function handleChartTypeChange(newType: ChartType) {
    const newMapping: ChartMapping = { chartType: newType }
    if (newType === "correlation") {
      newMapping.method = "pearson"
    }
    onChange(newMapping)
  }

  function handleSlotChange(slot: string, value: string) {
    const newMapping = { ...mapping, [slot]: value || undefined }

    // 检测分组数量
    if (value && data.length > 0) {
      const uniqueCount = new Set(data.map((d) => String(d[value] ?? ""))).size
      if (uniqueCount > GROUP_WARN_THRESHOLD) {
        setConfirmDialog({
          open: true,
          message: `该列有 ${uniqueCount} 个唯一值，分组较多可能影响图表展示效果`,
          pendingMapping: newMapping,
        })
        return
      }
    }

    onChange(newMapping)
  }

  function handleConfirm(confirmed: boolean) {
    if (confirmed && confirmDialog.pendingMapping) {
      onChange(confirmDialog.pendingMapping)
    }
    setConfirmDialog({ open: false, message: "", pendingMapping: null })
  }

  // 必填槽位检查
  const requiredSlots = Object.entries(slots).filter(([, s]) => s.required)
  const missingRequired = requiredSlots.filter(([key]) => !mapping[key])

  return (
    <div className="space-y-3">
      {/* 图表类型选择 */}
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(CHART_TYPE_INFO) as ChartType[]).map((type) => {
          const info = CHART_TYPE_INFO[type]
          const active = chartType === type
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
              <ChartIcon type={type} className="w-4 h-4" />
              <span>{info.label}</span>
            </button>
          )
        })}
      </div>

      {/* 图例开关 + 相关系数方法 */}
      <div className="flex items-center gap-2">
        {/* 图例开关 - 所有图表类型都显示 */}
        {chartType !== "table" && (
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] transition-colors cursor-pointer ${
              showLegend
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
            }`}
          >
            {showLegend ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            图例
          </button>
        )}

        {/* 相关系数方法 */}
        {chartType === "correlation" && (
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
      </div>

      {/* 列映射槽位 */}
      {Object.keys(slots).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(slots).map(([slot, slotDef]) => {
            if (chartType === "correlation" && slot === "columns") return null
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
                  onChange={(v) => handleSlotChange(slot, v)}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* 必填项提示 */}
      {missingRequired.length > 0 && chartType !== "table" && chartType !== "correlation" && (
        <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          请为 {missingRequired.map(([, s]) => s.label).join("、")} 选择列
        </div>
      )}

      {/* 可用列列表 */}
      <div className="flex flex-wrap gap-1">
        {columns.map((c) => (
          <span key={c.name} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)] font-mono">
            {c.name}
          </span>
        ))}
      </div>

      {/* 图表渲染 */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <Chart mapping={mapping} data={data} showLegend={showLegend} />
      </div>

      {/* 确认弹窗 */}
      <Dialog open={confirmDialog.open} onOpenChange={() => handleConfirm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>数据提示</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">{confirmDialog.message}</p>
          <p className="text-xs text-[var(--muted-foreground)]">是否继续使用该列？</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => handleConfirm(false)}>
              取消
            </Button>
            <Button size="sm" onClick={() => handleConfirm(true)}>
              继续使用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
