"""Static checks for pending_price_notifications RLS SQL."""

from pathlib import Path

SQL_PATH = Path(__file__).resolve().parents[1] / "supabase_pending_notifications.sql"


def load_sql() -> str:
    return SQL_PATH.read_text(encoding="utf-8")


class TestPendingNotificationsSql:
    def test_service_role_only_writes(self):
        sql = load_sql().lower()
        assert "revoke all on public.pending_price_notifications from anon, authenticated" in sql
        assert "grant all on public.pending_price_notifications to service_role" in sql

    def test_dedupe_key_unique(self):
        sql = load_sql().lower()
        assert "dedupe_key text not null unique" in sql
