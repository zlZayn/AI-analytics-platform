// 构建新鲜度检测：源码（src/prisma，排除 generated + 配置文件）最新 mtime 对比 .next\BUILD_ID。
// 输出（stdout 纯文本，无换行）：OK | STALE | NOT_BUILT
// 供 Start Dev.cmd / Build.cmd 调用：for /f "usebackq delims=" %%s in (`node scripts\freshness.js`) do set "BUILD_STATE=%%s"
const fs = require("fs")
const path = require("path")

const DIRS = ["src", "prisma"]
const FILES = ["next.config.ts", "package.json", "tsconfig.json"]
const BUILD_ID = path.join(".next", "BUILD_ID")

function newestSourceMtime() {
  let newest = 0
  for (const dir of DIRS) walk(dir)
  function walk(dir) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!p.includes(`${path.sep}generated`)) walk(p)
      } else {
        const m = fs.statSync(p).mtimeMs
        if (m > newest) newest = m
      }
    }
  }
  for (const f of FILES) {
    try {
      const m = fs.statSync(f).mtimeMs
      if (m > newest) newest = m
    } catch {
      // 文件缺失（如未生成）忽略
    }
  }
  return newest
}

try {
  if (!fs.existsSync(BUILD_ID)) {
    process.stdout.write("NOT_BUILT")
  } else {
    process.stdout.write(newestSourceMtime() > fs.statSync(BUILD_ID).mtimeMs ? "STALE" : "OK")
  }
} catch {
  process.stdout.write("NOT_BUILT")
}