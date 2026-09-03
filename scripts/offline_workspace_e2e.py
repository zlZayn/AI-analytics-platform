import os
from pathlib import Path

from playwright.sync_api import Route, sync_playwright


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4321")
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


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.route("**/api/connections/test", fulfill_connection)
        page.route("**/api/query", fulfill_query)
        page.route("**/api/schema/test*", fulfill_schema)
        page.goto(f"{BASE_URL}/workspace?connection=test&sql=SELECT%201", wait_until="networkidle")

        execute_button = page.get_by_role("button", name="执行", exact=True)
        execute_button.wait_for(state="visible")
        page.wait_for_function("button => !button.disabled", arg=execute_button.element_handle())
        try:
            with page.expect_request("**/api/query"):
                execute_button.click()
            page.get_by_test_id("chart-surface").wait_for(state="visible")
        except Exception as error:
            page.screenshot(path=str(OUTPUT_DIR / "workspace-failure.png"), full_page=True)
            body = page.locator("body").inner_text()[:1500]
            raise AssertionError(f"query result did not render: {error}; body={body}") from error
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
        page.screenshot(path=str(OUTPUT_DIR / "workspace-all-charts.png"), full_page=True)
        if errors:
            raise AssertionError("browser errors: " + " | ".join(errors))
        browser.close()
    print(f"Offline workspace E2E passed; screenshot: {OUTPUT_DIR / 'workspace-all-charts.png'}")


if __name__ == "__main__":
    main()
