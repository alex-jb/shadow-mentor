"""Independent, authored controls for the acceptance contract boundary."""

from copy import deepcopy
import unittest

from contract import digest, evaluate, freeze


def plan(*, transport="http", run_id="local-run-01"):
    return {
        "schema": "shadow.acceptance-plan.v1",
        "run_id": run_id,
        "scope": {"lane": "authored_transport", "transport": transport},
        "checks": [
            {"id": "status", "applies_to": ["http"], "expected": 200},
            {"id": "rpc", "applies_to": ["http", "stdio"], "expected": True},
        ],
        "open_questions": [],
    }


def observed(check_id, value):
    return {"id": check_id, "state": "OBSERVED", "ref": f"receipt/{check_id}", "value": value}


def envelope(spec, frozen, observations):
    return {
        "schema": "shadow.acceptance-evidence.v1",
        "plan_sha256": digest(frozen),
        "run_id": spec["run_id"],
        "scope": deepcopy(spec["scope"]),
        "observations": observations,
    }


def states(result):
    return {row["id"]: row["state"] for row in result["checks"]}


class ContractTest(unittest.TestCase):
    def setUp(self):
        self.plan = plan()
        self.frozen = freeze(self.plan)
        self.valid = envelope(self.plan, self.frozen, [observed("status", 200), observed("rpc", True)])

    def test_freeze_ignores_object_key_order_but_binds_requirement_changes(self):
        reordered = {key: self.plan[key] for key in reversed(self.plan)}
        reordered["scope"] = {"transport": "http", "lane": "authored_transport"}
        self.assertEqual(freeze(reordered), self.frozen)
        self.assertRegex(digest(self.frozen), r"\A[0-9a-f]{64}\Z")
        changed = deepcopy(self.plan)
        changed["checks"][0]["expected"] = 204
        self.assertNotEqual(digest(freeze(changed)), digest(self.frozen))

    def test_later_caller_mutation_does_not_change_frozen_contract(self):
        self.plan["checks"][0]["expected"] = 204
        self.plan["open_questions"].append("Should redirects be permitted?")
        self.plan["scope"]["transport"] = "stdio"
        result = evaluate(self.frozen, self.valid)
        self.assertEqual(result["decision"], "ACCEPT")
        self.assertEqual(states(result), {"status": "PASS", "rpc": "PASS"})

    def test_missing_skipped_and_error_are_unobserved_not_failed(self):
        for status in (None, "SKIPPED", "ERROR"):
            with self.subTest(status=status):
                observations = [observed("rpc", True)]
                if status:
                    observations.append({"id": "status", "state": status, "ref": "receipt/status"})
                result = evaluate(self.frozen, envelope(self.plan, self.frozen, observations))
                self.assertEqual(result["decision"], "WITHHOLD")
                self.assertEqual(states(result), {"status": "NOT_OBSERVED", "rpc": "PASS"})

    def test_admissible_mismatch_rejects_even_if_other_check_was_not_seen(self):
        result = evaluate(self.frozen, envelope(self.plan, self.frozen, [observed("status", 500)]))
        self.assertEqual(result["decision"], "REJECT")
        self.assertEqual(states(result), {"status": "FAIL", "rpc": "NOT_OBSERVED"})
        rows = {row["id"]: row for row in result["checks"]}
        self.assertEqual(rows["status"]["ref"], "receipt/status")
        self.assertNotIn("ref", rows["rpc"])

    def test_numeric_status_string_is_unobserved_not_a_definitive_mismatch(self):
        evidence = envelope(self.plan, self.frozen, [observed("status", "200"), observed("rpc", True)])
        result = evaluate(self.frozen, evidence)
        self.assertEqual(result["decision"], "WITHHOLD")
        self.assertEqual(states(result), {"status": "NOT_OBSERVED", "rpc": "PASS"})

    def test_python_equal_bools_and_ints_do_not_satisfy_a_typed_check(self):
        for expected, value in ((True, 1), (False, 0), (1, True), (0, False)):
            with self.subTest(expected=expected, observed=value):
                spec = plan(transport="stdio")
                spec["checks"][1]["expected"] = expected
                frozen = freeze(spec)
                result = evaluate(frozen, envelope(spec, frozen, [observed("rpc", value)]))
                self.assertEqual(result["decision"], "WITHHOLD")
                self.assertEqual(states(result)["rpc"], "NOT_OBSERVED")

    def test_scope_can_exempt_http_check_without_suppressing_stdio_requirement(self):
        spec = plan(transport="stdio")
        frozen = freeze(spec)
        result = evaluate(frozen, envelope(spec, frozen, [observed("rpc", True)]))
        self.assertEqual(result["decision"], "ACCEPT")
        self.assertEqual(states(result), {"status": "NOT_APPLICABLE", "rpc": "PASS"})

    def test_all_checks_outside_scope_cannot_prove_acceptance(self):
        spec = plan(transport="stdio")
        spec["checks"].pop()
        frozen = freeze(spec)
        result = evaluate(frozen, envelope(spec, frozen, []))
        self.assertEqual(result["decision"], "WITHHOLD")
        self.assertEqual(states(result), {"status": "NOT_APPLICABLE"})

    def test_nonapplicable_observation_is_scope_contradiction(self):
        spec = plan(transport="stdio")
        frozen = freeze(spec)
        result = evaluate(frozen, envelope(spec, frozen, [observed("status", 200), observed("rpc", True)]))
        self.assertEqual(result["decision"], "WITHHOLD")

    def test_valid_shaped_previous_result_cannot_satisfy_revised_plan(self):
        revised = deepcopy(self.plan)
        revised["checks"][0]["expected"] = 204
        self.assertEqual(evaluate(freeze(revised), self.valid)["decision"], "WITHHOLD")
        revised = plan(run_id="local-run-02")
        newer_frozen = freeze(revised)
        self.assertEqual(evaluate(newer_frozen, self.valid)["decision"], "WITHHOLD")
        updated_id_only = {**self.valid, "run_id": revised["run_id"]}
        self.assertEqual(evaluate(newer_frozen, updated_id_only)["decision"], "WITHHOLD")

    def test_each_binding_must_match_even_when_other_fields_do(self):
        for field, bad_value in (
            ("run_id", "unrelated-run"),
            ("plan_sha256", "0" * 64),
            ("scope", {"lane": "different_lane", "transport": "http"}),
            ("scope", {"lane": "authored_transport", "transport": "stdio"}),
        ):
            with self.subTest(field=field, bad_value=bad_value):
                evidence = {**self.valid, field: bad_value}
                self.assertEqual(evaluate(self.frozen, evidence)["decision"], "WITHHOLD")

    def test_unresolved_question_cannot_be_hidden_by_good_observations(self):
        self.plan["open_questions"].append("Does the acceptance scope include a proxy?")
        frozen = freeze(self.plan)
        evidence = envelope(self.plan, frozen, self.valid["observations"])
        self.assertEqual(evaluate(frozen, evidence)["decision"], "WITHHOLD")

    def test_structural_contradictions_do_not_admit_otherwise_passing_results(self):
        valid = self.valid["observations"]
        cases = {
            "same_id_same_value": [*valid, observed("status", 200)],
            "same_id_different_value": [*valid, observed("status", 500)],
            "unknown_check": [*valid, observed("extra_check", True)],
            "skipped_with_value": [valid[1], {**valid[0], "state": "SKIPPED"}],
            "missing_value": [valid[1], {"id": "status", "state": "OBSERVED", "ref": "receipt/status"}],
            "invalid_state_type": [valid[1], {**valid[0], "state": []}],
            "missing_reference": [valid[1], {**valid[0], "ref": ""}],
        }
        for name, observations in cases.items():
            with self.subTest(name=name):
                result = evaluate(self.frozen, {**self.valid, "observations": observations})
                self.assertEqual(result["decision"], "WITHHOLD")

    def test_invalid_plan_and_malformed_frozen_bytes_are_not_usable(self):
        duplicate = deepcopy(self.plan)
        duplicate["checks"].append(deepcopy(duplicate["checks"][0]))
        with self.assertRaises(ValueError):
            freeze(duplicate)
        for bad in (b"{", b"[]", b"{}", b"\xff"):
            with self.subTest(bad=bad):
                self.assertEqual(evaluate(bad, self.valid)["decision"], "WITHHOLD")


if __name__ == "__main__":
    unittest.main()
