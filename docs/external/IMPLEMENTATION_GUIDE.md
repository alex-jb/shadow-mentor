# Step-by-Step Implementation Guide

## Step 1 - Install
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Step 2 - Run tests
```bash
pytest
```

## Step 3 - Run demo
```bash
python scripts/run_demo.py
```

## Step 4 - Run API
```bash
uvicorn orallexa_modea.api.main:app --reload
```

## Step 5 - Call API
```bash
curl -X POST http://localhost:8000/api/modea/loan/deliberate \
  -H "Content-Type: application/json" \
  -d @data/demo/sample_loan.json
```

## Step 6 - Integrate into Shadow
- Copy `src/orallexa_modea/risk` into `shadow-mentor/lib/risk-tools` or wrap as a Python service.
- Copy Addenda A-C into the benchmark documentation folder.
- Add expected terms to the deterministic rubric: `fico >= 700`, `dti <= 0.36`, `ltv <= 0.80`, `var_10d <= 0.12`.
- Keep BRD citations for VaR/ES, 10-day horizon, 95% confidence, and analysis-only controls.
- Keep Addendum citations for FICO, DTI, LTV, and VaR cutoff.
