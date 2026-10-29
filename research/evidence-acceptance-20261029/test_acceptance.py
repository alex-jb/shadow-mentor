"""Synthetic regression controls, separate from the seven historical checks."""
import json
import unittest

from acceptance import inspect_check


METHODS = ("initialize", "tools/list")


def healthy():
    stdout = json.dumps({"summary": {"breaking": 0, "warning": 0, "safe": 0, "total": 0}, "changes": []})
    wire = [
        {"direction": "request", "message": {"jsonrpc": "2.0", "id": 1, "method": "initialize"}},
        {"direction": "response", "message": {"jsonrpc": "2.0", "id": 1, "result": {"capabilities": {"tools": {}}}}},
        {"direction": "request", "message": {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}},
        {"direction": "response", "message": {"jsonrpc": "2.0", "id": 2, "result": {"tools": []}}},
    ]
    return {"exit_code": 0, "timed_out": False}, {"stdout": stdout, "stderr": "", "capture_complete": True, "exchanges": wire}


class AcceptanceControls(unittest.TestCase):
    def check(self, process, raw):
        return inspect_check(process, raw, METHODS)

    def test_successful_empty_discovery_is_valid(self):
        p, r = healthy()
        self.assertEqual(self.check(p, r)["acceptance"], "ACCEPT")

    def test_discovery_error_preserves_native_pass(self):
        p, r = healthy()
        r["exchanges"][-1]["message"] = {"jsonrpc": "2.0", "id": 2, "error": {"code": -32603, "message": "failed"}}
        out = self.check(p, r)
        self.assertEqual((out["reported_verdict"], out["execution_state"], out["supported_verdict"]), ("PASS", "ERROR", "UNKNOWN"))

    def test_missing_response_is_incomplete(self):
        p, r = healthy()
        r["exchanges"].pop()
        self.assertEqual(self.check(p, r)["execution_state"], "INCOMPLETE")

    def test_matching_response_identity_is_required(self):
        p, r = healthy()
        r["exchanges"][-1]["message"]["id"] = 99
        self.assertEqual(self.check(p, r)["reason"], "UNMATCHED_RESPONSE")

    def test_duplicate_request_identity_is_ambiguous(self):
        p, r = healthy()
        r["exchanges"][2]["message"]["id"] = 1
        self.assertEqual(self.check(p, r)["reason"], "AMBIGUOUS_REQUEST_ID")

    def test_unfinished_pagination_is_not_complete(self):
        p, r = healthy()
        r["exchanges"][-1]["message"]["result"]["nextCursor"] = "page-2"
        self.assertEqual(self.check(p, r)["reason"], "PAGINATION_NOT_FINISHED")

    def test_finished_second_page_is_valid(self):
        p, r = healthy()
        r["exchanges"][-1]["message"]["result"]["nextCursor"] = "page-2"
        r["exchanges"] += [
            {"direction": "request", "message": {"jsonrpc": "2.0", "id": 3, "method": "tools/list", "params": {"cursor": "page-2"}}},
            {"direction": "response", "message": {"jsonrpc": "2.0", "id": 3, "result": {"tools": []}}},
        ]
        self.assertEqual(self.check(p, r)["acceptance"], "ACCEPT")

    def test_empty_string_cursor_is_opaque_and_not_absent(self):
        p, r = healthy()
        r["exchanges"][-1]["message"]["result"]["nextCursor"] = ""
        self.assertEqual(self.check(p, r)["reason"], "PAGINATION_NOT_FINISHED")
        r["exchanges"] += [
            {"direction": "request", "message": {"jsonrpc": "2.0", "id": 3, "method": "tools/list", "params": {"cursor": ""}}},
            {"direction": "response", "message": {"jsonrpc": "2.0", "id": 3, "result": {"tools": []}}},
        ]
        self.assertEqual(self.check(p, r)["acceptance"], "ACCEPT")

    def test_wrong_page_cursor_is_incomplete(self):
        p, r = healthy()
        r["exchanges"][2]["message"]["params"] = {"cursor": "unseen"}
        self.assertEqual(self.check(p, r)["execution_state"], "INCOMPLETE")

    def test_explicit_null_request_cursor_is_not_missing(self):
        p, r = healthy()
        r["exchanges"][2]["message"]["params"] = {"cursor": None}
        self.assertEqual(self.check(p, r)["reason"], "INVALID_REQUEST_CURSOR")

    def test_explicit_null_next_cursor_is_not_missing(self):
        p, r = healthy()
        r["exchanges"][-1]["message"]["result"]["nextCursor"] = None
        self.assertEqual(self.check(p, r)["reason"], "INVALID_OR_REPEATED_CURSOR")

    def test_discovery_cannot_precede_initialization(self):
        p, r = healthy()
        r["exchanges"] = r["exchanges"][2:] + r["exchanges"][:2]
        self.assertEqual(self.check(p, r)["reason"], "DISCOVERY_BEFORE_INITIALIZE")

    def test_absent_tools_capability_is_skipped(self):
        p, r = healthy()
        r["exchanges"][1]["message"]["result"]["capabilities"] = {}
        r["exchanges"] = r["exchanges"][:2]
        self.assertEqual(self.check(p, r)["execution_state"], "SKIPPED")

    def test_explicit_runner_skip_does_not_pass(self):
        p, r = healthy()
        p["runner_state"] = "SKIPPED"
        out = self.check(p, r)
        self.assertEqual((out["execution_state"], out["acceptance"]), ("SKIPPED", "WITHHOLD"))

    def test_invalid_report_cannot_be_repaired_by_receipts(self):
        p, r = healthy()
        r["stdout"] = '{"summary":'
        self.assertEqual(self.check(p, r)["execution_state"], "UNKNOWN")

    def test_summary_must_match_changes(self):
        p, r = healthy()
        report = json.loads(r["stdout"])
        report["summary"]["total"] = 1
        r["stdout"] = json.dumps(report)
        self.assertEqual(self.check(p, r)["reason"], "INVALID_OR_ABSENT_REPORT")

    def test_boolean_exit_code_is_not_zero(self):
        p, r = healthy()
        p["exit_code"] = False
        self.assertEqual(self.check(p, r)["execution_state"], "UNKNOWN")

    def test_product_failure_is_separate_from_execution_error(self):
        p, r = healthy()
        p["exit_code"] = 1
        r["stdout"] = json.dumps({"summary": {"breaking": 1, "warning": 0, "safe": 0, "total": 1}, "changes": [{"severity": "breaking"}]})
        out = self.check(p, r)
        self.assertEqual((out["execution_state"], out["supported_verdict"], out["acceptance"]), ("COMPLETE", "FAIL", "WITHHOLD"))

    def test_timeout_is_not_product_failure(self):
        p, r = healthy()
        p["timed_out"] = True
        self.assertEqual(self.check(p, r)["supported_verdict"], "UNKNOWN")

    def test_unconfirmed_capture_is_incomplete(self):
        p, r = healthy()
        r["capture_complete"] = False
        self.assertEqual(self.check(p, r)["execution_state"], "INCOMPLETE")

    def test_unsupported_profile_is_unknown(self):
        p, r = healthy()
        self.assertEqual(inspect_check(p, r, ("tools/call",))["execution_state"], "UNKNOWN")

    def test_empty_or_malformed_input_is_withheld(self):
        for p, r in [(None, None), ({}, {}), ({"exit_code": 0}, {"stderr": None})]:
            self.assertEqual(self.check(p, r)["acceptance"], "WITHHOLD")


if __name__ == "__main__":
    unittest.main()
