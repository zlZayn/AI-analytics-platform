"use client"

import dynamic from "next/dynamic"
import "@/lib/monaco-setup"

// 复用 workspace 相同的 Monaco 加载模式（本地托管，无 CDN）
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-full bg-[var(--muted)] animate-pulse rounded-lg" />,
})

interface RWorkbenchEditorProps {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  readOnly?: boolean
}

/** R 代码编辑器：Monaco（language=r），Ctrl+Enter 运行，最小侵入的适配层。 */
export function RWorkbenchEditor({ value, onChange, onRun, readOnly }: RWorkbenchEditorProps) {
  return (
    <div className="min-h-[200px] flex-1 border rounded-lg overflow-hidden min-w-0">
      <MonacoEditor
        height="100%"
        language="r"
        theme="vs-light"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={(editor) => {
          editor.addAction({
            id: "r-run",
            label: "运行 R 代码",
            keybindings: [2049 /* Ctrl+Enter */],
            run: () => onRun(),
          })
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          padding: { top: 8, bottom: 8 },
          readOnly: readOnly ?? false,
          tabSize: 2,
        }}
      />
    </div>
  )
}