Dev Log Convention

When to use: any repo that gets worked on across multiple AI sessions or tools (Claude app, Claude Code, different machines) where session memory doesn't carry over. Best added on day one, but works retroactively.

What it sets up: a docs/dev-log.md file (newest entry on top, one entry per meaningful piece of work: what changed, why, what a future session needs to know) plus a standing instruction in CLAUDE.md so every future Claude Code session appends entries automatically. Captures the reasoning that git commit messages are too terse for — library pins and why, deliberate stubs, patterns future code must copy, things that look wrong but are intentional.

Origin: built for integration-api (Carson Integration Platform), where it recorded decisions like the FluentAssertions 7.x licensing pin and deliberate crypto stubs that no diff or commit log would explain.

The prompt:

Add a dev-log convention to this project. It has two parts, and both are required.
Part 1 — create docs/dev-log.md (create the docs/ folder if needed) with this
exact structure:

# Dev Log

One entry per meaningful change: what changed, why, when. Not a chat
transcript, not a commit-by-commit list, the reasoning that would otherwise
only exist in whichever session it happened in.
Append a new entry after finishing any meaningful piece of work, before the
session ends. See the instruction in `CLAUDE.md`. Newest entry at the top.
Format:

## YYYY-MM-DD — Short title

What changed, in plain sentences. Why, if it's not obvious from the what.
Anything a future session (in any tool) would need to know before touching
this area again.

---

Then add one seed entry, dated today, titled "Dev log established", briefly
describing the current state of the project so the log doesn't start empty.
Part 2 — add a "## Dev log" section to CLAUDE.md (create CLAUDE.md if it
doesn't exist; if it exists, add the section without changing anything else).
The section must say, in substance:
This repo is worked on from multiple sessions and tools that don't share
memory — only the repo itself carries over between them. Git history gives
the "what" and "when" for free; commit messages are usually too terse for
the "why."
After finishing any meaningful piece of work, before the session ends,
append an entry to docs/dev-log.md. What changed, why, and anything a
future session would need to know before touching that area again. Newest
entry at the top. Not a chat transcript, not a line-by-line change list —
the reasoning that would otherwise only exist in this session.
From now on, in this and every future session, follow that instruction
yourself: when you finish a meaningful piece of work, write the entry before
the session ends. Good entries record decisions and their reasons (library
pins and why, patterns future code must copy, deliberate stubs or known gaps
and why they're deliberate, things that look wrong but are intentional).
Skip entries for trivial changes — the log's value is density, not coverage.
Notes: the leverage is entirely in Part 2 living in CLAUDE.md — an instruction in a doc nobody auto-reads is a dead instruction. And keep "newest entry at the top" strict; the freshest context is what the next session needs first.
