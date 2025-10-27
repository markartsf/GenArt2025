# Performance & Architecture Checklist
## For Audio-Reactive & Generative Art Projects

Use this checklist at the **start** of every new project to avoid crashes and performance issues.

---

## 🏗️ Initial Design Phase

### Architecture Questions (Claude's Responsibility)
- [ ] **Object Lifecycle**: What objects get created once vs. every frame?
- [ ] **Memory Allocation**: What's allocated each frame? (Buffers, arrays, objects?)
- [ ] **Resource Management**: Where are graphics buffers/canvases created?
- [ ] **Cleanup Strategy**: How and when are resources disposed?
- [ ] **Runtime Expectations**: 30 seconds? 3 minutes? Infinite loop?
- [ ] **Max Limits**: What's the maximum number of particles/layers/objects?

### Research & References (Mark's Help)
- [ ] Share working examples you like ("This sketch runs smooth for 5 minutes")
- [ ] Provide reference URLs or code samples
- [ ] Describe expected visual complexity
- [ ] Note any performance concerns from past projects

---

## 🧪 Development Phase

### Early Performance Checks (Both)
- [ ] **Add FPS monitor** in debug panel from the start
- [ ] **Test at intervals**: 10s, 30s, 60s, 3min
- [ ] **Memory profiling**: Open browser DevTools → Performance/Memory tab
- [ ] **Flag sluggishness immediately**: Don't wait for crashes!

### Code Review Points (Claude)
- [ ] Search for `createGraphics()`, `createCanvas()`, `new Array()` in loops
- [ ] Verify buffers/objects created in `constructor`, not `draw()`
- [ ] Check for `.dispose()`, `.remove()`, or cleanup methods
- [ ] Look for object pools or recycling patterns
- [ ] Confirm arrays have max limits (no unbounded growth)

---

## ✅ Pre-Release Validation

### Stability Tests
- [ ] Run for full song duration (3-5 minutes minimum)
- [ ] FPS stays above 50 (target: 60)
- [ ] Memory usage stabilizes (not growing infinitely)
- [ ] No browser warnings or slowdowns
- [ ] System stays responsive (no fan spin-up on M2 MacBook Pro)

### Browser DevTools Checks
- [ ] **Performance tab**: Record 30s, check for memory spikes
- [ ] **Memory tab**: Take heap snapshots at 0s, 30s, 60s - should be similar
- [ ] **Console**: No warnings about too many objects

---

## 🚨 Red Flags (Stop and Fix Immediately)

- ❌ FPS drops below 50 after 30 seconds
- ❌ Browser tab shows "⚠️" or memory warning
- ❌ Fans spin up on modern hardware
- ❌ Memory usage grows linearly over time
- ❌ System becomes unresponsive
- ❌ ANY sluggishness reported by Mark

---

## 📋 Common Patterns to Avoid

### ❌ BAD - Creates every frame
```javascript
draw() {
  let buffer = createGraphics(800, 800); // ← LEAK!
  // ...
}
```

### ✅ GOOD - Create once, reuse
```javascript
constructor() {
  this.buffer = createGraphics(800, 800); // ← Create once
}

draw() {
  this.buffer.clear(); // ← Reuse
  // ...
}

dispose() {
  this.buffer.remove(); // ← Clean up
  this.buffer = null;
}
```

---

## 📊 Performance Budget Template

Set these limits **before coding**:

- **Target FPS**: 60
- **Max particles/layers**: ___
- **Max graphics buffers**: ___
- **Canvas size**: ___ × ___
- **Expected runtime**: ___
- **Memory budget**: < 500 MB growth over 3 minutes

---

## 🤝 Communication Protocol

### Mark's Role:
- Share reference examples early
- Report ANY performance issues immediately
- Request "Can we test this for a minute?" if uncertain
- Provide feedback on visual responsiveness

### Claude's Role:
- Ask lifecycle questions before coding
- Add performance monitoring from the start
- Test at 30s/60s intervals during development
- Profile memory allocation patterns
- Research reference architectures when provided

---

## 🎯 Success Criteria

A project is ready when:
- ✅ Runs smoothly for 3× expected duration
- ✅ FPS stable at 60 (or justified reason for lower)
- ✅ Memory usage plateaus (not growing)
- ✅ All buffers/objects properly disposed
- ✅ Performance metrics visible in debug panel
- ✅ Mark confirms it feels responsive

---

**Last Updated**: Based on p5-geometric-layers crash analysis (2025-10-27)

**Lesson Learned**: A single `createGraphics()` in a draw loop crashed an M2 MacBook Pro. Always ask about object lifecycle FIRST.
