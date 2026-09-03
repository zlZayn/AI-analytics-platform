"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { SessionWorkspace } from "@/components/workspace/session-workspace"

function WorkspaceRoute() {
  const searchParams = useSearchParams()
  const connectionId = searchParams.get("connection")
  const initialSql = searchParams.get("sql") || ""
  return (
    <SessionWorkspace
      key={`${connectionId ?? ""}:${initialSql}`}
      connectionId={connectionId}
      initialSql={initialSql}
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