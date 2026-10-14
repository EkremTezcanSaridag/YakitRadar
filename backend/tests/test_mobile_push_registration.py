"""Mobile push registration uses anon Supabase client + RPC."""

from pathlib import Path

NOTIFICATIONS_JS = (
    Path(__file__).resolve().parents[2] / "mobile" / "src" / "services" / "notifications.js"
)
SUPABASE_JS = Path(__file__).resolve().parents[2] / "mobile" / "src" / "supabase.js"


class TestMobilePushRegistration:
    def test_sync_uses_register_push_token_rpc(self):
        source = NOTIFICATIONS_JS.read_text(encoding="utf-8")
        assert "supabase.rpc('register_push_token'" in source
        assert "installation_id: installationId" in source

    def test_client_uses_anon_key(self):
        source = SUPABASE_JS.read_text(encoding="utf-8")
        assert "EXPO_PUBLIC_SUPABASE_ANON_KEY" in source
