import type { CourseFileLanguage, VimPreferences } from './types'

export function shouldLoadLanguage(
  preferences: Pick<VimPreferences, 'filetypeDetection' | 'syntaxHighlighting'>,
) {
  // The file name already tells the course which parser to use. `syntax on`
  // must be sufficient even when `filetype on` has not been entered yet.
  return preferences.filetypeDetection || preferences.syntaxHighlighting
}

export const shouldLoadMarkdownLanguage = shouldLoadLanguage


export function languageNeedsParser(
  language: CourseFileLanguage,
  preferences: Pick<VimPreferences, 'filetypeDetection' | 'syntaxHighlighting'>,
) {
  return language !== 'vim' && shouldLoadLanguage(preferences)
}

export function shouldReconfigureLanguage(changed?: Set<keyof VimPreferences>) {
  return !changed || changed.has('filetypeDetection') || changed.has('syntaxHighlighting')
}
