"use client"

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"
import { X } from "lucide-react"

interface Toast {
  id: string
  message: string
  type: "success" | "error" | "info" | "warning"
}

interface ToastContextType {
  toast: (message: string, type?: Toast["type"]) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

const TOAST_STYLES: Record<Toast["type"], string> = {
  success: "border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success)]",
  error: "border-[var(--destructive-border)] bg-[var(--destructive-surface)] text-[var(--destructive)]",
  warning: "border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning)]",
  info: "border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)]",
}

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextIdRef = useRef(0)

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    nextIdRef.current += 1
    const id = `toast-${nextIdRef.current}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container：aria-live 播报（polite 不打断当前朗读） */}
      <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg animate-in slide-in-from-bottom-2 ${TOAST_STYLES[t.type]}`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="关闭提示"
              className="rounded p-0.5 hover:bg-[var(--accent)] transition-colors cursor-pointer"
            >
              <X className="w-3 h-3 opacity-60" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
