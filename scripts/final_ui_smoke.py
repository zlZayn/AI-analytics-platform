import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BASE_URL", "http://localhost:4321")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / ".artifacts" / "ui-smoke"
APP_VERSION = json.loads((PROJECT_ROOT / "package.json").read_text(encoding="utf-8"))["version"]
VIEWPORTS = {
    "mobile": (360, 800),
    "tablet": (768, 900),
    "desktop": (1280, 900),
    "wide": (1440, 900),
}


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for name, (width, height) in VIEWPORTS.items():
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            console_errors: list[str] = []
            page_errors: list[str] = []
            failed_requests: list[str] = []
            error_responses: list[str] = []
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on("requestfailed", lambda request: failed_requests.append(f"{request.url}: {request.failure}"))
            page.on("response", lambda response: error_responses.append(f"{response.status} {response.url}") if response.status >= 400 else None)
            page.goto(BASE_URL, wait_until="domcontentloaded")
            page.locator("body").wait_for(state="visible")
            page.get_by_text(f"v{APP_VERSION}", exact=True).wait_for(state="visible", timeout=15000)
            theme_toggle_count = page.get_by_role("button", name="切换深色主题").count()
            if theme_toggle_count:
                failures.append(f"{name}: dark-theme toggle is still rendered")
            if page.locator("html").evaluate("element => element.classList.contains('dark')"):
                failures.append(f"{name}: html still has the dark class")
            color_scheme = page.locator("html").evaluate(
                "element => getComputedStyle(element).colorScheme"
            )
            if color_scheme != "light":
                failures.append(f"{name}: expected light color-scheme, got {color_scheme!r}")

            overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
            if overflow:
                failures.append(f"{name}: page has horizontal overflow")

            page.screenshot(path=str(OUTPUT_DIR / f"{name}.png"), full_page=True)

            if width < 768:
                try:
                    page.get_by_test_id("mobile-nav-open").wait_for(state="visible", timeout=15000)
                except Exception:
                    details = {
                        "url": page.url,
                        "title": page.title(),
                        "body": page.locator("body").inner_text()[:500],
                        "console_errors": console_errors,
                        "page_errors": page_errors,
                        "failed_requests": failed_requests,
                        "html": page.content()[:1000],
                    }
                    raise RuntimeError(f"{name}: app shell did not render: {details}")
                page.get_by_test_id("mobile-nav-open").click()
                page.get_by_test_id("mobile-nav-close").wait_for(state="visible")
                page.wait_for_function(
                    """() => {
                        const sidebar = document.querySelector('aside');
                        return sidebar && sidebar.getBoundingClientRect().left >= 0;
                    }"""
                )
                page.screenshot(path=str(OUTPUT_DIR / f"{name}-navigation.png"), full_page=True)
                page.get_by_test_id("mobile-nav-close").click()
            else:
                page.get_by_role("button", name="选择连接").click()
                page.get_by_role("link", name="管理连接").wait_for()
                page.screenshot(path=str(OUTPUT_DIR / f"{name}-connections.png"), full_page=True)

            if console_errors:
                expected_offline_responses = [
                    response for response in error_responses
                    if response.startswith("500 ") and response.endswith("/api/connections")
                ]
                generic_resource_errors = all("Failed to load resource" in error for error in console_errors)
                offline_state_visible = "获取连接列表失败" in page.locator("body").inner_text()
                if not (
                    len(expected_offline_responses) == len(error_responses)
                    and generic_resource_errors
                    and offline_state_visible
                ):
                    failures.append(f"{name}: console errors: {' | '.join(console_errors)}; responses: {' | '.join(error_responses)}")
            if page_errors or failed_requests:
                failures.append(f"{name}: page errors: {' | '.join(page_errors)}; failed requests: {' | '.join(failed_requests)}")
            context.close()

        browser.close()

    if failures:
        raise SystemExit("\n".join(failures))
    print(f"UI smoke passed; screenshots: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
