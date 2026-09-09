export type Locale = 'en' | 'zh-CN' | 'ja'

export interface Lesson {
  id: string
  titles: Record<Locale, string>
  files: Record<Locale, string>
}

export interface CourseManifest {
  schemaVersion: number
  generatedAt: string
  source: string
  sourceRevision?: string
  locales: Locale[]
  lessons: Lesson[]
}

export interface VimPreferences {
  lineNumbers: boolean
  relativeLineNumbers: boolean
  lineWrapping: boolean
  highlightSearch: boolean
  autoIndent: boolean
  smartIndent: boolean
  tabSize: number
  softTabSize: number
  shiftWidth: number
  expandTab: boolean
  filetypeDetection: boolean
  syntaxHighlighting: boolean
}

export interface VimMapping {
  lhs: string
  rhs: string
  mode: 'normal' | 'insert' | 'visual'
  unmap?: boolean
  noremap?: boolean
}

export interface EditorStatus {
  cursorLine: number
  totalLines: number
  dirty: boolean
}
