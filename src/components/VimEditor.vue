<script setup lang="ts">
import { defaultKeymap, history, historyKeymap, indentLess } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorSelection, EditorState, type EditorState as CodeMirrorState, type Extension } from '@codemirror/state'
import { drawSelection, EditorView, highlightSpecialChars, keymap, lineNumbers } from '@codemirror/view'
import { Vim, vim, getCM } from '@replit/codemirror-vim'
import { tags } from '@lezer/highlight'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { shouldLoadMarkdownLanguage, shouldReconfigureLanguage } from '../editorLanguage'
import type { EditorStatus, VimMapping, VimPreferences } from '../types'
import { attachVimOptionController, registerVimOptionBridge, type VimOptionController } from '../vimBridge'

const props = defineProps<{
  modelValue: string
  sourceValue: string
  preferences: VimPreferences
  mappings: VimMapping[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'preferences-change': [value: VimPreferences]
  status: [value: EditorStatus]
}>()

const viewControllers = new WeakMap<EditorView, VimOptionController>()

registerVimOptionBridge()

const host = ref<HTMLElement>()
const lineNumberCompartment = new Compartment()
const wrappingCompartment = new Compartment()
const tabSizeCompartment = new Compartment()
const indentationCompartment = new Compartment()
const languageCompartment = new Compartment()
const highlightingCompartment = new Compartment()
let editor: EditorView | undefined
let editorController: VimOptionController | undefined
let appliedMappings: VimMapping[] = []
let runtimePreferences: VimPreferences = { ...props.preferences }

const learningVimHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: '#ff916b', fontWeight: '700' },
  { tag: tags.strong, color: '#f3c776', fontWeight: '700' },
  { tag: tags.emphasis, color: '#b6d9d5', fontStyle: 'italic' },
  { tag: [tags.link, tags.url], color: '#79c7c1', textDecoration: 'underline' },
  { tag: tags.monospace, color: '#f0a985' },
  { tag: tags.quote, color: '#9db3c2', fontStyle: 'italic' },
  { tag: tags.contentSeparator, color: '#6e8799' },
])

function reportStatus(state: CodeMirrorState) {
  emit('status', {
    cursorLine: state.doc.lineAt(state.selection.main.head).number,
    totalLines: state.doc.lines,
    dirty: state.doc.toString() !== props.sourceValue,
  })
}

function lineNumberExtension(preferences: VimPreferences): Extension {
  if (!preferences.lineNumbers) return []
  return lineNumbers({
    formatNumber(lineNumber, state) {
      if (!runtimePreferences.relativeLineNumbers) return String(lineNumber)
      const cursorLine = state.doc.lineAt(state.selection.main.head).number
      return String(lineNumber === cursorLine ? lineNumber : Math.abs(lineNumber - cursorLine))
    },
  })
}

function indentationExtension(preferences: VimPreferences): Extension {
  return indentUnit.of(preferences.expandTab ? ' '.repeat(preferences.shiftWidth) : '\t')
}

function languageExtension(preferences: VimPreferences): Extension {
  return shouldLoadMarkdownLanguage(preferences) ? markdown() : []
}

function highlightingExtension(preferences: VimPreferences): Extension {
  return preferences.syntaxHighlighting ? syntaxHighlighting(learningVimHighlightStyle) : []
}

function applyEditorPreferences(changed?: Set<keyof VimPreferences>) {
  if (!editor) return
  const includes = (...keys: (keyof VimPreferences)[]) => !changed || keys.some((key) => changed.has(key))
  const effects = []

  if (includes('lineNumbers', 'relativeLineNumbers')) {
    effects.push(lineNumberCompartment.reconfigure(lineNumberExtension(runtimePreferences)))
  }
  if (includes('lineWrapping')) {
    effects.push(wrappingCompartment.reconfigure(runtimePreferences.lineWrapping ? EditorView.lineWrapping : []))
  }
  if (includes('tabSize')) {
    effects.push(tabSizeCompartment.reconfigure(EditorState.tabSize.of(runtimePreferences.tabSize)))
  }
  if (includes('shiftWidth', 'expandTab')) {
    effects.push(indentationCompartment.reconfigure(indentationExtension(runtimePreferences)))
  }
  if (shouldReconfigureLanguage(changed)) {
    effects.push(languageCompartment.reconfigure(languageExtension(runtimePreferences)))
  }
  if (includes('syntaxHighlighting')) {
    effects.push(highlightingCompartment.reconfigure(highlightingExtension(runtimePreferences)))
  }
  if (effects.length) editor.dispatch({ effects })
  editor.dom.classList.toggle('vim-no-hlsearch', !runtimePreferences.highlightSearch)
}

function updateRuntimePreferences(patch: Partial<VimPreferences>) {
  runtimePreferences = { ...runtimePreferences, ...patch }
  if (editorController) editorController.preferences = runtimePreferences
  applyEditorPreferences(new Set(Object.keys(patch) as (keyof VimPreferences)[]))
  emit('preferences-change', { ...runtimePreferences })
}

function insertTab(view: EditorView) {
  const controller = viewControllers.get(view)
  const cm = getCM(view)
  if (!controller || !cm?.state.vim?.insertMode) return false

  const preferences = controller.preferences
  const transaction = view.state.changeByRange((range) => {
    const line = view.state.doc.lineAt(range.from)
    const column = range.from - line.from
    const width = preferences.softTabSize || preferences.tabSize
    const insert = preferences.expandTab ? ' '.repeat(width - (column % width)) : '\t'
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + insert.length),
    }
  })
  view.dispatch(transaction)
  return true
}

function clearMappings() {
  for (const mapping of appliedMappings) {
    try {
      Vim.unmap(mapping.lhs, mapping.mode)
    } catch {
      // A mapping may already have been removed by a previous editor instance.
    }
  }
  appliedMappings = []
}

function applyMappings() {
  clearMappings()
  for (const mapping of props.mappings) {
    if (mapping.unmap) Vim.unmap(mapping.lhs, mapping.mode)
    else if (mapping.noremap) Vim.noremap(mapping.lhs, mapping.rhs, mapping.mode)
    else Vim.map(mapping.lhs, mapping.rhs, mapping.mode)
  }
  appliedMappings = props.mappings.filter((mapping) => !mapping.unmap)
}

function createEditor() {
  if (!host.value) return
  editor?.destroy()
  applyMappings()
  runtimePreferences = { ...props.preferences }

  editor = new EditorView({
    parent: host.value,
    doc: props.modelValue,
    extensions: [
      vim({ status: true }),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      EditorState.allowMultipleSelections.of(true),
      keymap.of([
        { key: 'Tab', run: insertTab },
        {
          key: 'Shift-Tab',
          run(view) {
            const cm = getCM(view)
            return Boolean(cm?.state.vim?.insertMode) && indentLess(view)
          },
        },
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      lineNumberCompartment.of(lineNumberExtension(runtimePreferences)),
      wrappingCompartment.of(runtimePreferences.lineWrapping ? EditorView.lineWrapping : []),
      tabSizeCompartment.of(EditorState.tabSize.of(runtimePreferences.tabSize)),
      indentationCompartment.of(indentationExtension(runtimePreferences)),
      languageCompartment.of(languageExtension(runtimePreferences)),
      highlightingCompartment.of(highlightingExtension(runtimePreferences)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
        if (update.docChanged || update.selectionSet) reportStatus(update.state)
      }),
    ],
  })

  const cm = getCM(editor)
  editorController = { preferences: runtimePreferences, update: updateRuntimePreferences }
  viewControllers.set(editor, editorController)
  if (cm) attachVimOptionController(cm, editorController)
  editor.dom.classList.toggle('vim-no-hlsearch', !runtimePreferences.highlightSearch)
  reportStatus(editor.state)
  editor.focus()
}

onMounted(createEditor)
onBeforeUnmount(() => {
  clearMappings()
  editor?.destroy()
})

watch(
  () => props.preferences,
  (preferences) => {
    if (Object.keys(preferences).every((key) => preferences[key as keyof VimPreferences] === runtimePreferences[key as keyof VimPreferences])) return
    runtimePreferences = { ...preferences }
    if (editorController) editorController.preferences = runtimePreferences
    applyEditorPreferences()
  },
  { deep: true },
)

watch(() => props.mappings, applyMappings, { deep: true })

watch(
  () => props.modelValue,
  (value) => {
    if (!editor || editor.state.doc.toString() === value) return
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
  },
)
</script>

<template>
  <div ref="host" class="editor-host" aria-label="Vim practice editor" />
</template>
