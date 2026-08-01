// A pixel-art flappy bird cut from the same cloth as dino.js: same canvas
// footprint, same monochrome ink, same slide-open panel, same 5-digit counter.
// Everything is drawn from pixel grids / rectangles, so the only asset the
// page needs is the button icon itself.
(function () {
  var panel = document.getElementById('flappy-game');
  var stage = document.getElementById('flappy-stage');
  var canvas = document.getElementById('flappy-canvas');
  if (!panel || !canvas) return;

  var ctx = canvas.getContext('2d');
  var toggleBtn = document.getElementById('flappy-toggle');

  /**************/
  /* SPRITES    */
  /**************/
  // '#' paints a pixel, '.' leaves it clear. 20x15, drawn one cell per scaled
  // pixel just like the dino. The two clear cells on rows 3-4 are the eye; the
  // block jutting off the right on rows 6-8 is the beak.
  var BIRD_BODY = [
    '......#######.......',
    '....###########.....',
    '...#############....',
    '..##########..###...',
    '..##########..###...',
    '.################...',
    '.###################',
    '.###################',
    '.##################.',
    '.###############....',
    '..##############....',
    '..#############.....',
    '...###########......',
    '....#########.......',
    '......#####.........'
  ];

  var BIRD_COLS = 20;
  var BIRD_ROWS = BIRD_BODY.length; // 15

  // The wing is punched out of the finished body rather than baked into the
  // grid, so one sprite covers every beat of the flap
  // Kept clear of the outline on every beat, so punching the moat never eats
  // the bird's own edge
  var WING_TOP = [5, 6, 7]; // row the wing sits on, per frame
  var WING_LEFT = 5, WING_W = 6, WING_H = 3;

  /**************/
  /* STATE      */
  /**************/
  // PX is the unit for the scenery, U the finer unit the bird sprite uses
  var W = 600, H = 150, PX = 2, U = 1, scale = 1, groundY = 138;
  var BIRD_X = 76;
  var fg = '#e4e4e4';
  var open = false, rafId = null, lastTime = 0;

  var GRAVITY = 0.34;
  var FLAP_VELOCITY = -4.3;
  var MAX_FALL = 8;
  var SPEED_START = 3.2;
  var SPEED_MAX = 6.4;
  var ACCELERATION = 0.0006;

  var PIPE_CELLS = 11;  // shaft width, in PX cells
  var LIP_CELLS = 3;    // lip height, in PX cells
  var LIP_OVER = 2;     // cells the lip overhangs on each side

  var state, bird, pipes, clouds, pebbles;
  var speed, score, hiScore, flashTimer, flashCount, wingFrame, gameOverAt, bobTime;

  hiScore = parseInt(localStorage.getItem('flappyHiScore'), 10) || 0;

  function reset(hard) {
    state = 'waiting';
    speed = SPEED_START;
    score = 0;
    flashTimer = 0;
    flashCount = 0;
    wingFrame = 0;
    gameOverAt = 0;
    bobTime = 0;
    pipes = [];
    bird = { y: restY(), vy: 0 };
    spawnPipe(W + pipeWidth());
    if (hard || !clouds) {
      clouds = [];
      pebbles = [];
      for (var i = 0; i < 2; i++) spawnCloud(W * (0.4 + i * 0.5));
      for (var j = 0; j < 26; j++) spawnPebble(Math.random() * W);
    }
  }

  function restY() {
    return groundY * 0.42 - (BIRD_ROWS * U) / 2;
  }

  function pipeWidth() { return PIPE_CELLS * PX; }

  // The gap tightens as the run goes on, but never past what a single flap
  // can comfortably clear
  function gapSize() {
    return Math.max(42, 56 - score * 0.7) * scale;
  }

  // Roughly constant time between pipes early on, tightening at top speed
  function spacing() {
    return (120 + speed * 20) * scale;
  }

  /**************/
  /* SIZING     */
  /**************/
  function resize() {
    var cssW = Math.max(260, Math.round(panel.clientWidth));
    var cssH = cssW < 420 ? 120 : 150;
    var dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    W = cssW;
    H = cssH;
    scale = H / 150;
    U = Math.max(1, Math.round(scale));
    PX = Math.max(1, Math.round(2 * scale));
    groundY = H - 12 * scale;
    if (bird) bird.y = Math.min(bird.y, groundY - BIRD_ROWS * U);
    readColor();
    if (open) syncPanelHeight();
  }

  // The sprites inherit the page's text colour so the game follows the theme
  function readColor() {
    fg = getComputedStyle(canvas).color || '#e4e4e4';
  }

  function syncPanelHeight() {
    panel.style.height = stage.offsetHeight + 'px';
  }

  /**************/
  /* DRAWING    */
  /**************/
  function drawGrid(grid, x, y, unit) {
    ctx.fillStyle = fg;
    for (var r = 0; r < grid.length; r++) {
      var row = grid[r];
      var runStart = -1;
      for (var c = 0; c <= row.length; c++) {
        var on = row.charAt(c) === '#';
        if (on && runStart < 0) runStart = c;
        // Painting each horizontal run as one rect keeps the fill count low
        if (!on && runStart >= 0) {
          ctx.fillRect(x + runStart * unit, y + r * unit, (c - runStart) * unit, unit);
          runStart = -1;
        }
      }
    }
  }

  function rect(x, y, w, h) {
    ctx.fillStyle = fg;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawBird() {
    var x = BIRD_X * scale;
    drawGrid(BIRD_BODY, x, bird.y, U);

    // Clearing a one-cell moat around the wing lifts it off the body without
    // needing a second colour
    var frame = wingFrame < 4 ? 0 : wingFrame < 8 ? 1 : 2;
    var wx = x + WING_LEFT * U;
    var wy = bird.y + WING_TOP[frame] * U;
    ctx.clearRect(wx - U, wy - U, (WING_W + 2) * U, (WING_H + 2) * U);
    rect(wx, wy, WING_W * U, WING_H * U);
  }

  function drawPipe(p) {
    var u = PX;
    var pw = pipeWidth();
    var lipH = LIP_CELLS * u;
    var over = LIP_OVER * u;
    var top = p.gapY - p.gap / 2;
    var bot = p.gapY + p.gap / 2;

    // Hollow shafts keep the canvas as light as the cacti; the lips are solid
    // so the edge of the gap reads at a glance
    shaft(p.x, 0, top - lipH, pw, u);
    rect(p.x - over, top - lipH, pw + over * 2, lipH);
    rect(p.x - over, bot, pw + over * 2, lipH);
    shaft(p.x, bot + lipH, groundY - bot - lipH, pw, u);
  }

  function shaft(x, y, h, pw, u) {
    if (h <= 0) return;
    rect(x, y, u, h);
    rect(x + pw - u, y, u, h);
    ctx.globalAlpha = 0.3;
    for (var yy = y + 5 * u; yy < y + h - u; yy += 5 * u) rect(x, yy, pw, Math.max(1, u / 2));
    ctx.globalAlpha = 1;
  }

  function drawCloud(c) {
    var u = PX;
    ctx.globalAlpha = 0.45;
    rect(c.x + 2 * u, c.y + 2 * u, 12 * u, 2 * u);
    rect(c.x, c.y + 4 * u, 18 * u, 2 * u);
    rect(c.x + 3 * u, c.y, 8 * u, 2 * u);
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    rect(0, groundY, W, Math.max(1, PX / 2));
    ctx.globalAlpha = 0.5;
    for (var i = 0; i < pebbles.length; i++) {
      var p = pebbles[i];
      rect(p.x, groundY + p.o * PX, p.w * PX, Math.max(1, PX / 2));
    }
    ctx.globalAlpha = 1;
  }

  function drawScore() {
    var text = pad(score);
    ctx.fillStyle = fg;
    ctx.font = 'bold ' + Math.round(11 * scale) + "px 'Courier New', Courier, monospace";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    // The counter blinks for a moment each time it rolls past a ten
    var hidden = flashCount > 0 && Math.floor(flashTimer / 120) % 2 === 0;
    if (!hidden) ctx.fillText(text, W - 8 * scale, 8 * scale);

    if (hiScore > 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillText('HI ' + pad(hiScore), W - 8 * scale - ctx.measureText(text).width - 14 * scale, 8 * scale);
      ctx.globalAlpha = 1;
    }
  }

  function pad(n) {
    var s = String(n);
    while (s.length < 5) s = '0' + s;
    return s;
  }

  function drawCenterText(main, sub) {
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(13 * scale) + "px 'Courier New', Courier, monospace";
    ctx.fillText(main, W / 2, H * 0.34);
    if (sub) {
      ctx.globalAlpha = 0.55;
      ctx.font = Math.round(10 * scale) + "px 'Courier New', Courier, monospace";
      ctx.fillText(sub, W / 2, H * 0.34 + 18 * scale);
      ctx.globalAlpha = 1;
    }
  }

  /**************/
  /* SPAWNING   */
  /**************/
  function spawnCloud(x) {
    clouds.push({ x: x, y: (10 + Math.random() * 34) * scale, speed: 0.2 + Math.random() * 0.2 });
  }

  function spawnPebble(x) {
    pebbles.push({ x: x, w: 1 + Math.floor(Math.random() * 4), o: 2 + Math.floor(Math.random() * 3) });
  }

  function spawnPipe(x) {
    var gap = gapSize();
    // Leave room for a lip plus a stub of shaft at either end
    var margin = gap / 2 + (LIP_CELLS + 4) * PX;
    var prev = pipes.length ? pipes[pipes.length - 1].gapY : groundY * 0.5;
    // Walking the gap rather than redrawing it keeps consecutive pipes reachable
    var gy = pipes.length ? prev + (Math.random() * 2 - 1) * 40 * scale : groundY * 0.5;
    gy = Math.max(margin, Math.min(groundY - margin, gy));
    pipes.push({ x: x, gapY: gy, gap: gap, scored: false });
  }

  /**************/
  /* COLLISION  */
  /**************/
  // The box is pulled in from the artwork so near-misses stay misses
  function birdBox() {
    return { x: BIRD_X * scale + 4 * U, y: bird.y + 3 * U, w: 12 * U, h: 10 * U };
  }

  // The lip overhang is left out, so clipping a corner of it is forgiven
  function pipeBoxes(p) {
    var pw = pipeWidth();
    var top = p.gapY - p.gap / 2;
    var bot = p.gapY + p.gap / 2;
    return [
      { x: p.x, y: 0, w: pw, h: top },
      { x: p.x, y: bot, w: pw, h: groundY - bot }
    ];
  }

  function hits(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /**************/
  /* LOOP       */
  /**************/
  function update(dt) {
    if (state === 'crashed') {
      // The bird keeps falling after a crash until it hits the deck
      bird.vy = Math.min(MAX_FALL, bird.vy + GRAVITY * dt);
      bird.y = Math.min(bird.y + bird.vy * scale * dt, groundY - BIRD_ROWS * U);
      return;
    }

    if (state === 'running') {
      speed = Math.min(SPEED_MAX, speed + ACCELERATION * dt);
      wingFrame = (wingFrame + dt) % 12;
      if (flashCount > 0) {
        flashTimer += dt * 16.7;
        if (flashTimer > 360) { flashCount = 0; flashTimer = 0; }
      }
    }

    var move = state === 'waiting' ? 0 : speed * scale * dt;

    // Scenery
    for (var i = clouds.length - 1; i >= 0; i--) {
      clouds[i].x -= clouds[i].speed * scale * dt;
      if (clouds[i].x < -20 * PX) { clouds.splice(i, 1); spawnCloud(W + Math.random() * W * 0.5); }
    }
    if (clouds.length < 3 && Math.random() < 0.004 * dt) spawnCloud(W + Math.random() * 60);

    for (var p = pebbles.length - 1; p >= 0; p--) {
      pebbles[p].x -= move;
      if (pebbles[p].x < -8) { pebbles.splice(p, 1); spawnPebble(W + Math.random() * 40); }
    }

    if (state === 'waiting') {
      bobTime += dt;
      wingFrame = (wingFrame + dt * 0.6) % 12;
      bird.y = restY() + Math.sin(bobTime / 9) * 4 * scale;
      return;
    }

    // Bird physics. The ceiling is a wall, not a death: the top pipes are what
    // stop you from riding it
    bird.vy = Math.min(MAX_FALL, bird.vy + GRAVITY * dt);
    bird.y += bird.vy * scale * dt;
    if (bird.y < 0) { bird.y = 0; bird.vy = 0; }

    // Pipes
    for (var k = pipes.length - 1; k >= 0; k--) {
      pipes[k].x -= move;
      if (pipes[k].x + pipeWidth() < -20) pipes.splice(k, 1);
    }

    var last = pipes[pipes.length - 1];
    if (!last || last.x <= W - spacing()) spawnPipe(W);

    // Scoring
    var nose = BIRD_X * scale + 4 * U;
    for (var s = 0; s < pipes.length; s++) {
      if (!pipes[s].scored && pipes[s].x + pipeWidth() < nose) {
        pipes[s].scored = true;
        score++;
        if (score % 10 === 0) { flashCount = 3; flashTimer = 0; }
      }
    }

    // Crash check
    if (bird.y + BIRD_ROWS * U >= groundY) return crash();
    var box = birdBox();
    for (var m = 0; m < pipes.length; m++) {
      var boxes = pipeBoxes(pipes[m]);
      for (var n = 0; n < boxes.length; n++) {
        if (hits(box, boxes[n])) return crash();
      }
    }
  }

  function crash() {
    state = 'crashed';
    gameOverAt = 0;
    if (score > hiScore) {
      hiScore = score;
      localStorage.setItem('flappyHiScore', String(hiScore));
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < clouds.length; i++) drawCloud(clouds[i]);
    for (var j = 0; j < pipes.length; j++) drawPipe(pipes[j]);
    drawGround();
    drawBird();
    drawScore();
    if (state === 'waiting') drawCenterText('PRESS SPACE TO START', 'space / tap to flap  ·  mind the gap');
    if (state === 'crashed') drawCenterText('G A M E   O V E R', 'space or tap to try again');
  }

  function frame(now) {
    var delta = lastTime ? now - lastTime : 16.7;
    lastTime = now;
    var dt = Math.min(delta / 16.7, 3);
    if (state === 'crashed') gameOverAt += delta;
    update(dt);
    render();
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId === null) {
      lastTime = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  /**************/
  /* INPUT      */
  /**************/
  function flap() {
    if (state === 'waiting') {
      state = 'running';
      bird.vy = FLAP_VELOCITY;
      wingFrame = 0;
      return;
    }
    if (state === 'crashed') {
      // A short lockout keeps the crashing keypress from instantly restarting
      if (gameOverAt > 400) { reset(false); state = 'running'; bird.vy = FLAP_VELOCITY; }
      return;
    }
    bird.vy = FLAP_VELOCITY;
    wingFrame = 0;
  }

  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp' || e.key === 'ArrowUp') {
      e.preventDefault();
      flap();
    } else if (e.key === 'Escape') {
      window.toggleFlappy();
    }
  });

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    canvas.focus();
    flap();
  });

  window.addEventListener('resize', resize);

  // Keep the sprites in step with the light/dark toggle
  new MutationObserver(readColor).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  /**************/
  /* TOGGLE     */
  /**************/
  window.toggleFlappy = function () {
    open = !open;
    // Only one game holds the gap at a time, so the others step aside
    if (open && window.closeDino) window.closeDino();
    if (open && window.closeGeometry) window.closeGeometry();
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (toggleBtn) toggleBtn.setAttribute('aria-pressed', open ? 'true' : 'false');

    if (open) {
      resize();
      if (!state) reset(true);
      syncPanelHeight();
      start();
    } else {
      panel.style.height = '0px';
      stop();
    }
  };

  window.closeFlappy = function () {
    if (open) window.toggleFlappy();
  };

  resize();
  reset(true);
  render();
})();
