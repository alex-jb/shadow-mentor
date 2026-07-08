#!/usr/bin/env bash
# lint-skills.sh
# ─────────────────────────────────────────────────────────────
# CI gate for Shadow SKILL.md + evals.json discipline.
#
# Adopted 2026-07-08 from msitarzewski/agency-agents lint pattern.
# Runs on every PR that touches skills/ to catch drift before it
# lands on skills.sh where 669K other skills compete for attention.
#
# Checks per skill directory:
#   1. SKILL.md exists
#   2. SKILL.md frontmatter has required fields: name, description,
#      version, authors, license, repo, tags
#   3. SKILL.md has no CRLF line endings (LF only)
#   4. SKILL.md has required sections: "## When to use"
#   5. evals.json exists (v1.5.18+ requirement)
#   6. evals.json is valid JSON
#   7. evals.json has required top-level keys: skill, version, trigger, expectations
#
# Exit code: 0 = all green, 1 = at least one skill failed.

set -u

# Locate skills root regardless of where the script is invoked from.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SKILLS_ROOT="$( cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd )"

FAIL=0
CHECKED=0

for dir in "$SKILLS_ROOT"/shadow-*/; do
  skill_name="$( basename "$dir" )"
  CHECKED=$(( CHECKED + 1 ))
  skill_pass=1

  skill_md="$dir/SKILL.md"
  evals_json="$dir/evals.json"

  # Check 1: SKILL.md exists
  if [ ! -f "$skill_md" ]; then
    echo "FAIL $skill_name: SKILL.md missing"
    skill_pass=0
  else
    # Check 2: frontmatter required fields
    for field in name description version authors license repo tags; do
      if ! head -30 "$skill_md" | grep -q "^${field}:"; then
        echo "FAIL $skill_name: SKILL.md frontmatter missing '$field'"
        skill_pass=0
      fi
    done

    # Check 3: no CRLF
    if file "$skill_md" | grep -q CRLF; then
      echo "FAIL $skill_name: SKILL.md has CRLF line endings (LF only)"
      skill_pass=0
    fi

    # Check 4: required sections
    if ! grep -q "^## When to use" "$skill_md"; then
      echo "FAIL $skill_name: SKILL.md missing '## When to use' section"
      skill_pass=0
    fi
  fi

  # Check 5-7: evals.json (v1.5.18+ requirement)
  if [ ! -f "$evals_json" ]; then
    echo "FAIL $skill_name: evals.json missing (required v1.5.18+)"
    skill_pass=0
  else
    # Check 6: valid JSON
    if ! node -e "JSON.parse(require('fs').readFileSync('$evals_json','utf8'))" 2>/dev/null; then
      echo "FAIL $skill_name: evals.json invalid JSON"
      skill_pass=0
    else
      # Check 7: required top-level keys
      for key in skill version trigger expectations; do
        if ! node -e "const d=JSON.parse(require('fs').readFileSync('$evals_json','utf8')); if(!(d['$key'])) process.exit(1);" 2>/dev/null; then
          echo "FAIL $skill_name: evals.json missing top-level key '$key'"
          skill_pass=0
        fi
      done
    fi
  fi

  if [ $skill_pass -eq 1 ]; then
    echo "OK   $skill_name"
  else
    FAIL=$(( FAIL + 1 ))
  fi
done

echo
echo "Checked $CHECKED skills, $FAIL failed"
exit $FAIL
