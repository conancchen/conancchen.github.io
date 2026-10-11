# Bookshelf

Your recent reading, drawn as books on a shelf with a list underneath, plus an optional crate of art prints. Visitors can drag books to reorder them. No dependencies.

## Setup

```html
<link rel="stylesheet" href="bookshelf.css">
<div id="shelf"></div>
<script src="bookshelf.js"></script>
<script>
  Bookshelf.mount('#shelf', {
    coverBase: '/images/books/',
    books: [
      { title: 'Flash Boys', author: 'Michael Lewis', cover: 'flash-boys.jpg',
        color: '#ed1b2c', pages: 274, height: 171, current: true }
    ]
  });
</script>
```

## Options

**`books`**: only `title` is required.
`author`, `cover`, `color` (`#rrggbb`), `ink` (`'dark'`/`'light'`, otherwise picked from the color), `pages` (sets thickness), `height` (90–180), `current` (shows "currently reading"), `note`.

**`art`** (optional; leave it out for no crate):
`src`, `title`, `by`, `aspect` (width ÷ height), `row` (paintings in the same row come out the same height), `crate: { x, width, height, back }` (exact place in the crate; otherwise placed automatically).

**Other options:** `coverBase` and `artBase` (put in front of relative paths), `reorder` (default `true`), `storageKey` (where each visitor's order is saved; `null` to not save it), `onReorder(titles)`, and `labels: { reading, current, art, crate, shelf }`.

Visitors' reordering is saved only in their own browser. The order of `books` is the default everyone else sees.

## Theming

Set `--bs-*` variables on `.bookshelf`; see the top of `bookshelf.css` for the full list.

```css
.bookshelf { --bs-bg: #fffaf2; --bs-muted: #888; --bs-accent: #3787f0; }
```

## Jekyll

Pass the books in with `books: {{ site.data.books | jsonify }}`.

MIT License
