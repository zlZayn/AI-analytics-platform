"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Chart, type ChartMapping } from "@/components/chart"
import {
  type VariableInfo,
  type ChartType,
  type CorrelationMethod,
  inferVariableRole,
  inferChartType,
  inferMapping,
  computeVariableStats,
  getRoleLabel,
  getRoleColor,
  CHART_TYPE_SLOTS,
  CHART_TYPE_INFO,
} from "@/lib/variable-types"

interface ChartConfigPanelProps {
  columns: { name: string; type: string }[]
  data: Record<string, unknown>[]
  mapping: ChartMapping
  onChange: (mapping: ChartMapping) => void
}

const CORRELATION_METHODS: { value: CorrelationMethod; label: string; desc: string }[] = [
  { value: "pearson", label: "Pearson", desc: "线性关系" },
  { value: "spearman", label: "Spearman", desc: "单调关系" },
  { value: "kendall", label: "Kendall", desc: "有序数据" },
]

export function ChartConfigPanel({ columns, data, mapping, onChange }: ChartConfigPanelProps) {
  // 计算变量信息
  const variables: VariableInfo[] = useMemo(() => {
    return columns.map((col) => {
      const values = data.map((d) => d[col.name])
      const role = inferVariableRole(col.type, values)
      const stats = computeVariableStats(values)
      return { name: col.name, type: col.type, role, stats }
    })
  }, [columns, data])

  // 当前图表类型的映射槽位
  const slots = CHART_TYPE_SLOTS[mapping.chartType as ChartType] || {}

  // 获取某个槽位可用的变量
  // 连续变量唯一值少时也可以作为分类变量（ggplot2 哲学）
  function getAvailableVariables(slot: string): VariableInfo[] {
    const slotDef = slots[slot]
    if (!slotDef) return []
    return variables.filter((v) => {
      if (slotDef.accepts.includes(v.role)) return true
      // continuous with few unique values can also be used as categorical
      if (v.role === "continuous" && slotDef.accepts.includes("categorical") && v.stats.uniqueCount <= 20) return true
      return false
    })
  }

  // 切换图表类型
  function handleChartTypeChange(newType: ChartType) {
    const newMapping = inferMapping(variables, newType)
    onChange({ chartType: newType, ...newMapping })
  }

  return (
    <div className="space-y-4">
      {/* 图表类型选择 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-2 block">图表类型</label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(CHART_TYPE_INFO) as ChartType[]).map((type) => {
            const info = CHART_TYPE_INFO[type]
            const isCurrent = mapping.chartType === type
            return (
              <button
                key={type}
                onClick={() => handleChartTypeChange(type)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all text-xs ${
                  isCurrent
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
                title={info.description}
              >
                <span className="text-base">{info.icon}</span>
                <span className="font-medium">{info.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 相关系数方法选择 */}
      {mapping.chartType === "correlation" && (
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">相关系数方法</label>
          <div className="flex gap-2">
            {CORRELATION_METHODS.map((m) => (
              <Badge
                key={m.value}
                variant={mapping.method === m.value ? "default" : "outline"}
                className="cursor-pointer text-xs px-3 py-1"
                onClick={() => onChange({ ...mapping, method: m.value })}
              >
                {m.label}
                <span className="text-gray-400 ml-1">({m.desc})</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 映射槽位 */}
      {Object.keys(slots).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(slots).map(([slot, slotDef]) => {
            const available = getAvailableVariables(slot)
            if (available.length === 0) return null

            const currentValue = mapping[slot] as string | undefined

            return (
              <div key={slot}>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                  {slotDef.label}
                  {slotDef.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <Select
                  value={currentValue || ""}
                  onValueChange={(v) => onChange({ ...mapping, [slot]: v || undefined })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={slotDef.required ? "请选择" : "可选"} />
                  </SelectTrigger>
                  <SelectContent>
                    {!slotDef.required && (
                      <SelectItem value="">无</SelectItem>
                    )}
                    {available.map((v) => (
                      <SelectItem key={v.name} value={v.name}>
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-2">
                            <span>{v.name}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1 py-0 ${getRoleColor(v.role)}`}
                            >
                              {getRoleLabel(v.role)}
                            </Badge>
                            {v.role === "continuous" && slotDef.accepts.includes("categorical") && (
                              <span className="text-[10px] text-gray-400">
                                ({v.stats.uniqueCount}值)
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-400 truncate max-w-[200px]">
                            {v.stats.sampleValues.slice(0, 4).join(", ")}
                            {v.stats.uniqueCount > 4 ? "..." : ""}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      )}

      {/* 变量信息卡片 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-2 block">变量信息</label>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {variables.map((v) => (
            <div
              key={v.name}
              className="p-2.5 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700">{v.name}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1 py-0 ${getRoleColor(v.role)}`}
                  >
                    {getRoleLabel(v.role)}
                  </Badge>
                </div>
                <span className="text-[10px] text-gray-400">{v.type}</span>
              </div>
              <div className="text-[10px] text-gray-500 space-y-0.5">
                {v.role === "continuous" && v.stats.min !== undefined ? (
                  <>
                    <div>范围: {v.stats.min.toFixed(2)} ~ {v.stats.max?.toFixed(2)}</div>
                    <div>均值: {v.stats.mean?.toFixed(2)} | 唯一值: {v.stats.uniqueCount}</div>
                  </>
                ) : v.role === "temporal" ? (
                  <div>唯一值: {v.stats.uniqueCount} | 样本: {String(v.stats.sampleValues[0] || "")}</div>
                ) : (
                  <>
                    <div>唯一值: {v.stats.uniqueCount} | 空值: {(v.stats.nullRatio * 100).toFixed(1)}%</div>
                    <div>样本: {v.stats.sampleValues.slice(0, 3).join(", ")}{v.stats.uniqueCount > 3 ? "..." : ""}</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 图表 */}
      <div className="border rounded-lg bg-white p-3">
        <Chart mapping={mapping} data={data} />
      </div>
    </div>
  )
}
