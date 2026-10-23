"""Flush pending price push queue without running the scraper."""

from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

from fiyat_servisi import ISTANBUL_TZ, fiyat_bildirimleri_gonder, supabase
from notification_rules import pending_queue_flush_allowed
from push_token_maintenance import disable_stale_tokens


def main() -> int:
    now = datetime.now(ISTANBUL_TZ)

    if not pending_queue_flush_allowed(now):
        print("Sessiz saat devam ediyor; bekleyen fiyat kuyrugu flush edilmedi.")
        return 0

    disable_stale_tokens(supabase, now=now.astimezone())
    print("Bekleyen fiyat bildirim kuyrugu flush ediliyor (scraper atlandi)...")
    fiyat_bildirimleri_gonder([], None)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
