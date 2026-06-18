window.SCENARIOS = {
  lbo: {
    title: "AcmeCo_LBO_Model_v4_Maya.xlsx — Excel",
    recognized: "Excel · LBO model · 'Capital Structure' tab",
    canvas: `
      <div style="margin-bottom:14px; color:#94a3b8;">
        <strong style="color:#ecf0f5;">AcmeCo Leveraged Buyout — Capital Structure</strong>
        <br/>Maya's first task: review senior debt sizing for the 2026 transaction
      </div>
      <div class="fake-excel">
        <div class="fake-excel-row fake-excel-header">
          <div class="fake-excel-cell">Tranche</div>
          <div class="fake-excel-cell">Amount ($M)</div>
          <div class="fake-excel-cell">Rate</div>
          <div class="fake-excel-cell">Maturity</div>
        </div>
        <div class="fake-excel-row">
          <div class="fake-excel-cell">Term Loan A</div>
          <div class="fake-excel-cell">350</div>
          <div class="fake-excel-cell">SOFR + 275</div>
          <div class="fake-excel-cell">5y</div>
        </div>
        <div class="fake-excel-row">
          <div class="fake-excel-cell">Term Loan B</div>
          <div class="fake-excel-cell">600</div>
          <div class="fake-excel-cell">SOFR + 425</div>
          <div class="fake-excel-cell">7y</div>
        </div>
        <div class="fake-excel-row">
          <div class="fake-excel-cell">Sr. Sub Notes</div>
          <div class="fake-excel-cell">250</div>
          <div class="fake-excel-cell">9.25%</div>
          <div class="fake-excel-cell">8y</div>
        </div>
        <div class="fake-excel-row">
          <div class="fake-excel-cell highlight-cell">Senior Leverage Ratio</div>
          <div class="fake-excel-cell highlight-cell">4.2x</div>
          <div class="fake-excel-cell">—</div>
          <div class="fake-excel-cell">—</div>
        </div>
        <div class="fake-excel-row">
          <div class="fake-excel-cell">Total Leverage</div>
          <div class="fake-excel-cell">5.4x</div>
          <div class="fake-excel-cell">—</div>
          <div class="fake-excel-cell">—</div>
        </div>
        <div class="fake-excel-row">
          <div class="fake-excel-cell">Interest Coverage</div>
          <div class="fake-excel-cell">2.6x</div>
          <div class="fake-excel-cell">—</div>
          <div class="fake-excel-cell">—</div>
        </div>
      </div>
      <p style="color:#6b7280; margin-top:16px; font-size:11.5px;">Maya is on the highlighted cell. She does not know what "Senior Leverage Ratio" excludes vs "Total Leverage."</p>
    `,
    question: "What is \"Senior Leverage Ratio\" actually measuring vs Total Leverage?",
    voices: {
      junior: "Senior debt / EBITDA. 'Senior' = Term Loan A + Term Loan B only. Doesn't include the Sr. Sub Notes. That is why 4.2x < 5.4x total.",
      senior: "Your VP will care about the 3-year trajectory of this ratio, not the snapshot. Last LBO at this firm priced senior at 3.8x. We are 40bps wider. Ask: 'how does this compare to the precedent set we ran last week?'",
      compliance: "Both ratios go into the bank's covenant calculation. Stifel underwriting policy 4.3 caps senior leverage at 4.5x for B-rated borrowers. We are 4.2x — close to limit, must flag in deal memo."
    },
    followup: "How does this compare to the precedent set we ran last week, and what is our covenant headroom?"
  },

  bloomberg: {
    title: "Bloomberg Terminal — AAPL US Equity",
    recognized: "Bloomberg Terminal · AAPL Description (DES) page",
    canvas: `
      <div class="fake-bloomberg">
        <div class="bloomberg-header">AAPL US Equity &nbsp;&nbsp;|&nbsp;&nbsp; DES — Description</div>
        <div class="bloomberg-row"><span>Apple Inc</span><span>Common Stock</span></div>
        <div class="bloomberg-row"><span>EQY_SH_OUT</span><span>15.20B</span></div>
        <div class="bloomberg-row"><span>MARKET_CAP</span><span>$3,420.5B</span></div>
        <div class="bloomberg-row"><span>PX_LAST</span><span>225.18</span></div>
        <div class="bloomberg-row"><span>TRR_1MO</span><span>+4.82%</span></div>
        <div class="bloomberg-row"><span>TRR_YTD</span><span>+12.34%</span></div>
        <div class="bloomberg-row"><span>SHORT_INT_RATIO</span><span>1.18</span></div>
        <div class="bloomberg-row"><span>BORROW_RATE_AVG</span><span>22 bps</span></div>
        <div class="bloomberg-row"><span>DIVIDEND_YIELD</span><span>0.44%</span></div>
        <div class="bloomberg-row"><span>BETA_ADJ_OVERRIDABLE</span><span>1.21</span></div>
        <div class="bloomberg-row"><span>PE_RATIO</span><span>33.7</span></div>
        <div class="bloomberg-row"><span>EV_TO_EBITDA</span><span>24.1</span></div>
        <div class="bloomberg-row"><span>NET_DEBT_TO_EBITDA</span><span>0.31x</span></div>
        <div style="margin-top:10px; color:#7da3ff;">[Press &lt;HELP&gt; for help on any field]</div>
      </div>
      <p style="color:#6b7280; margin-top:16px; font-size:11.5px;">Maya is scanning the Description page on her first AAPL coverage initiation. Several field acronyms are unfamiliar.</p>
    `,
    question: "What is BORROW_RATE_AVG and why does it matter for an equity analyst?",
    voices: {
      junior: "It's the average annualized fee to borrow shares to short. 22 bps = 0.22%/yr. Very low → easy to short → no scarcity signal.",
      senior: "Look at it alongside SHORT_INT_RATIO 1.18 (1.18 days to cover). Both signals say 'crowded long, no short conviction.' For a coverage initiation note: NOT a contrarian short setup. Worth one sentence in the 'sentiment' section.",
      compliance: "Borrow rate data falls under MNPI scope ONLY when it materially changes (e.g., spike from 22 bps to 4%). Stifel research policy: do not publish forward-looking borrow-rate forecasts. Historical snapshot only."
    },
    followup: "Has the borrow rate trended over the last 90 days, and does that change our short-thesis discussion section?"
  },

  cds: {
    title: "Markit CDX IG Spread — 5-year — Last 12 Months",
    recognized: "Markit · CDS spread chart · CDX.IG.43 5y",
    canvas: `
      <div class="fake-cds-chart">
        <div class="chart-title">CDX.NA.IG.43 — 5-Year Spread (bps) — Last 12 Months</div>
        <svg class="fake-cds-svg" viewBox="0 0 600 220" preserveAspectRatio="none">
          <!-- gridlines -->
          <line x1="0" y1="40" x2="600" y2="40" stroke="#1f2937" stroke-dasharray="2,4" />
          <line x1="0" y1="100" x2="600" y2="100" stroke="#1f2937" stroke-dasharray="2,4" />
          <line x1="0" y1="160" x2="600" y2="160" stroke="#1f2937" stroke-dasharray="2,4" />
          <!-- axis labels -->
          <text x="4" y="38" fill="#6b7280" font-size="10" font-family="ui-monospace, monospace">90 bps</text>
          <text x="4" y="98" fill="#6b7280" font-size="10" font-family="ui-monospace, monospace">70 bps</text>
          <text x="4" y="158" fill="#6b7280" font-size="10" font-family="ui-monospace, monospace">50 bps</text>
          <!-- spread line -->
          <polyline points="40,150 80,148 120,140 160,135 200,125 240,118 280,110 320,95 360,75 400,55 440,48 480,55 520,62 560,68"
                    stroke="#ef4444" stroke-width="2.2" fill="none" />
          <!-- recent spike annotation -->
          <circle cx="400" cy="55" r="5" fill="#ef4444" />
          <text x="408" y="50" fill="#fbbf24" font-size="11" font-family="ui-monospace, monospace">+34 bps WoW</text>
          <!-- regime shift overlay -->
          <rect x="350" y="0" width="100" height="220" fill="#ef4444" opacity="0.06" />
          <text x="360" y="14" fill="#ef4444" font-size="10" font-family="ui-monospace, monospace">tariff scare</text>
        </svg>
        <p style="color:#94a3b8; font-size:11.5px; margin-top:10px;">Maya is looking at this for the first time. She wonders if she should flag the recent widening for the morning desk note.</p>
      </div>
    `,
    question: "The spread widened 34 bps WoW. Is that material? Do I flag it for the desk note?",
    voices: {
      junior: "CDX.IG.43 = the on-the-run investment-grade credit default swap index. Spread widening = market pricing more default risk on IG names. 34 bps in a week is a meaningful move (1y range is ~50-90 bps).",
      senior: "Look at the regime shift overlay around the tariff scare. The market took 4 weeks to retrace half. Your morning note should call out: (1) which sectors drove the widening, (2) whether it's still trending after the partial retrace, (3) what the desk is positioned for. Don't just say 'spreads widened.'",
      compliance: "If your desk note recommends a trade based on this signal, it must go through research review per Stifel policy 7.3 (FINRA Rule 2241). Educational commentary on spread movements is fine without review."
    },
    followup: "Which sectors led the widening, and is the desk currently long or short IG credit?"
  },

  policy: {
    title: "Stifel Underwriting Policy 4.3 — Senior Credit Underwriting Standards.pdf",
    recognized: "Internal PDF · Underwriting policy · Section 4.3",
    canvas: `
      <div class="fake-policy">
        <h2>Section 4.3 — Senior Credit Underwriting Standards</h2>
        <p><strong>4.3.1 — Leverage Limits.</strong> Senior leverage on <span class="jargon" title="Borrower with corporate credit rating of B (S&P) / B2 (Moody's) or equivalent">B-rated borrowers</span> shall not exceed <strong>4.5x EBITDA</strong>. <span class="jargon" title="Earnings adjusted for one-time or non-recurring items, generally by buyer's quality of earnings provider">Adjusted EBITDA</span> may be used only with documented <span class="jargon" title="Q of E report — third-party validation of EBITDA adjustments">QoE support</span>.</p>
        <p><strong>4.3.2 — Covenant Architecture.</strong> All term loans &gt;$100M require <span class="jargon" title="Restriction that prevents borrower from increasing leverage or making large discretionary payments">financial maintenance covenants</span>. <span class="jargon" title="A 'cov-lite' loan has only incurrence-based covenants, tested when borrower takes an action, not periodically">Cov-lite</span> exceptions require Credit Committee approval per Policy 11.2.</p>
        <p><strong>4.3.3 — Equity Cushion.</strong> Sponsor equity must constitute &gt;30% of total capitalization at close. Roll-over equity counts at <strong>50% credit</strong>. <span class="jargon" title="The implied equity value flowing back to the sponsor on early refinancing — high amounts signal aggressive structure">Capitalized PIK interest</span> does not count toward equity cushion.</p>
        <p><strong>4.3.4 — Distribution.</strong> <span class="jargon" title="Required Stifel-retained portion of the deal; the share we cannot syndicate away">Hold position</span> shall not exceed Bank's single-name concentration limit per Policy 3.2.</p>
        <p style="color:#6b7280; font-size:11px;">— policy effective 2026-03-15, last reviewed by Risk Committee 2026-04-22</p>
      </div>
      <p style="color:#6b7280; margin-top:16px; font-size:11.5px;">Maya is reading the underwriting policy for the first time. There are 5 highlighted terms she doesn't know yet (hover to see Shadow's inline definition).</p>
    `,
    question: "What is 'cov-lite' and why is the policy treating it as an exception requiring committee approval?",
    voices: {
      junior: "Cov-lite = loan with only incurrence-based covenants (tested when borrower acts) instead of maintenance covenants (tested quarterly). Lender has less visibility into deteriorating credit until something blows up.",
      senior: "Cov-lite was post-2008 sponsor-friendly innovation. Big banks did them anyway through 2021-2024. Stifel's mid-tier risk tolerance does not. This is a real differentiator vs Goldman Lev Fin desk. When a sponsor asks for cov-lite, your VP wants to know: (1) is there equity cushion >40%? (2) is the sponsor on our approved list? (3) is the EBITDA quality A or B?",
      compliance: "Policy 4.3.2 + Policy 11.2 chain means cov-lite requires explicit Credit Committee minutes. Do NOT verbally agree to cov-lite terms in client conversations without committee pre-clearance. This has tripped 2 associates in the last 18 months."
    },
    followup: "What sponsor names are on the firm's approved list and what is our current cov-lite exposure?"
  }
};

// Persona voice packs — each persona shifts the 3 voice tags + content + the
// question being asked, demonstrating that the same engine deploys different
// expertise per role. Falls back to default scenario voices if a persona has
// no override for a given scenario.
window.PERSONAS = {
  compliance: {
    label: "🛡 Compliance Officer",
    tags: { junior: "Junior loan analyst", senior: "Senior VP", third: "Compliance officer" },
    scenarios: {
      lbo: {
        question: "Senior Leverage Ratio 4.2x — does this pass Stifel underwriting policy 4.3 for a B-rated borrower?",
        voices: {
          junior: "Senior debt / EBITDA = $950M / $226M = 4.2x. Policy 4.3.1 caps senior leverage at 4.5x for B-rated borrowers. We are 30bps below the limit.",
          senior: "Don't just ship it because we're under the cap. Look at the QoE adjustment — if Adjusted EBITDA was lifted by >12%, the unadjusted ratio probably breaks 4.5x. Pull the QoE report from the data room before approving.",
          third: "Document this explicitly in the credit memo. CFPB adverse-action standards apply if we deny later: 'leveraged borrowers' is not a sufficient reason. Use 'senior leverage exceeded our underwriting threshold for B-rated risk profile' or similar specific language."
        },
        followup: "What is the QoE provider's EBITDA adjustment, and where does that put the unadjusted senior leverage ratio?"
      },
      bloomberg: {
        question: "AAPL is in our recommended retail list. Does the BORROW_RATE_AVG of 22 bps trigger any disclosure on the client research note?",
        voices: {
          junior: "BORROW_RATE_AVG is the cost to short. 22 bps is low — easy to short, no scarcity. SHORT_INT_RATIO 1.18 days to cover also low. Nothing unusual.",
          senior: "If we're publishing a long recommendation, the borrow data doesn't trigger anything. If we were considering a short thesis section, FINRA Rule 2241 research review applies and we'd need disclosure of any proprietary short position.",
          third: "Reg AC requires the analyst certify the recommendation reflects their personal views. Borrow data goes in the appendix, not the executive summary. Do NOT extrapolate the borrow trend into forward-looking borrow-rate forecasts — that crosses into MNPI territory."
        },
        followup: "Has our firm-wide hold on AAPL changed in the last 30 days, and does that change the conflict-of-interest disclosure required on this note?"
      },
      cds: {
        question: "The 34 bps WoW CDX widening — does this trigger any disclosure on our internal credit exposure report to the Risk Committee?",
        voices: {
          junior: "CDX.NA.IG.43 widening 34 bps in a week is material. Our internal threshold for Risk Committee notification is 25 bps weekly move on IG indices.",
          senior: "Risk Committee will want sector attribution. Which 5 IG names drove the move? Pull our exposure to those names today, not tomorrow. They'll ask in the meeting and 'I'll get back to you' looks bad.",
          third: "Document the trigger event in the credit-monitoring log per Policy 7.1. If we hold any of the affected names in client portfolios above the 3% threshold, Reg BI suitability re-review must occur within 5 business days."
        },
        followup: "Which 5 IG names led the widening, and what is our client-portfolio aggregate exposure to those names?"
      },
      policy: {
        question: "A sponsor is requesting cov-lite on a $250M Term Loan B. Policy 4.3.2 says Credit Committee approval required. What documentation do I need before I send to Committee?",
        voices: {
          junior: "Policy 4.3.2 plus Policy 11.2 means Credit Committee minutes are required before any cov-lite agreement. The sponsor request memo, our underwriting analysis, and the equity cushion calculation all go in the package.",
          senior: "Don't just send the package — pre-brief the Committee chair. Cov-lite asks are political, and a 5-minute hallway conversation before the meeting prevents the request from getting tabled. Tell them: equity cushion %, sponsor track record, EBITDA quality grade.",
          third: "Two associates have been tripped in the last 18 months for verbally agreeing to cov-lite terms in client conversations before Committee approval. The verbal agreement itself becomes a Reg compliance exposure even if Committee later approves. Strictly: 'subject to internal committee review' in every conversation until approval lands in writing."
        },
        followup: "What is the equity cushion percentage on this deal, and what is the sponsor's track record on prior Stifel transactions?"
      }
    }
  },
  quant: {
    label: "🧮 Quant / Data Scientist",
    tags: { junior: "Junior data scientist", senior: "Senior quant", third: "Model risk reviewer" },
    scenarios: {
      lbo: {
        question: "Our LBO default-probability model just flagged this deal at 8% PD. PSI on our credit features tripped last week. Is this PD prediction trustworthy?",
        voices: {
          junior: "PSI tripped on 3 features: borrower industry sector (rolled from healthcare-heavy to consumer-discretionary), 12-month EBITDA volatility, and senior-leverage-to-peer-median. Drift attribution shows the consumer-discretionary shift is doing 60% of the work.",
          senior: "Run SHAP on this specific borrower against the pre-drift baseline. If the PD goes from 8% to <5% under the old feature distribution, the model is mis-extrapolating to the new regime, not detecting real risk. Pre-drift validation set is in `/data/baseline_2025Q4_validation.parquet`.",
          third: "SR 11-7 effective challenge: this PD must be defensible to the model risk committee. If drift-corrected PD diverges by >2pp, file a model performance issue per Policy 11.4 and force-tier the deal to senior credit committee independently of the auto-decision."
        },
        followup: "What does the pre-drift validation set predict for this borrower? And what's our override-rate on model PD this quarter?"
      },
      bloomberg: {
        question: "Our equity factor model has AAPL loading 1.21 on the 'quality' factor. The Bloomberg-derived implied factor exposure is 1.34. Is this divergence a data-quality issue or a model-quality issue?",
        voices: {
          junior: "Two factor models disagreeing by 13 bps of loading is not noise — it's structural. Bloomberg uses Barra's USE5 factor definition; our internal model uses Fama-French 5-factor extended with quality. The 'quality' factor definitions diverge on R&D capitalization treatment.",
          senior: "Check if AAPL just released its 10-Q in the last 30 days. Quality factor loading shifts within 90 days of fundamentals refresh are normal, not model-quality issues. Don't flag this to model-risk yet. But if the divergence persists 60 days post-refresh, file it.",
          third: "SR 11-7 monitoring frame: factor-model divergence above 10 bps for a top-10 portfolio holding is a recordable model-performance event. Log it with attribution; don't escalate unless persistence > 60 days or affects risk-budget allocation > 5%."
        },
        followup: "When did AAPL's last 10-Q drop, and what was the R&D capitalization line-item change?"
      },
      cds: {
        question: "Our credit-spread regime model just flagged regime-shift probability at 0.73. The historical false-positive rate is ~12%. Should we send the alert to the credit desk?",
        voices: {
          junior: "Regime-shift model uses a Hidden Markov Model on 30-day rolling CDX spreads + VIX + slope-of-curve. 0.73 is above our 0.65 threshold. Last 4 trips of this threshold: 3 true regime shifts (2024-Q4, 2025-Q2, 2026-Q1), 1 false positive (2025-Q3).",
          senior: "False-positive history matters less than current conditioning. What's the VIX today? If it's <16, the spread move is probably idiosyncratic — single-name driven, not regime. If VIX >22, the model and the macro both agree, send the alert.",
          third: "Effective challenge per SR 11-7: alert the credit desk + log the model trigger in the model-monitoring repository. If the desk overrides the model 3 times in a row, force a model recalibration request through the Policy 11.4 process."
        },
        followup: "What is the current VIX, and what is our desk's override rate on regime alerts year-to-date?"
      },
      policy: {
        question: "Cov-lite exception requires Credit Committee approval. The committee asked for our model's predicted default rate on cov-lite vs maintenance-covenant loans in our historical book. Where is that analysis?",
        voices: {
          junior: "Historical book has ~3,400 deals back to 2014. Cov-lite was ~28% of B-rated TLBs in our book (2018-2024). Naive default rate cov-lite vs maintenance: 6.2% vs 4.8% — but cov-lite deals skewed toward larger sponsors with stronger track records, so the comparison is confounded.",
          senior: "Adjust for sponsor track record, EBITDA quality grade, and equity cushion using propensity-score matching. Cov-lite default rate matched to maintenance comps in our book: 7.1% vs 4.5%. That's the number the Committee actually wants — 2.6 pp marginal default rate from cov-lite controls.",
          third: "Document the methodology in the data-science memo. PSM is acceptable per Model Risk Standards Section 4.2, but include the falsification check: propensity-score balance diagnostics in the appendix. Without those, model-risk reviewer will reject the analysis at the Committee meeting."
        },
        followup: "What is the propensity-score balance diagnostic for the matched cov-lite vs maintenance sample, and are we within the 0.1 std-mean-difference threshold?"
      }
    }
  },
  engineer: {
    label: "💻 Software Engineer",
    tags: { junior: "Junior developer", senior: "Senior engineer", third: "Security review" },
    scenarios: {
      lbo: {
        question: "I'm refactoring the credit-decision pipeline to call this LBO model. What's the right service boundary, and where do I worry about regulated data?",
        voices: {
          junior: "Looks like the LBO model is at `risk-models-svc:8443/lbo/score`. Returns a JSON with PD, LGD, and EAD fields. Pure Bayesian regression under the hood, no external dependencies. Should be a clean integration.",
          senior: "Don't call it synchronously from the loan-decisioning critical path. PD calc is 200-800ms p99. Use the async pattern: enqueue scoring job, return decision_pending, callback via webhook. Look at how the credit-card limit-increase pipeline does it (`apps/clip/orchestrator.go:124`).",
          third: "The PD includes the borrower's industry sector — that's a covered attribute under our Fair Lending policy 4.5. Log the prediction and feature inputs to the Reg B explainability store before returning the decision. PII redaction: only the loan_id leaves the service boundary, never the applicant name or SSN."
        },
        followup: "What's the rate-limit posture on `risk-models-svc` at peak hours, and do we have circuit-breaker on the async pipeline?"
      },
      bloomberg: {
        question: "We're integrating Bloomberg B-PIPE feeds into our internal risk-monitoring pipeline. What's the data-residency posture, and where do I worry about license terms?",
        voices: {
          junior: "B-PIPE is a streaming protocol over Bloomberg's network. Authentication via Bloomberg-provided certificate. Output JSON or BLPAPI binary into our Kafka topic `market-data.raw`. Standard producer pattern.",
          senior: "Bloomberg license terms forbid passing real-time pricing data to *any* downstream consumer that doesn't have its own Bloomberg license. Make sure the Kafka topic ACL restricts consumer groups to licensed-seat services only. If an unlicensed internal service reads from it, Bloomberg can void the contract.",
          third: "Two compliance flags: (1) Bloomberg data cached >15 minutes is treated as 'static' under the license, which removes some restrictions but adds an audit obligation. Log the cache TTL in `bloomberg-data-handling.md` per Policy 8.1. (2) ANY logged Bloomberg field that gets stored to disk must redact the borrower identifier under our internal data-handling rules."
        },
        followup: "Which downstream services are subscribing to `market-data.raw` today, and which of them are on the licensed-seat allowlist?"
      },
      cds: {
        question: "I'm building a CDS-spread alerting service. The credit desk wants 'real-time' notifications. What's the right architecture, and where am I going to get rate-limited?",
        voices: {
          junior: "Markit CDS data has a 15-minute delay tier (the cheap one) and a real-time tier (5x the cost). For desk alerts, real-time tier is required. WebSocket subscription via Markit's streaming API.",
          senior: "Real-time CDS streaming costs ~$8k/month per seat. Negotiate up front: does the desk really need <30s latency, or is 60s acceptable? If 60s, use the 15-min tier + interpolation. Check with credit desk lead before signing the contract — engineering can save the firm $80k/year here.",
          third: "Markit's license forbids retransmission of streaming data. The WebSocket sink → Kafka pattern is technically retransmission. Use a pull-based broadcaster (`spread-monitor` polls Markit, fans out internally) instead of letting Kafka act as the broker. Engineering shortcut: 5-minute polls of the REST API, not the WebSocket."
        },
        followup: "What's the credit desk's tolerance for 60-second latency, and what's the cost differential between WebSocket streaming vs 5-minute REST polling?"
      },
      policy: {
        question: "The credit policy 4.3 is updated quarterly. Engineering's parser converts the policy PDF into a rule-engine config. How do I make this robust to format changes, and where does this need security review?",
        voices: {
          junior: "Current parser uses `pdfplumber` + regex. Brittle. Last quarter's update broke when Legal added bullet sub-bullets. Want to migrate to a structured pipeline: pandoc → markdown → YAML schema → rule-engine config.",
          senior: "Pandoc + Markdown is fine for static policy. But the rule-engine config is a security-critical surface — if a malformed policy update inserts a leverage cap of 999x, every B-rated loan goes through. Add a schema validation layer + a 'sanity check' that compares new config against the previous version and flags >20% delta in any threshold.",
          third: "Policy parsing is a covered process under our SR 11-7 model risk framework (policies act as decision rules). The pipeline needs (1) audit log of every config change, (2) git-tagged release of each rule-engine version, (3) PR-based review by Credit Compliance before deploy. No auto-deploy on policy update."
        },
        followup: "What's the 'sanity check' threshold delta we should flag, and who's the designated reviewer in Credit Compliance for these PRs?"
      }
    }
  },
  trader: {
    label: "📈 Trader / PM",
    tags: { junior: "Junior trader", senior: "Senior PM (Druckenmiller-style)", third: "Risk officer" },
    scenarios: {
      lbo: {
        question: "We're being offered the syndication of this Term Loan B at SOFR + 425. Is this priced appropriately and what's the risk-budget hit?",
        voices: {
          junior: "Comparable B-rated TLBs in the last 90 days clear at SOFR + 380-450. We're mid-range. Liquidity: average daily volume on issuer's existing bonds is $4M, so we shouldn't take more than $40M without market impact.",
          senior: "Think regime, not snapshot. If consumer-discretionary is rolling over and Fed cuts get pushed to 2027, this debt's mark-to-market is going to be ugly in 6 months. I would not be a buyer at SOFR + 425 unless we can syndicate down to <$20M hold. Ask: what's the secondary bid look like on similar paper from the last 30 days?",
          third: "Our credit-portfolio concentration limit is $250M total in B-rated consumer discretionary. Current exposure is $215M. A $40M hold takes us to $255M — over the cap. Either size down or sell something into syndication."
        },
        followup: "What is the secondary bid on similar B-rated consumer-discretionary TLB issued in the last 30 days, and what's our roll-off schedule?"
      },
      bloomberg: {
        question: "AAPL is consolidating at $225 with low SHORT_INT_RATIO 1.18 and low BORROW_RATE 22 bps. Is this a setup for a long entry, or am I being trapped by mean-reversion bias?",
        voices: {
          junior: "Technical: 50-day MA support holding. RSI 52, no extreme. Volume profile shows accumulation through the consolidation. Setup pattern is constructive long.",
          senior: "Think Druckenmiller — the easy money has been made. AAPL +12% YTD. The crowded long + low short interest means there's no fuel from short covering, only from real new buyers. For me, this isn't a trade, it's a hold-and-trim setup. Size into half the target, leave room for a pullback to add.",
          third: "Risk budget: AAPL is already 4.2% of book. Our single-name cap for mega-cap tech is 5%. A full-size add takes us over the cap. Either trim something else first or size to <0.8% on this entry."
        },
        followup: "What is our current single-name concentration in mega-cap tech, and what's the marginal-VaR contribution if we add 0.5% AAPL?"
      },
      cds: {
        question: "CDX widened 34 bps in a week. Should I rotate the book toward credit-protection long via CDS, or fade the move?",
        voices: {
          junior: "34 bps in a week is 80th percentile move over the last 24 months. Mean-reversion priors say fade. But the regime overlay shows a tariff scare started 4 weeks ago — narrative tailwind continues.",
          senior: "Druckenmiller question: what's the carry cost of being long protection here? If credit spread continues to widen, you make money. If it tightens back, you pay the negative carry. 5-year CDX carries roughly 90 bps annual cost. Need 6+ months of widening to break even on the carry. Are you that confident in the regime?",
          third: "If you're going long protection, position size: max 2% of book notional in CDS hedges per Policy 6.4. Hold period: declare the thesis time-horizon in the trade memo (4 weeks? 12 weeks?), and exit on either thesis violation OR thesis confirmation."
        },
        followup: "What's the 6-month forward CDX spread implied by the term structure, and is there carry-positive structure that better expresses the thesis?"
      },
      policy: {
        question: "The new policy 4.3 reduced our cov-lite tolerance. How does this change our positioning in the leveraged-loan secondary market?",
        voices: {
          junior: "Policy 4.3.2 update means we're less likely to underwrite cov-lite deals primary. Secondary is unaffected — we can still buy cov-lite TLBs from other dealers.",
          senior: "Wait — secondary IS affected, indirectly. If we're not underwriting cov-lite, our deal flow is going to skew toward maintenance-covenant deals. Other firms doing cov-lite get the sponsor's repeat business. We're going to see secondary bid tighten on the maintenance-covenant tranches we DO hold, and widen on the cov-lite tranches we'd want to buy opportunistically. The trade is: buy more cov-lite secondary at wider levels, since competing buyers will be less crowded.",
          third: "Be careful — secondary-market cov-lite positions are still cov-lite credits, and our internal risk-budget covenant treats cov-lite holdings under the same concentration cap as primary cov-lite. The secondary advantage isn't an end-run around policy 4.3.2; it's a pricing opportunity within the cap."
        },
        followup: "What's the current cov-lite secondary spread differential vs maintenance-covenant comparable issues, and what's our current secondary cov-lite holding versus the cap?"
      }
    }
  },
  advisor: {
    label: "💼 Wealth Advisor",
    tags: { junior: "Junior advisor", senior: "Senior advisor", third: "Reg BI / Fiduciary" },
    scenarios: {
      lbo: {
        question: "My HNW client is asking if we can put $2M of his portfolio into this LBO debt. He likes the SOFR + 425 yield. Is this a suitable recommendation?",
        voices: {
          junior: "TLB structure means floating rate, B-rated borrower, 7-year maturity. Yield is attractive but the credit risk is real — recovery in default is typically 60-80 cents on the dollar for senior secured TLBs.",
          senior: "$2M is 8% of his $25M portfolio. For an HNW client with 12% high-yield allocation already, adding more leveraged credit exposure pushes him past prudent diversification. Even if he wants it, the right answer is 'we can do $500K, not $2M, and here's why.'",
          third: "Reg BI suitability: this product is illiquid and the client's stated time horizon is <5 years per his most recent IPS. Recommending the full $2M without an explicit IPS update and a documented suitability override violates our fiduciary standard. Either get the IPS revised or size to $500K with a written rationale."
        },
        followup: "When did we last update this client's IPS, and what's his stated liquidity need over the next 24 months?"
      },
      bloomberg: {
        question: "Client owns 8% AAPL across multiple accounts. PE ratio 33.7 vs sector median 24. He's asking if we should trim. What's the answer?",
        voices: {
          junior: "33.7 P/E vs sector median 24 = 40% premium. Justified by AAPL's free-cash-flow margin advantage but not endlessly. Trimming 1-2% wouldn't hurt, and rebalancing toward equal-weight on his core holdings is straight diversification.",
          senior: "Don't lead with the P/E. Lead with his concentration risk: 8% in one stock is well above the firm's 5% single-name guideline for HNW portfolios. The conversation is 'this exposure is outside guideline, not because we don't like AAPL, but because concentration risk in any name above 5% triggers our review.' The valuation argument is secondary.",
          third: "Reg BI suitability + Reg S-P: the recommendation to trim must be documented with the specific basis (concentration above guideline, valuation premium, or tax-loss harvesting opportunity). If client refuses to trim, document the refusal + the alternative we offered. This is the documentation that matters in a future exam."
        },
        followup: "What is his cost basis on the AAPL position, and is there a tax-loss harvesting opportunity that makes the trim more attractive?"
      },
      cds: {
        question: "Client's portfolio has $5M in high-yield bonds. Credit spreads just widened 34 bps. Do I call him to discuss, and what do I say?",
        voices: {
          junior: "His HY bond exposure has likely declined 1-2% on this move. Calling proactively is good service. But don't recommend any action without his updated IPS — just describe the move and offer to schedule a review.",
          senior: "Yes call him, but think about why. If he's a long-term holder, the right conversation is 'spreads widened, your bonds are down, this is exactly what we anticipated in your IPS risk profile, no action needed.' If he's been anxious about credit recently, the conversation is 'are we still aligned on your risk tolerance for HY?' The call's purpose is to reaffirm the IPS, not to suggest a trade.",
          third: "Reg BI conflict of interest: do NOT lead the call with a trade suggestion that generates a commission. If we sell his HY position and rotate to investment-grade, that's a transaction Reg BI requires us to disclose the conflict. Calls to discuss market movements without a transaction are fiduciary-best-practice; calls to recommend a transaction have a higher documentation bar."
        },
        followup: "When was his last formal IPS review, and what is his stated risk tolerance for HY exposure during widening regimes?"
      },
      policy: {
        question: "The firm's updated underwriting policy 4.3 changes how we structure structured-product offerings. A client is asking about a cov-lite-backed structured note we offered him last quarter. What do I tell him?",
        voices: {
          junior: "Last quarter's note was structured under the prior policy. The terms are fixed for the life of the note (5 years). Nothing about the existing position changes.",
          senior: "Right, but he's not just asking about the existing note — he's asking what we'd offer going forward. The new policy means we won't structure another similar note for him. Be honest about that: 'this is the kind of product we offered when our underwriting policy was X; we recently updated our policy and we won't be offering similar products in the near future. If you want exposure to leveraged loans, here are the alternative paths.'",
          third: "Reg BI requirement: when the firm's policy changes affect what we can offer a client, that's a material change requiring proactive disclosure. Send the client written notice within 30 days that our product set has changed in their relevant exposure category. Don't wait for them to ask."
        },
        followup: "When did this client last receive a policy-change disclosure, and is the new cov-lite policy a Reg BI material-disclosure event?"
      }
    }
  }
};

window.MODES = {
  cloud: {
    latency: "cloud · last query 1.2s",
    description: "Cloud mode: screen capture → Anthropic / OpenAI API → response. Use for non-confidential training data, public market signals, educational explanations."
  },
  local: {
    latency: "local · last query 0.8s · Gemma 3 9B on M3 Max",
    description: "Local mode: screen capture → on-device Gemma 3 9B / Phi-4-mini / Apple Foundation Model 3 Core Advanced → response. No data leaves the laptop. Use for client PII, M&A documents, internal models, anything covered by Stifel Policy 7.3 or EU AI Act."
  }
};

window.WIFI_TOAST_CLOUD = "WiFi off → cloud mode broken (this is the expected failure that proves local mode is the moat).";
window.WIFI_TOAST_LOCAL = "WiFi off → local mode keeps working. Every analyst, every screen, every first 90 days, without your data ever leaving the building.";
