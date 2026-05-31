# /orient — comprehensive session re-orientation

You're being asked to re-orient yourself in this repo. The user wants a clear,
current picture of where things stand before any new work. Do each step in
order, then produce the structured summary at the end.

## Steps

### 1. Filesystem position

Run:
```bash
pwd
git worktree list
```
- `pwd` must be `/Users/markgould/Documents/GenArt2025` (the main repo).
- `git worktree list` should show only the main repo. If there are stale
  worktrees, surface that as an issue — the project's rule is no worktrees
  (see CLAUDE.md and PATTERNS.md "Repo hygiene"). Don't auto-delete.

### 2. Branch + recent history

Run:
```bash
git branch --show-current
git log -10 --oneline
git status -s
```

### 3. Read these files fresh (they may have changed since last session)

- `CLAUDE.md` — repo conventions (session-start protocol, workflow rules)
- `PATTERNS.md` — project-wide technical patterns (audio-reactive, Three.js, p5.js scaffolds, etc.)
- `DESIGN.md` — visual/aesthetic doctrine (core commitments, palettes, color/motion rules)
- `project-brushstroke/SPEC.md` — Brushstroke architecture (four-tier model, locked decisions)

If any of those files' mtimes are NEWER than the last commit that touched them, flag it — the user has been editing out-of-band.

### 4. Verify no-worktrees enforcement is intact

- `.claude/settings.json` should exist with a `PreToolUse` hook on `Bash`
- `.claude/hooks/block-git-worktree-add.sh` should exist and be executable
- Smoke-test by piping a test invocation through the hook:
  ```bash
  echo '{"tool_input": {"command": "git worktree add foo bar"}}' | .claude/hooks/block-git-worktree-add.sh; echo "exit=$?"
  ```
  Expect exit 2 + a BLOCKED message on stderr.

### 5. Memory check

Read the auto-memory file:
`/Users/markgould/.claude/projects/-Users-markgould-Documents-GenArt2025/memory/MEMORY.md`

Look for obvious contradictions with current code (e.g., references to deleted
directories, stale project status). Don't fix them automatically — note them
in the summary so the user can decide.

### 6. Structured summary

Produce a report in this shape and STOP — wait for the user to direct what to do next:

```
## Orientation report

- **Repo:** /Users/markgould/Documents/GenArt2025 ✓ (main, not worktree)
- **Branch:** <current branch>
- **Last 3 commits:**
  - <hash> <subject>
  - <hash> <subject>
  - <hash> <subject>
- **Uncommitted state:** <none | brief list of paths>
- **Doc updates since last commit:** <none | which files have newer mtime than HEAD>
- **Hook status:** <pass | issue>
- **Memory alignment:** <aligned | drift noted: ...>
- **Open threads / known TODOs:** <from PATTERNS.md "Under evaluation", recent commit messages, or anything else that looks unfinished>

Ready for direction.
```

## Notes

- Do NOT regurgitate full file contents in the response — the user knows what's in them, they want the *summary*.
- Do NOT modify anything during `/orient`. Read-only. Modifications come after the user directs them.
- If you find drift (memory says X, repo says Y), flag both versions and ask which is authoritative — don't auto-pick.
