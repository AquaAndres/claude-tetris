'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayRecords = document.getElementById('overlay-records');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');
const startScreen = document.getElementById('start-screen');
const startRecords = document.getElementById('start-records');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
const HIGHSCORES_KEY = 'tetris-highscores';
const MAX_HIGHSCORES = 5;
const MAX_NAME_LENGTH = 12;
const SKIN_KEY = 'tetris-skin';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor = '#22222e';
let startLevel = 1;
let combo = 0;
let gameStarted = false;
let highscores = loadHighscores();
let currentSkin = 'retro';

function roundedRectPath(context, x, y, w, h, r) {
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    return;
  }
  // manual fallback
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    colors: COLORS,
    draw(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    colors: [
      null,
      '#00e5ff', // I
      '#ffee58', // O
      '#e040fb', // T
      '#69f0ae', // S
      '#ff5252', // Z
      '#448aff', // J
      '#ffab40', // L
    ],
    draw(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.shadowBlur = alpha < 1 ? 4 : 14;
      context.fillStyle = color;
      context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    },
  },
  pastel: {
    colors: [
      null,
      '#a7e8ef', // I
      '#fff0b3', // O
      '#dcb8e6', // T
      '#c2e8c4', // S
      '#f3b7b7', // Z
      '#b9d8f7', // J
      '#ffd9b0', // L
    ],
    draw(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      context.globalAlpha = alpha;
      context.fillStyle = color;
      roundedRectPath(context, x * size + 2, y * size + 2, size - 4, size - 4, Math.max(2, size * 0.25));
      context.fill();
      context.globalAlpha = 1;
    },
  },
  pixel: {
    colors: COLORS,
    draw(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      const px = x * size;
      const py = y * size;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // checkerboard texture
      const half = (size - 2) / 2;
      context.fillStyle = 'rgba(0,0,0,0.15)';
      context.fillRect(px + 1, py + 1, half, half);
      context.fillRect(px + 1 + half, py + 1 + half, half, half);
      // bevel border
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(px + 1, py + 1, size - 2, 2);
      context.fillRect(px + 1, py + 1, 2, size - 2);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(px + 1, py + size - 3, size - 2, 2);
      context.fillRect(px + size - 3, py + 1, 2, size - 2);
      context.globalAlpha = 1;
    },
  },
};

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function dropIntervalForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = dropIntervalForLevel(level);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > highscores.bestCombo) {
      highscores.bestCombo = combo;
      saveHighscores();
    }
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin] || SKINS.retro;
  skin.draw(context, x, y, colorIndex, size, alpha ?? 1);
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    if (!raw) return { scores: [], bestCombo: 0, maxLines: 0 };
    const parsed = JSON.parse(raw);
    return {
      scores: Array.isArray(parsed.scores) ? parsed.scores : [],
      bestCombo: typeof parsed.bestCombo === 'number' ? parsed.bestCombo : 0,
      maxLines: typeof parsed.maxLines === 'number' ? parsed.maxLines : 0,
    };
  } catch {
    return { scores: [], bestCombo: 0, maxLines: 0 };
  }
}

function saveHighscores() {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(highscores));
  } catch {
    // storage unavailable; ignore
  }
}

function qualifiesForHighscore(candidateScore) {
  if (candidateScore <= 0) return false;
  if (highscores.scores.length < MAX_HIGHSCORES) return true;
  return candidateScore > highscores.scores[highscores.scores.length - 1].score;
}

function addHighscore(name, entryScore, entryLines, entryLevel) {
  const entry = {
    name: (name || 'JUGADOR').slice(0, MAX_NAME_LENGTH),
    score: entryScore,
    lines: entryLines,
    level: entryLevel,
    date: new Date().toISOString(),
  };
  highscores.scores.push(entry);
  highscores.scores.sort((a, b) => b.score - a.score);
  highscores.scores = highscores.scores.slice(0, MAX_HIGHSCORES);
  saveHighscores();
  return entry;
}

function renderHighscoreTable(container, highlightEntry) {
  container.textContent = '';

  const stats = document.createElement('div');
  stats.className = 'records-stats';
  const comboSpan = document.createElement('span');
  comboSpan.textContent = `Mejor combo: ${highscores.bestCombo}`;
  const linesSpan = document.createElement('span');
  linesSpan.textContent = `Máx. líneas: ${highscores.maxLines}`;
  stats.appendChild(comboSpan);
  stats.appendChild(linesSpan);
  container.appendChild(stats);

  const table = document.createElement('ol');
  table.className = 'records-table';

  if (highscores.scores.length === 0) {
    const li = document.createElement('li');
    li.className = 'records-empty';
    li.textContent = 'Sin puntuaciones todavía';
    table.appendChild(li);
  } else {
    for (const entry of highscores.scores) {
      const li = document.createElement('li');
      if (highlightEntry && entry === highlightEntry) {
        li.classList.add('records-highlight');
      }
      const nameSpan = document.createElement('span');
      nameSpan.className = 'records-name';
      nameSpan.textContent = entry.name;
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'records-score';
      scoreSpan.textContent = entry.score.toLocaleString();
      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);
      table.appendChild(li);
    }
  }

  container.appendChild(table);
}

function renderStartScreen() {
  renderHighscoreTable(startRecords, null);
}

function showHighscoreEntryForm(entryScore, entryLines, entryLevel) {
  overlayRecords.textContent = '';

  const form = document.createElement('div');
  form.className = 'records-form';

  const label = document.createElement('p');
  label.className = 'records-form-label';
  label.textContent = 'Nuevo récord. Ingresá tu nombre:';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'player-name';
  input.maxLength = MAX_NAME_LENGTH;
  input.placeholder = 'Nombre';

  const saveBtn = document.createElement('button');
  saveBtn.id = 'save-score-btn';
  saveBtn.textContent = 'Guardar';

  const submit = () => {
    const entry = addHighscore(input.value.trim(), entryScore, entryLines, entryLevel);
    overlayRecords.textContent = '';
    renderHighscoreTable(overlayRecords, entry);
  };

  saveBtn.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.code === 'Enter') submit();
  });

  form.appendChild(label);
  form.appendChild(input);
  form.appendChild(saveBtn);
  overlayRecords.appendChild(form);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  if (lines > highscores.maxLines) {
    highscores.maxLines = lines;
    saveHighscores();
  }

  overlayRecords.textContent = '';
  if (qualifiesForHighscore(score)) {
    showHighscoreEntryForm(score, lines, level);
  } else {
    renderHighscoreTable(overlayRecords, null);
  }

  overlay.classList.remove('hidden');
}

function openPauseMenu() {
  if (gameOver || paused) return;
  paused = true;
  cancelAnimationFrame(animId);
  pauseMenu.classList.remove('hidden');
}

function closePauseMenu() {
  if (!paused) return;
  paused = false;
  pauseControls.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  lastTime = performance.now();
  dropAccum = 0;
  animId = requestAnimationFrame(loop);
}

function togglePause() {
  if (!gameStarted || gameOver) return;
  if (paused) {
    closePauseMenu();
  } else {
    openPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggle.checked = theme === 'light';
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

function populateStartLevelOptions() {
  for (let i = 1; i <= 15; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    startLevelSelect.appendChild(opt);
  }
  startLevelSelect.value = startLevel;
}

function applySkin(skin) {
  currentSkin = SKINS[skin] ? skin : 'retro';
  document.body.dataset.skin = currentSkin;
  if (skinSelect) skinSelect.value = currentSkin;
  if (typeof current !== 'undefined' && current) {
    draw();
    drawNext();
  }
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(saved || 'retro');
}

if (skinSelect) {
  skinSelect.addEventListener('change', () => {
    const skin = skinSelect.value;
    localStorage.setItem(SKIN_KEY, skin);
    applySkin(skin);
  });
}

function init() {
  initTheme();
  initSkin();
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  combo = 0;
  gameStarted = true;
  dropInterval = dropIntervalForLevel(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  pauseControls.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'Escape' && document.activeElement === startLevelSelect) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (!gameStarted || paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', closePauseMenu);
pauseRestartBtn.addEventListener('click', () => {
  pauseMenu.classList.add('hidden');
  pauseControls.classList.add('hidden');
  init();
});
controlsBtn.addEventListener('click', () => {
  pauseControls.classList.toggle('hidden');
});
startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10) || 1;
});

populateStartLevelOptions();

playBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  init();
});

resetRecordsBtn.addEventListener('click', () => {
  highscores = { scores: [], bestCombo: 0, maxLines: 0 };
  saveHighscores();
  renderStartScreen();
});

initTheme();
initSkin();
renderStartScreen();
