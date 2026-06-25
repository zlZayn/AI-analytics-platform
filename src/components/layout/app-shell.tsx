"use client"

import { Suspense } from "react"
import { Sidebar } from "./sidebar"
import { ConnectionProvider } from "./connection-context"
import { ToastProvider } from "@/components/toast"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-gray-400">加载中...</div>}>
      <ToastProvider>
        <ConnectionProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </ConnectionProvider>
      </ToastProvider>
    </Suspense>
  )
}
