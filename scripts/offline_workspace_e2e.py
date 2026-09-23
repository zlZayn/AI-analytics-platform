import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import Page, Request, Route, sync_playwright


# 用 localhost 而非 127.0.0.1：Next.js 16 dev 拒绝跨来源 dev 资源（webpack-hmr），
# 127.0.0.1 访问会导致客户端永不挂载（见根 AGENTS.md 活跃坑）
BASE_URL = os.environ.get("BASE_URL", "http://localhost:4321")
OUTPUT_DIR = Path(__file__).resolve().parents[1] / ".artifacts" / "offline-e2e"
EXPECTED_WORKSPACE_SQL = "SELECT * FROM orders LIMIT 200"


def envelope(data: object) -> dict[str, object]:
    return {"success": True, "data": data, "requestId": "offline-e2e"}


def fulfill_connection(route: Route) -> None:
    # 详情响应（GET/PUT 共用）：含 username/ssl，列表响应刻意不含
    route.fulfill(json=envelope({
        "id": "test",
        "name": "离线测试连接",
        "description": None,
        "host": "localhost",
        "port": 5432,
        "database": "fixtures",
        "username": "analyst",
        "ssl": True,
        "status": "connected",
        "tableCount": 4,
    }))


def fulfill_connection_list(route: Route) -> None:
    # 与真实 GET /api/connections 对齐：不返回 username/ssl
    route.fulfill(json=envelope([
        {
            "id": "test",
            "name": "离线测试连接",
            "description": None,
            "host": "localhost",
            "port": 5432,
            "database": "fixtures",
            "status": "connected",
            "tableCount": 4,
        }
    ]))


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
    # 真实 /api/ai 返回的是 parseInsightItems 产物（含 sqlValid）；mock 不经解析，必须自带该标记，
    # 否则卡片走不了回退 SQL 执行路径（sqlValid 门控见 lib/ai-session-mapping.ts）
    route.fulfill(json=envelope({
        "items": [
            {
                "title": "洞察A：销售分布",
                "insight": "华东区销售占比最高",
                "sql": "SELECT 'A' AS note",
                "sqlValid": True,
                "chart": {"chartType": "bar", "x": "region", "y": "sales"},
                "fallback": True,
            },
            {
                "title": "洞察B：销售趋势",
                "insight": "销售额呈上升趋势",
                "sql": "SELECT 'B' AS note",
                "sqlValid": True,
                "chart": {"chartType": "line", "x": "day", "y": "sales"},
                "fallback": True,
            },
        ]
    }))


def fulfill_saved_queries(route: Route) -> None:
    route.fulfill(json=envelope([]))


# 有状态 mock：AI/R 历史权威源是服务端 analysis_history 表，POST 落库、GET 读回
analysis_history: list[dict[str, object]] = []


def fulfill_analysis_history(route: Route) -> None:
    if route.request.method == "POST":
        body = json.loads(route.request.post_data or "{}")
        entry = {
            **body,
            "id": f"analysis-{len(analysis_history) + 1}",
            "createdAt": body.get("createdAt", "2026-01-01T00:00:00Z"),
        }
        analysis_history.insert(0, entry)
        route.fulfill(json=envelope(entry))
        return
    kind = parse_qs(urlparse(route.request.url).query).get("kind", [None])[0]
    route.fulfill(json=envelope([entry for entry in analysis_history if not kind or entry.get("kind") == kind]))


def fulfill_query_history(route: Route) -> None:
    route.fulfill(json=envelope([
        {
            "id": "history-1",
            "sql": EXPECTED_WORKSPACE_SQL,
            "rowCount": 4,
            "executionTimeMs": 7,
            "status": "success",
            "errorCode": None,
            "createdAt": "2026-01-01T00:00:00Z",
        }
    ]))


def record_query_request(request: Request, query_requests: list[str]) -> None:
    if request.method == "POST" and urlparse(request.url).path == "/api/query":
        query_requests.append(request.post_data or "")


def assert_monaco_sql(page: Page, expected_sql: str) -> None:
    page.wait_for_function(
        """expectedSql => {
            const sql = document.querySelector('.monaco-editor .view-lines')?.textContent
                ?.replace(/\\u00a0/g, ' ') ?? ''
            return sql.includes(expectedSql)
        }""",
        arg=expected_sql,
        timeout=20_000,
    )


def assert_workspace_payload(
    page: Page,
    query_requests: list[str],
    request_count_before: int,
    expected_sql: str = EXPECTED_WORKSPACE_SQL,
) -> None:
    page.wait_for_url("**/workspace**", timeout=15_000)
    # 布局可拖拽（回归）：桌面视口下工作台纵向（编辑器高度）与横向（AI/结果宽度）句柄都在
    if page.get_by_role("separator").count() < 2:
        raise AssertionError("expected the workspace split handles on a desktop viewport")
    # 导航入口强制表格态：探索显示图表引导，数据表由「明细」承担
    page.get_by_test_id("chart-guide").wait_for(state="visible", timeout=20_000)
    if page.get_by_test_id("chart-surface").count() != 0:
        raise AssertionError("table state should not render a chart surface")
    if len(query_requests) != request_count_before + 1:
        raise AssertionError(
            f"expected one query request, got {len(query_requests) - request_count_before}"
        )

    params = parse_qs(urlparse(page.url).query)
    if params.get("sql") != [expected_sql]:
        raise AssertionError(f"workspace URL lost SQL: {page.url}")

    payload = json.loads(query_requests[-1])
    if payload.get("connectionId") != "test" or payload.get("sql") != expected_sql:
        raise AssertionError(f"workspace executed unexpected payload: {payload}")

    assert_monaco_sql(page, expected_sql)
    page.get_by_text("4 行", exact=False).first.wait_for()


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors: list[str] = []
        webr_aborted: list[str] = []
        query_requests: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("request", lambda request: record_query_request(request, query_requests))
        # 记录被故意 abort 的 WebR CDN 请求：对应 console 的 "Failed to load resource" 属预期内
        page.on("requestfailed", lambda request: webr_aborted.append(request.url) if "webr.r-wasm.org" in request.url else None)
        page.route("**/api/connections/test", fulfill_connection)
        page.route("**/api/query", fulfill_query)
        page.route("**/api/query/preview", fulfill_preview)
        page.route("**/api/query/saved*", fulfill_saved_queries)
        page.route("**/api/query/history*", fulfill_query_history)
        page.route("**/api/history*", fulfill_analysis_history)
        page.route("**/api/schema/test*", fulfill_schema)
        page.route("**/api/ai", fulfill_ai)
        # R 工作台：mock 掉 WebR CDN，制造确定性初始化失败（P1-5b 回归断言，不依赖真实网络）
        page.route("**webr.r-wasm.org**", lambda route: route.abort())

        # 回归路径：工作台 → 侧栏数据探索 →「在工作台执行」。
        # 同一 AppShell 内的客户端导航曾丢失 sql 查询参数。
        page.goto(f"{BASE_URL}/workspace?connection=test", wait_until="networkidle")
        page.get_by_role("link", name="数据探索", exact=True).click()
        page.wait_for_url("**/explorer**")
        page.get_by_role("button", name="orders", exact=True).click()
        page.get_by_role("button", name="在工作台执行", exact=True).wait_for(state="visible")
        query_request_count = len(query_requests)
        with page.expect_request("**/api/query"):
            page.get_by_role("button", name="在工作台执行", exact=True).click()
        assert_workspace_payload(page, query_requests, query_request_count)

        # 真实用户路径：数据探索 →「在工作台执行」→ 跳转 + SQL 填充 + 自动执行（无需手动点执行）
        page.goto(f"{BASE_URL}/explorer?connection=test", wait_until="networkidle")
        page.get_by_role("button", name="orders", exact=True).click()
        page.get_by_role("button", name="在工作台执行", exact=True).wait_for(state="visible")
        query_request_count = len(query_requests)
        with page.expect_request("**/api/query"):
            page.get_by_role("button", name="在工作台执行", exact=True).click()
        assert_workspace_payload(page, query_requests, query_request_count)

        # 历史记录 →「执行」→ 跳转 + SQL 填充 + 自动执行（与探索入口同一契约）
        page.goto(f"{BASE_URL}/queries?connection=test", wait_until="networkidle")
        page.get_by_role("tab", name="历史", exact=True).click()
        page.get_by_role("button", name="执行", exact=True).first.wait_for(state="visible")
        query_request_count = len(query_requests)
        with page.expect_request("**/api/query"):
            page.get_by_role("button", name="执行", exact=True).first.click()
        assert_workspace_payload(page, query_requests, query_request_count)

        # 表格不是图表类型：「明细」独占数据表（见 .agents/notes/2026-09-11-detail-table-single-owner.md）
        chart_labels = ["指标卡", "直方图", "折线图", "柱状图", "饼图", "散点图", "箱线图", "热力图", "相关矩阵"]
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

        # 明细独占数据表：读原始查询行，sales 为空的行（图表绑定会过滤）必须保留
        page.get_by_role("tab", name="明细", exact=True).click()
        detail_rows = page.locator("table tbody tr[data-row-index]")
        detail_rows.first.wait_for(state="visible", timeout=10_000)
        if detail_rows.count() != 4:
            raise AssertionError(f"明细未渲染全部 4 行原始数据，实际 {detail_rows.count()} 行")
        if "华北" not in page.locator("table tbody").inner_text():
            raise AssertionError("明细缺少 sales 为空的原始行")
        page.screenshot(path=str(OUTPUT_DIR / "detail-table.png"), full_page=True)

        # R 工作台错误态（P1-5b）：WebR 初始化失败时
        # 输出区离开「等待运行…」占位并显示错误，状态栏不误显「就绪」
        # 入口：结果头部条一级按钮「R 分析」（不再藏在「导出 ▼」菜单里）
        page.get_by_role("button", name="R 分析", exact=True).click()
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

        # 关闭面板（回归）：右侧停靠面板是浮层，关闭后平移出屏且 aria-hidden=true，
        # 不得再拦截结果区交互；代码与输出保持挂载（重新打开不丢）
        page.get_by_role("button", name="关闭 R 分析工作台", exact=True).click()
        page.wait_for_function(
            """() => {
                const panel = document.querySelector('aside[aria-label="R 分析工作台"]');
                return !!panel && panel.getAttribute('aria-hidden') === 'true';
            }""",
            timeout=10_000,
        )

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
        if page.get_by_role("tab", name="探索", exact=True).get_attribute("aria-selected") != "true":
            raise AssertionError("executing an insight did not select the explore tab")

        # 执行必须落地（回归）：卡片「执行」按钮离开加载态，且同一张卡片再次执行会真的再发一次查询。
        # 曾经同一份 querySpec 被编译去重吞掉 → 状态停在 compiling → 卡片永久转圈。
        settle = """() => {
            const buttons = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('执行'));
            return buttons.length > 0 && buttons.every((b) => !b.disabled);
        }"""
        page.wait_for_function(settle, timeout=15_000)
        # 点卡片会切到「探索」，回到洞察 Tab 再执行同一张卡片：必须真的再发一次查询（回归点）
        page.get_by_role("tab", name="洞察 2", exact=True).click()
        with page.expect_request("**/api/query"):
            page.get_by_role("tabpanel").get_by_role("button", name="执行", exact=True).first.click()
        page.wait_for_function(settle, timeout=15_000)
        page.screenshot(path=str(OUTPUT_DIR / "insights-tab.png"), full_page=True)

        # 保存查询闭环（也是 session-workspace 拆分的前置基线）：
        # 名称为空时保存按钮禁用；POST 带去空白的名称、连接 id 与非空编译 SQL；
        # 成功后对话框关闭且名称复位（再开是空的），并给出成功提示。
        saved_requests: list[str] = []
        page.on(
            "request",
            lambda request: saved_requests.append(request.post_data or "")
            if urlparse(request.url).path == "/api/query/saved"
            else None,
        )
        toolbar_save = page.get_by_role("button", name="保存", exact=True)
        if toolbar_save.count() != 1:
            raise AssertionError(f"expected exactly one save button before the dialog opens, got {toolbar_save.count()}")
        toolbar_save.click()
        save_dialog = page.get_by_role("dialog")
        save_dialog.wait_for(state="visible", timeout=10_000)
        if not save_dialog.get_by_role("button", name="保存", exact=True).is_disabled():
            raise AssertionError("save must stay disabled while the name is empty")
        save_dialog.get_by_label("名称", exact=True).fill("  销售趋势回归用例  ")
        with page.expect_request(
            lambda request: request.method == "POST" and urlparse(request.url).path == "/api/query/saved"
        ) as saved_request:
            save_dialog.get_by_role("button", name="保存", exact=True).click()
        saved_payload = json.loads(saved_request.value.post_data or "{}")
        if saved_payload.get("name") != "销售趋势回归用例":
            raise AssertionError(f"save name must be trimmed: {saved_payload}")
        if saved_payload.get("connectionId") != "test":
            raise AssertionError(f"save payload lost connectionId: {saved_payload}")
        if not saved_payload.get("sql"):
            raise AssertionError(f"save payload lost compiled sql: {saved_payload}")
        save_dialog.wait_for(state="hidden", timeout=10_000)
        page.get_by_text("查询已保存", exact=True).first.wait_for(state="visible", timeout=10_000)
        toolbar_save.click()
        save_dialog.wait_for(state="visible", timeout=10_000)
        if save_dialog.get_by_label("名称", exact=True).input_value() != "":
            raise AssertionError("name field must reset after a successful save")
        save_dialog.get_by_role("button", name="取消", exact=True).click()
        save_dialog.wait_for(state="hidden", timeout=10_000)
        if len(saved_requests) != 1:
            raise AssertionError(f"expected exactly one save POST, got {len(saved_requests)}")
        page.screenshot(path=str(OUTPUT_DIR / "save-query.png"), full_page=True)

        # 持久化（回归）：切页再回来，AI 对话与洞察卡片仍在；结果行不持久化，故图表区为空态
        page.get_by_role("link", name="数据探索", exact=True).click()
        page.wait_for_url("**/explorer**")
        page.goto(f"{BASE_URL}/workspace?connection=test", wait_until="networkidle")
        page.get_by_role("tab", name="洞察 2", exact=True).wait_for(state="visible", timeout=20_000)
        page.get_by_role("tabpanel").filter(has_text="华东区销售占比最高").wait_for(state="visible", timeout=20_000)
        if page.get_by_test_id("chart-surface").count() != 0:
            raise AssertionError("query result must not be persisted: chart surface should be empty until re-run")

        # 统一历史时间线（回归）：查询管理「历史」同时呈现 SQL 历史（query_history）与服务端 AI/R 历史（analysis_history，本次提问应已 POST 落库）
        page.goto(f"{BASE_URL}/queries?connection=test", wait_until="networkidle")
        page.get_by_role("tab", name="历史", exact=True).click()
        page.get_by_text("SQL", exact=True).first.wait_for(state="visible", timeout=10_000)
        page.get_by_text("AI", exact=True).first.wait_for(state="visible", timeout=10_000)
        page.get_by_text("测试多洞察", exact=False).first.wait_for(state="visible", timeout=10_000)
        page.screenshot(path=str(OUTPUT_DIR / "history-timeline.png"), full_page=True)

        page.screenshot(path=str(OUTPUT_DIR / "workspace-all-charts.png"), full_page=True)
        page.set_viewport_size({"width": 360, "height": 800})
        page.wait_for_timeout(250)
        if page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"):
            raise AssertionError("workspace has horizontal overflow at 360px")
        page.screenshot(path=str(OUTPUT_DIR / "workspace-mobile.png"), full_page=True)

        # 连接编辑回归：列表不含 username/ssl → 先取详情回填；密码留空不提交（PUT 缺省即保留密文）
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.route("**/api/connections", fulfill_connection_list)
        page.goto(f"{BASE_URL}/", wait_until="networkidle")
        page.get_by_role("button", name="编辑连接", exact=True).click()
        dialog = page.get_by_role("dialog")
        dialog.wait_for(state="visible", timeout=10_000)
        if dialog.get_by_label("用户名").input_value() != "analyst":
            raise AssertionError("edit dialog did not prefill username from the detail response")
        if dialog.get_by_label("密码").get_attribute("placeholder") != "留空则不修改":
            raise AssertionError("edit dialog does not mark the empty password as 'leave blank to keep'")
        with page.expect_request(
            lambda request: request.method == "PUT" and urlparse(request.url).path == "/api/connections/test"
        ) as put_request:
            dialog.get_by_role("button", name="保存", exact=True).click()
        payload = json.loads(put_request.value.post_data or "{}")
        if "password" in payload:
            raise AssertionError(f"empty password must be omitted from the update payload: {payload}")
        if payload.get("username") != "analyst" or payload.get("ssl") is not True:
            raise AssertionError(f"update payload lost username/ssl: {payload}")
        page.screenshot(path=str(OUTPUT_DIR / "connection-edit.png"), full_page=True)

        # WebR CDN 被故意 abort 产生的资源加载错误属预期内，其余报错才算失败
        unexpected = [e for e in errors if not (e == "Failed to load resource: net::ERR_FAILED" and webr_aborted)]
        if unexpected:
            raise AssertionError("browser errors: " + " | ".join(unexpected))
        browser.close()
    print(f"Offline workspace E2E passed; screenshot: {OUTPUT_DIR / 'workspace-all-charts.png'}")


if __name__ == "__main__":
    main()
