"""Static checks for post-cleanup gecmis unique tarih SQL."""

from pathlib import Path

SQL_PATH = Path(__file__).resolve().parents[1] / "supabase_gecmis_unique_tarih.sql"


def load_sql() -> str:
    return SQL_PATH.read_text(encoding="utf-8")


class TestGecmisUniqueTarihSql:
    def test_file_exists(self):
        assert SQL_PATH.is_file()

    def test_requires_p5_cleanup_first(self):
        sql = load_sql()
        assert "P5" in sql
        assert "duplicate-date cleanup" in sql.lower() or "duplicate tarih" in sql.lower()

    def test_drops_desc_index_and_creates_unique_tarih(self):
        sql = load_sql().lower()
        assert "drop index if exists public.gecmis_tarih_desc_idx" in sql
        assert "create unique index if not exists gecmis_tarih_uidx" in sql
