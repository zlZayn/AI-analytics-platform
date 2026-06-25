"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, Check } from "lucide-react"

interface Option {
  value: string
  label: string
  extra?: string
}

interface Props {
  value: string
  options: Option[]
  placeholder?: string
  onChange: (value: string) => void
  className?: string
}

export function DropdownSelect({ value, options, placeholder = "请选择", onChange, className }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between h-9 px-2.5 rounded-md border border-[var(--input)] bg-transparent text-xs text-left hover:border-[var(--ring)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50"
      >
        <span className={cn("truncate", !selected && "text-[var(--muted-foreground)]")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-[200px] overflow-auto rounded-md border border-[var(--border)] bg-[var(--popover)] shadow-md">
          {options.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-[var(--muted-foreground)]">无选项</div>
          ) : (
            options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left hover:bg-[var(--accent)] transition-colors",
                  opt.value === value && "bg-[var(--accent)]"
                )}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
              >
                <div className="min-w-0">
                  <span className="truncate">{opt.label}</span>
                  {opt.extra && <span className="text-[var(--muted-foreground)] ml-1.5">{opt.extra}</span>}
                </div>
                {opt.value === value && <Check className="w-3 h-3 text-[var(--foreground)] shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
