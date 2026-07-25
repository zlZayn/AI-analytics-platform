"use client"

import React from "react"

interface ErrorBoundaryState {
  hasError: boolean
  error: string
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  chartType?: string
}

export class ChartErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: "" }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error: error.message }
  }

  render() {
    if (this.state.hasError) {
      const label = this.props.chartType
        ? `${this.props.chartType} 图表`
        : "图表"
      return (
        <div className="flex flex-col items-center justify-center h-[320px] text-center p-4">
          <div className="mb-1 text-sm font-medium text-[var(--destructive)]">
            {label}渲染失败
          </div>
          <div className="max-w-md break-all text-xs text-[var(--muted-foreground)]">
            {this.state.error}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
