# 决策：Windows 脚本与中文文档编辑铁律（2026-09-03）

已实施：AGENTS 活跃坑记录 + 本决策记录

## 问题

本会话三次踩坑：PowerShell/Python 批量编辑 .cmd 与 UTF-8 中文文档时，破坏行尾（CRLF↔LF）与中文编码（逐字节转换破坏多字节字符），导致 diff 全量重写、乱码、需 git checkout 恢复。

## 决策

- 根目录 `*.cmd`：**CRLF + GBK(ANSI) + 无 BOM + 不用 chcp**。cmd 解析 LF 多行块报 "do was unexpected"；UTF-8 在记事本/控制台乱码。改 .cmd 一律字节级读改写（`ReadAllBytes` → GBK 解码 → 改 → GBK 编码回写字节），绝不 Python text mode
- 中文 UTF-8 文档（docs/、README、AGENTS）：**只用 read/write/edit 工具整份处理**，或 PowerShell `[System.IO.File]::ReadAllText/WriteAllText`（显式 UTF8 无 BOM）；禁止逐字节 `[char]` 拼接（破坏多字节）
- 任何批量编辑后跑三连校验：`check-line-endings.py`（行尾）、`git diff --check`（尾随空白）、抽查中文

## 替代方案（强制）

- Python `open(path, encoding=...)` text mode：Windows 隐式写 CRLF，行尾被破坏（已实测）
- 逐字节剔除 `\r`：破坏 UTF-8 多字节字符，中文乱码（已实测）
- PowerShell `Set-Content -Encoding UTF8`：写 BOM，干扰部分工具

## 影响

- Start Dev.cmd / Build.cmd 的新鲜度检测修复（`107ab6f`）即用字节级操作完成，全程未再破坏
- 该规则入根 AGENTS 活跃坑（每条规则后跟本记录链接习惯）