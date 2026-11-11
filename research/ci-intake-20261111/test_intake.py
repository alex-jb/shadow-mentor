"""Independent behavioral tests for the local GitHub Actions report intake."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

from intake import evaluate_ci


_CONTRACT_PATH = Path(__file__).resolve().parent.parent / "acceptance-contract-20261111" / "contract.py"
_CONTRACT_SPEC = importlib.util.spec_from_file_location("ci_intake_test_contract", _CONTRACT_PATH)
assert _CONTRACT_SPEC is not None and _CONTRACT_SPEC.loader is not None
contract = importlib.util.module_from_spec(_CONTRACT_SPEC)
_CONTRACT_SPEC.loader.exec_module(contract)


class IntakeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.identity = {"repository_id": 101, "run_id": 201, "attempt": 2, "job_id": 301}
        self.plan = {
            "schema": "shadow.acceptance-plan.v1",
            "run_id": "github:101:201:2:301",
            "scope": {"lane": "github-actions", "transport": "stdio"},
            "checks": [{"id": "inventory", "applies_to": ["stdio"], "expected": "[1]"}],
            "open_questions": [],
        }
        self.frozen = contract.freeze(self.plan)
        self.expected = {
            "identity": self.identity.copy(),
            "tested_sha": "a" * 40,
            "check_steps": {"inventory": 3},
        }
        self.job = {
            "id": 301,
            "run_id": 201,
            "status": "completed",
            "conclusion": "success",
            # The workflow's reported head is not the actual checked-out subject.
            "head_sha": "b" * 40,
            "name": "tests (python 3.12)",
            "steps": [{"number": 3, "status": "completed", "conclusion": "success", "name": "verify inventory"}],
        }
        self.snapshot = {
            "repository_id": 101,
            "run_id": 201,
            "attempt": 2,
            "complete": True,
            "total_count": 1,
            "jobs": [self.job],
        }
        self.receipt = {
            "identity": self.identity.copy(),
            "tested_sha": self.expected["tested_sha"],
            "plan_sha256": self._sha(self.frozen),
            "expectation_sha256": self._expectation_digest(),
            "report_sha256": "",
            "outcomes": {"3": "success"},
        }
        self.evidence = {
            "schema": "shadow.acceptance-evidence.v1",
            "plan_sha256": self.receipt["plan_sha256"],
            "run_id": self.plan["run_id"],
            "scope": self.plan["scope"].copy(),
            "observations": [{"id": "inventory", "state": "OBSERVED", "ref": "inventory.json", "value": "[1]"}],
        }
        self._encode_evidence()

    @staticmethod
    def _sha(value: bytes) -> str:
        return hashlib.sha256(value).hexdigest()

    def _expectation_digest(self) -> str:
        return self._sha(json.dumps(
            self.expected, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False,
        ).encode("utf-8"))

    def _set_report(self, report: bytes) -> None:
        self.report_bytes = report
        self.receipt["report_sha256"] = self._sha(report)

    def _encode_evidence(self) -> None:
        self._set_report(json.dumps(self.evidence).encode("utf-8"))

    def _refreeze_plan(self) -> None:
        self.frozen = contract.freeze(self.plan)
        self.receipt["plan_sha256"] = self.evidence["plan_sha256"] = self._sha(self.frozen)
        self.receipt["expectation_sha256"] = self._expectation_digest()
        self.evidence["run_id"] = self.plan["run_id"]
        self.evidence["scope"] = self.plan["scope"].copy()
        self._encode_evidence()

    def _run(self) -> dict:
        return evaluate_ci(self.frozen, self.expected, self.snapshot, self.receipt, self.report_bytes)

    def test_fresh_completed_step_and_matching_observation_accept(self) -> None:
        result = self._run()
        self.assertEqual(result["decision"], "ACCEPT")
        self.assertEqual(result["checks"][0]["state"], "PASS")
        self.assertEqual(result["native_steps"], [{
            "step_number": 3, "status": "completed", "outcome": "success", "conclusion": "success",
        }])

    def test_fresh_same_type_semantic_mismatch_rejects(self) -> None:
        self.evidence["observations"][0]["value"] = "[2]"
        self._encode_evidence()
        result = self._run()
        self.assertEqual(result["decision"], "REJECT")
        self.assertEqual(result["checks"][0]["state"], "FAIL")

    def test_wrong_typed_observation_does_not_prove_mismatch(self) -> None:
        self.evidence["observations"][0]["value"] = 1
        self._encode_evidence()
        result = self._run()
        self.assertEqual(result["decision"], "WITHHOLD")
        self.assertEqual(result["checks"][0]["reason"], "VALUE_TYPE_MISMATCH")

    def test_snapshot_for_previous_attempt_under_same_run_is_withheld(self) -> None:
        self.snapshot["attempt"] = 1
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_prior_attempt_receipt_is_not_reused_with_current_snapshot(self) -> None:
        self.receipt["identity"]["attempt"] = 1
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_other_job_cannot_substitute_for_expected_job(self) -> None:
        self.job["id"] = 302
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_other_job_receipt_cannot_substitute_for_expected_receipt(self) -> None:
        self.receipt["identity"]["job_id"] = 302
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_job_run_id_must_match_snapshot(self) -> None:
        self.job["run_id"] = 202
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_job_run_attempt_if_present_must_match_snapshot(self) -> None:
        self.job["run_attempt"] = self.identity["attempt"]
        self.assertEqual(self._run()["decision"], "ACCEPT")
        for attempt in (1, True, None):
            with self.subTest(attempt=attempt):
                self.job["run_attempt"] = attempt
                result = self._run()
                self.assertEqual(result["decision"], "WITHHOLD")
                self.assertEqual(result["reason"], "JOB_ATTEMPT_MISMATCH")

    def test_incomplete_snapshot_is_withheld_even_if_target_present(self) -> None:
        for complete, count in [(False, 1), (True, 2), (1, 1), (True, True)]:
            with self.subTest(complete=complete, count=count):
                self.snapshot["complete"] = complete
                self.snapshot["total_count"] = count
                self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_duplicate_job_id_is_ambiguous(self) -> None:
        self.snapshot["jobs"].append(copy.deepcopy(self.job))
        self.snapshot["total_count"] = 2
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_missing_planned_step_is_withheld(self) -> None:
        self.job["steps"].clear()
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_duplicate_step_number_is_ambiguous(self) -> None:
        self.job["steps"].append(copy.deepcopy(self.job["steps"][0]))
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_noncompleted_or_skipped_step_cannot_support_acceptance(self) -> None:
        for status, conclusion in [("in_progress", None), ("completed", "skipped")]:
            with self.subTest(status=status, conclusion=conclusion):
                self.job["steps"][0].update(status=status, conclusion=conclusion)
                self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_tolerated_failure_does_not_turn_into_native_success(self) -> None:
        self.receipt["outcomes"]["3"] = "failure"
        result = self._run()
        self.assertEqual(result["decision"], "WITHHOLD")
        self.assertEqual(result["reason"], "REQUIRED_STEP_NOT_OBSERVED")
        self.assertEqual(result["native_steps"][0]["outcome"], "failure")
        self.assertEqual(result["native_steps"][0]["conclusion"], "success")

    def test_missing_raw_step_outcome_is_withheld(self) -> None:
        self.receipt["outcomes"] = {}
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_report_bytes_not_semantic_json_are_bound(self) -> None:
        self.report_bytes += b"\n"
        self.assertEqual(json.loads(self.report_bytes), self.evidence)
        self.assertEqual(self._run()["reason"], "REPORT_DIGEST_MISMATCH")
        self._set_report(self.report_bytes)
        self.assertEqual(self._run()["decision"], "ACCEPT")

    def test_report_must_be_immutable_bytes(self) -> None:
        self.report_bytes = bytearray(self.report_bytes)
        self.assertEqual(self._run()["reason"], "INVALID_REPORT_BYTES")

    def test_bound_report_over_size_cap_is_withheld(self) -> None:
        self._set_report(self.report_bytes + b" " * (1024 * 1024))
        self.assertEqual(self._run()["reason"], "REPORT_TOO_LARGE")

    def test_strict_parser_rejects_duplicates_with_matching_digest(self) -> None:
        # A default Python parser would retain the second identical schema key.
        prefix = b'{"schema":"shadow.acceptance-evidence.v1",'
        duplicate = prefix + self.report_bytes[1:]
        self.assertEqual(json.loads(duplicate), self.evidence)
        self._set_report(duplicate)
        self.assertEqual(self._run()["reason"], "INVALID_REPORT_JSON")

    def test_strict_parser_rejects_nonfinite_tokens_with_matching_digest(self) -> None:
        original = self.report_bytes
        for token in (b"NaN", b"Infinity", b"-Infinity", b"1e999"):
            with self.subTest(token=token):
                self._set_report(original.replace(b'"value": "[1]"', b'"value": ' + token))
                self.assertEqual(self._run()["reason"], "INVALID_REPORT_JSON")

    def test_invalid_utf8_with_matching_digest_is_withheld(self) -> None:
        self._set_report(self.report_bytes + b"\xff")
        self.assertEqual(self._run()["reason"], "INVALID_REPORT_JSON")

    def test_wrong_tested_checkout_is_withheld(self) -> None:
        self.receipt["tested_sha"] = "c" * 40
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_wrong_receipt_plan_digest_is_withheld(self) -> None:
        self.receipt["plan_sha256"] = "f" * 64
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_exact_bool_identity_is_not_integer_one(self) -> None:
        self.expected["identity"]["attempt"] = True
        self.snapshot["attempt"] = self.receipt["identity"]["attempt"] = 1
        self.plan["run_id"] = "github:101:201:1:301"
        self._refreeze_plan()
        result = self._run()
        self.assertEqual(result["decision"], "WITHHOLD")
        self.assertEqual(result["reason"], "INVALID_EXPECTATION")

    def test_plan_run_id_must_bind_selected_job(self) -> None:
        self.plan["run_id"] = "github:101:201:2:302"
        self._refreeze_plan()
        self.assertEqual(self._run()["decision"], "WITHHOLD")

    def test_plan_for_another_lane_is_withheld_despite_matching_report(self) -> None:
        self.plan["scope"]["lane"] = "local-runner"
        self._refreeze_plan()
        result = self._run()
        self.assertEqual(result["decision"], "WITHHOLD")
        self.assertEqual(result["reason"], "PLAN_LANE_MISMATCH")

    def test_step_mapping_drift_is_withheld_even_when_both_steps_succeeded(self) -> None:
        self.job["steps"].append({"number": 4, "status": "completed", "conclusion": "success"})
        self.receipt["outcomes"]["4"] = "success"
        self.assertEqual(self._run()["decision"], "ACCEPT")
        self.expected["check_steps"]["inventory"] = 4
        result = self._run()
        self.assertEqual(result["decision"], "WITHHOLD")
        self.assertEqual(result["reason"], "RECEIPT_EXPECTATION_MISMATCH")

    def test_no_applicable_check_cannot_prove_acceptance(self) -> None:
        self.plan["checks"][0]["applies_to"] = ["http"]
        self.expected["check_steps"] = {}
        self.receipt["outcomes"] = {}
        self.evidence["observations"] = []
        self._refreeze_plan()
        result = self._run()
        self.assertEqual(result["decision"], "WITHHOLD")
        self.assertEqual(result["reason"], "NO_APPLICABLE_CHECKS")

    def test_empty_evidence_with_successful_step_is_still_missing(self) -> None:
        self.evidence["observations"] = []
        self._encode_evidence()
        result = self._run()
        self.assertEqual(result["decision"], "WITHHOLD")
        self.assertEqual(result["checks"][0]["reason"], "MISSING_OBSERVATION")

    def test_missing_applicable_check_to_step_mapping_is_withheld(self) -> None:
        self.expected["check_steps"] = {}
        self.assertEqual(self._run()["decision"], "WITHHOLD")


if __name__ == "__main__":
    unittest.main()
