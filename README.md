# Learning Vim

An interactive, offline-friendly web companion for
[`dofy/learn-vim`](https://github.com/dofy/learn-vim).

Production domain: <https://learning-vim.phpz.org/>

## MVP

- Reads all 11 chapters from the sibling `learn-vim` content repository.
- Switches between English, Simplified Chinese, and Japanese.
- Opens the lesson source in a CodeMirror editor with Vim keybindings.
- Saves edited buffers, lesson progress, language, and Vim preferences locally.
- Parses a safe subset of `.vimrc`: `set` options and map/unmap commands.
- Generates an installable PWA that precaches the course for offline use.

This MVP uses Vim-compatible keybindings, not a complete Vim runtime. Files,
windows, external commands, and plugins are planned behind a replaceable editor
engine boundary.

## Development

Place this repository next to `learn-vim`, then run:

```bash
pnpm install
pnpm dev
```

To use another content checkout:

```bash
LEARN_VIM_CONTENT_DIR=/path/to/learn-vim pnpm dev
```

## Build

```bash
pnpm build
pnpm preview
```
