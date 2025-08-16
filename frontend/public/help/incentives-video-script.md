
# GeniusGrid Incentives — 10‑Minute Walkthrough (Presenter Script)

**Audience:** Sales Ops / Finance / Admins  
**Goal:** Configure a plan, add a rule with tiers, simulate a payout, approve an adjustment, and export a report.

---

## 0:00 — Intro (what & where)
- “We’re in GeniusGrid > CRM > Incentives. The tabs across the top are our workflow.”
- Call out the toolbar: Search, Filters, Export, New.

## 0:45 — Plans (create FY example)
- Click **Plans → New**.
- Fill: Name “FY25 Growth”, Code “FY25-G”, From “2025-04-01”, To “2026-03-31”, Base “Revenue”.
- Save. Mention drafts vs active.

## 2:00 — Rules (earnings logic)
- Go to **Rules → New**.
- Rule Name “Qtr Target Bonus”.
- Plan = FY25 Growth. Metric = Revenue.
- Condition “>= 50L”. Reward “+2%”.
- Save as **Active** (or leave Draft for review).

## 3:15 — Tiers (slabs)
- Open **Tiers → New**, attach to the rule above.
- Add three slabs: 0–50L = 1%; 50L–1Cr = 2%; 1Cr+ = 3%.
- Save. Explain slabs step-up rewards.

## 4:30 — Programs (optional)
- Create a Program “West Region” to scope runs & reports.
- Tip: programs help with large orgs / different targets.

## 5:00 — Payouts (simulate → lock)
- **Payouts → New.** Choose Plan “FY25 Growth”, Period “Q1”, Scope “West Region”.
- Click **Simulate**. Show results and any exceptions.
- Fix data issues in CRM (if any), **Re-simulate**.
- **Lock & Publish** once validated.

## 7:00 — Adjustments (one-off credit/debit)
- **Adjustments → New**. Date today, Employee “Rohan S”, Plan “FY25 Growth”,
  Type “Credit”, Amount 25,000, Reason “Quarter-end true-up”.
- Status starts as **Pending**.

## 7:45 — Approvals (governance)
- Open **Approvals**. Approve the adjustment.
- Mention comments and audit trail.

## 8:30 — Reports (export)
- Go to **Reports**. Filter by Plan = FY25 Growth, Q1.
- Export CSV/XLS for payroll.

## 9:15 — Audit & wrap
- Show **Audit** log: the events we just performed.
- Recap: Plan → Rule → Tier → Payout → Adjustment → Approval → Report → Audit.
- Q&A.

---

## Recording Tips
- Use 1920×1080, dark theme.
- Zoom cursors, keep clicks deliberate.
- Keep the toolbar and tabs visible; avoid scrolling during key steps.
- Add captions for numbers (e.g., “>= 50L → +2%”).
