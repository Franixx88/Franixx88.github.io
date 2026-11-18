# Chains in the Abyss: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, English-only 3D bio site for Roman Sidorenko, served from GitHub Pages.

**Architecture:** A single `index.html` holds a fixed WebGL canvas behind scrollable HTML sections. The Three.js scene contains fog, particles, a long chain of instanced links and a crystal chess king at the bottom. Scroll progress drives the camera down the chain. All copy and numbers live in `js/content.js` and are rendered into the DOM.

**Tech Stack:** Three.js (vendored ES module + addons, loaded through an import map), plain CSS, no build step. Playwright with system Chrome is used only for verification.

**Spec:** `docs/design.md`

## Global Constraints
- English copy only.
- Static files only; must work from `https://franixx88.github.io/` with relative paths.
- No CDN at runtime: vendor three.js into `vendor/`. (Changed from the spec, which said CDN: vendoring is more reliable and works offline.)
- Exact data: Roman Sidorenko, 16, born Myrnohrad, lives Dnipro; C/C++ Middle; Python, Rust, Java, Go, ASM (a bit); NM; FIDE Classical 2319, Rapid 2283, Blitz 2341, Bullet 2619; Telegram @neistoviy_gay → https://t.me/neistoviy_gay; GitHub https://github.com/Franixx88.
- `prefers-reduced-motion`: no camera easing or counter animation, static scene.

## Review Focus
1. WebGL unavailable or failing → the text content must still be fully readable on a dark gradient background.
2. Phone at 390×844 and low DPR → text stays readable, the frame rate holds (lite mode: fewer particles, no bloom).
3. Window resize or orientation change mid-scroll → canvas and camera re-fit, no stretching.
4. Fast flick to the bottom → the king and the links are visible, and the counters show their final values.
5. Slow network → a loader shows until ready, and the text is never hidden forever (5 s timeout).

---

### Task 1: Content + page skeleton
**Files:** `index.html`, `css/style.css`, `js/content.js`, `js/render-content.js`, `tests/check.py`
**Produces:** `export const CONTENT` with fields `name, age, born, lives, code{main, level, others[]}, chess{title, ratings[{label, value}]}, links[{label, handle, url}]`; `renderContent(root)`.
- [ ] Test: `tests/check.py` loads the page and asserts that the text contains every exact value from Global Constraints and that the links have the correct hrefs.
- [ ] Implement the skeleton: sections `#intro #code #chess #contact`.
- [ ] Run the test → PASS. Commit.

### Task 2: Abyss scene
**Files:** `js/scene.js`, `js/main.js`
**Produces:** `createScene(canvas, {lite}) → {update(progress, t), resize(), setPointer(x, y)}`
- Fog plus a dark gradient; about 3000 drifting particles (800 in lite mode); a distant glowing alien monolith structure.
- The chain: torus links built with InstancedMesh, alternating 90° rotations, descending along a gently curved path. The emissive rune glow pulses.
- The camera follows the path by scroll progress 0..1 with damping. Bloom via UnrealBloomPass (off in lite mode).
- [ ] Test: a screenshot at top/middle/bottom is non-blank (pixel variance > threshold) and there are no console errors.
- [ ] Implement, run, commit.

### Task 3: Crystal king + interactions
**Files:** `js/king.js`
**Produces:** `createKing() → THREE.Group`, plus drag/pointer rotation in main.js
- LatheGeometry body + crown + cross, physical transmission material, orbiting shards.
- [ ] Test: the bottom screenshot shows a bright region in the center; dragging changes the frame.
- [ ] Implement, run, commit.

### Task 4: Polish + fallbacks
- Counters count up on reveal, sections fade and rise in, language runes appear, loader with 5 s timeout, no-WebGL fallback, reduced motion.
- [ ] Tests for Review Focus 1–5 in `tests/check.py`, run at desktop 1440×900 and mobile 390×844.
- [ ] Commit.

### Task 5: Publish
- [ ] Push to the `Franixx88/Franixx88.github.io` repo (needs Roman to create it or grant access), enable Pages, check the live URL.
