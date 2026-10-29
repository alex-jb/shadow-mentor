"""Authored regression controls for runner state and ambiguous report inputs."""
import json
from pathlib import Path
import unittest

import policy_parser_v2 as parser


H1, H2 = "sha256:" + "1" * 64, "sha256:" + "2" * 64
POLICY = {"fail_on": "warning", "display_severity": "safe"}


def raw(changes=(), after=H1):
    changes = list(changes)
    return {"stdout": json.dumps({
        "meta": {"before": {"contentHash": H1}, "after": {"contentHash": after}},
        "summary": {"breaking": sum(c["severity"] == "breaking" for c in changes),
                    "warning": sum(c["severity"] == "warning" for c in changes),
                    "safe": sum(c["severity"] == "safe" for c in changes),
                    "total": len(changes)},
        "changes": changes,
    }), "stderr": ""}


class BoundaryRegressions(unittest.TestCase):
    def test_skipped_runner_cannot_accept_retained_success(self):
        process, output = {"exit_code": 0, "runner_state": "SKIPPED"}, raw()
        self.assertEqual(parser._BASE.interpret(process, output, POLICY)["acceptance"], "ACCEPT")
        revised = parser.interpret(process, output, POLICY)
        self.assertEqual((revised["process_state"], revised["supported_verdict"], revised["acceptance"]), ("SKIPPED", "UNKNOWN", "WITHHOLD"))

    def test_other_noncomplete_runner_states_and_invalid_types_withhold(self):
        for state in ["ERROR", "INCOMPLETE", "UNKNOWN", None, [], False, "running"]:
            with self.subTest(state=state):
                self.assertEqual(parser.interpret({"exit_code": 0, "runner_state": state}, raw(), POLICY)["acceptance"], "WITHHOLD")

    def test_optional_and_explicit_complete_state_preserve_valid_policy(self):
        for process in [{"exit_code": 0}, {"exit_code": 0, "runner_state": "COMPLETE"}]:
            with self.subTest(process=process):
                self.assertEqual(parser.interpret(process, raw(), POLICY)["acceptance"], "ACCEPT")
        process = {"exit_code": 1, "runner_state": "COMPLETE"}
        self.assertEqual(parser.interpret(process, raw([{"severity": "warning"}], H2), POLICY)["supported_verdict"], "FAIL")
        self.assertEqual(parser.interpret({"exit_code": 0, "timed_out": True, "runner_state": "COMPLETE"}, raw(), POLICY)["process_state"], "ERROR")

    def test_duplicate_report_member_is_not_last_key_wins_acceptance(self):
        output = raw()
        output["stdout"] = '{"summary":{"total":1},' + output["stdout"][1:]
        self.assertEqual(parser._BASE.interpret({"exit_code": 0}, output, POLICY)["acceptance"], "ACCEPT")
        self.assertEqual(parser.interpret({"exit_code": 0}, output, POLICY)["reason"], "AMBIGUOUS_OR_INVALID_JSON_REPORT")

    def test_nested_duplicate_members_are_also_withheld(self):
        output = raw()
        output["stdout"] = output["stdout"].replace('"breaking": 0', '"breaking": 2, "breaking": 0')
        self.assertEqual(parser.interpret({"exit_code": 0}, output, POLICY)["acceptance"], "WITHHOLD")

    def test_nonfinite_literals_withheld_but_strings_remain_valid(self):
        for value in ["NaN", "Infinity", "-Infinity"]:
            with self.subTest(value=value):
                output = raw()
                output["stdout"] = '{"extra":' + value + ',' + output["stdout"][1:]
                self.assertEqual(parser.interpret({"exit_code": 0}, output, POLICY)["acceptance"], "WITHHOLD")
        output = raw()
        output["stdout"] = '{"note":"NaN and Infinity are text",' + output["stdout"][1:]
        self.assertEqual(parser.interpret({"exit_code": 0}, output, POLICY)["acceptance"], "ACCEPT")

    def test_equal_hash_nonempty_changes_is_unknown_not_pass_or_fail(self):
        for severity, exit_code, fail_on in [("warning", 0, "breaking"), ("breaking", 1, "warning")]:
            with self.subTest(severity=severity):
                flags = {**POLICY, "fail_on": fail_on}
                output = parser.interpret({"exit_code": exit_code}, raw([{"severity": severity}]), flags)
                self.assertEqual((output["report_state"], output["supported_verdict"]), ("INCONSISTENT", "UNKNOWN"))
        # A filtered display cannot support this contradiction rule either.
        self.assertEqual(parser.interpret({"exit_code": 0}, raw([{"severity": "safe"}]), {**POLICY, "display_severity": "breaking"})["report_state"], "FILTERED_UNSUPPORTED")

    def test_all_twelve_saved_native_checks_keep_prior_decisions(self):
        path = Path(__file__).resolve().parent.parent / "evidence-study-20261029b/contract-change-results.json"
        records = json.loads(path.read_text())["observations"]
        self.assertEqual(len(records), 12)
        for record in records:
            with self.subTest(version=record["cli_version"], case=record["case"]):
                args = record["process"], record["raw"], record["policy"]
                self.assertEqual(parser.interpret(*args), parser._BASE.interpret(*args))


if __name__ == "__main__":
    unittest.main()
