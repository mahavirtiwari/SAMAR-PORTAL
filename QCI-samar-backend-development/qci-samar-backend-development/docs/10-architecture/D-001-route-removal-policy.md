---
id: D-001
title: Verify frontend callers before removing API routes
status: Accepted
date: 2026-05-15
---

# D-001: Verify frontend callers before removing API routes

## Context

Between Feb and May 2026 we shipped at least four "dead code" cleanups that removed routes from
`routes/api.php`. Three had to be silently reverted: `7852fd6` (site picture download), `d04c022`
(meeting image + attendance selfie), `b0946cb` (`/applications/{id}/files/{field}`). A fourth,
`89ebf70` (2026-05-15), restored 6 more endpoints removed by the same `20a88c9` cleanup
("refactor: remove dead code and fix cross-system inconsistencies").

Root cause: each cleanup grepped only the backend repo. The frontend (`qci-samar-web`) and the
assessor mobile app (`qci-samar-assessor-mobile`) live in separate repos. A route can appear unused
in the backend while being actively called from outside it.

Cost: each silent re-add is a production-likely 404 (image/PDF previews, exports, list views)
caught by users, not by tests.

## Decision

**Before removing any route from `routes/api.php` or its handler method, the change author must
verify the route is not called by either frontend repo.** Backend-only grep is not sufficient.

Verification steps:
1. `rg <path-fragment> /Users/webority-admin/Code/qci-samar-web/src/services/api/`
2. `rg <path-fragment>` in `qci-samar-assessor-mobile`

An inline comment (`// Used by web: <file>`) on a route signals a confirmed caller and should be
treated as a stronger signal than its presence or absence in a grep. A short policy block at the
top of `routes/api.php` (added in `89ebf70`) restates the rule for future readers.

## Consequences

**Slower removals.** Acceptable — the cost of one false-positive removal (production 404 + frontend
ticket + re-deploy) outweighs the friction of one extra grep across two repos.

**Comment drift risk.** `// Used by web:` comments name files that can be renamed or moved. Treat
them as starting points, not guarantees — re-verify before deleting.

**Gap: frontend repo not on the cleanup author's machine.** This is a real gap; mitigation is to
require PR review by someone who has both repos checked out, or to formalize a cross-repo CI check
(out of scope for this ADR — flag as follow-up).

---

Related commits: 20a88c9 (cleanup), 7852fd6, d04c022, b0946cb, 89ebf70 (restorations).
