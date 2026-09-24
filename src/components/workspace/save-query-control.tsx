"use client"

// 「保存查询」单元：工具栏触发按钮 + 命名对话框 + POST /api/query/saved。
// 从 session-workspace.tsx 原样搬出（状态与提交逻辑一并搬走）；
// 行为由离线 E2E 的保存闭环断言钉住：空名禁用、名称去空白、connectionId、非空 SQL、
// 成功后关框并提示、再次打开时名称已复位。

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/components/toast"
import { fetchApi } from "@/lib/client-api"
import { Save } from "lucide-react"

interface SaveQueryControlProps {
  connectionId: string
  /** 当前已编译的 SQL；缺失时按钮禁用（与搬出前一致） */
  sql: string | undefined
}

export function SaveQueryControl({ connectionId, sql }: SaveQueryControlProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const { toast } = useToast()

  async function saveQuery() {
    if (!name.trim() || !sql || !connectionId) return
    try {
      await fetchApi("/api/query/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, name: name.trim(), sql }),
      })
      setOpen(false)
      setName("")
      toast("查询已保存", "success")
    } catch {
      toast("保存失败，请稍后重试", "error")
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!sql}
        className="h-7 text-xs gap-1"
      >
        <Save className="w-3.5 h-3.5" /> 保存
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>保存查询</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="save-name" className="text-xs">名称</Label>
            <Input
              id="save-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="查询名称"
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveQuery())}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>取消</Button>
            <Button size="sm" onClick={saveQuery} disabled={!name.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
