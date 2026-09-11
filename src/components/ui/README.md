# ui/ — 基础交互组件

- `button.tsx`、`input.tsx`、`label.tsx`：表单与操作基础件。
- `tabs.tsx`、`dialog.tsx`、`select.tsx`、`dropdown-select.tsx`：复合交互件。
- `card.tsx`、`table.tsx`、`badge.tsx`：内容与状态基础件。
- `split-handle.tsx`：可拖拽分割句柄（受控、无业务状态；指针拖拽 + 方向键 + Home/双击复位），三处布局复用。

## 惯例

- 基底是 `@base-ui/react`（非 radix），变体用 cva，类名合并用 `cn`（`lib/utils.ts`）。
- `tabs.tsx`：`variant="default"`（muted 凹陷，explorer/queries 用）与 `"line"`（透明底 + 2px 指示条，结果区三层 Tabs 用）；激活态来自 Base UI 的 `data-active`（不是 `data-[state=active]`），自定义覆盖必须走 `group-data-[variant=…]/tabs-list:` 前缀。
- `dialog.tsx`：`DialogContent` 默认带右上关闭按钮，`DialogFooter` 默认不带且内建关闭文案是英文 "Close"；Title/Description 自动建立 aria-labelledby/describedby。
- `dropdown-select.tsx` 是手写件（无键盘与 aria，裸 `var(--xxx)` 风格，图表配置面板在用）；`select.tsx`、`card.tsx`、`table.tsx` 目前是备件，可直接复用。
