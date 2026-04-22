# How to set up the four Cursor agents

**Last updated:** 2026-04-15  

Use **four separate agents** (or **four saved prompts** in **four separate chat threads**). **Do not merge their jobs.**

Loop: **Scout → Architect → Builder → Auditor.**

## Exact prompts

Canonical copy-paste text lives in the repo root:

| Agent | File |
|-------|------|
| Scout | `prompts/scout.md` |
| Architect | `prompts/architect.md` |
| Builder | `prompts/builder.md` |
| Auditor | `prompts/auditor.md` |

Each file leads with the **exact** system/first-message prompt; a short **Repo convention** footer describes where to save `TOOL BRIEF`, `BUILD SPEC`, and `AUDIT REPORT` artifacts.

## Artifact directories

| Output | Directory |
|--------|-----------|
| TOOL BRIEF | `docs/briefs/` |
| BUILD SPEC | `docs/specs/` |
| BUILD NOTES (optional) | `docs/specs/` |
| AUDIT REPORT | `docs/audits/` |

Platform-direction notes belong in `docs/decisions/`.

## Never

- Never let Builder **redesign the ticket mid-flight**.
- Never let Auditor **silently rewrite the feature**.
