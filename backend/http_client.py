"""Shared HTTP helpers for scrapers (rate limit, timeout, retry)."""
import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()

SCRAPER_RATE_LIMIT_DELAY = float(os.getenv("SCRAPER_RATE_LIMIT_DELAY", "1.0"))
SCRAPER_REQUEST_TIMEOUT = int(os.getenv("SCRAPER_REQUEST_TIMEOUT", "30"))
SCRAPER_MAX_RETRIES = int(os.getenv("SCRAPER_MAX_RETRIES", "3"))
SCRAPER_RETRY_BASE_DELAY = float(os.getenv("SCRAPER_RETRY_BASE_DELAY", "2.0"))
DEFAULT_USER_AGENT = os.getenv("HTTP_USER_AGENT", "YakitRadar/1.0")


def make_request_with_retry(url, headers=None, timeout=None):
    """Make HTTP GET with exponential backoff retry logic."""
    if headers is None:
        headers = {"User-Agent": DEFAULT_USER_AGENT}
    if timeout is None:
        timeout = SCRAPER_REQUEST_TIMEOUT

    last_error = None
    for attempt in range(SCRAPER_MAX_RETRIES):
        try:
            response = requests.get(url, headers=headers, timeout=timeout)
            response.raise_for_status()

            if SCRAPER_RATE_LIMIT_DELAY > 0:
                time.sleep(SCRAPER_RATE_LIMIT_DELAY)

            return response
        except requests.exceptions.Timeout as e:
            last_error = e
            print(f"Timeout on attempt {attempt + 1}/{SCRAPER_MAX_RETRIES} for {url}")
        except requests.exceptions.RequestException as e:
            last_error = e
            status_code = getattr(e.response, "status_code", None) if hasattr(e, "response") else None

            if status_code and 400 <= status_code < 500 and status_code != 429:
                raise

            print(f"Request failed on attempt {attempt + 1}/{SCRAPER_MAX_RETRIES} for {url}: {e}")

        if attempt < SCRAPER_MAX_RETRIES - 1:
            delay = SCRAPER_RETRY_BASE_DELAY * (2 ** attempt)
            print(f"Retrying in {delay} seconds...")
            time.sleep(delay)

    raise RuntimeError(f"Failed to fetch {url} after {SCRAPER_MAX_RETRIES} attempts: {last_error}")
