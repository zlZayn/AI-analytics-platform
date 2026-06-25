"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useConnection } from "./connection-context"
import {
  Database,
  Terminal,
  Search,
  Clock,
  ArrowLeft,
} from "lucide-react"

const navItems = [
  { href: "/workspace", label: "数据工作台", icon: Terminal },
  { href: "/explorer", label: "数据探索", icon: Search },
  { href: "/queries", label: "查询管理", icon: Clock },
]

export function Sidebar() {
  const pathname = usePathname()
  const { connection, connectionId } = useConnection()

  return (
    <aside className="w-52 bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] flex flex-col shrink-0 text-[var(--sidebar-foreground)]">
      {/* Header */}
      <div className="px-3 py-3 border-b border-[var(--sidebar-border)]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[var(--sidebar-primary)] rounded-md flex items-center justify-center">
            <span className="text-[var(--sidebar-primary-foreground)] text-[10px] font-bold">AI</span>
          </div>
          <span className="text-[13px] font-semibold">Data Analytics</span>
        </Link>
      </div>

      {/* Connection */}
      <div className="px-2 py-2 border-b border-[var(--sidebar-border)]">
        {connection ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[var(--sidebar-accent)]">
              <Database className="w-3.5 h-3.5 opacity-50" />
              <span className="text-[11px] font-medium truncate">{connection.name}</span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1 px-2 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <ArrowLeft className="w-2.5 h-2.5" />
              切换连接
            </Link>
          </div>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-dashed border-[var(--sidebar-border)] hover:border-[var(--muted-foreground)] text-[11px] text-[var(--muted-foreground)] transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            选择连接
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href)
          const disabled = !connectionId
          const Icon = item.icon
          const href = connectionId ? `${item.href}?connection=${connectionId}` : item.href

          return (
            <Link
              key={item.href}
              href={disabled ? "#" : href}
              className={cn(
                "flex items-center gap-2 px-2.5 h-[34px] rounded-md text-[13px] transition-colors",
                disabled && "pointer-events-none opacity-48",
                active
                  ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] font-medium"
                  : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
              )}
            >
              <Icon className="w-4 h-4 opacity-60" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[var(--sidebar-border)]">
        <span className="text-[10px] text-[var(--muted-foreground)]">v1.19.0</span>
      </div>
    </aside>
  )
}
