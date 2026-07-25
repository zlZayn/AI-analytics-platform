from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4321"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / ".artifacts" / "ui-smoke"
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
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on("requestfailed", lambda request: failed_requests.append(f"{request.url}: {request.failure}"))
            page.goto(BASE_URL, wait_until="domcontentloaded")
            page.locator("body").wait_for(state="visible")

            overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
            if overflow:
                failures.append(f"{name}: page has horizontal overflow")

            page.screenshot(path=str(OUTPUT_DIR / f"{name}-light.png"), full_page=True)

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
                page.screenshot(path=str(OUTPUT_DIR / f"{name}-navigation.png"), full_page=True)
                page.get_by_test_id("mobile-nav-close").click()
            else:
                page.get_by_role("button", name="选择连接").click()
                page.get_by_role("link", name="管理连接").wait_for()
                toggle = page.get_by_role("button", name="切换深色主题")
                toggle.click()
                page.locator("html.dark").wait_for(state="attached")
                page.screenshot(path=str(OUTPUT_DIR / f"{name}-dark.png"), full_page=True)

            if console_errors:
                failures.append(f"{name}: console errors: {' | '.join(console_errors)}")
            context.close()

        browser.close()

    if failures:
        raise SystemExit("\n".join(failures))
    print(f"UI smoke passed; screenshots: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
