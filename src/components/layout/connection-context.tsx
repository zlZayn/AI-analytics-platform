"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import type { Connection } from "@/types"

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

  const [connection, setConnection] = useState<Connection | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (connectionId) {
      setLoading(true)
      fetch(`/api/connections/${connectionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setConnection(data.data)
          else setConnection(null)
        })
        .catch(() => setConnection(null))
        .finally(() => setLoading(false))
    } else {
      setConnection(null)
    }
  }, [connectionId])

  return (
    <ConnectionContext.Provider value={{ connection, connectionId, loading }}>
      {children}
    </ConnectionContext.Provider>
  )
}
