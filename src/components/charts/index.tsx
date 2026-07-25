"use client"

import React from "react"
import type { ChartMapping, ChartProps } from "./types"
import { validateMapping } from "./utils"
import { EmptyState } from "./empty-state"
import { ChartErrorBoundary } from "./error-boundary"
import { LineChartView } from "./views/line-chart"
import { BarChartView } from "./views/bar-chart"
import { PieChartView } from "./views/pie-chart"
import { ScatterChartView } from "./views/scatter-chart"
import { BoxPlotView } from "./views/box-plot"
import { HeatmapView } from "./views/heatmap"
import { CorrelationHeatmap } from "./views/correlation-heatmap"
import { TableView } from "./views/table-view"
import { HistogramView } from "./views/histogram"
import { KpiView } from "./views/kpi"

export type { ChartMapping, ChartType, ChartProps } from "./types"

function ChartInner({ mapping, data, showLegend = true }: ChartProps) {
  if (data.length === 0) return <EmptyState />

  const { chartType } = mapping

  switch (chartType) {
    case "line": {
      const err = validateMapping(mapping, ["x", "y"])
      if (err) return <EmptyState message={err} />
      return (
        <ChartErrorBoundary chartType="折线图">
          <LineChartView
            data={data}
            xKey={mapping.x!}
            yKey={mapping.y!}
            colorKey={mapping.color}
            showLegend={showLegend}
          />
        </ChartErrorBoundary>
      )
    }
    case "bar": {
      const err = validateMapping(mapping, ["x", "y"])
      if (err) return <EmptyState message={err} />
      return (
        <ChartErrorBoundary chartType="柱状图">
          <BarChartView
            data={data}
            xKey={mapping.x!}
            yKey={mapping.y!}
            fillKey={mapping.fill}
            showLegend={showLegend}
          />
        </ChartErrorBoundary>
      )
    }
    case "pie": {
      const err = validateMapping(mapping, ["name", "value"])
      if (err) return <EmptyState message={err} />
      return (
        <ChartErrorBoundary chartType="饼图">
          <PieChartView
            data={data}
            nameKey={mapping.name!}
            valueKey={mapping.value!}
          />
        </ChartErrorBoundary>
      )
    }
    case "scatter": {
      const err = validateMapping(mapping, ["x", "y"])
      if (err) return <EmptyState message={err} />
      return (
        <ChartErrorBoundary chartType="散点图">
          <ScatterChartView
            data={data}
            xKey={mapping.x!}
            yKey={mapping.y!}
            colorKey={mapping.color}
          />
        </ChartErrorBoundary>
      )
    }
    case "boxplot": {
      const err = validateMapping(mapping, ["category", "value"])
      if (err) return <EmptyState message={err} />
      return (
        <ChartErrorBoundary chartType="箱线图">
          <BoxPlotView
            data={data}
            xKey={mapping.category!}
            yKey={mapping.value!}
          />
        </ChartErrorBoundary>
      )
    }
    case "heatmap": {
      const err = validateMapping(mapping, ["x", "y"])
      if (err) return <EmptyState message={err} />
      return (
        <ChartErrorBoundary chartType="热力图">
          <HeatmapView
            data={data}
            xKey={mapping.x!}
            yKey={mapping.y!}
            fillKey={mapping.value}
          />
        </ChartErrorBoundary>
      )
    }
    case "correlation":
      return (
        <ChartErrorBoundary chartType="相关系数矩阵">
          <CorrelationHeatmap data={data} method={mapping.method} />
        </ChartErrorBoundary>
      )
    case "histogram": {
      const err = validateMapping(mapping, ["value"])
      if (err) return <EmptyState message={err} />
      return <ChartErrorBoundary chartType="直方图"><HistogramView data={data} valueKey={mapping.value!} /></ChartErrorBoundary>
    }
    case "kpi": {
      const err = validateMapping(mapping, ["value"])
      if (err) return <EmptyState message={err} />
      return <ChartErrorBoundary chartType="指标卡"><KpiView data={data} valueKey={mapping.value!} labelKey={mapping.label} comparisonKey={mapping.comparison} /></ChartErrorBoundary>
    }
    case "table":
    default: {
      const columns = Object.keys(data[0] || {})
      return (
        <ChartErrorBoundary chartType="数据表">
          <TableView data={data} columns={columns} />
        </ChartErrorBoundary>
      )
    }
  }
}

export const Chart = React.memo(ChartInner)
