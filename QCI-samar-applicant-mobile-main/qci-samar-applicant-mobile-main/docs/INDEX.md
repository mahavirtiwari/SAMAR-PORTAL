# SAMAR Applicant — Documentation Index

Mobile client docs for the QCI SAMAR applicant app. The backend
(`../../qci-samar-backend/docs/`) is the source of truth for API contracts, roles, and
shared infra facts; this tree carries only what is specific to this app.

## Structure

```
docs/
└── 40-release/     # Shipping this app — store submission, review access
```

## 40 — Release

- [Store release](40-release/store-release.md) — Play Store / App Store submission, review
  accounts, review-notes text, pre-submission checklist
- [Native dependency refresh](40-release/native-dependency-refresh.md) — what to run after a
  React Native or native-pod bump, and the launch-time dyld crash that follows if you skip it

## Elsewhere

- Infra map: `.webority/infra.json`
- Conventions and app identity: `CLAUDE.md`
- [D-007 — the mobile store releases run against the staging backend](../../qci-samar-backend/docs/10-architecture/D-007-mobile-store-release-runs-on-staging.md)
