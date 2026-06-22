"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChartConfigPanel } from "@/components/chart-config-panel"
import { type ChartMapping } from "@/components/chart"
import { inferChartType, inferMapping, type VariableInfo, inferVariableRole, computeVariableStats } from "@/lib/variable-types"
import dynamic from "next/dynamic"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-gray-100 animate-pulse rounded-lg" />
})

interface Connection {
  id: string
  name: string
  database: string
  tableCount?: number
}

interface QueryResult {
  columns: { name: string; type: string }[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
}

interface SchemaTable {
  name: string
  comment?: string
  columns: {
    name: string
    type: string
    nullable: boolean
    isPrimary: boolean
    comment?: string
  }[]
  rowEstimate: number
}

interface QueryHistoryItem {
  id: string
  sql: string
  rowCount: number
  executionTimeMs: number
  createdAt: string
}

interface SavedQuery {
  id: string
  name: string
  sql: string
  createdAt: string
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const connectionId = searchParams.get("connection")

  const [connection, setConnection] = useState<Connection | null>(null)
  const [sql, setSql] = useState("")
  const [result, setResult] = useState<QueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [aiMessage, setAiMessage] = useState("")
  const [aiResult, setAiResult] = useState<{ sql: string; explanation: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const [schema, setSchema] = useState<SchemaTable[]>([])
  const [schemaLoading, setSchemaLoading] = useState(false)

  const [chartMapping, setChartMapping] = useState<ChartMapping>({ chartType: "table" })

  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([])
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [saveName, setSaveName] = useState("")
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // 可视化模式
  const [vizMode, setVizMode] = useState(false)
  const [vizTableName, setVizTableName] = useState("")

  useEffect(() => {
    if (connectionId) {
      fetchConnection()
      fetchSchema()
      fetchQueryHistory()
      fetchSavedQueries()
    }
  }, [connectionId])

  async function fetchConnection() {
    try {
      const res = await fetch(`/api/connections/${connectionId}`)
      const data = await res.json()
      if (data.success) setConnection(data.data)
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchSchema() {
    setSchemaLoading(true)
    try {
      const res = await fetch(`/api/schema/${connectionId}`)
      const data = await res.json()
      if (data.success) setSchema(data.data.tables || [])
    } catch (err) {
      console.error(err)
    } finally {
      setSchemaLoading(false)
    }
  }

  async function fetchQueryHistory() {
    try {
      const res = await fetch(`/api/query/history?connectionId=${connectionId}`)
      const data = await res.json()
      if (data.success) setQueryHistory(data.data)
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchSavedQueries() {
    try {
      const res = await fetch(`/api/query/saved?connectionId=${connectionId}`)
      const data = await res.json()
      if (data.success) setSavedQueries(data.data)
    } catch (err) {
      console.error(err)
    }
  }

  // 从表进入可视化
  async function enterVisualization(tableName: string) {
    const querySql = `SELECT * FROM ${tableName} LIMIT 200`
    setSql(querySql)
    setVizMode(true)
    setVizTableName(tableName)
    await executeQuery(querySql)
  }

  // 从查询结果进入可视化
  function enterVizFromResult() {
    setVizMode(true)
    setVizTableName("查询结果")
  }

  // 退出可视化
  function exitVisualization() {
    setVizMode(false)
    setVizTableName("")
  }

  async function executeQuery(querySql?: string) {
    const sqlToExecute = querySql || sql
    if (!connectionId || !sqlToExecute.trim()) return

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, sql: sqlToExecute })
      })
      const data = await res.json()

      if (data.success) {
        setResult(data.data)
        setSql(sqlToExecute)
        // 自动推断图表类型和映射
        const vars: VariableInfo[] = data.data.columns.map((c: { name: string; type: string }) => {
          const values = data.data.rows.map((r: Record<string, unknown>) => r[c.name])
          const role = inferVariableRole(c.type, values)
          const stats = computeVariableStats(values)
          return { name: c.name, type: c.type, role, stats }
        })
        const chartType = inferChartType(vars)
        const mapping = inferMapping(vars, chartType)
        setChartMapping({ chartType, ...mapping })
        fetchQueryHistory()
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError("查询执行失败")
    } finally {
      setLoading(false)
    }
  }

  async function analyzeWithAI() {
    if (!connectionId || !aiMessage.trim()) return

    setAiLoading(true)
    setError("")
    setAiResult(null)

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, message: aiMessage })
      })
      const data = await res.json()

      if (data.success) {
        setAiResult(data.data)
        setSql(data.data.sql)
        // 自动执行 AI 生成的 SQL
        await executeQuery(data.data.sql)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError("AI 分析失败")
    } finally {
      setAiLoading(false)
    }
  }

  async function saveQuery() {
    if (!saveName.trim() || !sql.trim()) return

    try {
      const res = await fetch("/api/query/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          name: saveName,
          sql
        })
      })
      const data = await res.json()

      if (data.success) {
        setShowSaveDialog(false)
        setSaveName("")
        fetchSavedQueries()
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (!connectionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>未选择连接</CardTitle>
            <CardDescription>请先选择一个数据库连接</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = "/"}>
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => window.location.href = "/"}>
              ← 返回
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {connection?.name || "加载中..."}
              </h1>
              <p className="text-xs text-gray-500">{connection?.database}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{connection?.tableCount || 0} 张表</Badge>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* 可视化模式 */}
        {vizMode && result ? (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={exitVisualization}>
                    ← 退出可视化
                  </Button>
                  <div>
                    <CardTitle className="text-base">可视化分析: {vizTableName}</CardTitle>
                    <CardDescription>{result.rowCount} 行数据</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartConfigPanel
                columns={result.columns}
                data={result.rows}
                mapping={chartMapping}
                onChange={setChartMapping}
              />
            </CardContent>
          </Card>
        ) : (
        <Tabs defaultValue="editor">
          <TabsList>
            <TabsTrigger value="editor">SQL 编辑器</TabsTrigger>
            <TabsTrigger value="ai">AI 分析</TabsTrigger>
            <TabsTrigger value="schema">数据结构</TabsTrigger>
            <TabsTrigger value="history">查询历史</TabsTrigger>
          </TabsList>

          {/* SQL 编辑器 */}
          <TabsContent value="editor" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">SQL 编辑器</CardTitle>
                    <CardDescription>编写并执行 SQL 查询</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {sql.trim() && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSaveDialog(true)}
                      >
                        保存查询
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="border rounded-lg overflow-hidden">
                  <MonacoEditor
                    height="200px"
                    language="sql"
                    theme="vs-light"
                    value={sql}
                    onChange={(value) => setSql(value || "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      padding: { top: 10, bottom: 10 }
                    }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={() => executeQuery()} disabled={loading} size="sm">
                    {loading ? "执行中..." : "执行"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setSql(""); setResult(null) }}>
                    清空
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 查询结果 + 图表配置 */}
            {result && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">查询结果</CardTitle>
                      <CardDescription>
                        {result.rowCount} 行 · {result.executionTimeMs}ms
                      </CardDescription>
                    </div>
                    {!vizMode && (
                      <Button variant="outline" size="sm" onClick={enterVizFromResult}>
                        进入可视化
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 图表配置 + 图表 */}
                  <ChartConfigPanel
                    columns={result.columns}
                    data={result.rows}
                    mapping={chartMapping}
                    onChange={setChartMapping}
                  />

                  {/* 数据表格 */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="text-xs font-medium text-gray-500 px-3 py-2 bg-gray-50 border-b">
                      数据预览（前 100 行）
                    </div>
                    <div className="overflow-auto max-h-[300px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr className="border-b">
                            {result.columns.map((col) => (
                              <th key={col.name} className="text-left px-3 py-2 font-medium text-gray-700 text-xs">{col.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows.slice(0, 100).map((row, i) => (
                            <tr key={i} className="border-b hover:bg-gray-50">
                              {result.columns.map((col) => (
                                <td key={col.name} className="px-3 py-1.5 text-gray-600 text-xs">
                                  {String(row[col.name] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-red-600">{error}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* AI 分析 */}
          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">AI 数据分析</CardTitle>
                <CardDescription>用自然语言描述你想分析的内容</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3">
                  <Input
                    value={aiMessage}
                    onChange={(e) => setAiMessage(e.target.value)}
                    placeholder="例如：查看各药店的会员数量统计"
                    onKeyDown={(e) => e.key === "Enter" && !aiLoading && analyzeWithAI()}
                  />
                  <Button onClick={analyzeWithAI} disabled={aiLoading} size="sm">
                    {aiLoading ? "分析中..." : "分析"}
                  </Button>
                </div>

                {aiResult && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">AI 生成的 SQL:</p>
                    <pre className="text-xs text-blue-900 whitespace-pre-wrap font-mono">
                      {aiResult.sql}
                    </pre>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  提示：AI 会自动生成 SQL 并执行，结果将显示在「SQL 编辑器」标签页
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 数据结构 */}
          <TabsContent value="schema" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">数据结构</CardTitle>
                <CardDescription>
                  {schemaLoading ? "加载中..." : `${schema.length} 张表 · 点击表名进入可视化`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {schemaLoading ? (
                  <div className="text-center py-8 text-gray-500 text-sm">加载中...</div>
                ) : (
                  <div className="space-y-3">
                    {schema.map((table) => (
                      <div key={table.name} className="border rounded-lg p-3 hover:border-blue-200 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3
                              className="font-medium text-sm text-blue-600 cursor-pointer hover:underline"
                              onClick={() => enterVisualization(table.name)}
                            >
                              {table.name}
                            </h3>
                            <Badge variant="outline" className="text-xs">{table.rowEstimate} 行</Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => enterVisualization(table.name)}
                          >
                            可视化
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {table.columns.map((col) => (
                            <Badge key={col.name} variant="secondary" className="text-xs font-normal">
                              {col.name}
                              <span className="text-gray-400 ml-1">{col.type}</span>
                              {col.isPrimary && <span className="text-blue-500 ml-1">PK</span>}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 查询历史 */}
          <TabsContent value="history" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 保存的查询 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">保存的查询</CardTitle>
                </CardHeader>
                <CardContent>
                  {savedQueries.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">暂无保存</div>
                  ) : (
                    <div className="space-y-2">
                      {savedQueries.map((item) => (
                        <div
                          key={item.id}
                          className="p-2 border rounded cursor-pointer hover:bg-gray-50"
                          onClick={() => { setSql(item.sql); executeQuery(item.sql) }}
                        >
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-xs text-gray-500 truncate font-mono">{item.sql}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 查询历史 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">查询历史</CardTitle>
                </CardHeader>
                <CardContent>
                  {queryHistory.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">暂无历史</div>
                  ) : (
                    <div className="space-y-2">
                      {queryHistory.map((item) => (
                        <div
                          key={item.id}
                          className="p-2 border rounded cursor-pointer hover:bg-gray-50"
                          onClick={() => { setSql(item.sql); executeQuery(item.sql) }}
                        >
                          <div className="text-xs text-gray-500 truncate font-mono">{item.sql}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{item.rowCount} 行</Badge>
                            <span className="text-xs text-gray-400">{item.executionTimeMs}ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        )}
      </main>

      {/* 保存查询对话框 */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[400px]">
            <CardHeader>
              <CardTitle className="text-base">保存查询</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="save-name">查询名称</Label>
                <Input
                  id="save-name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="例如：各药店会员统计"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(false)}>
                  取消
                </Button>
                <Button size="sm" onClick={saveQuery} disabled={!saveName.trim()}>
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">加载中...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
