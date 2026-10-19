"""Read one trusted public documentation page with Crawl4AI, safely and locally.

Run on demand by Node. JSON-only stdout; crawl logs go to stderr.
No cloud account, API key, or persistent background service.
"""
import asyncio
import contextlib
import ipaddress
import json
import os
import socket
import sys
from urllib.parse import urlsplit

TRUSTED = {
    "docs.python.org", "developer.mozilla.org", "nodejs.org", "react.dev",
    "www.typescriptlang.org", "www.python.org", "git-scm.com", "docs.github.com",
    "docs.docker.com", "learn.microsoft.com", "docs.npmjs.com", "docs.crawl4ai.com",
    "docs.ollama.com", "www.sqlite.org", "sqlite.org", "docs.rs", "go.dev",
}


def valid_url(value):
    try:
        u = urlsplit(value)
        return (
            u.scheme == "https" and u.hostname in TRUSTED
            and not u.username and not u.password and u.port is None
            and len(value) <= 1200 and all(ord(c) >= 32 for c in value)
        )
    except (ValueError, TypeError):
        return False


def public_dns(host):
    try:
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        return bool(addresses) and all(
            ipaddress.ip_address(item[4][0]).is_global for item in addresses
        )
    except (OSError, ValueError):
        return False


async def run(url):
    if not valid_url(url):
        raise ValueError("Only known public HTTPS documentation sites are allowed")
    host = urlsplit(url).hostname
    if not public_dns(host):
        raise ValueError("Documentation host did not resolve to a public address")

    os.environ["CRAWL4AI_NO_CLOUD_NOTICE"] = "1"
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

    browser = BrowserConfig(headless=True, verbose=False)
    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS, wait_until="domcontentloaded",
        page_timeout=14000, screenshot=False, pdf=False,
        capture_mhtml=False, scan_full_page=False
    )
    # Constrain browser navigation and all subrequests to the exact trusted
    # host. Block redirects to other domains, HTTP, internal URLs, and assets.
    async with AsyncWebCrawler(config=browser) as crawler:
        async def restrict_requests(page, context, **kwargs):
            async def guard(route):
                request_url = route.request.url
                try:
                    parts = urlsplit(request_url)
                    allowed = (
                        parts.scheme == "https" and parts.hostname == host
                        and parts.port is None
                    )
                    if allowed:
                        await route.continue_()
                    else:
                        await route.abort()
                except Exception:
                    with contextlib.suppress(Exception):
                        await route.abort()
            await page.route("**/*", guard)
            return page

        crawler.crawler_strategy.set_hook("on_page_context_created", restrict_requests)
        with contextlib.redirect_stdout(sys.stderr):
            result = await crawler.arun(url=url, config=run_config)
        if not result.success:
            raise RuntimeError("Crawl4AI could not read the documentation page")
        effective_url = getattr(result, "url", url)
        if not valid_url(effective_url) or urlsplit(effective_url).hostname != host:
            raise RuntimeError("The documentation page redirected outside the trusted host")
        markdown = getattr(result, "markdown", "")
        if not isinstance(markdown, str):
            markdown = getattr(markdown, "raw_markdown", "")
        text = str(markdown).strip()[:9000]
        if len(text) < 40:
            raise RuntimeError("Documentation content is empty or unavailable")
        print(json.dumps({"url": url, "text": text}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("One documentation URL required")
        asyncio.run(run(sys.argv[1]))
    except Exception as exc:
        print(json.dumps({"error": str(exc)[:150]}, ensure_ascii=False))
        sys.exit(1)
