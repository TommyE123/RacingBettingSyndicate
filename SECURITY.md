# Security policy

## Supported versions

Security fixes are made for the latest release only. If you are running an older version,
update to the latest release first and check whether the problem still applies.

## Reporting a vulnerability

Please do not open a public issue or pull request for a security problem.

Report it privately with GitHub's private vulnerability reporting:

1. Open the [Security tab](https://github.com/TommyE123/RacingBettingSyndicate/security) of
   the repository.
2. Choose **Report a vulnerability**, or go straight to
   [the report form](https://github.com/TommyE123/RacingBettingSyndicate/security/advisories/new).

Please include as much of this as you can:

* the RacingBettingSyndicate version, and whether you run the published images or builds of
  your own
* how it is deployed, for example which ports are reachable and whether it is served over HTTPS
* steps to reproduce the problem
* what an attacker could do with it, for example read or change another member's bets,
  returns or standings, or act as an admin

## What to expect

RacingBettingSyndicate is maintained by one person, so these are targets and not guarantees:

* an acknowledgement within 7 days
* an update on whether the report is accepted, and a plan for a fix, within 30 days
* a fix published as a new release, with credit in the advisory if you want it

Reports are handled in private until a fixed release is available.

## Scope

In scope:

* the backend API, including sign-in, sessions, and the checks on what members and admins can
  see and change
* the web UI and its `/api` proxy route
* the published backend and frontend images and the way they are built

Out of scope:

* vulnerabilities in the development tooling, such as the linters and scanners. The Dev Container
  tools float to the latest release, and the tools bundled with MegaLinter are fixed by the
  pinned MegaLinter release. None of it ships in the images.
* advisories in third-party dependencies that have no effect on RacingBettingSyndicate.
  Dependencies are updated by Renovate, and MegaLinter runs Trivy in CI (report-only for now,
  see issue #5). Please report a dependency problem only if you can show it is exploitable
  through RacingBettingSyndicate.
