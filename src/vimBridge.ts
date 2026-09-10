import { CodeMirror, Vim, type CodeMirrorV } from '@replit/codemirror-vim'
import { courseFileAtCursor } from './courseFile'
import type { VimPreferences } from './types'
import { defaultPreferences } from './vimrc'

export interface VimOptionController {
  preferences: VimPreferences
  update: (patch: Partial<VimPreferences>) => void
  openCourseFile?: (fileName: string) => void
  sourceCurrentFile?: (fileName?: string) => void
}

const controllers = new WeakMap<object, VimOptionController>()
let registered = false

function normalizeWidth(value: number, minimum = 1) {
  const width = Math.round(Number(value))
  return Number.isFinite(width) ? Math.min(16, Math.max(minimum, width)) : minimum
}

function controllerFor(cm?: object) {
  return cm ? controllers.get(cm) : undefined
}

function defineBooleanOption(name: string, key: keyof VimPreferences, aliases: string[] = []) {
  Vim.defineOption(name, defaultPreferences[key] as boolean, 'boolean', aliases, (value, cm) => {
    const controller = controllerFor(cm)
    if (!controller) return defaultPreferences[key]
    if (value === undefined) return controller.preferences[key]
    controller.update({ [key]: value } as Partial<VimPreferences>)
    return value
  })
}

function defineNumberOption(name: string, key: keyof VimPreferences, aliases: string[] = [], minimum = 1) {
  Vim.defineOption(name, defaultPreferences[key] as number, 'number', aliases, (value, cm) => {
    const controller = controllerFor(cm)
    if (!controller) return defaultPreferences[key]
    if (value === undefined) return controller.preferences[key]
    const width = normalizeWidth(value, minimum)
    controller.update({ [key]: width } as Partial<VimPreferences>)
    return width
  })
}

function updateExBoolean(cm: CodeMirrorV, value: string, key: keyof VimPreferences) {
  if (value === 'on' || value === 'enable' || value === 'off') {
    controllerFor(cm)?.update({ [key]: value !== 'off' } as Partial<VimPreferences>)
  }
}

export function registerVimOptionBridge() {
  if (registered) return
  registered = true

  defineBooleanOption('number', 'lineNumbers', ['nu'])
  defineBooleanOption('relativenumber', 'relativeLineNumbers', ['rnu'])
  defineBooleanOption('wrap', 'lineWrapping')
  defineBooleanOption('hlsearch', 'highlightSearch', ['hls'])
  defineBooleanOption('autoindent', 'autoIndent', ['ai'])
  defineBooleanOption('smartindent', 'smartIndent', ['si'])
  defineBooleanOption('expandtab', 'expandTab', ['et'])
  defineNumberOption('tabstop', 'tabSize', ['ts'])
  defineNumberOption('softtabstop', 'softTabSize', ['sts'], 0)
  defineNumberOption('shiftwidth', 'shiftWidth', ['sw'])

  Vim.defineAction('openCourseFile', (cm) => {
    const cursor = cm.getCursor()
    const fileName = courseFileAtCursor(cm.getLine(cursor.line), cursor.ch)
    if (fileName) controllerFor(cm)?.openCourseFile?.(fileName)
  })
  Vim.mapCommand('gf', 'action', 'openCourseFile', {}, {})

  // codemirror-vim's default indentAuto adapter drops the motion range and
  // therefore makes commands such as =% and gg=G indent only the cursor line.
  Vim.defineOperator('indentAuto', (cm, _args, ranges) => {
    cm.setSelections(ranges)
    CodeMirror.commands.indentAuto(cm)
    return ranges[0].anchor
  })

  Vim.defineEx('source', 'so', (cm, params) => {
    const fileName = params.argString.trim()
    controllerFor(cm)?.sourceCurrentFile?.(fileName === '%' ? undefined : fileName)
  })

  Vim.defineEx('syntax', 'sy', (cm, params) => {
    updateExBoolean(cm, params.argString.trim(), 'syntaxHighlighting')
  })
  Vim.defineEx('filetype', 'filet', (cm, params) => {
    updateExBoolean(cm, params.argString.trim(), 'filetypeDetection')
  })

  const newlineAndIndent = CodeMirror.commands.newlineAndIndent
  CodeMirror.commands.newlineAndIndent = (cm) => {
    const preferences = controllerFor(cm)?.preferences
    if (!preferences || (preferences.autoIndent && preferences.smartIndent)) {
      newlineAndIndent(cm)
      return
    }

    const cursor = cm.getCursor()
    const indentation = preferences.autoIndent
      ? cm.getLine(cursor.line).match(/^\s*/)?.[0] ?? ''
      : ''
    cm.replaceSelection(`\n${indentation}`)
  }
}

export function attachVimOptionController(cm: object, controller: VimOptionController) {
  controllers.set(cm, controller)
}
