"use client"

import React from "react"

interface ErrorBoundaryState {
  hasError: boolean
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  chartType?: string
  resetKeys?: readonly unknown[]
}

export class ChartErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.hasError && resetKeysChanged(previous.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      const label = this.props.chartType
        ? `${this.props.chartType}图表`
        : "图表"
      return (
        <div className="flex flex-col items-center justify-center h-[320px] text-center p-4">
          <div className="mb-1 text-sm font-medium text-[var(--destructive)]">
            {label}渲染失败
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">数据或配置暂时无法渲染。</div>
          <button type="button" className="mt-3 rounded border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--accent)]" onClick={() => this.setState({ hasError: false })}>重试</button>
        </div>
      )
    }
    return this.props.children
  }
}

function resetKeysChanged(previous: readonly unknown[] = [], current: readonly unknown[] = []): boolean {
  return previous.length !== current.length || previous.some((value, index) => !Object.is(value, current[index]))
}
