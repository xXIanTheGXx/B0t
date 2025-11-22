
from playwright.sync_api import Page, expect, sync_playwright
import time
import os

def test_settings_navigation_and_save(page: Page):
    print("Navigating to home...")
    page.goto("http://localhost:3000")

    print("Finding Configure Settings button...")
    settings_btn = page.get_by_role("link", name="Configure Settings")
    expect(settings_btn).to_be_visible()

    print("Clicking settings button...")
    settings_btn.click()
    expect(page).to_have_url("http://localhost:3000/settings.html")

    expect(page.get_by_role("tab", name="Network")).to_be_visible()
    expect(page.get_by_role("tab", name="Security")).to_be_visible()

    print("Checking network tab auth fields...")
    page.get_by_role("tab", name="Network").click()

    page.get_by_label("Microsoft Auth").check()

    expect(page.get_by_placeholder("Email")).to_be_visible()
    expect(page.get_by_placeholder("Password (Optional)")).to_be_visible()

    print("Filling settings...")
    page.fill("#startIp", "192.168.1.1")
    page.fill("#endIp", "192.168.1.255")
    page.fill("#email", "test@example.com")
    page.fill("#authPassword", "secret123")

    print("Saving changes...")
    page.get_by_role("button", name="Save Changes").click()

    print("Verifying persistence...")
    page.reload()
    expect(page.locator("#startIp")).to_have_value("192.168.1.1")
    expect(page.locator("#email")).to_have_value("test@example.com")
    expect(page.locator("#authPassword")).to_have_value("secret123")

    print("Taking screenshot...")
    # Use absolute path in /app/verification
    screenshot_path = "/app/verification/verification.png"
    page.screenshot(path=screenshot_path)
    print(f"Screenshot saved to {screenshot_path}")

if __name__ == "__main__":
    print("Launching browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("dialog", lambda dialog: dialog.accept())

        try:
            test_settings_navigation_and_save(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
