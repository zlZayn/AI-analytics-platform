"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Connection {
  id: string
  name: string
  description?: string
  host: string
  port: number
  database: string
  status: string
  tableCount?: number
  lastConnectedAt?: string
}

export default function Home() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    host: "localhost",
    port: 5432,
    database: "",
    username: "postgres",
    password: "",
    ssl: false
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // 加载连接列表
  useEffect(() => {
    fetchConnections()
  }, [])

  async function fetchConnections() {
    try {
      const res = await fetch("/api/connections")
      const data = await res.json()
      if (data.success) {
        setConnections(data.data)
      }
    } catch (err) {
      console.error("加载连接失败:", err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    setSubmitting(true)
    setError("")

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })
      const data = await res.json()

      if (data.success) {
        setDialogOpen(false)
        setFormData({
          name: "",
          description: "",
          host: "localhost",
          port: 5432,
          database: "",
          username: "postgres",
          password: "",
          ssl: false
        })
        fetchConnections()
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError("创建失败")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定要删除这个连接吗？")) return

    try {
      const res = await fetch(`/api/connections/${id}`, {
        method: "DELETE"
      })
      const data = await res.json()

      if (data.success) {
        fetchConnections()
      }
    } catch (err) {
      console.error("删除失败:", err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Data Analytics</h1>
            <p className="text-sm text-gray-500">通用型 AI 数据分析平台</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline">v1.0.0</Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">数据库连接</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{connections.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">总表数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {connections.reduce((sum, c) => sum + (c.tableCount || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">系统状态</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="default" className="bg-green-500">运行中</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Connections */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>数据库连接</CardTitle>
              <CardDescription>管理你的 PostgreSQL 数据库连接</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-8 px-2.5 text-sm font-medium">
                + 新建连接
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新建数据库连接</DialogTitle>
                  <DialogDescription>
                    填写 PostgreSQL 数据库连接信息
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">连接名称</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="生产数据库"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">描述（可选）</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="主要业务数据库"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="host">主机</Label>
                      <Input
                        id="host"
                        value={formData.host}
                        onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="port">端口</Label>
                      <Input
                        id="port"
                        type="number"
                        value={formData.port}
                        onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="database">数据库名</Label>
                    <Input
                      id="database"
                      value={formData.database}
                      onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                      placeholder="myapp"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="username">用户名</Label>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">密码</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="text-sm text-red-500">{error}</div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreate} disabled={submitting}>
                    {submitting ? "创建中..." : "创建"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : connections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无数据库连接，点击"新建连接"开始
              </div>
            ) : (
              <div className="space-y-4">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium">{conn.name}</div>
                        <div className="text-sm text-gray-500">
                          {conn.host}:{conn.port}/{conn.database}
                        </div>
                      </div>
                      <Badge
                        variant={conn.status === "connected" ? "default" : "destructive"}
                      >
                        {conn.status === "connected" ? "已连接" : "未连接"}
                      </Badge>
                      {conn.tableCount && (
                        <Badge variant="outline">{conn.tableCount} 张表</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/dashboard?connection=${conn.id}`}
                      >
                        进入
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(conn.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
