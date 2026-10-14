"""Static checks for market_signals RLS SQL."""

from pathlib import Path

SQL_PATH = Path(__file__).resolve().parents[1] / "supabase_market_signals.sql"


def load_sql() -> str:
    return SQL_PATH.read_text(encoding="utf-8")


class TestMarketSignalsSql:
    def test_client_roles_select_only_on_table(self):
        sql = load_sql().lower()
        assert "grant select on public.market_signals to anon, authenticated" in sql
        assert "revoke insert, update, delete on table public.market_signals from anon, authenticated" in sql

    def test_client_roles_no_sequence_write(self):
        sql = load_sql().lower()
        assert "revoke all on sequence public.market_signals_id_seq from anon, authenticated" in sql
        assert "revoke usage, update on sequence public.market_signals_id_seq from anon, authenticated" in sql
