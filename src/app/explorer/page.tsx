"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, RefreshCw, Key, Link2, Eye, Copy, Play, Database } from "lucide-react"
import type { SchemaTable, SchemaData } from "@/types"
import { useToast } from "@/components/toast"

export default function ExplorerPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const connectionId = searchParams.get("connection")
  const { toast } = useToast()

  const [schema, setSchema] = useState<SchemaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<SchemaTable | null>(null)
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (connectionId) fetchSchema()
  }, [connectionId])

  async function fetchSchema(refresh = false) {
    if (!connectionId) return
    setLoading(true)
    const res = await fetch(`/api/schema/${connectionId}${refresh ? "?refresh=true" : ""}`)
    const data = await res.json()
    if (data.success) setSchema({ tables: data.data.tables || [], relations: data.data.relations || [], version: data.data.version })
    setLoading(false)
  }

  async function previewTable(name: string) {
    if (!connectionId) return
    setPreviewLoading(true)
    setPreview(null)
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, sql: `SELECT * FROM ${name} LIMIT 20` }),
    })
    const data = await res.json()
    setPreview(data.success ? data.data.rows : null)
    setPreviewLoading(false)
  }

  function selectTable(t: SchemaTable) {
    setSelected(t)
    previewTable(t.name)
  }

  const tables = schema?.tables.filter(
    (t) => t.name.includes(search.toLowerCase()) || t.comment?.includes(search.toLowerCase())
  ) || []

  const related = schema?.relations.filter(
    (r) => r.fromTable === selected?.name || r.toTable === selected?.name
  ) || []

  if (!connectionId) {
    return <div className="p-6 flex items-center justify-center min-h-[50vh] text-[var(--muted-foreground)] text-xs">请先选择数据库连接</div>
  }

  return (
    <div className="p-4 h-[calc(100vh-2rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-sm font-semibold text-[var(--foreground)]">数据探索</h1>
        <div className="flex items-center gap-2">
          {schema && <Badge variant="outline" className="text-[10px]">{schema.tables.length} 表</Badge>}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => fetchSchema(true)} disabled={loading}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        {/* Table List */}
        <div className="w-64 flex flex-col min-h-0 border rounded-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索表..."
                className="pl-8 h-7 text-xs"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {tables.map((t) => (
              <button
                key={t.name}
                className={`w-full text-left px-3 py-2 text-xs transition-colors border-b border-[var(--border)] last:border-0 ${
                  selected?.name === t.name
                    ? "bg-[var(--accent)] font-medium"
                    : "hover:bg-[var(--muted)]"
                }`}
                onClick={() => selectTable(t)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Database className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </div>
                  <span className="text-[var(--muted-foreground)] shrink-0 ml-2 font-mono text-[10px]">{t.rowEstimate}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 min-h-0">
          {selected ? (
            <div className="h-full flex flex-col border rounded-lg">
              {/* Table header */}
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--foreground)]">{selected.name}</span>
                  {selected.comment && <span className="text-[10px] text-[var(--muted-foreground)]">{selected.comment}</span>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={() => {
                    const sql = `SELECT * FROM ${selected.name} LIMIT 200`
                    router.push(`/workspace?connection=${connectionId}&sql=${encodeURIComponent(sql)}`)
                  }}
                >
                  <Play className="w-2.5 h-2.5" /> 在工作台执行
                </Button>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="columns" className="flex-1 flex flex-col min-h-0">
                <div className="px-3 pt-2">
                  <TabsList className="h-7">
                    <TabsTrigger value="columns" className="gap-1 text-[11px] h-5 px-2">
                      <Key className="w-3 h-3" /> 字段 ({selected.columns.length})
                    </TabsTrigger>
                    <TabsTrigger value="relations" className="gap-1 text-[11px] h-5 px-2">
                      <Link2 className="w-3 h-3" /> 关联 ({related.length})
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="gap-1 text-[11px] h-5 px-2">
                      <Eye className="w-3 h-3" /> 预览
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Columns */}
                <TabsContent value="columns" className="flex-1 overflow-auto mt-0 p-3 pt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-[var(--muted-foreground)]">
                        <th className="py-1.5 font-semibold uppercase tracking-wider text-[10px]">字段</th>
                        <th className="py-1.5 font-semibold uppercase tracking-wider text-[10px]">类型</th>
                        <th className="py-1.5 font-semibold uppercase tracking-wider text-[10px]">可空</th>
                        <th className="py-1.5 font-semibold uppercase tracking-wider text-[10px]">说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.columns.map((c) => (
                        <tr key={c.name} className="border-b last:border-0 hover:bg-[var(--muted)]/50">
                          <td className="py-1.5 font-mono">
                            {c.isPrimary && <Key className="w-2.5 h-2.5 text-yellow-500 inline mr-1" />}
                            {c.name}
                          </td>
                          <td className="py-1.5 text-[var(--muted-foreground)] font-mono">{c.type}</td>
                          <td className="py-1.5 text-[var(--muted-foreground)]">{c.nullable ? "Y" : "N"}</td>
                          <td className="py-1.5 text-[var(--muted-foreground)]">{c.comment || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TabsContent>

                {/* Relations */}
                <TabsContent value="relations" className="flex-1 overflow-auto mt-0 p-3 pt-2">
                  {related.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)] py-8 text-center">无关联</p>
                  ) : (
                    <div className="space-y-1.5">
                      {related.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono">
                          <span className="text-[var(--foreground)]">{r.fromTable}.{r.fromColumn}</span>
                          <span className="text-[var(--muted-foreground)]">→</span>
                          <span className="text-[var(--foreground)]">{r.toTable}.{r.toColumn}</span>
                          <Badge variant="outline" className="text-[9px] ml-auto">{r.type}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Preview */}
                <TabsContent value="preview" className="flex-1 overflow-auto mt-0">
                  {previewLoading ? (
                    <p className="text-xs text-[var(--muted-foreground)] py-8 text-center">加载中...</p>
                  ) : !preview ? (
                    <p className="text-xs text-[var(--muted-foreground)] py-8 text-center">点击表名加载预览</p>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b text-left text-[var(--muted-foreground)]">
                            {selected.columns.map((c) => (
                              <th key={c.name} className="py-1.5 px-2 font-semibold uppercase tracking-wider text-[10px]">{c.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((row, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-[var(--muted)]/50">
                              {selected.columns.map((c) => (
                                <td key={c.name} className="py-1.5 px-2 font-mono">{String(row[c.name] ?? "")}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center border rounded-lg text-[var(--muted-foreground)] text-xs">
              <div className="text-center">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>选择左侧表查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
