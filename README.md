# Learning Vim

<p align="center">
  <img src="public/learning-vim-logo.svg" alt="learning vim" width="560">
</p>

**Read the lesson. Put your hands on the keys. Learn Vim without leaving the page.**

[![Verify](https://github.com/dofy/learning-vim/actions/workflows/verify.yml/badge.svg)](https://github.com/dofy/learning-vim/actions/workflows/verify.yml)
[![Course languages](https://img.shields.io/badge/course-3%20languages-17324d)](https://learning-vim.phpz.org/)
[![PWA](https://img.shields.io/badge/PWA-offline--ready-e5663a)](https://learning-vim.phpz.org/)

Learning Vim turns the hands-on lessons from
[`dofy/learn-vim`](https://github.com/dofy/learn-vim) into an interactive web
course. The explanation stays beside a working Vim-style editor, so every
motion, edit, search, macro, text object, and register can move immediately from
something you read to something you do.

🌐 **Website:** [learning-vim.phpz.org](https://learning-vim.phpz.org/)

![Learning Vim course and practice workspace](docs/images/learning-vim-workspace.png)

## Learn with both eyes and hands

Most Vim tutorials make you memorize commands in one window and practice them
somewhere else. Learning Vim keeps the whole loop in one focused workspace:

- 🧭 Follow all 11 chapters from a compact course map.
- 📖 Read the original lesson in English, Simplified Chinese, or Japanese.
- ⌨️ Practice directly on a copy of the lesson with Vim keybindings.
- 🎛️ Hide the course map or lesson and give the editor more room.
- 💾 Keep edited buffers, language, progress, and preferences on the device.
- 📦 Export and import learning data when moving to another browser.
- 📴 Install the site as a PWA and keep the course available offline.
- ⚙️ Load a safe `.vimrc` subset for mappings and common editor options.

The layout is built for uninterrupted practice: the header and footer stay in
place while the course map, lesson, and editor scroll independently. On smaller
screens, the same workspace becomes a clean Read / Practice switcher.

## Course content stays independent

This website and the course are deliberately separate projects:

```text
dofy/learn-vim                   dofy/learning-vim
Markdown course  ── sync ─────▶ interactive static PWA
```

`learn-vim` remains a plain Markdown tutorial that can be cloned and opened in
Vim. `learning-vim` copies a versioned course snapshot during the build, checks
the three locale structures, and packages the content for static hosting and
offline use. The web app never becomes a second source of truth.

## Run it locally

Place both repositories next to each other:

```text
Seven/
├── learn-vim/
└── learning-vim/
```

Then start the web project:

```bash
pnpm install
pnpm dev
```

Open <http://localhost:5173/>. To use another content checkout:

```bash
LEARN_VIM_CONTENT_DIR=/path/to/learn-vim pnpm dev
```

Create and inspect the production build with:

```bash
pnpm build
pnpm preview
```

## What version 1 supports

The current editor uses CodeMirror 6 with `@replit/codemirror-vim`. It covers
the everyday Vim motions and editing workflow used throughout the course.
Lessons have stable deep links, previous/next navigation, cursor and buffer
status, local autosave, and portable learning-data backups. The `.vimrc` parser
intentionally supports a safe subset:

- `syntax on` / `syntax off` for Markdown highlighting
- `filetype on` / `filetype off` for Markdown detection
- `set number`, `relativenumber`, `hlsearch`, `wrap`, `autoindent`, and
  `smartindent`
- `set tabstop`, `softtabstop`, `shiftwidth`, and `expandtab`
- `map`, `noremap`, `nmap`, `nnoremap`, `imap`, `inoremap`, `vmap`, and their
  matching `unmap` commands
- `let mapleader = "..."`

These options work both when loaded from the Vim config panel and when entered
as Ex commands in the practice editor. Runtime settings stay active while
moving between lessons; add them to the config panel to keep them after reload.

The application remains a static PWA: no account, database, or server is needed.
A scheduled production build checks out the newest `dofy/learn-vim` course
every day, while every application change passes the same build in CI. Pushes
to `main`, scheduled content refreshes, and manual workflow runs deploy the
verified `dist` output to the existing Cloudflare Pages project. The workflow
uses repository secrets named `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`; the token only needs Cloudflare Pages edit access.

The generated site includes `public/CNAME` for `learning-vim.phpz.org`.

## Engine boundary

Version 1 deliberately uses the maintained CodeMirror Vim engine. The available
Vim WebAssembly port is still experimental, depends on browser shared-memory
features, and embeds an older Vim runtime. Real buffers and windows, external
shell commands, arbitrary Vimscript, and plugins therefore remain outside the
stable editor. The editor component is isolated so a production-ready Vim/Wasm
engine can replace it later without rewriting the course interface.

## Next on the voyage

- Optional real Vim / WebAssembly lab when browser support is dependable
- Structured exercises published alongside the source lessons
- More language parsers for future non-Markdown practice files
- Optional account-based sync without removing local-first usage

Course content comes from [`dofy/learn-vim`](https://github.com/dofy/learn-vim).
The interactive web application is maintained by
[Seven Yu](https://github.com/dofy).
