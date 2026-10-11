/*
 * Bookshelf: a shelf of the books you're reading and just finished, drawn
 * as blocks standing on a plank, with the same books listed under it, and
 * an optional crate of art prints at the end of the shelf.
 *
 *   <link rel="stylesheet" href="bookshelf.css">
 *   <div id="shelf"></div>
 *   <script src="bookshelf.js"></script>
 *   <script>
 *     Bookshelf.mount('#shelf', {
 *       books: [{ title: 'Flash Boys', author: 'Michael Lewis', cover: 'flash-boys.jpg',
 *                 color: '#ed1b2c', pages: 274, height: 171, current: true }],
 *       coverBase: '/images/books/'
 *     });
 *   </script>
 *
 * See README.md for every option. MIT licensed.
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var mounts = 0;

  var DEFAULTS = {
    books: [],
    art: [],
    // Put in front of each book's cover and each print's src, unless it's
    // already a full URL or path
    coverBase: '',
    artBase: '',
    // Lets visitors drag the books into their own order (on the shelf or in
    // the list), which their browser remembers under storageKey; null
    // remembers nothing
    reorder: true,
    storageKey: 'bookshelf-order',
    // Called with the books' titles in their new order after each reorder
    onReorder: null,
    labels: {
      shelf: "A shelf of what I'm reading now and just finished",
      reading: 'Recent reading',
      current: 'currently reading',
      art: 'Selected art',
      crate: 'Art'
    }
  };

  // The drawing, in its own units: the svg scales to fill its container
  // W: the whole width; LINE: where the books stand; PLANK: the plank's
  // front edge; GAP: between books; DX, DY: how far back-and-up depth runs
  var W = 667, LINE = 190, PLANK = 6, GAP = 7, DX = 9, DY = -7, X0 = 4;
  var H = LINE + 16;
  // How deep a book runs, in DX/DY steps, and the plank (deeper than the books)
  var BOOK_DEEP = 2, PLANK_DEEP = 2.2, CRATE_DEEP = 1.6;
  // How thick a page is: a book's thickness is in proportion to its pages,
  // unless there are too many to fit, when they all come out thinner
  var PAGE_W = 0.1275;
  // The bookend's upright and the foot it stands on
  var BOOKEND_W = 9, BOOKEND_TALL = 116, BOOKEND_FOOT = 44;
  // The crate: how wide and tall, as drawn
  var CRATE_W = 200, CRATE_H = 60;
  // A line or book is moved past another once it's dragged this far over it
  var GIVE = 0.2;

  function isUrl(s) { return /^([a-z]+:|\/|\.)/i.test(s); }

  function merge(o) {
    var out = {}, k;
    for (k in DEFAULTS) out[k] = DEFAULTS[k];
    for (k in o || {}) if (o[k] !== undefined) out[k] = o[k];
    out.labels = {};
    for (k in DEFAULTS.labels) out.labels[k] = DEFAULTS.labels[k];
    for (k in (o && o.labels) || {}) out.labels[k] = o.labels[k];
    return out;
  }

  // Dark text on a light spine, light text on a dark one, unless the book says
  function inkFor(hex) {
    var n = parseInt(hex.slice(1), 16);
    var lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    return lum > 150 ? 'dark' : 'light';
  }

  function normalizeBook(b, base) {
    var color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#d9d4c7';
    return {
      title: String(b.title || 'Untitled'),
      author: b.author ? String(b.author) : '',
      cover: b.cover ? (isUrl(b.cover) ? b.cover : base + b.cover) : null,
      color: color,
      ink: b.ink === 'dark' || b.ink === 'light' ? b.ink : inkFor(color),
      pages: Math.max(40, +b.pages || 300),
      height: Math.min(180, Math.max(90, +b.height || 165)),
      current: !!b.current,
      note: b.note ? String(b.note) : ''
    };
  }

  function normalizeArt(a, i, base) {
    return {
      src: isUrl(a.src) ? a.src : base + a.src,
      title: a.title ? String(a.title) : '',
      by: a.by ? String(a.by) : '',
      alt: a.alt || [a.title, a.by].filter(Boolean).join(', '),
      aspect: +a.aspect || 1,
      row: a.row !== undefined ? +a.row : Math.floor(i / 2),
      crate: a.crate || null
    };
  }

  function mount(root, options) {
    if (typeof root === 'string') root = document.querySelector(root);
    if (!root) throw new Error('Bookshelf: no element to mount on');
    var o = merge(options);
    var uid = 'bs' + (++mounts);
    var BOOKS = (o.books || []).map(function (b) { return normalizeBook(b, o.coverBase); });
    var ART = (o.art || []).map(function (a, i) { return normalizeArt(a, i, o.artBase); });
    var hasArt = ART.length > 0;

    function html(tag, cls, parent, text) {
      var node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined) node.textContent = text;
      if (parent) parent.appendChild(node);
      return node;
    }

    root.classList.add('bookshelf');
    root.classList.toggle('is-fixed', !o.reorder);
    root.textContent = '';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'bs-cabinet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', o.labels.shelf);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    root.appendChild(svg);

    // The Art section, opened from the crate: the prints large, in rows, each
    // row's paintings coming out the same height and filling the width
    var artSection = null;
    if (hasArt) {
      artSection = html('div', 'bs-art', root);
      artSection.id = uid + '-art';
      var artInner = html('div', 'bs-art-inner', artSection);
      html('h2', 'bs-label', artInner, o.labels.art);
      var rows = {};
      ART.forEach(function (a) {
        if (!rows[a.row]) rows[a.row] = html('div', 'bs-art-row', artInner);
        var fig = html('figure', 'bs-art-fig', rows[a.row]);
        fig.style.flexGrow = a.aspect;
        var img = html('img', '', fig);
        img.src = a.src;
        img.alt = a.alt;
        img.loading = 'lazy';
        img.style.aspectRatio = a.aspect;
        var cap = html('figcaption', '', fig);
        html('span', 'bs-art-title', cap, a.title);
        html('span', 'bs-art-by', cap, a.by);
        a.img = img;
      });
    }

    var list = html('div', 'bs-list', root);
    list.id = uid + '-list';
    html('h2', 'bs-label', list, o.labels.reading);
    var readList = html('ul', 'bs-reads', list);
    var reads = BOOKS.map(function (b) {
      var li = html('li', 'bs-read' + (b.current ? ' is-current' : ''), readList);
      li.tabIndex = 0;
      if (b.cover) {
        var img = html('img', 'bs-cover', li);
        img.src = b.cover;
        img.alt = 'Cover of ' + b.title;
        img.width = 56;
        img.height = 86;
        img.loading = 'lazy';
      } else {
        // no cover: a plain one in the spine's color
        html('span', 'bs-cover bs-cover-blank', li).style.background = b.color;
      }
      var text = html('span', 'bs-read-text', li);
      html('span', 'bs-read-title', text, b.title);
      var by = html('span', 'bs-read-by', text);
      if (b.author) html('span', 'bs-read-author', by, b.author);
      if (b.current) html('span', 'bs-now', by, (b.author ? ' · ' : '') + o.labels.current);
      if (b.note) html('span', 'bs-note', text, b.note);
      return li;
    });

    function el(name, attrs, parent) {
      var node = document.createElementNS(NS, name);
      for (var k in attrs) node.setAttribute(k, attrs[k]);
      (parent || svg).appendChild(node);
      return node;
    }
    function pts(points) { return points.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }
    function shade(hex, by) {
      var n = parseInt(hex.slice(1), 16);
      var c = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) { return Math.min(255, Math.round(v * by)); });
      return 'rgb(' + c.join(',') + ')';
    }

    // A plank: its top surface running back, then its front edge
    var plankEnd = W - DX * PLANK_DEEP;
    el('polygon', { points: pts([[0, LINE], [plankEnd, LINE], [W, LINE + DY * PLANK_DEEP], [DX * PLANK_DEEP, LINE + DY * PLANK_DEEP]]), 'class': 'bs-plank-top' });
    el('rect', { x: 0, y: LINE, width: plankEnd, height: PLANK, 'class': 'bs-plank-front' });
    el('polygon', { points: pts([[plankEnd, LINE], [W, LINE + DY * PLANK_DEEP], [W, LINE + DY * PLANK_DEEP + PLANK], [plankEnd, LINE + PLANK]]), 'class': 'bs-plank-end' });

    // If the books, the bookend and the crate won't all fit on the plank,
    // the books come out thinner, all alike
    var pages = BOOKS.reduce(function (s, b) { return s + b.pages; }, 0);
    var room = plankEnd - X0 - BOOKS.length * GAP - (BOOKEND_W + BOOKEND_FOOT + DX * CRATE_DEEP + GAP) -
      (hasArt ? CRATE_W + DX * CRATE_DEEP + 8 : 0);
    var pageW = pages ? Math.min(PAGE_W, room / pages) : PAGE_W;

    // Books left to right, each one covering the side of the one before it.
    // Each is drawn at its own left edge, then slid along to its place on the
    // shelf (see place() below), so they can be put in a new order. Each
    // shows its spine (in its own color, the title running up it), its top
    // with the page edges showing between the covers, and its right side in
    // a darker shade.
    var groups = [], widths = [];
    var x = X0;
    BOOKS.forEach(function (b, i) {
      var w = b.pages * pageW, h = b.height, top = LINE - h, L = 0, R = w;
      var g = el('g', { 'class': 'bs-book' + (b.current ? ' is-current' : ''), 'data-i': i, tabindex: 0 });
      // A book runs about as deep as the shelf, mostly hidden by its neighbors
      var dx = DX * BOOK_DEEP, dy = DY * BOOK_DEEP;
      var side = [[R, top], [R + dx, top + dy], [R + dx, LINE + dy], [R, LINE]];
      // A backing in the page's color fills the book's outline, so when the
      // drawing over it fades back, nothing behind shows through
      var outline = pts([[L, LINE], [L, top], [L + dx, top + dy], [R + dx, top + dy], [R + dx, LINE + dy], [R, LINE]]);
      // An unseen copy of the outline stays put to catch the cursor, so the
      // book doesn't slip out from under it as it pops up and tips
      el('polygon', { points: outline, 'class': 'bs-hit' }, g);
      var lift = el('g', { 'class': 'bs-book-lift' }, g);
      el('polygon', { points: outline, 'class': 'bs-backing' }, lift);
      var art = el('g', { 'class': 'bs-book-art' }, lift);
      el('polygon', { points: pts(side), 'class': 'bs-book-side', style: 'fill:' + shade(b.color, 0.72) }, art);
      // Its top: the page block, sitting a little down inside the two cover
      // boards and the spine's edge, which stand up around it in a lighter
      // shade
      function at(across, depth) { return [L + across + dx * depth, top + dy * depth]; }
      function line(points) { return 'M' + pts(points).replace(/ /g, ' L'); }
      // The covers and the spine's edge come out equally thick, measured
      // square to each band: the covers run back along the depth, the
      // spine's edge across
      var thick = 1.8, len = Math.sqrt(dx * dx + dy * dy);
      var board = thick * len / -dy, near = thick / -dy;
      // How far down the pages sit; less than the boards are thick, so the
      // boards hide the pages' near and right edges
      var sink = 1.5;
      function down(q) { return [q[0], q[1] + sink]; }
      var block = [at(board, near), at(w - board, near), at(w - board, 1), at(board, 1)];
      el('polygon', { points: pts(block.map(down)), 'class': 'bs-book-pages' }, art);
      // ruled with the edges of the pages, and a faint line along their back
      var lines = line([at(board, 1), at(w - board, 1)].map(down));
      for (var p = board + 0.8; p < w - board; p += 0.8) lines += line([at(p, near), at(p, 1)].map(down));
      el('path', { d: lines, 'class': 'bs-book-page-lines' }, art);
      // The inside of the near cover shows above the pages, in shadow
      el('polygon', { points: pts([at(board, near), at(board, 1), down(at(board, 1)), down(at(board, near))]), 'class': 'bs-book-wall' }, art);
      // The boards: a U around the pages, open at the back
      var boards = [at(0, 0), at(w, 0), at(w, 1), at(w - board, 1), at(w - board, near), at(board, near), at(board, 1), at(0, 1)];
      el('polygon', { points: pts(boards), 'class': 'bs-book-top', style: 'fill:' + shade(b.color, 1.18) }, art);
      // Outlined all round but the back, between the ends of the covers
      el('path', { d: line([at(board, 1), at(0, 1), at(0, 0)]) + ' ' + line([at(board, 1), at(board, near), at(w - board, near), at(w - board, 1), at(w, 1)]), 'class': 'bs-book-edge' }, art);
      var spine = el('rect', { x: L, y: top, width: w, height: h, 'class': 'bs-book-spine' }, art);
      spine.style.fill = b.color;
      // The title runs up the spine, shrinking if it's too long for it
      var clip = el('clipPath', { id: uid + '-spine-' + i }, art);
      el('rect', { x: L, y: top + 5, width: w, height: h - 10 }, clip);
      var holder = el('g', { 'clip-path': 'url(#' + uid + '-spine-' + i + ')' }, art);
      var title = el('text', { x: 0, y: 0, 'class': 'bs-book-title' }, holder);
      title.textContent = b.title;
      title.style.fill = b.ink === 'dark' ? '#1a1a18' : '#fff';
      var size = Math.min(13, w * 0.55);
      title.style.fontSize = size + 'px';
      while (size > 7 && title.getComputedTextLength() > h - 18) {
        size -= 0.5;
        title.style.fontSize = size + 'px';
      }
      // centered across the spine at whatever size it came out
      title.setAttribute('transform', 'translate(' + (L + w / 2 + size * 0.35) + ',' + (LINE - 9) + ') rotate(-90)');
      groups[i] = g;
      widths[i] = w;
      x += w + GAP;
    });

    // A bookend holding up the last book: an L of pine to match the crate, its
    // upright standing flush against the book with a rounded top, and its
    // foot running out along the shelf
    var bookend = el('g', { 'class': 'bs-bookend' });
    (function () {
      var L = x - GAP, w = BOOKEND_W, d = CRATE_DEEP, r = 3;
      var T = LINE - BOOKEND_TALL, R = L + w;
      el('polygon', { points: pts([[R, T + r], [R + DX * d, T + r + DY * d], [R + DX * d, LINE + DY * d], [R, LINE]]), 'class': 'bs-line bs-bookend-side' }, bookend);
      el('path', { d: 'M' + L + ',' + (T + r) + ' Q' + L + ',' + T + ' ' + (L + r) + ',' + T + ' L' + (L + DX * d + w - r) + ',' + (T + DY * d) +
        ' Q' + (R + DX * d) + ',' + (T + DY * d) + ' ' + (R + DX * d) + ',' + (T + r + DY * d) + ' L' + R + ',' + (T + r) + ' Z', 'class': 'bs-line bs-bookend-top' }, bookend);
      el('path', { d: 'M' + L + ',' + LINE + ' L' + L + ',' + (T + r) + ' Q' + L + ',' + T + ' ' + (L + r) + ',' + T + ' Q' + R + ',' + T + ' ' + R + ',' + (T + r) + ' L' + R + ',' + LINE + ' Z', 'class': 'bs-line bs-bookend-face' }, bookend);
      // its foot, a thin plate running out along the shelf from the bottom
      var plate = 4, FR = R + BOOKEND_FOOT, FT = LINE - plate;
      el('polygon', { points: pts([[R, FT], [FR, FT], [FR + DX * d, FT + DY * d], [R + DX * d, FT + DY * d]]), 'class': 'bs-line bs-bookend-top' }, bookend);
      el('polygon', { points: pts([[FR, FT], [FR + DX * d, FT + DY * d], [FR + DX * d, LINE + DY * d], [FR, LINE]]), 'class': 'bs-line bs-bookend-side' }, bookend);
      el('rect', { x: R, y: FT, width: BOOKEND_FOOT, height: plate, 'class': 'bs-line bs-bookend-face' }, bookend);
      x = FR + DX * d + GAP;
    })();

    // The art crate: an open wooden crate past the books, its inside in
    // shadow, with the prints standing in it. It sits centered in the
    // stretch between the bookend and the plank's front corner.
    var crate = null;
    if (hasArt) {
      var binW = CRATE_W, binH = CRATE_H, deep = [DX * CRATE_DEEP, DY * CRATE_DEEP];
      var binL = (x + plankEnd - binW - deep[0]) / 2, binT = LINE - binH;
      crate = el('g', { 'class': 'bs-crate', tabindex: 0, role: 'button', 'aria-expanded': 'false', 'aria-controls': artSection.id, 'aria-label': o.labels.crate + ': show the paintings', 'aria-pressed': 'false' });
      // A backing in the page's color fills the crate's outline, so when the
      // crate blurs back the shelf behind it doesn't show through (and, as
      // with a book, an unseen copy stays put to catch the cursor)
      var binOutline = pts([[binL, LINE], [binL, binT], [binL + deep[0], binT + deep[1]], [binL + binW + deep[0], binT + deep[1]],
        [binL + binW + deep[0], LINE + deep[1]], [binL + binW, LINE]]);
      el('polygon', { points: binOutline, 'class': 'bs-hit' }, crate);
      el('polygon', { points: binOutline, 'class': 'bs-backing' }, crate);
      var body = el('g', { 'class': 'bs-crate-body' }, crate);
      el('polygon', { points: pts([[binL, binT], [binL + binW, binT], [binL + binW + deep[0], binT + deep[1]], [binL + deep[0], binT + deep[1]]]), 'class': 'bs-line bs-crate-inside' }, body);
      // Where each print stands: as the art says, or else spread across the
      // crate, the first furthest back and tallest
      var n = ART.length;
      var placed = ART.map(function (a, k) {
        if (a.crate) return { a: a, x: +a.crate.x || 0, w: +a.crate.width, h: +a.crate.height, back: +a.crate.back || 0 };
        var back = n > 1 ? 1.2 - 0.85 * k / (n - 1) : 0.6;
        var h = 88 + 14 * back, w = h * a.aspect;
        if (w > binW - 16) { w = binW - 16; h = w / a.aspect; }
        var left = 8 + (binW - 16 - w) * (n > 1 ? (k % 2 ? 1 - k / (n - 1) / 2 : k / (n - 1)) : 0.5);
        return { a: a, x: left, w: w, h: h, back: back };
      }).sort(function (p, q) { return q.back - p.back; });
      // Opening the crate, they rise up out of it one after another
      placed.forEach(function (p, k) {
        var L = binL + p.x + DX * p.back, base = LINE - 6 + DY * p.back;
        var img = el('image', { href: p.a.src, x: L, y: base - p.h, width: p.w, height: p.h, preserveAspectRatio: 'xMidYMid slice', 'class': 'bs-print' }, body);
        img.style.setProperty('--k', k);
        img.style.setProperty('--n', n);
      });
      el('polygon', { points: pts([[binL + binW, binT], [binL + binW + deep[0], binT + deep[1]], [binL + binW + deep[0], LINE + deep[1]], [binL + binW, LINE]]), 'class': 'bs-line bs-crate-side' }, body);
      el('rect', { x: binL, y: binT, width: binW, height: binH, 'class': 'bs-line bs-crate-front' }, body);
      el('text', { x: binL + binW / 2, y: binT + binH / 2 + 5, 'class': 'bs-crate-label' }, body).textContent = o.labels.crate;
    }

    // A painting pressed in the art section opens large over the page, at up
    // to three quarters of the screen, with its caption; pressing anywhere
    // or Esc closes it
    var box = null;
    if (hasArt) {
      box = html('div', 'bs-lightbox', root);
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Painting');
      box.tabIndex = -1;
      box.hidden = true;
      var boxFig = html('figure', 'bs-lightbox-fig', box);
      var boxImg = html('img', '', boxFig);
      var boxCap = html('figcaption', '', boxFig);
      var boxTitle = html('span', 'bs-art-title', boxCap), boxBy = html('span', 'bs-art-by', boxCap);
      var lastFocus = null;
      var openPainting = function (a) {
        lastFocus = document.activeElement;
        boxImg.src = a.src;
        boxImg.alt = a.alt;
        boxImg.style.width = 'min(75vw, calc(75vh * ' + a.aspect.toFixed(3) + '))';
        boxTitle.textContent = a.title;
        boxBy.textContent = a.by;
        box.hidden = false;
        requestAnimationFrame(function () { box.classList.add('is-open'); });
        box.focus();
      };
      var closePainting = function () {
        box.classList.remove('is-open');
        setTimeout(function () { box.hidden = true; }, 200);
        if (lastFocus) lastFocus.focus();
      };
      ART.forEach(function (a) {
        a.img.tabIndex = 0;
        a.img.setAttribute('role', 'button');
        a.img.addEventListener('click', function () { openPainting(a); });
        a.img.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPainting(a); }
        });
      });
      box.addEventListener('click', closePainting);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !box.hidden) closePainting();
      });
    }

    // Hovering (or focusing) a book on the shelf pops it up and narrows the
    // list to just its line; pressing a book pins it that way until it's
    // pressed again or Esc. Hovering a line in the list pops its book out
    // too, but leaves the list as it is, so the line doesn't move out from
    // under the cursor. Hovering the crate opens the Art section above the
    // list (pressing pins it). A book and the art are never out at once:
    // whatever's under the cursor shows, a book over the art; otherwise
    // whatever's pinned, and pinning one unpins the other. While a book is
    // out, the crate blurs back; while the art is out, the books fade.
    var pinned = null, hovered = null, listHovered = null;
    var artPinned = false, artHover = false;
    function update() {
      var book = hovered !== null ? hovered : artHover ? null : pinned;
      var art = hovered === null && (artHover || artPinned);
      var shown = book;
      if (book === null && !art && listHovered !== null) book = listHovered;
      groups.forEach(function (g, j) {
        g.classList.toggle('is-picked', j === book);
        g.setAttribute('aria-pressed', j === pinned);
      });
      // the other lines in the list blur back, as the shelf's books fade
      reads.forEach(function (r, j) {
        r.classList.toggle('is-shown', shown === null || j === shown);
        r.classList.toggle('is-dimmed', shown === null && book !== null && j !== book);
      });
      list.hidden = art;
      root.classList.toggle('has-picked', book !== null);
      root.classList.toggle('has-art', art);
      if (crate) {
        artSection.classList.toggle('is-open', art);
        crate.classList.toggle('is-open', art);
        crate.setAttribute('aria-expanded', art);
        crate.setAttribute('aria-pressed', artPinned);
      }
    }
    function pin(i) {
      pinned = pinned === i ? null : i;
      if (pinned !== null) artPinned = false;
      hovered = null;
      artHover = false;
      update();
    }
    function pinArt() {
      artPinned = !artPinned;
      if (artPinned) pinned = null;
      // a press settles it: a tap on a touch screen never leaves, so the
      // hover it started would otherwise hang on
      hovered = null;
      artHover = false;
      update();
    }
    if (crate) {
      crate.addEventListener('mouseenter', function () { artHover = true; update(); });
      crate.addEventListener('focus', function () { artHover = true; update(); });
      crate.addEventListener('mouseleave', function () { artHover = false; update(); });
      crate.addEventListener('blur', function () { artHover = false; update(); });
      crate.addEventListener('click', pinArt);
      crate.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pinArt(); }
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      // Esc closes an open painting first
      if (artPinned && (!box || box.hidden)) { artPinned = false; update(); }
      if (pinned !== null) pin(pinned);
    });

    // The books can be put in a new order, by dragging them along the shelf
    // or their lines up and down the list (or with Shift and the arrow
    // keys), the list and the shelf following each other. A book the saved
    // order doesn't know yet, newly added, goes first, as the newest.
    var order = BOOKS.map(function (b, i) { return i; });
    if (o.reorder && o.storageKey) {
      try {
        var saved = JSON.parse(localStorage.getItem(o.storageKey)) || [];
        var known = saved.map(function (t) { return BOOKS.findIndex(function (b) { return b.title === t; }); })
          .filter(function (j, k, all) { return j >= 0 && all.indexOf(j) === k; });
        order = order.filter(function (j) { return known.indexOf(j) < 0; }).concat(known);
      } catch (e) {}
    }
    function titles() { return order.map(function (j) { return BOOKS[j].title; }); }
    // Slides each book to its place in the order, all but the one being dragged
    function place(skip) {
      var at = X0;
      order.forEach(function (j) {
        if (j !== skip) groups[j].style.transform = 'translate(' + at + 'px, 0)';
        at += widths[j] + GAP;
      });
    }
    // Stacks the books in order, each covering the side of the one before
    // it, and puts the list in the same order (with CSS rather than moving
    // the lines, so they don't replay their fade-in)
    function settle(changed) {
      place();
      order.forEach(function (j, k) {
        svg.insertBefore(groups[j], bookend);
        reads[j].style.order = k;
      });
      if (!changed) return;
      if (o.storageKey) {
        try { localStorage.setItem(o.storageKey, JSON.stringify(titles())); } catch (e) {}
      }
      if (typeof o.onReorder === 'function') o.onReorder(titles());
    }
    // On load they start in place, without sliding there
    svg.classList.add('is-loading');
    settle(false);
    svg.getBoundingClientRect();
    svg.classList.remove('is-loading');

    function same(a, b) { return a.join() === b.join(); }
    function nudge(i, by, then) {
      var k = order.indexOf(i) + by;
      if (k < 0 || k >= order.length) return;
      order.splice(order.indexOf(i), 1);
      order.splice(k, 0, i);
      settle(true);
      then.focus();
    }

    // Dragging a book along the shelf. A drag starts once the pointer has
    // moved a few pixels, so a press still picks the book. The drag is
    // followed across the whole page rather than captured by the book:
    // raising the book over the others moves it in the drawing, which would
    // drop a capture.
    var drag = null, dragged = false;
    // Where a book at x would go among the others: past each one it has
    // been dragged a fifth of the way over, going either way
    function slotFor(i, x, right) {
      var f = right ? GIVE : 1 - GIVE;
      var others = order.filter(function (j) { return j !== i; });
      var at = X0, k = 0;
      others.forEach(function (j) {
        if (x > at + (widths[j] + GAP) * f) k++;
        at += widths[j] + GAP;
      });
      others.splice(k, 0, i);
      return others;
    }
    function startDrag(i, e) {
      drag = { i: i, x0: e.clientX, from: order.slice(), moving: false,
        home: X0 + order.slice(0, order.indexOf(i)).reduce(function (s, j) { return s + widths[j] + GAP; }, 0) };
    }
    function moveDrag(e) {
      var i = drag.i, g = groups[i];
      var dx = (e.clientX - drag.x0) * W / svg.getBoundingClientRect().width;
      if (!drag.moving) {
        if (Math.abs(e.clientX - drag.x0) < 4) return;
        drag.moving = true;
        g.classList.add('is-dragging');
        document.documentElement.classList.add('bookshelf-dragging');
        // in front of everything on the shelf, the bookend and crate too,
        // until it's let go and settles back into the row
        svg.appendChild(g);
        hovered = i;
        update();
      }
      var end = X0 + widths.reduce(function (s, w) { return s + w + GAP; }, 0) - GAP;
      var x = Math.max(X0, Math.min(end - widths[i], drag.home + dx));
      g.style.transform = 'translate(' + x + 'px, 0)';
      order = slotFor(i, x, x > drag.home);
      place(i);
    }
    function endDrag(keep, e) {
      if (drag.moving) {
        groups[drag.i].classList.remove('is-dragging');
        document.documentElement.classList.remove('bookshelf-dragging');
        if (!keep) order = drag.from;
        settle(!same(order, drag.from));
        // the book stays up only if it's let go under the mouse; a finger
        // lifted off the screen leaves nothing hovering
        hovered = e.pointerType === 'mouse' && groups[drag.i].contains(e.target) ? drag.i : null;
        update();
        // the press that ends a drag doesn't also pick the book
        dragged = true;
        setTimeout(function () { dragged = false; }, 0);
      }
      drag = null;
    }

    // Dragging a line up or down the list: it follows the pointer, the
    // others slide aside, and the books on the shelf move along with it. On
    // a touch screen a line is held a moment before it comes loose, so a
    // swipe still scrolls the page.
    var sort = null;
    function startSort(i, e) {
      sort = { i: i, x0: e.clientX, y0: e.clientY, dy: 0, from: order.slice(), moving: false,
        touch: e.pointerType !== 'mouse',
        rects: order.map(function (j) { return reads[j].getBoundingClientRect(); }) };
      if (sort.touch) sort.timer = setTimeout(function () { if (sort) beginSort(); }, 250);
    }
    function beginSort() {
      sort.moving = true;
      reads[sort.i].classList.add('is-sorting');
      readList.classList.add('is-sorting');
      // its book on the shelf comes up out of the row and is carried over
      // the others to its new place, in front of everything
      groups[sort.i].classList.add('is-carried');
      svg.appendChild(groups[sort.i]);
      document.documentElement.classList.add('bookshelf-dragging');
      try { window.getSelection().removeAllRanges(); } catch (e) {}
      listHovered = sort.i;
      update();
    }
    function moveSort(e) {
      var dy = e.clientY - sort.y0;
      if (!sort.moving) {
        if (Math.abs(dy) < 4 && Math.abs(e.clientX - sort.x0) < 4) return;
        // a finger that moves before it's been held is scrolling
        if (sort.touch) { clearTimeout(sort.timer); sort = null; return; }
        beginSort();
      }
      var i = sort.i, from = sort.from, rects = sort.rects, n = from.length, p = from.indexOf(i);
      dy = Math.max(rects[0].top - rects[p].top, Math.min(rects[n - 1].bottom - rects[p].bottom, dy));
      sort.dy = dy;
      reads[i].style.transform = 'translateY(' + dy + 'px)';
      // past each other line it has been dragged a fifth of the way over
      var top = rects[p].top + dy, bottom = rects[p].bottom + dy, k = 0;
      from.forEach(function (j, q) {
        if (j === i) return;
        var r = rects[q];
        if (dy > 0 ? bottom > r.top + r.height * GIVE : top > r.bottom - r.height * GIVE) k++;
      });
      order = from.filter(function (j) { return j !== i; });
      order.splice(k, 0, i);
      // the others slide to their new places
      var gap = n > 1 ? rects[1].top - rects[0].bottom : 0, at = rects[0].top;
      order.forEach(function (j) {
        var r = rects[from.indexOf(j)];
        if (j !== i) reads[j].style.transform = 'translateY(' + (at - r.top) + 'px)';
        at += r.height + gap;
      });
      place();
    }
    function endSort(keep, e) {
      clearTimeout(sort.timer);
      if (sort.moving) {
        var i = sort.i, p = sort.from.indexOf(i), was = sort.rects[p].top + sort.dy;
        reads[i].classList.remove('is-sorting');
        readList.classList.remove('is-sorting');
        groups[i].classList.remove('is-carried');
        document.documentElement.classList.remove('bookshelf-dragging');
        if (!keep) order = sort.from;
        // Put the lines in their new order at once, then let the dropped one
        // glide the last bit from where it was let go into its place
        readList.classList.add('no-slide');
        reads.forEach(function (r) { r.style.transform = ''; });
        settle(!same(order, sort.from));
        reads[i].style.transform = 'translateY(' + (was - reads[i].getBoundingClientRect().top) + 'px)';
        reads[i].getBoundingClientRect();
        readList.classList.remove('no-slide');
        reads[i].style.transform = '';
        listHovered = e.pointerType === 'mouse' && reads[i].contains(e.target) ? i : null;
        update();
      }
      sort = null;
    }

    if (o.reorder) {
      document.addEventListener('pointermove', function (e) {
        if (drag) moveDrag(e);
        if (sort) moveSort(e);
      });
      document.addEventListener('pointerup', function (e) {
        if (drag) endDrag(true, e);
        if (sort) endSort(true, e);
      });
      document.addEventListener('pointercancel', function (e) {
        if (drag) endDrag(false, e);
        if (sort) endSort(false, e);
      });
      // once a line is loose, a finger moving it doesn't scroll the page
      document.addEventListener('touchmove', function (e) { if (sort && sort.moving) e.preventDefault(); }, { passive: false });
    }
    // the covers aren't dragged off as pictures
    readList.addEventListener('dragstart', function (e) { e.preventDefault(); });

    reads.forEach(function (r, j) {
      function on() { if (!drag && !sort) { listHovered = j; update(); } }
      function off() { if (!sort && listHovered === j) { listHovered = null; update(); } }
      r.addEventListener('mouseenter', on);
      r.addEventListener('focus', on);
      r.addEventListener('mouseleave', off);
      r.addEventListener('blur', off);
      if (!o.reorder) return;
      r.addEventListener('pointerdown', function (e) { if (e.button === 0 && !drag) startSort(j, e); });
      r.addEventListener('keydown', function (e) {
        if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          nudge(j, e.key === 'ArrowUp' ? -1 : 1, r);
        }
      });
    });

    groups.forEach(function (g, i) {
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', BOOKS[i].title + (BOOKS[i].author ? ', ' + BOOKS[i].author : ''));
      g.setAttribute('aria-controls', list.id);
      g.addEventListener('mouseenter', function () { if (!drag) { hovered = i; update(); } });
      g.addEventListener('focus', function () { if (!drag) { hovered = i; update(); } });
      g.addEventListener('mouseleave', function () { if (!drag) { hovered = null; update(); } });
      g.addEventListener('blur', function () { if (!drag) { hovered = null; update(); } });
      g.addEventListener('click', function () { if (!dragged) pin(i); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pin(i); }
        if (o.reorder && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          nudge(i, e.key === 'ArrowLeft' ? -1 : 1, g);
        }
      });
      if (o.reorder) {
        g.setAttribute('aria-roledescription', 'draggable book');
        g.addEventListener('pointerdown', function (e) { if (e.button === 0 && !sort) startDrag(i, e); });
      }
    });

    update();

    return {
      // The books' titles in the order they stand on the shelf
      order: titles
    };
  }

  global.Bookshelf = { mount: mount };
})(window);
