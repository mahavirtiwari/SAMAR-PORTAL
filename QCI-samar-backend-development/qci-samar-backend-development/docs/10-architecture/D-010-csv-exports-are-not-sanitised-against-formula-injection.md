---
id: D-010
title: CSV exports are deliberately not sanitised against spreadsheet formula injection
status: ACCEPTED
date: 2026-09-03
---

# D-010: CSV exports are deliberately not sanitised against spreadsheet formula injection

## Context

Every CSV export in this API writes user-supplied text straight through `fputcsv`
with no escaping of the characters spreadsheets treat as the start of a formula.
As of 03-Sep-2026 that is seven endpoints:

- `ApplicationController::export`
- `AssessmentController::export`
- `ApplicationFeedbackController::export` and `::exportForApplication`
- `OrganizationController::export`
- `DisciplineController::export`
- `AssessmentParameterController::export`
- `PaymentController::export`

A cell whose value begins `=`, `+`, `-` or `@` is evaluated as a formula when the
file is opened in Excel or Google Sheets. Several exported columns carry text an
applicant typed: enterprise name, unit name, unit address, contact person name.
So an applicant can, in principle, place a formula into a file an internal user
later opens.

This was raised by the security review of the payment export
(TASK-05937, 03-Sep-2026), which correctly noted it is pre-existing and
consistent rather than something that export introduced, and therefore a
fleet-level question rather than a per-export patch.

## Decision

**We accept the risk and do not sanitise.** Navneet decided this on 03-Sep-2026,
having been shown the alternative (one shared sanitising writer, roughly an hour,
routing all seven exports through it).

The reasoning: these files are downloaded by internal QCI staff from an
authenticated portal and opened on their own machines. They are not distributed
to the public and are not machine-consumed by anything downstream of us.

## What would reopen this

Any of the following makes the decision wrong rather than merely conservative,
and should send it back for a second look:

- An export becomes reachable by, or is routinely forwarded to, someone outside
  QCI staff.
- An export is consumed by an automated pipeline rather than a person.
- A new export carries a free-text field an applicant controls that is wider or
  less constrained than today's names and addresses.

## Note for future work

Do not "fix" this in one export on the way past. Partial sanitisation is worse
than none, because it makes the exports inconsistent and creates a false
impression that the class is handled. If this is ever revisited, it is one shared
writer applied to all of them at once.
