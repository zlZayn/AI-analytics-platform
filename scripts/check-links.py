#!/usr/bin/env python3
"""Markdown 相对链接校验：扫描目录（或单文件）下 .md 文件的 [text](path) 链接。

用法: python check-links.py [路径...] [--fragments] [--exclude GLOB] [--no-ignore]
                            [--encoding ENC] [--quiet] [--verbose] [--github]
- 路径：目录（递归）或单个 .md 文件，均可混合；默认当前目录。
- 默认跳过 .git / node_modules / .venv / dist 等目录；--no-ignore 关闭跳过。
- 外链(http/https/mailto/data/tel)、纯锚点(#x)、模板占位符({...}) 跳过。
- 错误 = 链接目标不存在；警告 = 锚点未找到(--fragments)。
- --github: 模拟 GitHub 解析（Linux 语义）——
  大小写敏感逐组件比对 + 链接目标须被 git 跟踪（目录链接放行）。
  Windows 本地存在不敏感，此模式在推送前补查 GitHub 上会 404 的链接。
  非 git 仓库中跳过跟踪检查，避免误报。
- 退出码: 0 = 无错误, 1 = 有错误（警告不影响退出码）。
"""
import argparse
import fnmatch
import os
import re
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

EXCLUDE_DIRS = {
    ".git", ".hg", ".svn", "node_modules", ".venv", "venv", "__pycache__",
    ".idea", ".vscode", "dist", "build", ".pytest_cache", ".ruff_cache",
}
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
FENCE_RE = re.compile(r"^(`{3,}|~{3,})")


def iter_md_files(paths, exclude, no_ignore):
    for path in paths:
        p = os.path.abspath(path)
        if os.path.isfile(p):
            if p.lower().endswith((".md", ".markdown")) and not _excluded(p, exclude):
                yield p
            continue
        for dirpath, dirnames, filenames in os.walk(p):
            if not no_ignore:
                dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
            dirnames[:] = [d for d in dirnames
                           if not _excluded(os.path.join(dirpath, d), exclude)]
            for fn in filenames:
                full = os.path.join(dirpath, fn)
                if fn.lower().endswith((".md", ".markdown")) and not _excluded(full, exclude):
                    yield full


def _excluded(path, patterns):
    return any(fnmatch.fnmatch(path, pat) or fnmatch.fnmatch(os.path.basename(path), pat)
               for pat in patterns)


def strip_code_blocks(text):
    out, fence = [], None
    for line in text.splitlines():
        if fence:
            if FENCE_RE.match(line):
                fence = None
            continue
        m = FENCE_RE.match(line)
        if m:
            fence = m.group(1)[0]
            continue
        out.append(line)
    return re.sub(r"`[^`\n]+`", "", "\n".join(out))


def slugify(anchor):
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", anchor.lower()).strip("-")


def heading_anchors(path):
    anchors = set()
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if s.startswith("#"):
                    anchors.add(slugify(s.lstrip("#").strip()))
                m = re.search(r'<a\s+id="([^"]+)"', line)
                if m:
                    anchors.add(m.group(1))
    except OSError:
        pass
    return anchors


# ── GitHub 语义（--github）──

def exact_case_exists(path):
    """路径存在且逐组件大小写精确匹配磁盘条目（模拟 Linux/GitHub）"""
    abs_path = os.path.abspath(path)
    parts = [p for p in abs_path.split(os.sep) if p]
    if not parts:
        return False
    if os.name == "nt":
        head = parts[0] + os.sep  # 盘符（"C:\"）
        parts = parts[1:]
    else:
        head = "/"
    for part in parts:
        if not os.path.exists(head):
            return False
        try:
            if part not in os.listdir(head):
                return False
        except OSError:
            return False
        head = os.path.join(head, part)
    return True


_tracked_by_root: dict[str, set[str]] = {}


def _find_git_root(path):
    """向上找 .git（目录或文件），返回仓库根；找不到返回 None"""
    current = os.path.abspath(path)
    if os.path.isfile(current):
        current = os.path.dirname(current)
    while True:
        if os.path.exists(os.path.join(current, ".git")):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return None
        current = parent


def _tracked_files(root):
    """仓库根 → git ls-files 相对路径集合（POSIX 分隔符）"""
    if root not in _tracked_by_root:
        result = subprocess.run(
            ["git", "-C", root, "ls-files"], capture_output=True, text=True,
        )
        _tracked_by_root[root] = set(result.stdout.splitlines())
    return _tracked_by_root[root]


def github_target_status(path):
    """GitHub 语义检查。返回 (ok, message)：
    - 非 git 仓库 → (True, None)（跳过，不误报）
    - 越出仓库根 → (False, "越出仓库根")
    - 目录 → (True, None)（目录链接 GitHub 可打开）
    - 文件未跟踪 → (False, "未被 git 跟踪")
    - 其余 → (True, None)
    """
    if not exact_case_exists(path):
        return False, "目标不存在或大小写不匹配（GitHub 大小写敏感）"
    root = _find_git_root(path)
    if root is None:
        return True, None
    rel = os.path.relpath(path, root)
    if rel == ".." or rel.startswith(".." + os.sep):
        return False, "越出仓库根"
    if os.path.isdir(path):
        return True, None
    posix_rel = rel.replace(os.sep, "/")
    if posix_rel not in _tracked_files(root):
        return False, "未被 git 跟踪（GitHub 上不存在）"
    return True, None


def main():
    ap = argparse.ArgumentParser(description="Markdown 相对链接校验")
    ap.add_argument("paths", nargs="*", default=["."], help="目录或 .md 文件（默认当前目录）")
    ap.add_argument("--fragments", action="store_true", help="同时校验 #锚点（警告级）")
    ap.add_argument("--exclude", action="append", default=[], help="排除模式（fnmatch，可多次）")
    ap.add_argument("--no-ignore", action="store_true", help="不跳过 .git/node_modules 等目录")
    ap.add_argument("--encoding", default="utf-8", help="文件解码编码（默认 utf-8）")
    ap.add_argument("--quiet", action="store_true", help="只输出错误与汇总")
    ap.add_argument("--verbose", action="store_true", help="每个文件列出链接计数")
    ap.add_argument("--github", action="store_true",
                    help="模拟 GitHub 解析：大小写敏感 + 目标须被 git 跟踪（目录放行）")
    args = ap.parse_args()

    errors, warnings, files, links = [], [], 0, 0
    for md in iter_md_files(args.paths, args.exclude, args.no_ignore):
        files += 1
        try:
            with open(md, encoding=args.encoding) as f:
                text = strip_code_blocks(f.read())
        except OSError as e:
            warnings.append(f"{md}: 读取失败 {e}")
            continue
        base = os.path.dirname(md)
        file_links = 0
        for target in LINK_RE.findall(text):
            links += 1
            file_links += 1
            raw = target.strip()
            if raw.startswith("<") and raw.endswith(">"):
                raw = raw[1:-1]
            if "://" in raw or raw.startswith(("mailto:", "data:", "tel:")):
                continue
            if "{" in raw or "}" in raw:  # 模板占位符，跳过
                continue
            anchor = None
            if "#" in raw:
                raw, anchor = raw.split("#", 1)
            if not raw:
                continue
            path = os.path.normpath(os.path.join(base, raw))
            if args.github:
                ok, message = github_target_status(path)
                if not ok:
                    errors.append(f"{md}: 链接目标 {message} -> {raw}")
                    continue
            elif not os.path.exists(path):
                errors.append(f"{md}: 链接目标不存在 -> {raw}")
                continue
            if anchor and args.fragments and anchor not in heading_anchors(path):
                warnings.append(f"{md}: 锚点未找到 #{anchor} -> {raw}")
        if args.verbose and not args.quiet:
            print(f"{md}: {file_links} 链接")

    for e in errors:
        print("ERROR", e)
    if not args.quiet:
        for w in warnings:
            print("WARN ", w)
    print(f"checked {files} files, {links} links, {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
