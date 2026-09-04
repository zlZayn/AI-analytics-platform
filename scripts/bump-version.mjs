// 版本 bump：只改 package.json 的 version 一行（其余字节不动）。
// 用法：node scripts/bump-version.mjs X.Y.Z
// 说明：sidebar 徽标读 NEXT_PUBLIC_APP_VERSION（next.config.ts 从 package.json 注入），
//       烟测脚本按 package.json 断言——改这一处即全局生效；但必须重新构建才会进入产物。
import { readFileSync, writeFileSync } from "fs"

const next = process.argv[2]
if (!/^\d+\.\d+\.\d+$/.test(next || "")) {
  console.error("用法: node scripts/bump-version.mjs X.Y.Z")
  process.exit(1)
}

const file = "package.json"
const raw = readFileSync(file, "utf8")
const match = raw.match(/"version":\s*"[^"]+"/)
if (!match) {
  console.error("package.json 中未找到 version 字段")
  process.exit(1)
}
const old = match[0].match(/"(\d+\.\d+\.\d+)"/)[1]
writeFileSync(file, raw.replace(match[0], `"version": "${next}"`), "utf8")
console.log(`版本 ${old} -> ${next}`)
console.log("记住：重建并重启（npm run build 后重启 next start），版本号才在页面生效")