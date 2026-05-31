#!/usr/bin/env bash
# Block 'git worktree add' commands per CLAUDE.md workflow conventions.
# Other git worktree subcommands (list, remove, prune) are allowed.
#
# Invoked as a Claude Code PreToolUse hook on the Bash tool. Receives the
# tool invocation as JSON on stdin; exits 2 to block, with stderr shown to
# the model.

input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Match: word-boundary "git", whitespace, "worktree", whitespace, "add",
# followed by whitespace or end. Skips spurious matches inside strings.
if echo "$cmd" | grep -qE '(^|[^A-Za-z0-9_-])git[[:space:]]+worktree[[:space:]]+add([[:space:]]|$)'; then
  cat >&2 <<EOF
BLOCKED: 'git worktree add' is disabled in this repo.

Per CLAUDE.md workflow conventions, no git worktrees and no claude/* branches.
Work directly in /Users/markgould/Documents/GenArt2025/ on the user's named
branch (default: project-brushstroke). If isolation is genuinely required,
STOP and ask the user before proceeding — do NOT bypass this hook.
EOF
  exit 2
fi

exit 0
