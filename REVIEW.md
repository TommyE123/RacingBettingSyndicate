# Code Review Guidance

This document defines repository-specific review guidance for `RacingBettingSyndicate`.

Review the actual changes in the PR and focus on issues that could affect correctness, reliability, security, maintainability, observability, or production behaviour.

Do not manufacture findings. If no actionable issue exists, state that clearly.

**Audience:** this document is addressed to the reviewing agent producing a local PR review, and applies in full whenever Claude is asked to review a PR itself. Other reviewers' (human or bot) findings may use a different format; assess them against the Evidence Threshold and Scope and Noise sections rather than assuming it follows the status and verdict format below. When Claude is instead _assessing and fixing_ another reviewer's findings, the review status, per-finding tag, and verdict formats do not apply to it, and neither does "Review only — do not push commits to the PR."

---

## Review Status

Every review must begin with one of the following statuses.

### 🟢 GREEN — READY

No actionable issues found.

The PR is safe to proceed from a code review perspective.

### 🟠 AMBER — CHANGES RECOMMENDED

No blocking issue was found, but worthwhile actionable improvements remain.

### 🔴 RED — CHANGES REQUIRED

A genuine correctness, security, reliability, or regression issue must be resolved before the PR is ready.

The status is a summary of the review outcome, not a score. Do not invent findings simply to avoid a GREEN review.

---

## Per-Finding Reporting Format

Every individual finding also gets its own tag, separate from the overall review status above:

- 🔴 **RED** — must be fixed before merge (blocking)
- 🟠 **AMBER** — worth fixing, not necessarily blocking
- 🟢 **GREEN** — something the PR gets right, or a minor/non-blocking observation worth noting

Only 🔴 RED and 🟠 AMBER findings are actionable. A 🟢 GREEN finding does not affect the overall review status — a review can carry GREEN call-outs and still conclude an overall GREEN — READY status, since GREEN findings are not actionable.

Report at most 5 🟠 AMBER findings per review; prefer fewer, high-confidence findings over an exhaustive list.

For each 🔴/🟠 finding, give:

- exact `file:line`
- what is wrong
- why it matters
- the smallest correct fix
- whether this PR introduced it or it is pre-existing
- whether a regression test is required

Inspect the surrounding repository, not just the changed lines. Do not treat the PR description or a passing test suite as proof of correctness.

End every review with exactly one verdict:

- ✅ **APPROVE** — safe to merge
- ⚠️ **APPROVE WITH MINOR CHANGES** — no blocking (RED) issue
- ❌ **CHANGES REQUIRED** — at least one RED (blocking) issue found

Review only — do not push commits to the PR.

---

## Evidence Threshold

Only raise a finding when the issue can be reasonably demonstrated from the changed code and represents a realistic failure scenario, and is introduced or materially worsened by the PR. Avoid speculation — point to the specific code path that produces the problem. A GREEN review is preferred over a weak, speculative, or low-confidence finding.

---

## Betting, Money and Results Behaviour

`RacingBettingSyndicate` manages tournament betting, leagues and automated results. Mistakes here can misstate money, standings or outcomes.

Pay particular attention to:

- Stake, odds, payout, points and scoring calculations, including rounding and currency/decimal handling.
- Results ingestion and automation: duplicate, late, corrected, abandoned or non-runner results.
- League and tournament standings that could be recomputed incorrectly or become inconsistent.
- Idempotency and race conditions when bets, results or standings are updated concurrently.
- Authentication, authorisation and per-user or per-league data isolation.
- Audit trails: whether changes to bets, results and standings can be explained afterwards.
- Behaviour when an external results/data source is unavailable or returns unexpected data.

Findings in this area may have significant user impact, so ensure they are supported by a clearly explained failure path.

---

## Container and Deployment Behaviour

The backend and frontend ship as Docker images run by Compose. Pay particular attention to health checks (`/health`), running as a non-root user, image pinning, port and volume changes, and anything that persists data under `/data`.

---

## Logging, Notifications and Observability

Pay attention to changes affecting:

- Health reporting.
- Failure events.
- Notifications.
- Logging.
- Status reporting.

Flag cases where observable behaviour no longer reflects actual application state.

---

## CI, Release and Deployment

Review workflow and deployment changes for:

- Incorrect CI/CD behaviour.
- Excessive permissions.
- Missing permissions.
- Secret exposure.
- Unsafe dependency or action changes.
- Container image or deployment changes, where present.
- Release automation regressions.
- Configuration that could trigger unintended deployments.
- Changes that require operational action but do not make that requirement clear.

---

## Tests

Tests should provide meaningful confidence for the behaviour being changed.

Look for:

- Missing regression coverage for an important bug fix.
- Tests that pass without verifying the claimed behaviour.
- Tests that only verify implementation details where observable behaviour matters.
- Missing coverage for important error paths introduced by the change.

Do not request new tests for purely mechanical or low-risk changes where additional coverage provides little value.

---

## Documentation

Flag documentation only when the PR introduces behaviour that makes existing documentation inaccurate or misleading.

Pay particular attention to:

- Configuration.
- Defaults.
- Betting, scoring and results rules.
- Deployment requirements.
- Operational procedures.

Do not request documentation updates purely because documentation could be expanded.

---

## Scope and Noise

Review the changes made by the PR, not the repository as a whole.

Do not:

- Report unrelated cleanup opportunities.
- Report issues already fully covered by automated tooling.
- Report hypothetical problems without a credible failure scenario.
- Duplicate findings.

Prefer a small number of high-confidence findings over a large number of speculative ones.

---

## When No Issues Are Found

A GREEN review is a valid outcome.

If no actionable issue exists, state that clearly rather than inventing minor concerns.
