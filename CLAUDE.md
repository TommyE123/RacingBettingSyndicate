# RacingBettingSyndicate Repository Guide

## Project

RacingBettingSyndicate is a racing tournament betting, league management and results automation platform. It has a frontend and a backend, but neither is committed yet, so the stack, layout and commands are **not yet established**. Do not assume a language, framework or directory structure; read the repository as it stands. Betting, money, league standings and results automation need particular care: correctness and auditability matter more than speed.

## Commands

No build, test or lint commands exist yet. When the application is added, record the real commands here (install, unit tests, frontend build/lint/test, backend tests) in the same change that introduces them. Until then, don't invent or cite commands.

- Validation scope: follow `.claude/rules/testing.md`. CI is authoritative for repository-wide checks.
- MegaLinter findings: follow `.claude/rules/megalinter.md`. It covers this repository's lint job, not application architecture.
- Locally checkable today: YAML, Markdown and shell scripts (for example `yamllint`, `markdownlint`, `shellcheck`, `actionlint`, when installed).

## Working rules

- Read the actual implementation, tests, and relevant configuration before deciding on a change.
- For external APIs, workflow syntax, and schemas, verify current documentation or established examples rather than guessing.
- If the request is ambiguous in a way that would materially change the implementation, ask before changing anything. Relay any open questions from `analyze`. Don't ask about details existing patterns already settle.
- For complex changes, summarise the approach and wait for a go-ahead before implementing. Complex means anything touching bets, stakes, payouts, scoring or results ingestion, several components, or ambiguity left after `analyze`. Do the same whenever the user asks for a plan. Otherwise, implement directly.
- Work within the requested scope and follow existing patterns.
- Prefer existing mechanisms over new infrastructure. Use the `simplification-review` skill before adding tooling, automation, dependencies, or infrastructure.
- Add regression tests for behaviour fixes where practical.
- Update documentation when a change makes it inaccurate.
- Don't fix unrelated failures, and never weaken validation to make CI green.
- Never commit secrets, credentials, API keys or real user/betting data.
- Review the final diff before reporting.
- Never report work, investigation, reproduction, validation, or review that was not actually performed.
- If repository instructions conflict, follow the more restrictive one, continue the task, and report the conflict.

## Issues and labels

- Search existing issues before proposing a new one, and ask before creating a missing one.
- Don't add, remove, or request GitHub issue labels unless asked. PR labels are separate.

## Branches, commits and PRs

- Name task branches `<type>/<issue-number>-<short-slug>`, e.g. `fix/12-results-import`. If there's no issue, use `<type>/<short-slug>`, e.g. `docs/update-readme`.
  - Types: `feat`, `fix`, `chore`, `refactor`, `test`, `ci`, `docs`, `perf`, `build`, `style`. Pick the one that matches the work; don't default to `feat`/`chore`.
  - Issue number: digits only, no `#`. If an issue exists but you can't find its number, **stop and ask**; never invent one.
  - Slug: **2–5 meaningful words**, lowercase kebab-case, ideally ≤40 characters.
  - Never use random or generated names, UUIDs, timestamps, usernames, or similar non-descriptive names.
  - Sessions started by tooling may be assigned a branch (for example `claude/...`) that doesn't follow this scheme. Use the assigned branch and don't rename it unless asked.
  - **Validate the branch name before committing or opening a PR.** If it doesn't comply, rename it before continuing, unless it was assigned as above.
- Commit and push on a feature branch. Open a PR only when the user asks. Respect local-only, no-commit, no-push, and no-PR requests.
- Never push to a protected branch, force-push, or bypass hooks. Don't overwrite unrelated local changes.
- When branch currency matters, merge `origin/main` as directed by `.claude/rules/branch-currency.md`. Don't update merely because `main` moved.
- PR titles use Conventional Commits (`<type>: <description>`). The title check enforces this.
- PRs that change application behaviour or add real scope should link an issue (`Closes #N`). Mechanical docs, config, or CI-only tweaks and dependency-bot PRs are exempt.
- Never merge a PR. The repository owner is the final gatekeeper.

## Review gate

- A PR is substantive if it changes, or could affect, any of these: application code, tests, CI/CD, build or release logic, workflows or automation, or security/dependency config. Docs, comments, formatting, or metadata only is not substantive. If in doubt, treat it as substantive.
- Before reporting a substantive PR ready for the owner's merge decision, validate locally per `.claude/rules/testing.md`, confirm CI on the current head with `pr-monitor`, and, when a local review is wanted, use `surgical-reviewer`.
- `REVIEW.md` defines the evidence standard for local reviews.

## Governance

- Treat changes to `CLAUDE.md`, `.claude/`, and other agent-governance files as their own scope, not incidental application cleanup.
- Don't weaken governance to make a task easier.
- Keep `.claude/settings.json` consistent with this file.

<!-- settings.json guardrails are pattern-based and partial; branch protection on main is the authoritative control. -->

## Session titles

Claude can't set a session title itself, so propose one in this format:

- `I: #N - <issue title>`
- `I: #N PR: #N - <issue title>`, once a PR exists
- `PR: #N - <PR title>`, when there is no linked issue

## Agents and skills

The agents (`analyze`, `implement`, `pr-monitor`, `surgical-reviewer`, `test-validator`) and the `simplification-review` skill are optional tools chosen per task, not a mandatory sequence.
