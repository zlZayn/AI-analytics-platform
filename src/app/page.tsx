"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Database, Plus, Pencil, Trash2, ArrowRight } from "lucide-react"
import type { ApiResponse, Connection } from "@/types"
import { ApiRequestError, fetchApi } from "@/lib/client-api"

const defaultForm = {
  name: "",
  description: "",
  host: "localhost",
  port: 5432,
  database: "",
  username: "postgres",
  password: "",
  ssl: false,
}

export default function Home() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shouldCreate = searchParams.get("action") === "create"
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(shouldCreate)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [listError, setListError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetchApi<ApiResponse<Connection[]>>("/api/connections", { signal: controller.signal }, 8000)
      .then((d) => { if (d.success) setConnections(d.data) })
      .catch((requestError) => { if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setListError(requestError instanceof ApiRequestError ? requestError.message : "连接列表加载失败") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  async function handleSubmit() {
    setSubmitting(true)
    setError("")
    try {
      const url = editingId ? `/api/connections/${editingId}` : "/api/connections"
      const method = editingId ? "PUT" : "POST"
      const data = await fetchApi<ApiResponse<Connection>>(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (data.success) {
        setDialogOpen(false)
        setForm(defaultForm)
        setEditingId(null)
        refresh()
      }
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : "操作失败")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除？")) return
    try {
      const data = await fetchApi<ApiResponse<{ deleted: boolean }>>(`/api/connections/${id}`, { method: "DELETE" })
      if (data.success) refresh()
    } catch (requestError) {
      setListError(requestError instanceof ApiRequestError ? requestError.message : "删除连接失败")
    }
  }

  function refresh() {
    setListError("")
    fetchApi<ApiResponse<Connection[]>>("/api/connections", {}, 8000)
      .then((d) => { if (d.success) setConnections(d.data) })
      .catch((requestError) => setListError(requestError instanceof ApiRequestError ? requestError.message : "连接列表加载失败"))
  }

  function openEdit(conn: Connection) {
    setEditingId(conn.id)
    setForm({
      name: conn.name,
      description: conn.description || "",
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: "postgres",
      password: "",
      ssl: false,
    })
    setDialogOpen(true)
  }

  function enterConnection(conn: Connection) {
    router.push(`/workspace?connection=${conn.id}`)
  }

  return (
    <div className="mx-auto max-w-2xl p-6 text-[var(--foreground)]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-base font-semibold text-[var(--foreground)]">连接管理</h1>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">选择或创建 PostgreSQL 数据库连接</p>
      </div>
      {listError && <div className="mb-4 flex items-center justify-between rounded-md border border-[var(--destructive-border)] bg-[var(--destructive-surface)] px-3 py-2 text-xs text-[var(--destructive)]"><span>{listError}</span><Button variant="ghost" size="sm" className="h-6 text-xs" onClick={refresh}>重试</Button></div>}

      {/* Connection List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[var(--muted-foreground)]">加载中...</div>
      ) : connections.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--muted)]">
            <Database className="h-5 w-5 text-[var(--muted-foreground)]" />
          </div>
          <p className="mb-1 text-sm text-[var(--foreground)]">暂无数据库连接</p>
          <p className="mb-4 text-xs text-[var(--muted-foreground)]">点击下方按钮创建第一个连接</p>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingId(null); setForm(defaultForm); setError("") } }}>
            <DialogTrigger className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90">
              <Plus className="w-3.5 h-3.5 mr-1" />
              新建连接
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>新建连接</DialogTitle>
                <DialogDescription>填写 PostgreSQL 连接信息</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Field label="名称" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="生产数据库" />
                <Field label="描述" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="可选" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="主机" value={form.host} onChange={(v) => setForm({ ...form, host: v })} />
                  <Field label="端口" value={String(form.port)} onChange={(v) => setForm({ ...form, port: Number(v) })} type="number" />
                </div>
                <Field label="数据库" value={form.database} onChange={(v) => setForm({ ...form, database: v })} placeholder="mydb" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="用户名" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
                  <Field label="密码" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
                </div>
                {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>取消</Button>
                <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "保存中..." : "保存"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="group flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--card-foreground)] transition-colors hover:border-[var(--ring)]"
            >
              <div
                className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                onClick={() => enterConnection(conn)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--muted)] transition-colors group-hover:bg-[var(--accent)]">
                  <Database className="h-4 w-4 text-[var(--muted-foreground)]" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--foreground)]">{conn.name}</div>
                  <div className="truncate text-xs text-[var(--muted-foreground)]">
                    {conn.host}:{conn.port}/{conn.database}
                    {conn.tableCount ? ` · ${conn.tableCount} 表` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => enterConnection(conn)}
                >
                  进入
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(conn)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[var(--muted-foreground)] hover:text-[var(--destructive)]" onClick={() => handleDelete(conn.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}

          {/* Add new */}
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingId(null); setForm(defaultForm); setError("") } }}>
            <DialogTrigger className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] p-2.5 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--ring)] hover:text-[var(--foreground)]">
              <Plus className="w-3.5 h-3.5" />
              新建连接
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? "编辑连接" : "新建连接"}</DialogTitle>
                <DialogDescription>填写 PostgreSQL 连接信息</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Field label="名称" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="生产数据库" />
                <Field label="描述" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="可选" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="主机" value={form.host} onChange={(v) => setForm({ ...form, host: v })} />
                  <Field label="端口" value={String(form.port)} onChange={(v) => setForm({ ...form, port: Number(v) })} type="number" />
                </div>
                <Field label="数据库" value={form.database} onChange={(v) => setForm({ ...form, database: v })} placeholder="mydb" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="用户名" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
                  <Field label="密码" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
                </div>
                {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>取消</Button>
                <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "保存中..." : "保存"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  )
}
