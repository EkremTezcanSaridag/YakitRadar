"""Tests for data-health signals published to the workflow (Sprint 2)."""

from pathlib import Path

import yaml

from fiyat_servisi import github_output, publish_data_health

REPO_ROOT = Path(__file__).resolve().parents[2]
GUNCELLE_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "guncelle.yml"


def _read_output(path):
    if not path.exists():
        return {}
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        key, _, value = line.partition("=")
        values[key] = value
    return values


class TestGithubOutput:
    def test_writes_key_value_pair(self, tmp_path, monkeypatch):
        output = tmp_path / "github_output"
        monkeypatch.setenv("GITHUB_OUTPUT", str(output))

        github_output("scrape_ok", "true")

        assert _read_output(output) == {"scrape_ok": "true"}

    def test_without_output_env_is_noop(self, monkeypatch):
        monkeypatch.delenv("GITHUB_OUTPUT", raising=False)

        github_output("scrape_ok", "true")


class TestPublishDataHealth:
    def test_failed_scrape_marks_scrape_not_ok(self, tmp_path, monkeypatch):
        output = tmp_path / "github_output"
        monkeypatch.setenv("GITHUB_OUTPUT", str(output))

        publish_data_health(False, [], [])

        values = _read_output(output)
        assert values["scrape_ok"] == "false"
        assert "sanity_blocked" not in values

    def test_clean_run_marks_scrape_ok_and_no_block(self, tmp_path, monkeypatch):
        output = tmp_path / "github_output"
        monkeypatch.setenv("GITHUB_OUTPUT", str(output))

        publish_data_health(True, [], [])

        values = _read_output(output)
        assert values["scrape_ok"] == "true"
        assert values["sanity_blocked"] == "false"

    def test_blocked_fields_are_reported_with_summary(self, tmp_path, monkeypatch):
        output = tmp_path / "github_output"
        monkeypatch.setenv("GITHUB_OUTPUT", str(output))

        publish_data_health(True, ["lpg"], ["lpg: 40/81 il %25 esigini asti"])

        values = _read_output(output)
        assert values["scrape_ok"] == "true"
        assert values["sanity_blocked"] == "true"
        assert "lpg" in values["sanity_summary"]


class TestWorkflowDataHealthSteps:
    def _steps(self):
        workflow = yaml.safe_load(GUNCELLE_WORKFLOW.read_text(encoding="utf-8"))
        return workflow["jobs"]["guncelle"]["steps"]

    def _step(self, name):
        for step in self._steps():
            if step.get("name") == name:
                return step
        raise AssertionError(f"step not found: {name}")

    def test_price_step_publishes_outputs(self):
        step = self._step("Fiyatları güncelle")
        assert step["id"] == "fiyat_guncelle"

    def test_health_issue_step_reads_outputs(self):
        step = self._step("Veri sağlık uyarısı için issue aç veya güncelle")
        condition = step["if"]
        assert "steps.fiyat_guncelle.outputs.scrape_ok == 'false'" in condition
        assert "steps.fiyat_guncelle.outputs.sanity_blocked == 'true'" in condition
        assert "always()" in condition

    def test_health_issue_step_closes_on_clean_run(self):
        step = self._step("Veri sağlık uyarısı issue'sunu kapat")
        condition = step["if"]
        assert "steps.fiyat_guncelle.outputs.scrape_ok == 'true'" in condition
        assert "sanity_blocked != 'true'" in condition

    def test_successful_scheduled_run_closes_failure_issue(self):
        workflow = yaml.safe_load(GUNCELLE_WORKFLOW.read_text(encoding="utf-8"))
        recovery = workflow["jobs"]["guncelle-schedule-recovery"]
        assert recovery["needs"] == "guncelle"
        assert "success()" in recovery["if"]
        assert "github.event_name == 'schedule'" in recovery["if"]

    def test_gate_logs_event_and_schedule(self):
        step = self._step("Zamanlanmış koşu — freshness gate uygulanacak mı?")
        script = step["run"]
        assert "gate_event_name=" in script
        assert "gate_schedule=" in script
