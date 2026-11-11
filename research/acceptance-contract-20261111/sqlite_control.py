"""Live local acceptance control using a fixed in-memory SQLite fixture."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys

import contract


HERE = Path(__file__).resolve().parent
SCOPE = {"lane": "sqlite-in-memory", "transport": "stdio"}
REQUEST_SCHEMA = "shadow.sqlite-control-request.v1"
RESPONSE_SCHEMA = "shadow.sqlite-control-response.v1"
SEED = """
CREATE TABLE accounts (id INTEGER PRIMARY KEY, paid INTEGER, canceled INTEGER);
INSERT INTO accounts VALUES (1, 1, 0), (2, 1, 1), (3, 0, 0);
"""
QUERIES = {
    "paid_active": "SELECT COUNT(*) FROM accounts WHERE paid = 1 AND canceled = 0",
    "all_accounts": "SELECT COUNT(*) FROM accounts",
    "missing_column": "SELECT COUNT(missing_column) FROM accounts",
    "paid_canceled": "SELECT COUNT(*) FROM accounts WHERE paid = 1 AND canceled = 1",
    "paid_active_ids": "SELECT id FROM accounts WHERE paid = 1 AND canceled = 0 ORDER BY id",
    "paid_canceled_ids": "SELECT id FROM accounts WHERE paid = 1 AND canceled = 1 ORDER BY id",
}
ID_LIST_QUERIES = {"paid_active_ids", "paid_canceled_ids"}


def _json(value: object) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=True, allow_nan=False)


def _worker() -> int:
    request = json.load(sys.stdin)
    if (
        type(request) is not dict
        or request.keys() != {"schema", "run_id", "plan_sha256", "query_id"}
        or not all(type(item) is str for item in request.values())
        or request["schema"] != REQUEST_SCHEMA
        or request["query_id"] not in QUERIES
    ):
        print("invalid control request", file=sys.stderr)
        return 2
    response = {**request, "schema": RESPONSE_SCHEMA}
    with sqlite3.connect(":memory:") as connection:
        connection.executescript(SEED)
        try:
            cursor = connection.execute(QUERIES[request["query_id"]])
            if request["query_id"] in ID_LIST_QUERIES:
                value = json.dumps([row[0] for row in cursor], separators=(",", ":"))
            else:
                value = cursor.fetchone()[0]
        except sqlite3.Error as exc:
            response.update(status="SQL_ERROR", error={"type": type(exc).__name__, "message": str(exc)})
            print(_json(response))
            return 1
        response.update(status="SQL_COMPLETED", value=value)
    print(_json(response))
    return 0


def _execute(control_id: str, check_id: str, expected: int | str, query_id: str) -> dict:
    plan = {
        "schema": contract.PLAN_SCHEMA,
        "run_id": f"sqlite:{control_id}",
        "scope": SCOPE,
        "checks": [{"id": check_id, "applies_to": ["stdio"], "expected": expected}],
        "open_questions": [],
    }
    frozen = contract.freeze(plan)
    request = {
        "schema": REQUEST_SCHEMA,
        "run_id": plan["run_id"],
        "plan_sha256": contract.digest(frozen),
        "query_id": query_id,
    }
    process = subprocess.run(
        [sys.executable, "-B", str(Path(__file__).resolve()), "--worker"],
        input=_json(request),
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )
    response = json.loads(process.stdout)
    # Treat a broken fixture transport as an experiment error, not a valid SQL result.
    assert process.stderr == ""
    assert all(response[key] == request[key] for key in ("run_id", "plan_sha256", "query_id"))
    assert response["schema"] == RESPONSE_SCHEMA
    ref = f"sqlite-results.json#row={control_id}/response"
    if response.get("status") == "SQL_COMPLETED":
        value_type = str if query_id in ID_LIST_QUERIES else int
        assert process.returncode == 0 and type(response.get("value")) is value_type
        observation = {"id": check_id, "state": "OBSERVED", "value": response["value"], "ref": ref}
    else:
        assert response.get("status") == "SQL_ERROR" and process.returncode == 1
        assert "value" not in response and response["error"]["type"] == "OperationalError"
        observation = {"id": check_id, "state": "ERROR", "ref": ref}
    evidence = {
        "schema": contract.EVIDENCE_SCHEMA,
        "run_id": response["run_id"],
        "plan_sha256": response["plan_sha256"],
        "scope": SCOPE,
        "observations": [observation],
    }
    return {
        "id": control_id,
        "kind": "fresh_sql_attempt",
        "frozen_plan": frozen.decode("utf-8"),
        "request": request,
        "response": response,
        "process": {"returncode": process.returncode, "stdout": process.stdout, "stderr": process.stderr},
        "evidence": evidence,
        "verdict": contract.evaluate(frozen, evidence),
    }


def _substitute(control_id: str, plan_row: dict, evidence_row: dict, *, omit: bool = False) -> dict:
    frozen = plan_row["frozen_plan"].encode("utf-8")
    evidence = evidence_row["evidence"]
    if omit:
        evidence = {**evidence, "observations": []}
    return {
        "id": control_id,
        "kind": "post_run_evidence_substitution",
        "frozen_plan": frozen.decode("utf-8"),
        "source_response_row": evidence_row["id"],
        "evidence": evidence,
        "verdict": contract.evaluate(frozen, evidence),
    }


def run_controls() -> dict:
    healthy = _execute("paid_active_matches", "paid_not_canceled_count", 1, "paid_active")
    broad = _execute("broad_query_mismatches", "paid_not_canceled_count", 1, "all_accounts")
    alternate = _execute("broad_query_matches_alternate", "all_accounts_count", 3, "all_accounts")
    error = _execute("sql_error", "paid_not_canceled_count", 1, "missing_column")
    equal_count = _execute("canceled_subset_same_count", "paid_not_canceled_count", 1, "paid_canceled")
    right_ids = _execute("active_subset_matches_ids", "paid_not_canceled_ids", "[1]", "paid_active_ids")
    wrong_ids = _execute("canceled_subset_mismatches_ids", "paid_not_canceled_ids", "[1]", "paid_canceled_ids")
    stale = _substitute("old_run_under_changed_plan", alternate, broad)
    missing = _substitute("observation_omitted_after_run", healthy, healthy, omit=True)
    rows = [healthy, broad, alternate, error, equal_count, right_ids, wrong_ids, stale, missing]
    expected = [
        ("ACCEPT", "APPLICABLE_CHECKS_PASSED"),
        ("REJECT", "REQUIRED_CHECK_FAILED"),
        ("ACCEPT", "APPLICABLE_CHECKS_PASSED"),
        ("WITHHOLD", "REQUIRED_CHECK_NOT_OBSERVED"),
        ("ACCEPT", "APPLICABLE_CHECKS_PASSED"),
        ("ACCEPT", "APPLICABLE_CHECKS_PASSED"),
        ("REJECT", "REQUIRED_CHECK_FAILED"),
        ("WITHHOLD", "PLAN_DIGEST_MISMATCH"),
        ("WITHHOLD", "REQUIRED_CHECK_NOT_OBSERVED"),
    ]
    assert [(r["verdict"]["decision"], r["verdict"]["reason"]) for r in rows] == expected
    assert broad["response"]["value"] == alternate["response"]["value"] == 3
    assert equal_count["response"]["value"] == healthy["response"]["value"] == 1
    assert right_ids["response"]["value"] == "[1]" and wrong_ids["response"]["value"] == "[2]"
    assert [r["response"]["status"] for r in rows[:4]] == ["SQL_COMPLETED"] * 3 + ["SQL_ERROR"]
    assert all(r["response"]["status"] == "SQL_COMPLETED" for r in rows[4:7])
    return {
        "schema": "shadow.sqlite-transfer-control.v1",
        "counts": {
            "fresh_sql_attempts": sum(r["kind"] == "fresh_sql_attempt" for r in rows),
            "post_run_substitutions": sum(r["kind"] == "post_run_evidence_substitution" for r in rows),
        },
        "python_version": sys.version.split()[0],
        "sqlite_version": sqlite3.sqlite_version,
        "code_sha256": {
            name: hashlib.sha256((HERE / name).read_bytes()).hexdigest()
            for name in ("sqlite_control.py", "contract.py")
        },
        "seed_sql": SEED.strip(),
        "fixed_selects": QUERIES,
        "limits": [
            "Authored SQLite fixtures and local subprocess stdio only; no real customer or server.",
            "Plans are frozen before their fresh SQL attempts; post-run substitutions execute no SQL.",
            "The adapter and echoed bindings are trusted local inputs, not authenticated evidence.",
            "Equal counts from different row sets correctly pass the count-only criterion; this is not a false accept at that scope.",
            "The row-identity criterion compares a canonical JSON string of sorted IDs; matching it says nothing about uncaptured fields or query correctness beyond this check.",
            "This is not an Oracle study replication.",
            "This is a transfer control, not a new historical defect or generalization result.",
        ],
        "rows": rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--worker", action="store_true")
    parser.add_argument("--output", type=Path, default=HERE / "sqlite-results.json")
    args = parser.parse_args()
    if args.worker:
        return _worker()
    result = run_controls()
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=True, allow_nan=False) + "\n", encoding="utf-8")
    print(_json(result["counts"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
