---
id: D-008
title: The applicant app deliberately does not pin TLS certificates
status: SUPERSEDED (20-Aug-2026, same day it was accepted) — see the Reversal section
date: 2026-08-20
---

# D-008: The applicant app deliberately does not pin TLS certificates

> **⚠️ SUPERSEDED.** Both SAMAR apps now carry the full security-grade tier,
> pinning included. This document is kept because the reasoning below was
> examined and rejected on the merits, and that is worth more than a deleted
> file — anyone who proposes the same asymmetry again should read why it did not
> survive. **Do not implement this decision.**

## Context

Two mobile clients in this constellation talk to the same API host, with opposite
TLS postures:

- **`qci-samar-assessor-mobile` pins.** ISRG root certificates for
  `samar-api.webority.dev` and `qcisamartest.qci.org.in`, enforced natively in
  `android/app/src/main/res/xml/network_security_config.xml` and via TrustKit
  (`kTSKEnforcePinning: true`) in `ios/assessor/AppDelegate.swift`.
- **`qci-samar-applicant-mobile` pinned nothing.** No pin configuration in any env
  file, no pinning library wired anywhere in the source.

`BUG-06301` flagged the asymmetry in July 2026 and asked the right question: was
the gap a deliberate scope decision or an oversight? Nothing recorded an answer.

## Decision (as originally accepted, now reversed)

The applicant app does not pin TLS certificates, on two arguments:

1. **The threat models differ.** The assessor app carries the audit evidence that
   decides a certification outcome, captured in the field on untrusted networks.
   The applicant app is a read-mostly window onto an enterprise's own data.
2. **Pinning has an asymmetric failure mode.** A pinned build cannot be fixed
   server-side; any move off the pinned roots bricks every install until a store
   release ships *and users install it*.

## Reversal — why this did not survive the day

Navneet reversed it within hours of acceptance, and the reasoning is better than
the original:

- **Argument 1 does not hold.** The applicant app captures **site pictures and
  site-tour photographs of the applicant's premises, geo-tagged, as evidence in a
  DRDO defence/aerospace vendor certification**. That is the same class of
  evidence the assessor app carries, on the same scheme, feeding the same
  certification decision. Calling it "an enterprise's own data" understated what
  it is.
- **Argument 2 is a cost, not a disqualifier.** It applies equally to the assessor
  app, which pays it deliberately. A cost accepted for one client and refused for
  its sibling needs a difference between them to justify it — and per the point
  above, there isn't one.
- **The convention is explicit that the tier is not a menu.** `react-native.md`
  → *"Apply ALL of these together — they're layers, not options."* A
  security-grade app with pinning removed is not a lighter posture, it is a
  posture with a hole in a named place.

**One posture across both clients.** The applicant app now carries the full tier:
`SecurityGuard.kt` (Kotlin baseline + RootBeer fail-closed), Talsec, WebView
debugging off, the iOS jailbreak/Frida/anti-debug layer, and TrustKit pinning
against the same two ISRG roots the assessor uses.

## What replaces this

Nothing separate — the applicant app simply follows the security-grade tier in
`react-native.md` like its sibling, and the two apps are read together rather
than compared. `BUG-06301`'s third "Done when" item is satisfied by *applying*
the tier rather than by recording an exemption from it.

## The lesson worth keeping

The original decision was written to close an open question quickly, and it
reached for the difference between the two apps rather than testing whether that
difference was real. **A recorded rationale is not the same as a sound one** —
writing the reasoning down is what made it checkable, and it failed the first
check it got. That is the process working, not failing; but the failure mode to
watch is dressing up an existing gap as a decision because deciding is cheaper
than fixing.
