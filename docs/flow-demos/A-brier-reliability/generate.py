#!/usr/bin/env python3
"""
Generate a Flow Immersive-shaped CSV for Demo A: Brier reliability surface
over time, per Shadow persona.

Flow's Featured examples (Stock Portfolio, Population Futures, El Nino) use
a wide CSV where rows are observations and columns are dimensions. Flow
maps three columns to X / Y / Z axes and can render a fourth as color or
size. We produce:

  x_predicted_probability   [0.0, 0.1, 0.2, ..., 1.0]
  y_empirical_frequency     [empirical outcome rate at that predicted-prob bin]
  z_week_offset             [-12, -11, ..., 0]  (12 weeks of history)
  persona                   [Credit Fundamentals | Risk Officer | ... ]
  bin_count                 [n samples in that bin, drives point size]

A perfectly calibrated persona would emit a surface where y == x for every
week. Miscalibration appears as vertical departure from the y=x plane.
Drift over time appears as the surface tilting along the Z axis.

Usage:
  python3 generate.py > shadow-brier-reliability.csv

The output is upload-ready to a.flow.gl → Create new → Load CSV.
"""

import csv
import math
import random
import sys

PERSONAS = [
    "Credit Fundamentals",
    "Risk Officer",
    "Fair Lending Compliance",
    "Customer Advocate",
    "Macro Contrarian",
]

# Ground truth "true" miscalibration profile per persona (v0.1 synthetic).
# In production this is measured; here we hand-tune realistic-looking curves.
# Each entry: (overconfidence_slope, drift_per_week)
#   overconfidence_slope: 0 = perfectly calibrated. Positive = over-confident
#                        at high probability. Negative = under-confident.
#   drift_per_week: how much the overconfidence changes per week.
PROFILE = {
    "Credit Fundamentals":       (+0.02, -0.001),  # slightly over-confident, improving
    "Risk Officer":              (+0.05, +0.003),  # over-confident and drifting worse
    "Fair Lending Compliance":   (-0.08, +0.002),  # under-confident, drifting worse
    "Customer Advocate":         (+0.01,  0.000),  # nearly perfect
    "Macro Contrarian":          (-0.03, -0.002),  # slightly under-confident, improving
}

X_BINS = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]
WEEKS = list(range(-11, 1))  # weeks -11..0, week 0 is "this week"

random.seed(20260706)  # deterministic for repro

def empirical_frequency(x_bin, overconfidence, week_offset, drift):
    """Return the empirical outcome rate at this predicted-prob bin, given the
    persona's overconfidence profile."""
    effective_over = overconfidence + drift * abs(week_offset)
    # Overconfident: predicted p is higher than empirical rate.
    # So empirical = predicted - overconfidence*(some_curve).
    # We shape the miscalibration as a sinusoid peaking at x=0.5 so ends stay bounded.
    curve = math.sin(x_bin * math.pi)
    y = x_bin - effective_over * curve
    # Add small measurement noise.
    y += random.uniform(-0.008, 0.008)
    y = max(0.0, min(1.0, y))
    return y

def bin_count(x_bin):
    """Realistic bin count — bell-shaped, peaks at 0.5."""
    return int(200 * (1 - abs(x_bin - 0.5) * 1.5))

def main():
    writer = csv.writer(sys.stdout)
    writer.writerow([
        "x_predicted_probability",
        "y_empirical_frequency",
        "z_week_offset",
        "persona",
        "bin_count",
    ])
    for persona in PERSONAS:
        over, drift = PROFILE[persona]
        for week in WEEKS:
            for x in X_BINS:
                y = empirical_frequency(x, over, week, drift)
                n = bin_count(x)
                writer.writerow([f"{x:.2f}", f"{y:.4f}", week, persona, n])

if __name__ == "__main__":
    main()
