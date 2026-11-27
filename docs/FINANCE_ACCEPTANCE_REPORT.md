# Finance Module — Acceptance Report (Engineering QA)

This is engineering/QA documentation only. It is **not** part of the production
Finance UI or navigation, and must not be linked from any app route.

**Report:** https://claude.ai/code/artifact/a487a9ff-e44f-4a97-affc-333fdd6674ea

Covers, as run against the live backend on 2026-09-05:

- Gaps found and fixed (Commitments API routes, Variance Explanations
  end-to-end, Needs Attention/Exceptions engine, Settings/Periods routes,
  the over-budget enforcement bug, the commitments-not-wired-into-summary bug,
  and the missing Finance schema deployment).
- The full acceptance test matrix (A–W), run live as `mkizza` (Finance
  Officer) and `dnatukwasa` (Finance Reviewer) via server-issued JWTs — not
  mocked.
- The section-13 reconciliation output (8/8 checks OK).
- The known structural limit: the full 3-stage budget lifecycle (Preparer ≠
  Validator ≠ Approver) requires a third `finance_budget_approver` identity in
  production — correctly enforced segregation of duties, not a bug.

**Demo/test tooling** (never runs automatically, all in `scripts/`):
`resolve-finance-demo-users.js`, `assign-finance-demo-roles.js`,
`finance-demo-seed.js --seed|--cleanup`, `deploy-finance-schema.js --apply`.

If the demo project (`FIN-DEMO-*`) is still present, remove it with:

```
node scripts/finance-demo-seed.js --cleanup <demoSeedId>
```

See `pms_finance_demo_manifests` for the current `demoSeedId` if it isn't
already known.
