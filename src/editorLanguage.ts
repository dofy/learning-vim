import type { VimPreferences } from './types'

export function shouldLoadMarkdownLanguage(
  preferences: Pick<VimPreferences, 'filetypeDetection' | 'syntaxHighlighting'>,
) {
  // Every lesson buffer is a Markdown document. `syntax on` must therefore be
  // sufficient to load the known language parser, even without `filetype on`.
  return preferences.filetypeDetection || preferences.syntaxHighlighting
}

export function shouldReconfigureLanguage(changed?: Set<keyof VimPreferences>) {
  return !changed || changed.has('filetypeDetection') || changed.has('syntaxHighlighting')
}
