"""Project saved GitHub Actions Jobs API JSON into a local review snapshot.

The scope is supplied by the caller. This offline projection checks consistency
and row counts; it does not establish the origin or authenticity of the export.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re

from intake import MAX_JSON_BYTES, _decode


def _positive(value: object) -> bool:
    return type(value) is int and value > 0


def _nonblank(value: object) -> bool:
    return type(value) is str and bool(value.strip())


def _valid_statuses(row: dict) -> bool:
    return (
        _nonblank(row.get("status"))
        and "conclusion" in row
        and (row["conclusion"] is None or _nonblank(row["conclusion"]))
    )


def _project_steps(raw: object, location: str) -> list[dict]:
    if type(raw) is not list:
        raise ValueError(f"{location}: steps must be a list")
    steps = []
    seen = set()
    for index, row in enumerate(raw, start=1):
        if not (
            type(row) is dict
            and _positive(row.get("number"))
            and type(row.get("name")) is str
            and _valid_statuses(row)
        ):
            raise ValueError(f"{location}, step {index}: invalid step")
        number = row["number"]
        if number in seen:
            raise ValueError(f"{location}, step {index}: duplicate step number")
        seen.add(number)
        steps.append({k: row[k] for k in ("number", "name", "status", "conclusion")})
    return steps


def _project_job(raw: object, run_id: int, attempt: int, location: str) -> dict:
    if not (
        type(raw) is dict
        and _positive(raw.get("id"))
        and _positive(raw.get("run_id"))
        and type(raw.get("head_sha")) is str
        and re.fullmatch(r"[0-9a-f]{40}", raw["head_sha"]) is not None
        and type(raw.get("name")) is str
        and _valid_statuses(raw)
    ):
        raise ValueError(f"{location}: invalid job")
    if raw["run_id"] != run_id:
        raise ValueError(f"{location}: run ID does not match requested scope")
    if "run_attempt" in raw and (
        not _positive(raw["run_attempt"]) or raw["run_attempt"] != attempt
    ):
        raise ValueError(f"{location}: run attempt does not match requested scope")
    job = {k: raw[k] for k in ("id", "run_id", "head_sha", "name", "status", "conclusion")}
    if "run_attempt" in raw:
        job["run_attempt"] = raw["run_attempt"]
    job["steps"] = _project_steps(raw.get("steps"), location)
    return job


def project_jobs(raw: object, repository_id: int, run_id: int, attempt: int) -> dict:
    """Project a single response object or a nonempty list of slurped pages."""
    if not all(_positive(value) for value in (repository_id, run_id, attempt)):
        raise ValueError("repository ID, run ID and attempt must be positive integers")
    pages = [raw] if type(raw) is dict else raw
    if type(pages) is not list or not pages:
        raise ValueError("expected one Jobs response or a nonempty list of pages")

    total = None
    jobs = []
    seen = set()
    for page_index, page in enumerate(pages, start=1):
        if not (
            type(page) is dict
            and type(page.get("total_count")) is int
            and page["total_count"] >= 0
            and type(page.get("jobs")) is list
        ):
            raise ValueError(f"page {page_index}: invalid Jobs response")
        if total is None:
            total = page["total_count"]
        elif total != page["total_count"]:
            raise ValueError(f"page {page_index}: inconsistent total_count")
        if len(jobs) + len(page["jobs"]) > total:
            raise ValueError(f"page {page_index}: returned rows exceed total_count")
        for job_index, raw_job in enumerate(page["jobs"], start=1):
            location = f"page {page_index}, job {job_index}"
            job = _project_job(raw_job, run_id, attempt, location)
            if job["id"] in seen:
                raise ValueError(f"{location}: duplicate job ID")
            seen.add(job["id"])
            jobs.append(job)

    return {
        "repository_id": repository_id,
        "run_id": run_id,
        "attempt": attempt,
        "complete": len(jobs) == total,
        "total_count": total,
        "jobs": jobs,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("response", type=Path, help="saved Jobs response JSON")
    parser.add_argument("--repository-id", type=int, required=True)
    parser.add_argument("--run-id", type=int, required=True)
    parser.add_argument("--attempt", type=int, required=True)
    args = parser.parse_args(argv)
    try:
        if not args.response.is_file():
            raise ValueError("response must be a regular file")
        with args.response.open("rb") as source:
            data = source.read(MAX_JSON_BYTES + 1)
        if len(data) > MAX_JSON_BYTES:
            raise ValueError("response exceeds the 1 MiB local profile")
        result = project_jobs(_decode(data), args.repository_id, args.run_id, args.attempt)
    except (OSError, ValueError, RecursionError) as exc:
        parser.error(f"invalid Jobs export: {exc}")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
