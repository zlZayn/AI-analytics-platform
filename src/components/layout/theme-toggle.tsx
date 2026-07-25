"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

type Theme = "light" | "dark"

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    const stored = window.localStorage.getItem("analytics-theme") as Theme | null
    const initial = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    setTheme(initial)
    document.documentElement.classList.toggle("dark", initial === "dark")
  }, [])

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    window.localStorage.setItem("analytics-theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  return (
    <button type="button" onClick={toggleTheme} className="rounded p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]" title={theme === "dark" ? "切换亮色主题" : "切换深色主题"} aria-label={theme === "dark" ? "切换亮色主题" : "切换深色主题"}>
      {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  )
}
