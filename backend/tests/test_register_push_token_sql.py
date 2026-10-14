"""Static checks for register_push_token hardening in SQL."""

from pathlib import Path

SQL_PATH = Path(__file__).resolve().parents[1] / "supabase_notifications.sql"


def load_sql() -> str:
    return SQL_PATH.read_text(encoding="utf-8")


class TestRegisterPushTokenSql:
    def test_anon_execute_retained(self):
        sql = load_sql()
        assert "grant execute on function public.register_push_token(jsonb) to anon" in sql

    def test_prevents_cross_installation_token_takeover(self):
        sql = load_sql().lower()
        assert "delete from public.push_tokens" in sql
        assert "installation_id <> installation_id_value" in sql

    def test_update_scoped_to_installation_id(self):
        sql = load_sql().lower()
        assert "on conflict (installation_id) do update" in sql
        assert "where push_tokens.installation_id = installation_id_value" in sql
