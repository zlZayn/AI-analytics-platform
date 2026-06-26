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
import type { Connection } from "@/types"

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
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Auto-open create dialog if ?action=create
  useEffect(() => {
    if (searchParams.get("action") === "create") {
      setDialogOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    fetch("/api/connections")
      .then((r) => r.json())
      .then((d) => d.success && setConnections(d.data))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit() {
    setSubmitting(true)
    setError("")
    try {
      const url = editingId ? `/api/connections/${editingId}` : "/api/connections"
      const method = editingId ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setDialogOpen(false)
        setForm(defaultForm)
        setEditingId(null)
        refresh()
      } else {
        setError(data.error)
      }
    } catch {
      setError("操作失败")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除？")) return
    const res = await fetch(`/api/connections/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (data.success) refresh()
  }

  function refresh() {
    fetch("/api/connections")
      .then((r) => r.json())
      .then((d) => d.success && setConnections(d.data))
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
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-base font-semibold text-gray-900">连接管理</h1>
        <p className="text-xs text-gray-400 mt-0.5">选择或创建 PostgreSQL 数据库连接</p>
      </div>

      {/* Connection List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-xs">加载中...</div>
      ) : connections.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Database className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 mb-1">暂无数据库连接</p>
          <p className="text-xs text-gray-400 mb-4">点击下方按钮创建第一个连接</p>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingId(null); setForm(defaultForm); setError("") } }}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-gray-900 text-white hover:bg-gray-800 h-8 px-3 text-xs font-medium transition-colors">
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
                {error && <p className="text-xs text-red-500">{error}</p>}
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
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group"
            >
              <div
                className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                onClick={() => enterConnection(conn)}
              >
                <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition-colors">
                  <Database className="w-4 h-4 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{conn.name}</div>
                  <div className="text-xs text-gray-400 truncate">
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
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => handleDelete(conn.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}

          {/* Add new */}
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingId(null); setForm(defaultForm); setError("") } }}>
            <DialogTrigger className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-lg border border-dashed border-gray-200 hover:border-gray-300 text-xs text-gray-400 hover:text-gray-600 transition-colors">
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
                {error && <p className="text-xs text-red-500">{error}</p>}
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
