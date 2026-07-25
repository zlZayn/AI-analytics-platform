export function EmptyState({ message }: { message?: string }) {
  return (
    <div className="flex h-[320px] items-center justify-center text-[13px] text-[var(--chart-tick)]">
      {message || "暂无数据"}
    </div>
  )
}
