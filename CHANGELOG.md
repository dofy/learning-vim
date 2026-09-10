# Changelog

## 2.2.1 - 2026-09-10

- Run the existing unit suite before verification and production deployment.
- Mark chapters whose file, window, or multi-buffer commands require desktop Vim.
- Prevent stale lesson requests from replacing the currently selected lesson.
- Improve dialog keyboard focus and stop the editor from stealing initial focus.
- Load the practice editor only when the active layout needs it.
- Align the mobile, engine-boundary, and version documentation with the shipped app.

## 2.2.0 - 2026-09-10

- Add localized course-file workspaces for lesson source, Vim config, and exercises.
- Support `gf` course-file navigation and applying the bundled `vimrc.vim`.
- Add clipboard feedback, Vim config reset, and previous/next lesson controls.
- Improve the tablet Read / Practice workspace and responsive pane layout.

## 1.0.2 - 2026-09-09

- Refresh the displayed application version for the production release.

## 1.0.1 - 2026-09-09

- Update the displayed application version for the first post-MVP release.
- Improve README wordmark contrast for GitHub's dark theme.

## 1.0.0 - 2026-09-09

- Ship the multilingual course as an installable, offline static PWA.
- Add a Vim-style CodeMirror editor with Markdown syntax highlighting.
- Support lesson-four Vim options from `.vimrc` and live Ex commands, including
  line numbers, search highlighting, indentation, tabs, filetype, and syntax.
- Support recursive and non-recursive mappings.
- Add chapter deep links, previous/next controls, cursor position, and buffer status.
- Persist progress and edited buffers locally with JSON backup and restore.
- Build against the latest `dofy/learn-vim` content on a daily deployment schedule.
- Record the upstream revision for deterministic course builds and PWA updates.
