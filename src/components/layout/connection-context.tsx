"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import type { Connection } from "@/types"
import { fetchApi } from "@/lib/client-api"

interface ConnectionContextType {
  connection: Connection | null
  connectionId: string | null
  loading: boolean
}

const ConnectionContext = createContext<ConnectionContextType>({
  connection: null,
  connectionId: null,
  loading: false,
})

export function useConnection() {
  return useContext(ConnectionContext)
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const connectionId = searchParams.get("connection")

  const [resolved, setResolved] = useState<{ id: string | null; connection: Connection | null }>({
    id: null,
    connection: null,
  })

  useEffect(() => {
    if (!connectionId) return

    const controller = new AbortController()
    fetchApi<{ success: boolean; data?: Connection }>(`/api/connections/${connectionId}`, {
      signal: controller.signal,
    })
      .then((data) => setResolved({ id: connectionId, connection: data.success ? data.data ?? null : null }))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResolved({ id: connectionId, connection: null })
        }
      })

    return () => controller.abort()
  }, [connectionId])

  const connection = resolved.id === connectionId ? resolved.connection : null
  const loading = connectionId !== null && resolved.id !== connectionId

  return (
    <ConnectionContext.Provider value={{ connection, connectionId, loading }}>
      {children}
    </ConnectionContext.Provider>
  )
}
