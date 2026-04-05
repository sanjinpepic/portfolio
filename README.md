# Sanjin Pepić — Personal Portfolio

Welcome! This repository contains my personal portfolio website, built with vanilla HTML, CSS, and JavaScript and styled as a retro desktop experience.

## About Me

I’m **Sanjin Pepić**, a strategy and business analyst focused on analytics, growth, and transformation.

- **Current role:** Head of Strategy Development at Erasteel
- **Background:** Strategy, data analytics, product, and transformation work across energy, fintech, and industrial sectors
- **Interests:** Product strategy, business intelligence, and data-driven decision-making

## Portfolio Highlights

The site includes:

- **About** window with a short introduction
- **Projects** window featuring selected work
- **Browser**-style window for interactive exploration
- **Resume** window with my CV details
- **Contact** window with ways to reach me

## Standalone Window Architecture

Each desktop app/window partial is authored as its own standalone file in `windows/` so it is easy to maintain and edit independently.

To produce a fully bundled `index.html` (with all window markup embedded), run:

```bash
node scripts/build-index.mjs
```

This replaces each `<!-- START:inline ... -->` block in `index.html` with the latest contents from the matching standalone file.

## Updating the Winamp YouTube Playlist

The Winamp TV channel list is editable via:

`assets/winamp-playlist.txt`

- Put **one YouTube URL per line** (or a plain 11-character video ID).
- To set your own label in the channel list, use:
  - `<url_or_id> | My Custom Title`
- Remove any line to remove that channel.
- Lines beginning with `#` are treated as comments.

When the page loads, Winamp reads this file and builds the channel lineup automatically.

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript

## Run Locally

Because this is a static site, you can open `index.html` directly in a browser.

For a smoother local experience, serve it with a local server:

```bash
python3 -m http.server 8000
```

Then open: <http://localhost:8000>

## Contact

- Email: `sanjin@pepic.me`
- LinkedIn: `in/sanjin-pepic`

---

Thanks for visiting my portfolio.
