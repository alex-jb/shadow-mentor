"""Read a saved five-file evidence bundle and print a report-only verdict."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from intake import MAX_JSON_BYTES, _decode, evaluate_ci


def read_bundle(directory: Path) -> dict:
    values = {}
    for key, name in (
        ("frozen", "plan.json"), ("expected", "expected.json"), ("snapshot", "jobs.json"),
        ("receipt", "receipt.json"), ("report_bytes", "report.json"),
    ):
        path = directory / name
        try:
            if not path.is_file():
                raise OSError("not a regular file")
            with path.open("rb") as source:
                data = source.read(MAX_JSON_BYTES + 1)
            if len(data) > MAX_JSON_BYTES:
                raise ValueError("file exceeds the local profile")
            values[key] = data if key in {"frozen", "report_bytes"} else _decode(data)
        except (OSError, ValueError, RecursionError):
            return {
                "decision": "WITHHOLD", "reason": "INPUT_FILE_UNAVAILABLE_OR_INVALID",
                "checks": [], "native_steps": [], "input_file": name,
            }
    return evaluate_ci(**values)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path, help="local directory containing the evidence bundle")
    args = parser.parse_args()
    verdict = read_bundle(args.bundle)
    print(json.dumps(verdict, indent=2, ensure_ascii=False))
    return {"ACCEPT": 0, "REJECT": 1, "WITHHOLD": 2}[verdict["decision"]]


if __name__ == "__main__":
    raise SystemExit(main())
