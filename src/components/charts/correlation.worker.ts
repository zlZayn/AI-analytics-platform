/// <reference lib="webworker" />

import type { CorrelationMethod } from "./types"
import { computeCorrelationMatrix, type CorrelationMatrixResult } from "./correlation-matrix"

export interface CorrelationWorkerRequest {
  requestId: number
  rows: Record<string, unknown>[]
  columns: string[]
  method: CorrelationMethod
}

export type CorrelationWorkerResponse =
  | { requestId: number; ok: true; result: CorrelationMatrixResult }
  | { requestId: number; ok: false; error: string }

self.onmessage = (event: MessageEvent<CorrelationWorkerRequest>) => {
  const { requestId, rows, columns, method } = event.data
  try {
    self.postMessage({
      requestId,
      ok: true,
      result: computeCorrelationMatrix(rows, columns, method),
    } satisfies CorrelationWorkerResponse)
  } catch {
    self.postMessage({
      requestId,
      ok: false,
      error: "相关矩阵计算失败",
    } satisfies CorrelationWorkerResponse)
  }
}

export {}
