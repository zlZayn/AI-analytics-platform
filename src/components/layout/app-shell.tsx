"use client"

import { Suspense, useState } from "react"
import { Menu } from "lucide-react"
import { Sidebar } from "./sidebar"
import { ConnectionProvider } from "./connection-context"
import { ToastProvider } from "@/components/toast"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[var(--background)] text-[var(--muted-foreground)]">加载中...</div>}>
      <ToastProvider>
        <ConnectionProvider>
          <div className="flex h-screen min-h-0">
            <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
            {mobileOpen && <button className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} aria-label="关闭导航" />}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-11 shrink-0 items-center border-b border-[var(--border)] bg-[var(--background)] px-3 md:hidden">
                <button data-testid="mobile-nav-open" className="rounded p-1.5 hover:bg-[var(--muted)]" onClick={() => setMobileOpen(true)} aria-label="打开导航">
                  <Menu className="h-4 w-4" />
                </button>
                <span className="ml-2 text-xs font-semibold">Data Analytics</span>
              </div>
              <main className="min-h-0 flex-1 overflow-auto">{children}</main>
            </div>
          </div>
        </ConnectionProvider>
      </ToastProvider>
    </Suspense>
  )
}
