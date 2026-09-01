# 决策：项目重命名为 AI-analytics-platform（2026-09-01）

已实施：完成

## 问题

项目原名 `ai-data-analytics`，目录已改名为 `AI-analytics-platform`，命名不一致。

## 决策

- 目录名：`AI-analytics-platform`
- npm 包名：`ai-analytics-platform`（kebab-case）
- 展示名：AI Analytics Platform
- 文档内旧名引用与盘符绝对路径全部同步为相对写法，不保留旧名别名

## 替代方案（强制）

- 保留 `ai-data-analytics` 包名：与目录名持续不一致，改名波及面反复出现
- 目录名回退为旧名：改名是既成事实，回退代价更高

## 影响

- `package.json` / `package-lock.json` 的 name 字段更新为 `ai-analytics-platform`
- 文档引用改为相对项目根写法，仓库可移植
- 缓存/工具目录（.next、.artifacts 等）内的旧名与旧路径命中可再生，不修改