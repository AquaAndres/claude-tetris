# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla Tetris — HTML5 Canvas + CSS + plain JavaScript (ES6+). No build process, no package manager, no dependencies.

## Running

No install/build step. Either:

```bash
start index.html       # Windows: open directly in browser
```

or serve statically (needed if testing anything that would require a server, e.g. future fetch calls):

```bash
python3 -m http.server 8000
npx serve .
php -S localhost:8000
```

There is no test suite, linter, or build tool in this repo.

## Architecture

Three files, no modules/bundler — `game.js` is loaded as a single classic script and relies on globals.

- `index.html` — DOM shell: `<canvas id="board">` (300×600, the play field) and `<canvas id="next-canvas">` (next-piece preview), plus HUD spans (`score`/`lines`/`level`) and the pause/game-over `#overlay`.
- `style.css` — dark/retro arcade look; no logic-relevant details.
- `game.js` (~300 lines) — entire game logic, structured around a small set of global `let` state variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`) mutated by top-level functions rather than a class/state object.

Key mechanics to know before editing:

- **Board model**: `ROWS × COLS` matrix, each cell `0` (empty) or a color index `1–7` identifying which piece locked there.
- **Pieces**: defined as fixed square matrices in `PIECES` (index 0 unused). Rotation is done by `rotateCW` (transpose), and `tryRotate` applies it with wall-kick offsets `[0, -1, 1, -2, 2]` tried in order until one doesn't collide.
- **Collision** (`collide`): single source of truth for whether a shape at a given offset is legal (out of bounds or overlapping a filled board cell). Used for movement, rotation, ghost projection, and locking.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and advances the piece one row once it exceeds `dropInterval`. `animId` is tracked so pause/game-over/restart can cancel and later resume the loop cleanly.
- **Locking/clearing**: `lockPiece` → `merge` (writes piece into `board`) → `clearLines` (bottom-up scan, removes full rows, unshifts empty rows, re-checks the same index after a splice) → `spawn` (promotes `next` to `current`, generates a new `next`; if the new piece immediately collides, calls `endGame`).
- **Scoring/leveling**: `LINE_SCORES = [0,100,300,500,800]` multiplied by `level`; hard drop adds 2×(rows dropped), soft drop adds 1 per row. Level increments every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Rendering**: `draw()` clears and redraws grid, board, ghost piece (`ghostY()` projects straight down, drawn at `globalAlpha 0.2`), then the current piece — in that order, every frame. `drawNext()` renders the preview canvas independently.
- Input is a single `keydown` listener switching on `e.code` (arrows + `KeyX` for rotate, `Space` for hard drop, `KeyP` for pause), guarded by `paused`/`gameOver` checks.

If changing `COLS`, `ROWS`, or `BLOCK` in `game.js`, also update the `#board` canvas `width`/`height` in `index.html` to match (`COLS×BLOCK` by `ROWS×BLOCK`).
