# Project Brushstroke — Patterns

*Working patterns and hard-won lessons. Sister document to `SPEC.md` —
where SPEC says **what** the system is, this says **how we work on it**.*

---

## Repo hygiene (learned the hard way)

### No git worktrees for this project

Claude Code can spawn subagents with `isolation: "worktree"`, which creates a
temp worktree at `.claude/worktrees/<random-name>/` on a `claude/<random-name>`
branch. Over time these accumulated as stale checkouts of *old* commits — and
because a session shelled into one is looking at an old snapshot, it draws wrong
conclusions about what exists, and uncommitted work gets stranded where the main
repo can't see it. This caused real confusion and nearly lost work.

**Rule, now enforced three ways:** no worktrees, no `claude/*` branches; work
directly in the main repo on the named branch.
- `CLAUDE.md` (repo root) — instruction, top of file, loaded every session.
- `MEMORY.md` (project memory) — same rule near the top.
- `.claude/settings.json` PreToolUse hook + `.claude/hooks/block-git-worktree-add.sh`
  — hard-blocks `git worktree add` at the tool layer. Tested: blocks `add`,
  allows `list`/`remove`/`prune`.

Session-start habit as backstop: confirm `pwd` is the main repo (not a worktree
path) and `git branch --show-current` is the intended branch before any work.

### Separate projects get separate repos

Distinct projects do **not** live as branches/dirs inside another project's
repo. When work that wasn't really Brushstroke ended up tangled in the
GenArt2025 tree, the fix was extraction into standalone repos:
- `butterchurn-3d` → `~/Documents/butterchurn-3d/` (own repo)
- `curl-noise` → `~/Documents/curl-noise/` (own repo)
- Google AI Studio "Brushstroke" (GAIS) → moved entirely out of the repo;
  shares the name, different lineage, never merge without a deliberate decision.

### Git is the backup — no hand-maintained copy folders

A hand-maintained `Brushstroke-Master/` "backup" folder drifted from the tracked
files (its SPEC.md lost the §1.5 four-tier section while the committed copy kept
it). The committed file in git is always the canonical backup; a parallel folder
just creates a second copy that can rot. Don't keep manual backup folders —
recover any prior state from a commit (`git show <hash>:path`) or a tag.

### Verify before destroy

Throughout cleanup, the discipline that prevented loss: read/inventory before
removing, and *run* an extracted project (`npm install && npm run dev`) before
deleting its source. "Files appear present" and "it actually runs" are different
facts — confirm the second before anything destructive.
