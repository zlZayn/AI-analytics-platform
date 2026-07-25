"use client"

import { useEffect, useRef, useState } from "react"
import type { CorrelationMethod } from "./types"
import type { CorrelationMatrixResult } from "./correlation-matrix"
import type { CorrelationWorkerRequest, CorrelationWorkerResponse } from "./correlation.worker"

interface CorrelationState {
  loading: boolean
  result: CorrelationMatrixResult | null
  error: string | null
}

interface CompletedCorrelationState extends CorrelationState {
  rows: Record<string, unknown>[] | null
  columns: string[] | null
  method: CorrelationMethod | null
}

export function useCorrelationMatrix(
  rows: Record<string, unknown>[],
  columns: string[],
  method: CorrelationMethod,
): CorrelationState {
  const requestIdRef = useRef(0)
  const [completed, setCompleted] = useState<CompletedCorrelationState>({
    loading: true,
    result: null,
    error: null,
    rows: null,
    columns: null,
    method: null,
  })

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const worker = new Worker(new URL("./correlation.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (event: MessageEvent<CorrelationWorkerResponse>) => {
      if (event.data.requestId !== requestId) return
      setCompleted(event.data.ok
        ? { loading: false, result: event.data.result, error: null, rows, columns, method }
        : { loading: false, result: null, error: event.data.error, rows, columns, method })
    }
    worker.onerror = () => {
      if (requestIdRef.current === requestId) {
        setCompleted({ loading: false, result: null, error: "相关矩阵计算失败", rows, columns, method })
      }
    }

    worker.postMessage({ requestId, rows, columns, method } satisfies CorrelationWorkerRequest)
    return () => worker.terminate()
  }, [rows, columns, method])

  if (completed.rows !== rows || completed.columns !== columns || completed.method !== method) {
    return { loading: true, result: completed.result, error: null }
  }
  return completed
}
