"""Synthetic boundary controls for the ordinary policy-aware output baseline."""
import json
import unittest

from policy_parser import interpret


H1, H2 = "sha256:" + "1" * 64, "sha256:" + "2" * 64


def raw_report(changes=(), before=H1, after=H1):
    changes = list(changes)
    return {
        "stdout": json.dumps({
            "meta": {"before": {"contentHash": before}, "after": {"contentHash": after}},
            "summary": {
                "breaking": sum(x["severity"] == "breaking" for x in changes),
                "warning": sum(x["severity"] == "warning" for x in changes),
                "safe": sum(x["severity"] == "safe" for x in changes),
                "total": len(changes),
            },
            "changes": changes,
        }),
        "stderr": "",
    }


def policy(fail_on="warning", display="safe"):
    return {"fail_on": fail_on, "display_severity": display}


class PolicyParserControls(unittest.TestCase):
    def test_healthy_unchanged_zero_is_accepted(self):
        output = interpret({"exit_code": 0}, raw_report(), policy())
        self.assertEqual((output["process_state"], output["report_state"], output["supported_verdict"], output["acceptance"]), ("COMPLETE", "VALID", "PASS", "ACCEPT"))

    def test_warning_exit_one_is_valid_failure_under_warning_policy(self):
        output = interpret({"exit_code": 1}, raw_report([{"severity": "warning"}], after=H2), policy("warning"))
        self.assertEqual((output["supported_verdict"], output["report_state"], output["acceptance"]), ("FAIL", "VALID", "WITHHOLD"))

    def test_warning_exit_zero_passes_under_breaking_policy(self):
        output = interpret({"exit_code": 0}, raw_report([{"severity": "warning"}], after=H2), policy("breaking"))
        self.assertEqual((output["supported_verdict"], output["acceptance"]), ("PASS", "ACCEPT"))

    def test_safe_threshold_is_not_hardcoded_to_breaking(self):
        raw = raw_report([{"severity": "safe"}], after=H2)
        self.assertEqual(interpret({"exit_code": 1}, raw, policy("safe"))["supported_verdict"], "FAIL")
        self.assertEqual(interpret({"exit_code": 0}, raw, policy("warning"))["supported_verdict"], "PASS")

    def test_changed_hash_with_empty_unfiltered_changes_is_unknown(self):
        output = interpret({"exit_code": 0}, raw_report(after=H2), policy())
        self.assertEqual((output["report_state"], output["supported_verdict"], output["acceptance"]), ("INCONSISTENT", "UNKNOWN", "WITHHOLD"))
        self.assertEqual(output["reason"], "CHANGED_HASH_WITHOUT_CLASSIFIED_CHANGE")

    def test_filtered_report_is_unsupported_not_unclassified_or_unchanged(self):
        output = interpret({"exit_code": 0}, raw_report(after=H2), policy(display="breaking"))
        self.assertEqual((output["report_state"], output["supported_verdict"], output["reason"]), ("FILTERED_UNSUPPORTED", "UNKNOWN", "UNSUPPORTED_FILTERED_REPORT"))

    def test_report_counts_and_hash_metadata_must_be_valid(self):
        for mutation in ["counts", "missing-meta", "missing-before", "short-hash", "null-hash"]:
            with self.subTest(mutation=mutation):
                raw = raw_report()
                report = json.loads(raw["stdout"])
                if mutation == "counts":
                    report["summary"]["total"] = 1
                elif mutation == "missing-meta":
                    del report["meta"]
                elif mutation == "missing-before":
                    del report["meta"]["before"]
                elif mutation == "short-hash":
                    report["meta"]["before"]["contentHash"] = "sha256:123"
                else:
                    report["meta"]["before"]["contentHash"] = None
                raw["stdout"] = json.dumps(report)
                output = interpret({"exit_code": 0}, raw, policy())
                self.assertEqual((output["supported_verdict"], output["acceptance"]), ("UNKNOWN", "WITHHOLD"))

    def test_discovery_error_is_not_product_failure(self):
        raw = raw_report()
        raw["stderr"] = "Warning: Failed to list tools: fixture error\n"
        output = interpret({"exit_code": 0}, raw, policy())
        self.assertEqual((output["process_state"], output["supported_verdict"], output["acceptance"]), ("ERROR", "UNKNOWN", "WITHHOLD"))

    def test_process_error_and_timeout_are_not_product_failure(self):
        for process in [{"exit_code": 2}, {"exit_code": 1, "timed_out": True}]:
            with self.subTest(process=process):
                output = interpret(process, raw_report(), policy())
                self.assertEqual((output["process_state"], output["supported_verdict"]), ("ERROR", "UNKNOWN"))

    def test_policy_conflict_missing_output_and_malformed_input_withhold(self):
        cases = [
            ({"exit_code": 1}, raw_report(), policy()),
            ({"exit_code": 0}, {"stdout": "", "stderr": ""}, policy()),
            ({"exit_code": 0}, {"stdout": '{"summary":', "stderr": ""}, policy()),
            ({"exit_code": 0}, raw_report(), {}),
            ({"exit_code": 0}, raw_report(), {"fail_on": [], "display_severity": "safe"}),
            ({"exit_code": False}, raw_report(), policy()),
            (None, None, policy()),
        ]
        for process, raw, flags in cases:
            with self.subTest(process=process, raw=raw, flags=flags):
                self.assertEqual(interpret(process, raw, flags)["acceptance"], "WITHHOLD")


if __name__ == "__main__":
    unittest.main()
