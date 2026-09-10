// 版本 bump：只改 package.json 的 version 一行（其余字节不动）。
// 用法：node scripts/bump-version.mjs {major|minor|patch|X.Y.Z}
//   语义：patch = 修复/文档；minor = 功能或行为变化；major = 破坏性契约变更
// 说明：sidebar 徽标读 NEXT_PUBLIC_APP_VERSION（next.config.ts 从 package.json 注入），
//       烟测脚本按 package.json 断言——改这一处即全局生效；但必须重新构建才会进入产物。
import { readFileSync, writeFileSync } from "fs"
import { fileURLToPath } from "node:url"

const RELEASE_INDEX = { major: 0, minor: 1, patch: 2 }

/** 相对递增（major/minor/patch，低位置零）或透传 X.Y.Z；非法输入抛错 */
export function nextVersion(current, input) {
  const parts = String(current).split(".").map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`非法当前版本: ${current}`)
  }
  if (/^\d+\.\d+\.\d+$/.test(input || "")) return input
  const index = RELEASE_INDEX[input]
  if (index === undefined) throw new Error("用法: node scripts/bump-version.mjs {major|minor|patch|X.Y.Z}")
  const next = [...parts]
  next[index] += 1
  for (let i = index + 1; i < 3; i += 1) next[i] = 0
  return next.join(".")
}

function main() {
  const raw = readFileSync("package.json", "utf8")
  const match = raw.match(/"version":\s*"(\d+\.\d+\.\d+)"/)
  if (!match) {
    console.error("package.json 中未找到 version 字段")
    process.exit(1)
  }
  let next
  try {
    next = nextVersion(match[1], process.argv[2])
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
  writeFileSync("package.json", raw.replace(match[0], `"version": "${next}"`), "utf8")
  console.log(`版本 ${match[1]} -> ${next}`)
  console.log("记住：重建并重启（npm run build 后重启 next start），版本号才在页面生效")
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
