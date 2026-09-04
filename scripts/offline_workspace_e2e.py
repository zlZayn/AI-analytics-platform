import os
from pathlib import Path

from playwright.sync_api import Route, sync_playwright


# 用 localhost 而非 127.0.0.1：Next.js 16 dev 拒绝跨来源 dev 资源（webpack-hmr），
# 127.0.0.1 访问会导致客户端永不挂载（见根 AGENTS.md 活跃坑）
BASE_URL = os.environ.get("BASE_URL", "http://localhost:4321")
OUTPUT_DIR = Path(__file__).resolve().parents[1] / ".artifacts" / "offline-e2e"


def envelope(data: object) -> dict[str, object]:
    return {"success": True, "data": data, "requestId": "offline-e2e"}


def fulfill_connection(route: Route) -> None:
    route.fulfill(json=envelope({
        "id": "test",
        "name": "离线测试连接",
        "host": "localhost",
        "port": 5432,
        "database": "fixtures",
        "status": "connected",
    }))


def fulfill_query(route: Route) -> None:
    rows = [
        {"day": "2026-01-01", "region": "华东", "sales": 10, "profit": 2},
        {"day": "2026-01-02", "region": "华南", "sales": 14, "profit": 4},
        {"day": "2026-01-03", "region": "华北", "sales": None, "profit": 3},
        {"day": "2026-01-04", "region": "西南", "sales": 9, "profit": 1},
    ]
    route.fulfill(json=envelope({
        "columns": [
            {"name": "day", "type": "date"},
            {"name": "region", "type": "varchar"},
            {"name": "sales", "type": "numeric"},
            {"name": "profit", "type": "numeric"},
        ],
        "rows": rows,
        "rowCount": len(rows),
        "returnedRowCount": len(rows),
        "truncated": False,
        "rowLimit": 5000,
        "executionTimeMs": 7,
    }))


def fulfill_schema(route: Route) -> None:
    route.fulfill(json=envelope({
        "version": 1,
        "scannedAt": "2026-01-01T00:00:00Z",
        "tables": [
            {
                "name": "orders",
                "comment": None,
                "columns": [
                    {"name": "day", "type": "date", "nullable": False},
                    {"name": "region", "type": "varchar", "nullable": True},
                    {"name": "sales", "type": "numeric", "nullable": True},
                    {"name": "profit", "type": "numeric", "nullable": True},
                ],
                "relations": [],
            }
        ],
        "relations": [],
    }))


def fulfill_preview(route: Route) -> None:
    route.fulfill(json=envelope({
        "columns": [
            {"name": "day", "type": "date"},
            {"name": "region", "type": "varchar"},
            {"name": "sales", "type": "numeric"},
        ],
        "rows": [
            {"day": "2026-01-01", "region": "华东", "sales": 10},
            {"day": "2026-01-02", "region": "华南", "sales": 14},
        ],
        "rowCount": 2,
        "returnedRowCount": 2,
        "truncated": False,
        "rowLimit": 100,
        "executionTimeMs": 3,
    }))


def fulfill_ai(route: Route) -> None:
    route.fulfill(json=envelope({
        "items": [
            {
                "title": "洞察A：销售分布",
                "insight": "华东区销售占比最高",
                "sql": "SELECT 'A' AS note",
                "chart": {"chartType": "bar", "x": "region", "y": "sales"},
                "fallback": True,
            },
            {
                "title": "洞察B：销售趋势",
                "insight": "销售额呈上升趋势",
                "sql": "SELECT 'B' AS note",
                "chart": {"chartType": "line", "x": "day", "y": "sales"},
                "fallback": True,
            },
        ]
    }))


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors: list[str] = []
        webr_aborted: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        # 记录被故意 abort 的 WebR CDN 请求：对应 console 的 "Failed to load resource" 属预期内
        page.on("requestfailed", lambda request: webr_aborted.append(request.url) if "webr.r-wasm.org" in request.url else None)
        page.route("**/api/connections/test", fulfill_connection)
        page.route("**/api/query", fulfill_query)
        page.route("**/api/query/preview", fulfill_preview)
        page.route("**/api/schema/test*", fulfill_schema)
        page.route("**/api/ai", fulfill_ai)
        # R 工作台：mock 掉 WebR CDN，制造确定性初始化失败（P1-5b 回归断言，不依赖真实网络）
        page.route("**webr.r-wasm.org**", lambda route: route.abort())

        # 真实用户路径：数据探索 →「在工作台执行」→ 跳转 + SQL 填充 + 自动执行（无需手动点执行）
        page.goto(f"{BASE_URL}/explorer?connection=test", wait_until="networkidle")
        page.get_by_role("button", name="orders", exact=True).click()
        page.get_by_role("button", name="在工作台执行", exact=True).wait_for(state="visible")
        with page.expect_request("**/api/query"):
            page.get_by_role("button", name="在工作台执行", exact=True).click()
        page.wait_for_url("**/workspace**", timeout=15000)
        page.get_by_test_id("chart-surface").wait_for(state="visible", timeout=20000)
        page.wait_for_function(
            "() => (document.querySelector('.monaco-editor .view-lines')?.textContent.replace(/\\u00a0/g, ' ') || '').includes('FROM orders')",
            timeout=20000,
        )
        page.get_by_text("4 行", exact=False).first.wait_for()

        chart_labels = ["表格", "指标卡", "直方图", "折线图", "柱状图", "饼图", "散点图", "箱线图", "热力图", "相关矩阵"]
        for label in chart_labels:
            button = page.get_by_role("button", name=label, exact=True)
            button.click()
            page.wait_for_timeout(100)
            if "bg-[var(--foreground)]" not in (button.get_attribute("class") or ""):
                raise AssertionError(f"{label} did not remain selected")
            surface_text = page.get_by_test_id("chart-surface").inner_text()
            if "请选择" in surface_text or "缺少必要字段" in surface_text:
                raise AssertionError(f"{label} has no usable default mapping: {surface_text}")

        page.get_by_text("正在计算相关矩阵...").wait_for(state="hidden")

        # R 工作台错误态（P1-5b）：WebR 初始化失败时
        # 输出区离开「等待运行…」占位并显示错误，状态栏不误显「就绪」
        # 入口：结果头部条「导出 ▼」菜单 →「R 分析」
        page.get_by_role("button", name="导出", exact=True).click()
        page.get_by_role("menuitem", name="R 分析", exact=True).click()
        page.get_by_text("R 分析 · df（", exact=False).wait_for(state="visible", timeout=10000)
        page.get_by_text("等待运行…", exact=False).wait_for(state="hidden", timeout=20000)
        page.get_by_text("R 环境初始化失败", exact=False).wait_for(state="visible", timeout=20000)
        # 状态栏（span 内，格式「初始化失败: <原因>」）显示具体失败原因，不再误显「就绪」
        page.locator("span", has_text="初始化失败: ").first.wait_for(state="visible", timeout=20000)
        if "就绪" in (page.locator("body").inner_text() or ""):
            raise AssertionError("R workbench status bar still shows fake ready")
        # 未初始化时点「运行」→ 写入「未就绪」错误项（不再静默无输出）
        page.get_by_role("button", name="运行", exact=True).click()
        page.get_by_text("R 环境未就绪", exact=False).wait_for(state="visible", timeout=20000)
        page.screenshot(path=str(OUTPUT_DIR / "r-workbench-error-state.png"), full_page=True)

        # AI 多洞察（阶段 1）：返回 2 条 → 洞察 Tab 卡片流 → 点卡片执行 → 切探索视图并渲染图表
        ai_input = page.get_by_placeholder("输入 @ 选表，如：对比 @orders 与 @customers 的销售趋势")
        ai_input.fill("测试多洞察")
        ai_input.press("Enter")
        page.get_by_role("tab", name="洞察 2", exact=True).wait_for(state="visible", timeout=20000)
        panel = page.get_by_role("tabpanel").filter(has_text="华东区销售占比最高")
        panel.wait_for(state="visible", timeout=20000)
        page.get_by_role("tabpanel").filter(has_text="销售额呈上升趋势").wait_for(state="visible", timeout=20000)
        with page.expect_request("**/api/query"):
            page.get_by_role("tabpanel").get_by_role("button", name="执行", exact=True).first.click()
        page.get_by_test_id("chart-surface").wait_for(state="visible", timeout=20000)
        page.get_by_role("tab", name="探索", exact=True).get_attribute("aria-selected")
        page.screenshot(path=str(OUTPUT_DIR / "insights-tab.png"), full_page=True)

        page.screenshot(path=str(OUTPUT_DIR / "workspace-all-charts.png"), full_page=True)
        # WebR CDN 被故意 abort 产生的资源加载错误属预期内，其余报错才算失败
        unexpected = [e for e in errors if not (e == "Failed to load resource: net::ERR_FAILED" and webr_aborted)]
        if unexpected:
            raise AssertionError("browser errors: " + " | ".join(unexpected))
        browser.close()
    print(f"Offline workspace E2E passed; screenshot: {OUTPUT_DIR / 'workspace-all-charts.png'}")


if __name__ == "__main__":
    main()
