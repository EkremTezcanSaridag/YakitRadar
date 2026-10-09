"""Pytest configuration and fixtures."""
import os
import pytest
from unittest.mock import MagicMock

# Set test environment variables
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_KEY"] = "test-key"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key"
os.environ["NOTIFICATION_MIN_CHANGE"] = "0.01"
os.environ["MAX_REASONABLE_PRICE_CHANGE"] = "8.0"
os.environ["SCRAPER_RATE_LIMIT_DELAY"] = "0"
os.environ["SCRAPER_REQUEST_TIMEOUT"] = "30"
os.environ["SCRAPER_MAX_RETRIES"] = "3"


@pytest.fixture
def mock_supabase():
    """Mock Supabase client."""
    mock_client = MagicMock()
    return mock_client


@pytest.fixture
def sample_price_data():
    """Sample price data for testing."""
    return {
        "İstanbul": {
            "il": "İstanbul",
            "benzin_95": "45,50",
            "motorin": "46,20",
            "lpg": "25,30",
            "guncelleme": "2026-10-09 15:00"
        },
        "Ankara": {
            "il": "Ankara",
            "benzin_95": "45,00",
            "motorin": "45,80",
            "lpg": "25,10",
            "guncelleme": "2026-10-09 15:00"
        }
    }


@pytest.fixture
def sample_price_changes():
    """Sample price changes for testing."""
    return [
        {
            "city": "İstanbul",
            "fuel": "Benzin",
            "field": "benzin_95",
            "old_price": 45.00,
            "new_price": 45.50,
            "diff": 0.50,
            "direction": "increase"
        },
        {
            "city": "Ankara",
            "fuel": "Motorin",
            "field": "motorin",
            "old_price": 46.00,
            "new_price": 45.80,
            "diff": -0.20,
            "direction": "decrease"
        }
    ]
