# Resulting Traceability Matrix

| Benchmark Rule | Source | Implementation File | Test File |
|---|---|---|---|
| FICO >= 700 | Addendum A | `src/orallexa_modea/loan/policy.py` | `tests/test_loan_policy.py` |
| DTI <= 0.36 | Addendum B | `src/orallexa_modea/loan/policy.py` | `tests/test_loan_policy.py` |
| LTV <= 0.80 | Addendum C | `src/orallexa_modea/loan/policy.py` | `tests/test_loan_policy.py` |
| VaR <= 0.12 | Addendum C Risk Appetite Note | `src/orallexa_modea/risk/risk_core.py` | `tests/test_risk_core.py` |
| VaR/ES Framework | BRD Risk Core Specification | `src/orallexa_modea/risk/var_es.py` | `tests/test_risk_core.py` |
| 10-Day Horizon | BRD Risk Packet Methodology | `src/orallexa_modea/risk/models.py` | `tests/test_risk_core.py` |
| Confidence 95% | BRD Risk Packet Methodology | `src/orallexa_modea/risk/models.py` | `tests/test_risk_core.py` |
| Analysis Only | BRD Governance Controls | `src/orallexa_modea/risk/audit.py` | `tests/test_audit_and_council.py` |
