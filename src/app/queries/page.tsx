"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HistoryTimeline } from "@/components/history-timeline"
import { useToast } from "@/components/toast"
import { ApiRequestError, fetchApi } from "@/lib/client-api"
import { buildHistoryWorkspaceUrl, buildWorkspaceUrl } from "@/lib/workspace-navigation"
import { importLegacyLocalHistory, listHistory } from "@/lib/history-client"
import type { HistoryEntry } from "@/types/history"
import { filterTimeline, mergeHistoryTimeline, type TimelineItem } from "@/lib/history-merge"
import type { ApiResponse, QueryHistoryItem, SavedQuery } from "@/types"
import { Play, Trash2, Copy, Search, Bookmark, Clock } from "lucide-react"

export default function QueriesPage() {
  const searchParams = useSearchParams()
  const connectionId = searchParams.get("connection")
  const { toast } = useToast()

  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([])
  const [analysisHistory, setAnalysisHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!connectionId) return
    let active = true
    async function loadQueries(id: string) {
      setLoading(true)
      setError("")
      try {
        // 旧浏览器历史（v2 localStorage）先一次性导入服务端，再统一读取两类历史
        await importLegacyLocalHistory(id)
        const [saved, history, analysis] = await Promise.all([
          fetchApi<ApiResponse<SavedQuery[]>>(`/api/query/saved?connectionId=${id}`),
          fetchApi<ApiResponse<QueryHistoryItem[]>>(`/api/query/history?connectionId=${id}`),
          listHistory(id),
        ])
        if (!active) return
        if (saved.success) setSavedQueries(saved.data)
        if (history.success) setQueryHistory(history.data)
        setAnalysisHistory(analysis)
      } catch (requestError) {
        if (active) setError(requestError instanceof ApiRequestError ? requestError.message : "查询列表加载失败")
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadQueries(connectionId)
    return () => { active = false }
  }, [connectionId])

  // 统一历史时间线：SQL（query_history）+ AI/R（analysis_history）读取期合并，权威源都在服务端
  const mergedTimeline = useMemo(
    () => mergeHistoryTimeline(queryHistory, analysisHistory),
    [queryHistory, analysisHistory],
  )
  const timeline = useMemo(() => filterTimeline(mergedTimeline, search), [mergedTimeline, search])

  function goToWorkspace(sql: string) {
    const url = buildWorkspaceUrl(connectionId, sql)
    // Keep navigation explicit so production App Router transitions cannot drop `sql`.
    if (url) window.location.assign(url)
  }

  /** 时间线条目的「执行」：SQL/AI 带 SQL 直达；R 额外带 `r=<id>` 让工作台回放该条代码 */
  function openTimelineItem(item: TimelineItem) {
    if (!item.openSql) return
    const url = buildHistoryWorkspaceUrl(connectionId, item.openSql, item.kind === "r" ? item.id : null)
    if (url) window.location.assign(url)
  }

  async function deleteSaved(id: string) {
    try {
      await fetchApi(`/api/query/saved?id=${id}`, { method: "DELETE" })
      setSavedQueries((prev) => prev.filter((q) => q.id !== id))
      toast("已删除", "info")
    } catch (requestError) {
      toast(requestError instanceof ApiRequestError ? requestError.message : "删除失败，请重试", "error")
    }
  }

  function copySql(sql: string) {
    navigator.clipboard.writeText(sql)
    toast("已复制", "success")
  }

  const filteredSaved = savedQueries.filter(
    (q) => q.name.toLowerCase().includes(search.toLowerCase()) || q.sql.toLowerCase().includes(search.toLowerCase())
  )

  if (!connectionId) {
    return <div className="p-6 flex items-center justify-center min-h-[50vh] text-[var(--muted-foreground)] text-xs">请先选择数据库连接</div>
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-sm font-semibold text-[var(--foreground)]">查询管理</h1>
        <span className="text-[10px] text-[var(--muted-foreground)]">
          {savedQueries.length} 收藏 · {mergedTimeline.length} 历史
        </span>
      </div>
      {error && <div className="mb-3 rounded-md border border-[var(--destructive-border)] bg-[var(--destructive-surface)] px-3 py-2 text-xs text-[var(--destructive)]">{error}</div>}

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)]" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索查询..." className="pl-8 h-8 text-xs" />
      </div>

      <Tabs defaultValue="saved">
        <TabsList className="mb-3">
          <TabsTrigger value="saved" className="gap-1 text-xs">
            <Bookmark className="w-3 h-3" /> 收藏
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1 text-xs">
            <Clock className="w-3 h-3" /> 历史
          </TabsTrigger>
        </TabsList>

        {/* Saved */}
        <TabsContent value="saved">
          {loading ? (
            <p className="text-xs text-[var(--muted-foreground)] py-8 text-center">加载中...</p>
          ) : filteredSaved.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)] py-8 text-center">暂无收藏</p>
          ) : (
            <div className="space-y-2">
              {filteredSaved.map((q) => (
                <div key={q.id} className="group border rounded-md p-3 hover:border-[var(--border)] transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-xs font-medium text-[var(--foreground)]">{q.name}</span>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => goToWorkspace(q.sql)} title="执行">
                        <Play className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copySql(q.sql)} title="复制">
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-[var(--muted-foreground)] hover:text-[var(--destructive)]" onClick={() => deleteSaved(q.id)} title="删除">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <pre className="text-[10px] text-[var(--muted-foreground)] font-mono whitespace-pre-wrap break-all leading-relaxed bg-[var(--muted)] rounded p-2">
                    {q.sql}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History：SQL / AI / R 统一时间线 */}
        <TabsContent value="history">
          {loading ? (
            <p className="text-xs text-[var(--muted-foreground)] py-8 text-center">加载中...</p>
          ) : (
            <HistoryTimeline items={timeline} onOpen={openTimelineItem} onCopy={copySql} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
