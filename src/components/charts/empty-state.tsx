export function EmptyState({ message }: { message?: string }) {
  return (
    <div
      className="flex items-center justify-center h-[320px]"
      style={{ fontSize: 13, color: "var(--chart-tick, #9ca3af)" }}
    >
      {message || "暂无数据"}
    </div>
  )
}
