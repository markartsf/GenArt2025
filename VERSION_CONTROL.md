# Version Control Guide

Your project is now under git version control! This means you can experiment freely and always return to previous versions.

## Current Versions

### V1 (Current - Committed)
- Fall color palette with deep burgundy background
- 4 sketches: Lorenz, Rössler, Particles, Waveform
- Thick lines (4-16px) responding to bass
- Basic audio features: bass, mid, high, RMS, spectral centroid

## How to Work with Versions

### Save Current Work (Commit)
Whenever you want to save a version:
```bash
git add -A
git commit -m "Description of changes"
```

### Create a New Version Branch
To experiment without affecting V1:
```bash
git checkout -b v2-pitch-responsive
# Make your changes
git add -A
git commit -m "V2: Added pitch-responsive features"
```

### List All Versions
```bash
git log --oneline
git branch -a
```

### Return to a Previous Version
```bash
# See all commits
git log --oneline

# Go back to specific commit
git checkout <commit-hash>

# Or go back to V1
git checkout master
```

### Compare Versions
```bash
# See what changed between versions
git diff master v2-pitch-responsive
```

## Recommended Workflow

1. **Keep V1 Safe:** Never commit to master unless you're sure
2. **Create Feature Branches:** Each experiment gets its own branch
3. **Tag Releases:** Mark important versions
   ```bash
   git tag -a v1.0 -m "Fall themed responsive art"
   git tag -a v2.0 -m "Pitch-responsive features"
   ```

## File Versioning Strategy

We'll create parallel versions of files:
- `sketches/lorenz-v2.js` - Enhanced version
- `sketches/lorenz.js` - Original V1 (untouched)

This way you can:
- Switch between versions easily in the HTML dropdown
- Compare side-by-side
- Keep both versions available

## Backup to GitHub (Recommended)

To backup online and share:
```bash
# Create repo on github.com
# Then connect it:
git remote add origin https://github.com/YOUR-USERNAME/GenArt2025.git
git push -u origin master
git push --tags
```

## Quick Commands Reference

```bash
# Save work
git add -A && git commit -m "Your message"

# See status
git status

# See history
git log --oneline --graph --all

# Create new branch for experiment
git checkout -b experiment-name

# Switch branches
git checkout master
git checkout v2-pitch-responsive
```
