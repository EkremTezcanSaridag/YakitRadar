"""Static checks for fiyatlar/gecmis RLS SQL (no live DB)."""

from pathlib import Path

SQL_PATH = Path(__file__).resolve().parents[1] / "supabase_fiyatlar_gecmis.sql"


def load_sql() -> str:
    return SQL_PATH.read_text(encoding="utf-8")


class TestFiyatlarGecmisSql:
    def test_file_exists(self):
        assert SQL_PATH.is_file()

    def test_rls_and_read_only_client_roles(self):
        sql = load_sql().lower()
        assert "alter table public.fiyatlar enable row level security" in sql
        assert "alter table public.gecmis enable row level security" in sql
        assert "revoke all on public.fiyatlar from anon, authenticated" in sql
        assert "revoke all on public.gecmis from anon, authenticated" in sql
        assert "grant select on public.fiyatlar to anon, authenticated" in sql
        assert "grant select on public.gecmis to anon, authenticated" in sql
        assert "grant all on public.fiyatlar to service_role" in sql
        assert "grant all on public.gecmis to service_role" in sql

    def test_select_policies_for_anon(self):
        sql = load_sql()
        assert 'create policy "fiyatlar_select_anon"' in sql
        assert 'create policy "gecmis_select_anon"' in sql

    def test_select_policies_for_authenticated(self):
        sql = load_sql()
        assert 'create policy "fiyatlar_select_authenticated"' in sql
        assert 'to authenticated' in sql
        assert 'create policy "gecmis_select_authenticated"' in sql
        assert sql.count("using (true)") >= 4

    def test_gecmis_indexes_deferred_to_follow_up_sql(self):
        sql = load_sql().lower()
        assert "gecmis_tarih_uidx" not in sql
        assert "gecmis_tarih_desc_idx" not in sql
