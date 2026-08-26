# Brew Buddy

Personal homebrewing app. The authoritative spec is `docs/brew-buddy-brief.md` —
read it before making design or architecture decisions. Stack: Next.js + TypeScript,
SQLite via ORM, Docker on AWS (see brief §2). The `theme/` folder (Luna v1.4) is a
visual design reference only — never port or evaluate its code.

## Dev log

This repo is worked on from multiple sessions and tools that don't share memory —
only the repo itself carries over between them. Git history gives the "what" and
"when" for free; commit messages are usually too terse for the "why."

After finishing any meaningful piece of work, before the session ends, append an
entry to `docs/dev-log.md`. What changed, why, and anything a future session would
need to know before touching that area again. Newest entry at the top. Not a chat
transcript, not a line-by-line change list — the reasoning that would otherwise
only exist in this session.

From now on, in this and every future session, follow that instruction yourself:
when you finish a meaningful piece of work, write the entry before the session
ends. Good entries record decisions and their reasons (library pins and why,
patterns future code must copy, deliberate stubs or known gaps and why they're
deliberate, things that look wrong but are intentional). Skip entries for trivial
changes — the log's value is density, not coverage.
