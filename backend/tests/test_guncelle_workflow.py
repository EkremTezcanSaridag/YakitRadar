"""Guard rails for guncelle.yml scheduled-run checkout layout."""
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
GUNCELLE_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "guncelle.yml"


def _guncelle_steps():
    workflow = yaml.safe_load(GUNCELLE_WORKFLOW.read_text(encoding="utf-8"))
    return workflow["jobs"]["guncelle"]["steps"]


def _step_by_name(steps, name):
    for step in steps:
        if step.get("name") == name:
            return step
    raise AssertionError(f"step not found: {name}")


def test_gate_sparse_checkout_uses_isolated_path():
    steps = _guncelle_steps()
    gate_checkout = _step_by_name(steps, "Gate için minimal checkout")
    assert gate_checkout["uses"] == "actions/checkout@v4"
    assert gate_checkout["with"]["path"] == ".gate"
    assert "backend/schedule_freshness.py" in gate_checkout["with"]["sparse-checkout"]


def test_freshness_script_runs_from_gate_path():
    steps = _guncelle_steps()
    freshness = _step_by_name(steps, "Zamanlanmış koşu — veri taze mi?")
    assert freshness["run"].strip() == "python3 .gate/backend/schedule_freshness.py"


def test_main_checkout_has_no_sparse_checkout():
    steps = _guncelle_steps()
    main_checkout = _step_by_name(steps, "Kodu çek")
    assert main_checkout["uses"] == "actions/checkout@v4"
    assert "sparse-checkout" not in (main_checkout.get("with") or {})


def test_morning_schedule_exempt_from_freshness_gate():
    steps = _guncelle_steps()
    gate = _step_by_name(steps, "Zamanlanmış koşu — freshness gate uygulanacak mı?")
    script = gate["run"]
    assert 'github.event.schedule }}" != "10 5 * * *"' in script
    assert "use_freshness_gate=false" in script
