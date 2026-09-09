<script setup lang="ts">
import { basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { Vim, vim } from '@replit/codemirror-vim'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { VimMapping, VimPreferences } from '../types'

const props = defineProps<{
  modelValue: string
  preferences: VimPreferences
  mappings: VimMapping[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const host = ref<HTMLElement>()
let editor: EditorView | undefined
let appliedMappings: VimMapping[] = []

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
    if (mapping.unmap) {
      Vim.unmap(mapping.lhs, mapping.mode)
    } else Vim.map(mapping.lhs, mapping.rhs, mapping.mode)
  }
  appliedMappings = props.mappings.filter((mapping) => !mapping.unmap)
}

function createEditor() {
  if (!host.value) return
  editor?.destroy()
  applyMappings()

  const extensions = [
    vim({ status: true }),
    basicSetup,
    EditorState.tabSize.of(props.preferences.tabSize),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
    }),
  ]

  if (props.preferences.lineNumbers) {
    extensions.push(
      lineNumbers({
        formatNumber(lineNumber, state) {
          if (!props.preferences.relativeLineNumbers) return String(lineNumber)
          const cursorLine = state.doc.lineAt(state.selection.main.head).number
          return String(lineNumber === cursorLine ? lineNumber : Math.abs(lineNumber - cursorLine))
        },
      }),
    )
  }
  if (props.preferences.lineWrapping) extensions.push(EditorView.lineWrapping)

  editor = new EditorView({
    parent: host.value,
    doc: props.modelValue,
    extensions,
  })
  editor.focus()
}

onMounted(createEditor)
onBeforeUnmount(() => {
  clearMappings()
  editor?.destroy()
})

watch(
  () => [props.preferences, props.mappings],
  createEditor,
  { deep: true },
)

watch(
  () => props.modelValue,
  (value) => {
    if (!editor || editor.state.doc.toString() === value) return
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
    })
  },
)
</script>

<template>
  <div ref="host" class="editor-host" aria-label="Vim practice editor" />
</template>
