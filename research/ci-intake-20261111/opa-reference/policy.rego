package shadow_app

import rego.v1

# The shared CI intake has already validated and frozen input.plan and checked
# report bytes. This policy decides the application criterion, not admission.

nonblank(value) if {
	is_string(value)
	trim_space(value) != ""
}

scalar(value) if is_string(value)
scalar(value) if is_boolean(value)
scalar(value) if {
	is_number(value)
	floor(value) == value
}

valid_report if {
	r := input.report
	is_object(r)
	object.keys(r) == {"schema", "run_id", "plan_sha256", "scope", "observations"}
	r.schema == "shadow.acceptance-evidence.v1"
	nonblank(r.run_id)
	nonblank(r.plan_sha256)
	is_object(r.scope)
	object.keys(r.scope) == {"lane", "transport"}
	nonblank(r.scope.lane)
	r.scope.transport in {"http", "stdio"}
	is_array(r.observations)
}

valid_observation(obs) if {
	is_object(obs)
	nonblank(obs.id)
	nonblank(obs.ref)
	obs.state == "OBSERVED"
	object.keys(obs) == {"id", "state", "ref", "value"}
	scalar(obs.value)
}

valid_observation(obs) if {
	is_object(obs)
	nonblank(obs.id)
	nonblank(obs.ref)
	obs.state in {"ERROR", "SKIPPED"}
	object.keys(obs) == {"id", "state", "ref"}
}

valid_observations if {
	every obs in input.report.observations {
		valid_observation(obs)
	}
}

observed_ids := {obs.id | some obs in input.report.observations}
planned_ids := {check.id | some check in input.plan.checks}
applicable_ids := {check.id |
	some check in input.plan.checks
	input.plan.scope.transport in check.applies_to
}
observations := {obs.id: obs | some obs in input.report.observations}

outcome(check) := {"state": "NOT_APPLICABLE", "reason": "OUTSIDE_PLANNED_TRANSPORT"} if {
	not check.id in applicable_ids
} else := {"state": "NOT_OBSERVED", "reason": "MISSING_OBSERVATION"} if {
	not check.id in observed_ids
} else := {"state": "NOT_OBSERVED", "reason": obs.state, "ref": obs.ref} if {
	obs := observations[check.id]
	obs.state != "OBSERVED"
} else := {"state": "NOT_OBSERVED", "reason": "VALUE_TYPE_MISMATCH", "ref": obs.ref} if {
	obs := observations[check.id]
	type_name(obs.value) != type_name(check.expected)
} else := {"state": "FAIL", "reason": "VALUE_MISMATCH", "ref": obs.ref} if {
	obs := observations[check.id]
	obs.value != check.expected
} else := {"state": "PASS", "reason": "VALUE_MATCH", "ref": observations[check.id].ref}

rows := [object.union({"id": check.id}, outcome(check)) | some check in input.plan.checks]
states := {row.state | some row in rows}

decision(label, reason, checks) := {"decision": label, "reason": reason, "checks": checks}
hold(reason) := decision("WITHHOLD", reason, [])

result := hold("INVALID_EVIDENCE") if {
	not valid_report
} else := hold("PLAN_DIGEST_MISMATCH") if {
	input.report.plan_sha256 != input.frozen_plan_sha256
} else := hold("RUN_ID_MISMATCH") if {
	input.report.run_id != input.plan.run_id
} else := hold("SCOPE_MISMATCH") if {
	input.report.scope != input.plan.scope
} else := hold("OPEN_QUESTIONS") if {
	count(input.plan.open_questions) > 0
} else := hold("INVALID_OBSERVATION") if {
	not valid_observations
} else := hold("DUPLICATE_OBSERVATION") if {
	count(observed_ids) != count(input.report.observations)
} else := hold("UNKNOWN_CHECK") if {
	count(observed_ids - planned_ids) > 0
} else := hold("NONAPPLICABLE_OBSERVATION") if {
	count(observed_ids - applicable_ids) > 0
} else := decision("REJECT", "REQUIRED_CHECK_FAILED", rows) if {
	"FAIL" in states
} else := decision("WITHHOLD", "REQUIRED_CHECK_NOT_OBSERVED", rows) if {
	"NOT_OBSERVED" in states
} else := decision("WITHHOLD", "NO_APPLICABLE_CHECKS", rows) if {
	not "PASS" in states
} else := decision("ACCEPT", "APPLICABLE_CHECKS_PASSED", rows)
