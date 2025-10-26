# Git Made Easy - Visual Interfaces & Simple Commands

## You Don't Need Terminal! (But it's easier than you think)

### Option 1: GitHub Desktop (EASIEST - Recommended)
**Visual interface for Git - no commands needed**

**Download:** https://desktop.github.com/

**What you can do:**
- See all your versions visually
- Create new versions with a click
- Compare changes side-by-side
- Publish to GitHub with one button
- Undo anything easily

**How to use:**
1. Install GitHub Desktop
2. File → Add Local Repository → Choose GenArt2025 folder
3. You'll see all your commits (V1, V2) visually
4. To save new work: Write description, click "Commit"
5. To go back in time: Right-click any commit → "Revert"

### Option 2: VS Code (If you use it)
**Built-in Git interface**

1. Open GenArt2025 folder in VS Code
2. Click Source Control icon (left sidebar)
3. See all changes visually
4. Click ✓ to save versions
5. Click clock icon to see history

### Option 3: SourceTree (Advanced but visual)
**Free from Atlassian**
- More features than GitHub Desktop
- Visual branch diagrams
- Download: https://www.sourcetreeapp.com/

### Terminal Commands (They're simpler than they look!)

**The only 5 commands you need:**

```bash
# 1. See what changed
git status

# 2. Save your work
git add -A
git commit -m "Description of what you did"

# 3. See version history
git log --oneline

# 4. Go back to a version
git checkout <commit-id>

# 5. Return to latest
git checkout master
```

**Example workflow:**
```bash
# You made changes to make lines thicker
git add -A
git commit -m "Made Lorenz lines thicker (10-30px)"

# You want to see what you did
git log --oneline
# Shows:
# a1b2c3d Made Lorenz lines thicker (10-30px)
# f81ce8f V2: Pitch-responsive features
# 1621a21 V1: Fall themed visualizations

# You want to compare with V2
git diff f81ce8f

# You want to go back to V2 temporarily
git checkout f81ce8f
# (Test it, then return)
git checkout master
```

**That's it! Those 5 commands handle 90% of your needs.**

## Quick Reference Card

Print this out:

```
┌─────────────────────────────────────────────┐
│         ESSENTIAL GIT COMMANDS              │
├─────────────────────────────────────────────┤
│ git status                                  │
│ → What changed?                             │
│                                             │
│ git add -A                                  │
│ git commit -m "Your note"                   │
│ → Save this version                         │
│                                             │
│ git log --oneline                           │
│ → Show all versions                         │
│                                             │
│ git checkout <id>                           │
│ → Jump to that version                      │
│                                             │
│ git checkout master                         │
│ → Return to latest                          │
└─────────────────────────────────────────────┘
```

## Real Examples for Your Project

**Scenario: You made lines thicker**
```bash
git add -A
git commit -m "V3: Increased Lorenz and Rössler line thickness to 10-30px"
```

**Scenario: You want to see what versions exist**
```bash
git log --oneline --graph
# Pretty visual tree of all versions
```

**Scenario: You broke something, want to undo**
```bash
# If you haven't committed yet:
git checkout -- .

# If you committed but want to go back:
git log --oneline
git checkout <previous-commit-id>
git checkout -b v3-backup  # Save this as a branch
git checkout master        # Return to current
```

**Scenario: You want to try two different ideas**
```bash
# Branch 1: Camera experiments
git checkout -b camera-orbit
# ... make changes ...
git commit -m "Added camera orbit"

# Branch 2: Different idea - slower transitions
git checkout master
git checkout -b slow-transitions
# ... make changes ...
git commit -m "Slowed down all transitions"

# Compare them
git checkout camera-orbit
# Test...
git checkout slow-transitions
# Test...

# Keep the one you like
git checkout master
git merge slow-transitions
```

## Visualizing Your Versions

**In GitHub Desktop:**
- Timeline on left shows all versions
- Click any version to see what changed
- Green = added, Red = removed
- Blue diff shows exact changes

**In Terminal (pretty):**
```bash
git log --graph --oneline --all --decorate
```

Shows a tree like:
```
* a1b2c3d (HEAD -> master) V3: Thicker lines
* f81ce8f V2: Pitch-responsive
* 1621a21 V1: Fall themed
```

## Troubleshooting

**"I'm lost, what version am I on?"**
```bash
git log --oneline -1
```

**"I want to start fresh from V2"**
```bash
git checkout f81ce8f
git checkout -b v3-from-v2
# Now you can build V3 without affecting V2
```

**"I made a mistake in my last commit"**
```bash
# Change the files
git add -A
git commit --amend -m "V3: Corrected version"
```

**"I want to see exactly what I changed"**
```bash
git diff
# Or for a specific file:
git diff sketches/lorenz.js
```

## Connecting to GitHub (Backup online)

**Using GitHub Desktop:**
1. Publish Repository button (top)
2. Choose public or private
3. Click Publish
4. Done! Online backup + sharing

**Using Terminal:**
```bash
# Create repo on github.com first, then:
git remote add origin https://github.com/YOURNAME/GenArt2025.git
git push -u origin master
```

## You're Already Using Git!

You already have:
- V1 saved (commit 1621a21)
- V2 saved (commit f81ce8f)
- Version history working
- Ability to go back anytime

**GitHub Desktop will make it visual and easier!**
