import type { CorrelationMethod } from "./types"
import { computeCorrelation } from "./algorithms"
import { MAX_CORR_COLUMNS } from "./constants"

export interface CorrelationCell {
  value: number | null
  sampleSize: number
}

export interface CorrelationMatrixResult {
  labels: string[]
  cells: CorrelationCell[][]
  truncated: boolean
}

export function findNumericColumns(rows: Record<string, unknown>[]): string[] {
  const columns = new Set(rows.flatMap((row) => Object.keys(row)))
  return [...columns].filter((column) => rows.some((row) => toFiniteNumber(row[column]) !== null))
}

export function computeCorrelationMatrix(
  rows: Record<string, unknown>[],
  requestedColumns: string[],
  method: CorrelationMethod,
): CorrelationMatrixResult {
  const labels = requestedColumns.slice(0, MAX_CORR_COLUMNS)
  const cells = labels.map((left) => labels.map((right) => {
    const leftValues: number[] = []
    const rightValues: number[] = []

    for (const row of rows) {
      const leftValue = toFiniteNumber(row[left])
      const rightValue = toFiniteNumber(row[right])
      if (leftValue === null || rightValue === null) continue
      leftValues.push(leftValue)
      rightValues.push(rightValue)
    }

    return computeCorrelation(leftValues, rightValues, method)
  }))

  return {
    labels,
    cells,
    truncated: requestedColumns.length > MAX_CORR_COLUMNS,
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}
