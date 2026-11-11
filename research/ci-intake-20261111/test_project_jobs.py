"""Behavioral tests for offline projection of saved Jobs API responses."""

from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import tempfile
import unittest

from intake import MAX_JSON_BYTES
from project_jobs import main, project_jobs


_SCOPE = {"repository_id": 101, "run_id": 201, "attempt": 2}


def _job(job_id: int = 301) -> dict:
    return {
        "id": job_id,
        "run_id": 201,
        "run_attempt": 2,
        "head_sha": "a" * 40,
        "name": "test (3.12)",
        "status": "completed",
        "conclusion": "success",
        "steps": [{
            "number": 4,
            "name": "verify inventory",
            "status": "completed",
            "conclusion": "success",
            "started_at": "2026-11-11T00:00:00Z",
        }],
        "url": "https://api.github.com/example/job",
        "labels": ["runner"],
    }


class ProjectJobsTests(unittest.TestCase):
    def test_projects_only_review_fields_from_single_response(self) -> None:
        raw = {"total_count": 1, "jobs": [_job()], "extra": "omit"}
        result = project_jobs(raw, **_SCOPE)
        self.assertEqual(result, {
            **_SCOPE,
            "complete": True,
            "total_count": 1,
            "jobs": [{
                "id": 301,
                "run_id": 201,
                "run_attempt": 2,
                "head_sha": "a" * 40,
                "name": "test (3.12)",
                "status": "completed",
                "conclusion": "success",
                "steps": [{
                    "number": 4, "name": "verify inventory", "status": "completed", "conclusion": "success",
                }],
            }],
        })
        self.assertIn("labels", raw["jobs"][0])
        self.assertIn("started_at", raw["jobs"][0]["steps"][0])

    def test_slurped_pages_produce_complete_snapshot_in_input_order(self) -> None:
        pages = [{"total_count": 2, "jobs": [_job(302)]}, {"total_count": 2, "jobs": [_job(301)]}]
        result = project_jobs(pages, **_SCOPE)
        self.assertTrue(result["complete"])
        self.assertEqual(result["total_count"], 2)
        self.assertEqual([job["id"] for job in result["jobs"]], [302, 301])

    def test_partial_pages_preserve_declared_total_and_incomplete_flag(self) -> None:
        pages = [{"total_count": 3, "jobs": [_job()]}, {"total_count": 3, "jobs": [_job(302)]}]
        result = project_jobs(pages, **_SCOPE)
        self.assertFalse(result["complete"])
        self.assertEqual(result["total_count"], 3)
        self.assertEqual(len(result["jobs"]), 2)

    def test_zero_declared_jobs_is_distinct_from_empty_page_list(self) -> None:
        result = project_jobs({"total_count": 0, "jobs": []}, **_SCOPE)
        self.assertTrue(result["complete"])
        self.assertEqual(result["jobs"], [])
        with self.assertRaisesRegex(ValueError, "nonempty list of pages"):
            project_jobs([], **_SCOPE)

    def test_job_attempt_absence_and_unfinished_conclusion_are_preserved(self) -> None:
        job = _job()
        del job["run_attempt"]
        job.update(status="in_progress", conclusion=None)
        job["steps"][0].update(status="in_progress", conclusion=None)
        result = project_jobs({"total_count": 1, "jobs": [job]}, **_SCOPE)["jobs"][0]
        self.assertNotIn("run_attempt", result)
        self.assertEqual(result["status"], "in_progress")
        self.assertIsNone(result["conclusion"])
        self.assertIsNone(result["steps"][0]["conclusion"])

    def test_inconsistent_page_totals_are_rejected(self) -> None:
        pages = [{"total_count": 2, "jobs": [_job()]}, {"total_count": 3, "jobs": [_job(302)]}]
        with self.assertRaisesRegex(ValueError, "inconsistent total_count"):
            project_jobs(pages, **_SCOPE)

    def test_more_rows_than_reported_total_are_rejected(self) -> None:
        pages = [{"total_count": 1, "jobs": [_job()]}, {"total_count": 1, "jobs": [_job(302)]}]
        with self.assertRaisesRegex(ValueError, "exceed total_count"):
            project_jobs(pages, **_SCOPE)

    def test_duplicate_job_across_pages_is_rejected(self) -> None:
        pages = [{"total_count": 2, "jobs": [_job()]}, {"total_count": 2, "jobs": [_job()]}]
        with self.assertRaisesRegex(ValueError, "duplicate job ID"):
            project_jobs(pages, **_SCOPE)

    def test_duplicate_step_within_job_is_rejected(self) -> None:
        job = _job()
        job["steps"].append(job["steps"][0].copy())
        with self.assertRaisesRegex(ValueError, "duplicate step number"):
            project_jobs({"total_count": 1, "jobs": [job]}, **_SCOPE)

    def test_exact_positive_integer_scope(self) -> None:
        for field, value in (("repository_id", True), ("run_id", "201"), ("attempt", 0), ("attempt", 2.0)):
            with self.subTest(field=field, value=value), self.assertRaisesRegex(ValueError, "positive integers"):
                project_jobs({"total_count": 0, "jobs": []}, **{**_SCOPE, field: value})

    def test_jobs_require_matching_run_and_matching_attempt_if_present(self) -> None:
        for field, value in (("run_id", 202), ("run_attempt", 1), ("run_attempt", True), ("run_attempt", None)):
            with self.subTest(field=field, value=value), self.assertRaisesRegex(ValueError, "requested scope"):
                project_jobs({"total_count": 1, "jobs": [{**_job(), field: value}]}, **_SCOPE)

    def test_invalid_page_count_or_rows_are_rejected(self) -> None:
        for page in (None, {}, {"total_count": True, "jobs": []}, {"total_count": -1, "jobs": []},
                     {"total_count": 0, "jobs": {}}, {"total_count": "0", "jobs": []}):
            with self.subTest(page=page), self.assertRaises(ValueError):
                project_jobs([page], **_SCOPE)

    def test_invalid_job_and_step_shapes_are_rejected(self) -> None:
        for changes in ({"id": False}, {"head_sha": "not-a-sha"}, {"status": ""}, {"conclusion": 1},
                        {"steps": None}, {"steps": [{"number": True, "name": "x", "status": "completed",
                                                    "conclusion": "success"}]}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                project_jobs({"total_count": 1, "jobs": [{**_job(), **changes}]}, **_SCOPE)

    def _invoke(self, raw: bytes) -> tuple[int, str, str]:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "raw.json"
            path.write_bytes(raw)
            stdout, stderr = io.StringIO(), io.StringIO()
            with redirect_stdout(stdout), redirect_stderr(stderr):
                try:
                    code = main([str(path), "--repository-id", "101", "--run-id", "201", "--attempt", "2"])
                except SystemExit as exc:
                    code = exc.code
            return code, stdout.getvalue(), stderr.getvalue()

    def test_cli_returns_snapshot_json_for_partial_page(self) -> None:
        code, stdout, stderr = self._invoke(json.dumps({"total_count": 2, "jobs": [_job()]}).encode())
        self.assertEqual(code, 0)
        self.assertEqual(stderr, "")
        self.assertFalse(json.loads(stdout)["complete"])

    def test_cli_rejects_duplicate_keys_and_nonfinite_values(self) -> None:
        for raw in (
            b'{"total_count":0,"total_count":0,"jobs":[]}',
            b'{"total_count":0,"jobs":[],"ignored":NaN}',
            b'{"total_count":0,"jobs":[],"ignored":1e999}',
        ):
            with self.subTest(raw=raw):
                code, stdout, stderr = self._invoke(raw)
                self.assertEqual(code, 2)
                self.assertEqual(stdout, "")
                self.assertIn("invalid Jobs export", stderr)

    def test_cli_rejects_large_file_before_projection(self) -> None:
        code, stdout, stderr = self._invoke(b" " * (MAX_JSON_BYTES + 1))
        self.assertEqual(code, 2)
        self.assertEqual(stdout, "")
        self.assertIn("exceeds", stderr)


if __name__ == "__main__":
    unittest.main()
