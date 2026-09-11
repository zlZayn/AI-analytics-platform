"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { SessionWorkspace } from "@/components/workspace/session-workspace"
import { parseRHistoryParam } from "@/lib/workspace-navigation"

function WorkspaceRoute() {
  const searchParams = useSearchParams()
  const connectionId = searchParams.get("connection")
  const initialSql = searchParams.get("sql") || ""
  // R 历史回放：同 SQL 不同 r 参数也要重建会话，故 key 含 r
  const rHistoryId = parseRHistoryParam(searchParams.get("r")) ?? ""
  return (
    <SessionWorkspace
      key={`${connectionId ?? ""}:${initialSql}:${rHistoryId}`}
      connectionId={connectionId}
      initialSql={initialSql}
      rHistoryId={rHistoryId}
    />
  )
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="p-6 text-[var(--muted-foreground)] text-xs">加载中...</div>}>
      <WorkspaceRoute />
    </Suspense>
  )
}