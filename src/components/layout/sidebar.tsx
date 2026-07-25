"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useConnection } from "./connection-context"
import {
  Database,
  Terminal,
  Search,
  Clock,
  ChevronDown,
  Check,
  Settings,
  Plus,
  Circle,
  X,
} from "lucide-react"
import type { Connection } from "@/types"
import { fetchApi } from "@/lib/client-api"

const navItems = [
  { href: "/workspace", label: "数据工作台", icon: Terminal },
  { href: "/explorer", label: "数据探索", icon: Search },
  { href: "/queries", label: "查询管理", icon: Clock },
]

export function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { connection, connectionId } = useConnection()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(false)
  const [connectionError, setConnectionError] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function loadConnections() {
    if (loading) return
    setLoading(true)
    setConnectionError(false)
    try {
      const response = await fetchApi<{ success: boolean; data?: Connection[] }>("/api/connections")
      if (response.success) setConnections(response.data ?? [])
    } catch {
      setConnectionError(true)
    } finally {
      setLoading(false)
    }
  }

  function toggleConnectionMenu() {
    const opening = !dropdownOpen
    setDropdownOpen(opening)
    if (opening && connections.length === 0) void loadConnections()
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dropdownOpen])

  function handleSelectConnection(conn: Connection) {
    const nav = pathname || "/workspace"
    router.push(`${nav}?connection=${conn.id}`)
    setDropdownOpen(false)
  }

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] text-[var(--sidebar-foreground)] shadow-xl transition-transform md:relative md:z-auto md:w-52 md:translate-x-0 md:shadow-none",
      mobileOpen ? "translate-x-0" : "-translate-x-full",
    )}>
      <button data-testid="mobile-nav-close" className="absolute right-2 top-3 rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)] md:hidden" onClick={onClose} aria-label="关闭导航">
        <X className="h-4 w-4" />
      </button>
      {/* Header */}
      <div className="px-3 py-3 border-b border-[var(--sidebar-border)]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[var(--sidebar-primary)] rounded-md flex items-center justify-center">
            <span className="text-[var(--sidebar-primary-foreground)] text-[10px] font-bold">AI</span>
          </div>
          <span className="text-[13px] font-semibold">Data Analytics</span>
        </Link>
      </div>

      {/* Connection Selector */}
      <div className="px-2 py-2 border-b border-[var(--sidebar-border)]" ref={dropdownRef}>
        <div className="relative">
          <button
            onClick={toggleConnectionMenu}
            className={cn(
              "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] transition-colors",
              connection
                ? "bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/80"
                : "border border-dashed border-[var(--sidebar-border)] hover:border-[var(--muted-foreground)] text-[var(--muted-foreground)]"
            )}
          >
            <Database className="w-3.5 h-3.5 opacity-50 shrink-0" />
            <span className="truncate flex-1 text-left">
              {connection ? connection.name : "选择连接"}
            </span>
            <ChevronDown className={cn(
              "w-3 h-3 opacity-50 shrink-0 transition-transform",
              dropdownOpen && "rotate-180"
            )} />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--popover)] border border-[var(--border)] rounded-md shadow-lg z-50 overflow-hidden">
              {loading ? (
                <div className="px-3 py-2 text-[10px] text-[var(--muted-foreground)]">
                  加载中...
                </div>
              ) : connectionError ? (
                <button type="button" className="w-full px-3 py-2 text-left text-[10px] text-[var(--destructive)] hover:bg-[var(--accent)]" onClick={() => void loadConnections()}>
                  连接加载失败，点击重试
                </button>
              ) : connections.length === 0 ? (
                <div className="px-3 py-2 text-[10px] text-[var(--muted-foreground)]">
                  暂无连接
                </div>
              ) : (
                <div className="max-h-48 overflow-auto py-0.5">
                  {connections.map((conn) => (
                    <button
                      key={conn.id}
                      onClick={() => handleSelectConnection(conn)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] transition-colors text-left",
                        conn.id === connectionId
                          ? "bg-[var(--accent)] text-[var(--foreground)]"
                          : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                      )}
                    >
                      <Circle className={cn(
                        "w-1.5 h-1.5 shrink-0",
                        conn.id === connectionId ? "fill-[var(--primary)]" : "fill-transparent stroke-[var(--muted-foreground)]"
                      )} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{conn.name}</div>
                        <div className="truncate text-[9px] text-[var(--muted-foreground)]">
                          {conn.database}
                        </div>
                      </div>
                      {conn.id === connectionId && (
                        <Check className="w-3 h-3 shrink-0 text-[var(--primary)]" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Footer actions */}
              <div className="border-t border-[var(--border)] px-1 py-0.5">
                <Link
                  href="/"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] rounded-sm transition-colors"
                >
                  <Settings className="w-3 h-3" />
                  管理连接
                </Link>
                <Link
                  href="/?action=create"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] rounded-sm transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  新建连接
                </Link>
              </div>
            </div>
          )}
        </div>
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
        <span className="text-[10px] text-[var(--muted-foreground)]">v1.23.0</span>
      </div>
    </aside>
  )
}
