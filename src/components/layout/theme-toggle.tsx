"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"

type Theme = "light" | "dark"

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, () => "light")

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark"
    window.localStorage.setItem("analytics-theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
    window.dispatchEvent(new Event("analytics-theme-change"))
  }

  return (
    <button type="button" onClick={toggleTheme} className="rounded p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]" title={theme === "dark" ? "切换亮色主题" : "切换深色主题"} aria-label={theme === "dark" ? "切换亮色主题" : "切换深色主题"}>
      {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  )
}

function getTheme(): Theme {
  const stored = window.localStorage.getItem("analytics-theme")
  if (stored === "light" || stored === "dark") return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function subscribeToTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  window.addEventListener("storage", onChange)
  window.addEventListener("analytics-theme-change", onChange)
  media.addEventListener("change", onChange)
  document.documentElement.classList.toggle("dark", getTheme() === "dark")

  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener("analytics-theme-change", onChange)
    media.removeEventListener("change", onChange)
  }
}
