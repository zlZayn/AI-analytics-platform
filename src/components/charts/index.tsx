"use client"

import React from "react"
import type { ChartProps } from "./types"
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
      if (!mapping.x || !mapping.y) return <EmptyState message="请选择 X 轴和 Y 轴字段" />
      return (
        <ChartErrorBoundary chartType="折线图" resetKeys={[mapping, data]}>
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
      if (!mapping.x || !mapping.y) return <EmptyState message="请选择分类和数值字段" />
      return (
        <ChartErrorBoundary chartType="柱状图" resetKeys={[mapping, data]}>
          <BarChartView
            data={data}
            xKey={mapping.x!}
            yKey={mapping.y!}
            fillKey={mapping.fill}
            showLegend={showLegend}
            mode={mapping.mode}
          />
        </ChartErrorBoundary>
      )
    }
    case "pie": {
      if (!mapping.name || !mapping.value) return <EmptyState message="请选择名称和数值字段" />
      return (
        <ChartErrorBoundary chartType="饼图" resetKeys={[mapping, data]}>
          <PieChartView
            data={data}
            nameKey={mapping.name!}
            valueKey={mapping.value!}
            categoryLimit={mapping.categoryLimit}
          />
        </ChartErrorBoundary>
      )
    }
    case "scatter": {
      if (!mapping.x || !mapping.y) return <EmptyState message="请选择 X 轴和 Y 轴字段" />
      return (
        <ChartErrorBoundary chartType="散点图" resetKeys={[mapping, data]}>
          <ScatterChartView
            data={data}
            xKey={mapping.x!}
            yKey={mapping.y!}
            colorKey={mapping.color}
            pointLimit={mapping.pointLimit}
          />
        </ChartErrorBoundary>
      )
    }
    case "boxplot": {
      if (!mapping.category || !mapping.value) return <EmptyState message="请选择分组和数值字段" />
      return (
        <ChartErrorBoundary chartType="箱线图" resetKeys={[mapping, data]}>
          <BoxPlotView
            data={data}
            xKey={mapping.category!}
            yKey={mapping.value!}
          />
        </ChartErrorBoundary>
      )
    }
    case "heatmap": {
      if (!mapping.x || !mapping.y || !mapping.value) return <EmptyState message="请选择 X 轴、Y 轴和数值字段" />
      return (
        <ChartErrorBoundary chartType="热力图" resetKeys={[mapping, data]}>
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
        <ChartErrorBoundary chartType="相关系数矩阵" resetKeys={[mapping, data]}>
          <CorrelationHeatmap data={data} method={mapping.method} columns={mapping.columns} />
        </ChartErrorBoundary>
      )
    case "histogram": {
      if (!mapping.value) return <EmptyState message="请选择数值字段" />
      return <ChartErrorBoundary chartType="直方图" resetKeys={[mapping, data]}><HistogramView data={data} valueKey={mapping.value!} /></ChartErrorBoundary>
    }
    case "kpi": {
      if (!mapping.value) return <EmptyState message="请选择指标值字段" />
      return <ChartErrorBoundary chartType="指标卡" resetKeys={[mapping, data]}><KpiView data={data} valueKey={mapping.value!} labelKey={mapping.label} comparisonKey={mapping.comparison} /></ChartErrorBoundary>
    }
    case "table":
    default: {
      const columns = Object.keys(data[0] || {})
      return (
        <ChartErrorBoundary chartType="数据表" resetKeys={[mapping, data]}>
          <TableView data={data} columns={columns} />
        </ChartErrorBoundary>
      )
    }
  }
}

export const Chart = React.memo(ChartInner)
