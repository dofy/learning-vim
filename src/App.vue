<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createBackup, parseBackup } from './backup'
import AppToast from './components/AppToast.vue'
import VimEditor from './components/VimEditor.vue'
import type { CourseFileLanguage, CourseFileRole, CourseManifest, EditorStatus, Locale } from './types'
import type { ClipboardResult } from './vimClipboard'
import { defaultPreferences, parseVimrc } from './vimrc'

const labels = {
  en: {
    course: 'Course map', lesson: 'Lesson', practice: 'Practice buffer', reset: 'Reset buffer',
    complete: 'Mark complete', completed: 'Completed', config: 'Vim config', apply: 'Apply config', resetConfig: 'Restore defaults',
    configHelp: 'Supports lesson options including line numbers, search highlighting, indentation, tabs, filetype, syntax, and mappings.',
    resetConfigHelp: 'Restores only Vim config. Progress and practice buffers are not changed.',
    source: 'Content synced from dofy/learn-vim', loading: 'Loading course…', update: 'A new version is ready.',
    reload: 'Reload', readMode: 'Read', editMode: 'Edit', error: 'Course could not be loaded.',
    showNav: 'Show course map', hideNav: 'Hide course map', showLesson: 'Show lesson', hideLesson: 'Hide lesson',
    contentBy: 'Course content', previous: 'Previous chapter', next: 'Next chapter',
    original: 'Course copy', modified: 'Saved locally', learningData: 'Learning data',
    dataHelp: 'Move progress and preferences between browsers without an account.',
    exportData: 'Export data', importData: 'Import data', invalidBackup: 'This backup could not be imported.',
    applyFileConfig: 'Apply this config', configApplied: 'Vim config applied', configReset: 'Default Vim config restored', clipboardCopied: 'Copied to system clipboard',
    clipboardBlocked: 'System clipboard permission was denied', closePreview: 'Close file preview',
    readOnlyPreview: 'Read-only file preview', sourceOnlyVimrc: 'This course can only source vimrc.vim or ~/.vimrc.',
  },
  'zh-CN': {
    course: '课程航线', lesson: '课程正文', practice: '练习缓冲区', reset: '重置缓冲区',
    complete: '标记完成', completed: '已完成', config: 'Vim 配置', apply: '应用配置', resetConfig: '恢复初始设置',
    configHelp: '支持课程中的行号、搜索高亮、缩进、Tab、filetype、syntax 和 map 系列配置。',
    resetConfigHelp: '只恢复 Vim 配置，不影响学习进度和练习内容。',
    source: '课程同步自 dofy/learn-vim', loading: '正在装载课程…', update: '新版本已准备好。',
    reload: '重新载入', readMode: '阅读', editMode: '编辑', error: '课程加载失败。',
    showNav: '显示导航', hideNav: '隐藏导航', showLesson: '显示正文', hideLesson: '隐藏正文',
    contentBy: '课程内容', previous: '上一章', next: '下一章',
    original: '课程原稿', modified: '已保存到本机', learningData: '学习数据',
    dataHelp: '无需账号，在不同浏览器之间迁移进度和偏好设置。',
    exportData: '导出数据', importData: '导入数据', invalidBackup: '无法导入这份备份。',
    applyFileConfig: '应用此配置', configApplied: 'Vim 配置已应用', configReset: '已恢复初始 Vim 配置', clipboardCopied: '已复制到系统剪贴板',
    clipboardBlocked: '浏览器未允许写入系统剪贴板', closePreview: '关闭文件预览',
    readOnlyPreview: '文件只读预览', sourceOnlyVimrc: '本课程仅支持 source vimrc.vim 或 ~/.vimrc。',
  },
  ja: {
    course: 'コースマップ', lesson: 'レッスン', practice: '練習バッファ', reset: 'バッファを戻す',
    complete: '完了にする', completed: '完了', config: 'Vim 設定', apply: '設定を適用', resetConfig: '初期設定に戻す',
    configHelp: '行番号、検索ハイライト、インデント、Tab、filetype、syntax、map 設定に対応します。',
    resetConfigHelp: 'Vim 設定だけを初期化します。進捗と練習内容は変更されません。',
    source: 'dofy/learn-vim から同期', loading: 'コースを読み込み中…', update: '新しい版があります。',
    reload: '再読み込み', readMode: '読む', editMode: '編集', error: 'コースを読み込めません。',
    showNav: 'ナビを表示', hideNav: 'ナビを隠す', showLesson: '本文を表示', hideLesson: '本文を隠す',
    contentBy: 'コース内容', previous: '前の章', next: '次の章',
    original: '教材の原文', modified: '端末に保存済み', learningData: '学習データ',
    dataHelp: 'アカウントなしで進捗と設定を別のブラウザへ移行できます。',
    exportData: 'データを書き出す', importData: 'データを読み込む', invalidBackup: 'バックアップを読み込めません。',
    applyFileConfig: 'この設定を適用', configApplied: 'Vim 設定を適用しました', configReset: 'Vim の初期設定に戻しました', clipboardCopied: 'システムのクリップボードにコピーしました',
    clipboardBlocked: 'システムのクリップボードへの書き込みが許可されていません', closePreview: 'ファイル表示を閉じる',
    readOnlyPreview: 'ファイルの読み取り専用表示', sourceOnlyVimrc: 'このコースでは vimrc.vim または ~/.vimrc のみ source できます。',
  },
} as const

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })
interface EditorFile {
  name: string
  language: CourseFileLanguage
  role?: CourseFileRole
  files: Record<Locale, string>
}
const renderLinkOpen = md.renderer.rules.link_open
md.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
  const token = tokens[index]
  const href = token.attrGet('href')
  const lessonMatch = typeof href === 'string' ? href.match(/^(chapter\d{2})\.md(?:#.*)?$/) : null
  if (lessonMatch?.[1]) {
    token.attrSet('href', lessonPath(locale.value, lessonMatch[1]))
    token.attrSet('data-lesson-id', lessonMatch[1])
    token.attrSet('data-course-file', `${lessonMatch[1]}.md`)
  } else if (href === 'vimrc.vim' || href === 'chapter04-demo.js') {
    token.attrSet('href', `/course/${locale.value}/${href}`)
    token.attrSet('data-course-file', href)
  }
  return renderLinkOpen
    ? renderLinkOpen(tokens, index, options, environment, renderer)
    : renderer.renderToken(tokens, index, options)
}
const manifest = ref<CourseManifest>()
const locale = ref<Locale>('zh-CN')
const lessonId = ref('chapter01')
const source = ref('')
const editorSource = ref('')
const buffer = ref('')
const activeFileName = ref('chapter01.md')
const loading = ref(true)
const error = ref('')
const completed = ref<Record<string, boolean>>({})
const initialVimrc = 'syntax on\nset number\nset tabstop=4\n" Try: inoremap jj <Esc>'
const vimrc = ref(initialVimrc)
const vimConfigOpen = ref(false)
const configWarnings = ref<string[]>([])
const workspaceMode = ref<'read' | 'edit'>('read')
const updateReady = ref(false)
const preferences = ref({ ...defaultPreferences })
const mappings = ref<ReturnType<typeof parseVimrc>['mappings']>([])
const installUpdate = ref<() => void>(() => window.location.reload())
const appVersion = __APP_VERSION__
const navVisible = ref(localStorage.getItem('learning-vim:nav-visible') !== 'false')
const lessonVisible = ref(localStorage.getItem('learning-vim:lesson-visible') !== 'false')
const phoneMediaQuery = window.matchMedia('(max-width: 720px)')
const narrowTabletMediaQuery = window.matchMedia('(min-width: 721px) and (max-width: 1050px)')
const touchTabletMediaQuery = window.matchMedia('(min-width: 721px) and (max-width: 1366px) and (pointer: coarse)')
const phoneViewport = ref(phoneMediaQuery.matches)
const tabletViewport = ref(narrowTabletMediaQuery.matches || touchTabletMediaQuery.matches)
const editorStatus = ref<EditorStatus>({ cursorLine: 1, totalLines: 1, dirty: false })
const importInput = ref<HTMLInputElement>()
const backupError = ref('')
const workspaceNotice = ref('')
const workspaceNoticeError = ref(false)
const previewFileName = ref('')
const previewSource = ref('')
const previewOpen = ref(false)
let workspaceNoticeTimer: number | undefined
let editorFileLoadId = 0

const t = computed(() => labels[locale.value])
const lessons = computed(() => manifest.value?.lessons ?? [])
const currentLesson = computed(() => lessons.value.find((lesson) => lesson.id === lessonId.value))
const editorFiles = computed<EditorFile[]>(() => {
  const lesson = currentLesson.value
  if (!lesson) return []
  return [
    { name: `${lesson.id}.md`, language: 'markdown' as CourseFileLanguage, files: lesson.files },
    ...(lesson.workspaceFiles ?? []),
  ]
})
const activeEditorFile = computed(() => editorFiles.value.find((file) => file.name === activeFileName.value) ?? editorFiles.value[0])
const showNav = computed(() => phoneViewport.value || navVisible.value)
const showLesson = computed(() => phoneViewport.value || tabletViewport.value || lessonVisible.value)
const currentLessonIndex = computed(() => lessons.value.findIndex((lesson) => lesson.id === lessonId.value))
const hasPreviousLesson = computed(() => currentLessonIndex.value > 0)
const hasNextLesson = computed(() => currentLessonIndex.value >= 0 && currentLessonIndex.value < lessons.value.length - 1)
const renderedLesson = computed(() => md.render(source.value))
const progress = computed(() => {
  if (!lessons.value.length) return 0
  const count = lessons.value.filter((lesson) => completed.value[lesson.id]).length
  return Math.round((count / lessons.value.length) * 100)
})
const editorPosition = computed(() => {
  const { cursorLine, totalLines } = editorStatus.value
  if (locale.value === 'zh-CN') return `第 ${cursorLine} 行 / 共 ${totalLines} 行`
  if (locale.value === 'ja') return `${cursorLine} / ${totalLines} 行目`
  return `Line ${cursorLine} of ${totalLines}`
})
const editorPositionCompact = computed(() => `${editorStatus.value.cursorLine}/${editorStatus.value.totalLines}`)

function storageKey(kind: string, fileName = activeFileName.value) {
  if (kind === 'buffer' && fileName !== `${lessonId.value}.md`) {
    return `learning-vim:${kind}:${locale.value}:${lessonId.value}:${fileName}`
  }
  return `learning-vim:${kind}:${locale.value}:${lessonId.value}`
}

function lessonPath(targetLocale: Locale, id: string) {
  return `/${targetLocale}/${id}/`
}

function routeFromLocation(): { locale: Locale; id: string } | undefined {
  const match = window.location.pathname.match(/^\/(en|zh-CN|ja)\/(chapter\d{2})\/?$/)
  if (match?.[1] && match[2]) return { locale: match[1] as Locale, id: match[2] }
  const legacyId = window.location.hash.slice(1)
  if (/^chapter\d{2}$/.test(legacyId)) return { locale: locale.value, id: legacyId }
}

function initialLocale(): Locale {
  const pathLocale = window.location.pathname.match(/^\/(en|zh-CN|ja)\//)?.[1] as Locale | undefined
  if (pathLocale) return pathLocale
  const saved = localStorage.getItem('learning-vim:locale') as Locale | null
  if (saved && ['en', 'zh-CN', 'ja'].includes(saved)) return saved
  const language = navigator.language.toLowerCase()
  if (language.startsWith('ja')) return 'ja'
  if (language.startsWith('zh')) return 'zh-CN'
  return 'en'
}

async function loadLesson() {
  const lesson = currentLesson.value
  if (!lesson) return
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`/course/${lesson.files[locale.value]}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    source.value = await response.text()
    const preferredFile = editorFiles.value.some((file) => file.name === activeFileName.value)
      ? activeFileName.value
      : `${lesson.id}.md`
    await loadEditorFile(preferredFile, preferredFile === `${lesson.id}.md` ? source.value : undefined)
    completed.value = readCompleted()
    document.documentElement.lang = locale.value
  } catch (reason) {
    error.value = `${t.value.error} ${String(reason)}`
  } finally {
    loading.value = false
  }
}

function chooseLesson(id: string, updateHistory = true) {
  if (!lessons.value.some((lesson) => lesson.id === id)) return
  if (id !== lessonId.value) activeFileName.value = `${id}.md`
  lessonId.value = id
  const path = lessonPath(locale.value, id)
  if (updateHistory && window.location.pathname !== path) {
    window.history.pushState(null, '', path)
  }
}

function navigateLesson(offset: -1 | 1) {
  const target = lessons.value[currentLessonIndex.value + offset]
  if (target) chooseLesson(target.id)
}

function syncLessonFromLocation() {
  const route = routeFromLocation()
  if (!route || !lessons.value.some((lesson) => lesson.id === route.id)) return
  locale.value = route.locale
  chooseLesson(route.id, false)
  const canonicalPath = lessonPath(route.locale, route.id)
  if (window.location.pathname !== canonicalPath || window.location.hash) {
    window.history.replaceState(null, '', canonicalPath)
  }
}

function setMetaContent(selector: string, content: string) {
  document.head.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content)
}

function updateDocumentMetadata() {
  const lesson = currentLesson.value
  if (!lesson) return
  const title = `${lesson.titles[locale.value]} · Learning Vim`
  const descriptions: Record<Locale, string> = {
    en: `Learn ${lesson.titles.en} with an interactive Vim editor and hands-on exercises.`,
    'zh-CN': `通过交互式 Vim 编辑器和动手练习学习${lesson.titles['zh-CN']}。`,
    ja: `インタラクティブな Vim エディターと演習で${lesson.titles.ja}を学びます。`,
  }
  const url = new URL(lessonPath(locale.value, lesson.id), 'https://learning-vim.phpz.org').href
  const description = descriptions[locale.value]
  document.title = title
  document.documentElement.lang = locale.value
  document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', url)
  setMetaContent('meta[name="description"]', description)
  setMetaContent('meta[property="og:title"]', title)
  setMetaContent('meta[property="og:description"]', description)
  setMetaContent('meta[property="og:url"]', url)
  setMetaContent('meta[property="og:locale"]', locale.value === 'en' ? 'en_US' : locale.value.replace('-', '_'))
  setMetaContent('meta[name="twitter:title"]', title)
  setMetaContent('meta[name="twitter:description"]', description)
}

function syncResponsiveViewport() {
  phoneViewport.value = phoneMediaQuery.matches
  tabletViewport.value = !phoneViewport.value && (narrowTabletMediaQuery.matches || touchTabletMediaQuery.matches)
  if (phoneViewport.value) workspaceMode.value = 'read'
}

function handleLessonLink(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-course-file]')
  const fileName = link?.dataset.courseFile
  if (!fileName) return
  event.preventDefault()
  void openCourseFile(fileName)
}

function resetBuffer() {
  buffer.value = editorSource.value
  localStorage.removeItem(storageKey('buffer'))
}

async function loadEditorFile(fileName: string, knownSource?: string) {
  const file = editorFiles.value.find((candidate) => candidate.name === fileName)
  if (!file) return false
  const loadId = ++editorFileLoadId
  const fileSource: string = knownSource ?? await fetch(`/course/${file.files[locale.value]}`).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
  })
  if (loadId !== editorFileLoadId) return false
  activeFileName.value = fileName
  editorSource.value = fileSource
  buffer.value = localStorage.getItem(storageKey('buffer', fileName)) ?? fileSource
  return true
}

async function openCourseFile(fileName: string) {
  const chapter = fileName.match(/^(chapter\d{2})\.md$/)?.[1]
  if (chapter && chapter !== lessonId.value) {
    chooseLesson(chapter)
    return
  }
  const file = editorFiles.value.find((candidate) => candidate.name === fileName)
  if (!file) return
  try {
    if (phoneViewport.value && fileName !== `${lessonId.value}.md`) {
      const response = await fetch(`/course/${file.files[locale.value]}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      previewFileName.value = fileName
      previewSource.value = await response.text()
      previewOpen.value = true
      return
    }
    await loadEditorFile(fileName, fileName === `${lessonId.value}.md` ? source.value : undefined)
    if (tabletViewport.value) workspaceMode.value = 'edit'
  } catch (reason) {
    showWorkspaceNotice(`${t.value.error} ${String(reason)}`, true)
  }
}

function showWorkspaceNotice(message: string, isError = false) {
  window.clearTimeout(workspaceNoticeTimer)
  workspaceNotice.value = message
  workspaceNoticeError.value = isError
  workspaceNoticeTimer = window.setTimeout(() => { workspaceNotice.value = '' }, 2400)
}

async function sourceCourseConfig(fileName?: string) {
  const requested = (fileName || activeFileName.value).replace(/^\.\//, '')
  const target = ['vimrc.vim', '.vimrc', '~/.vimrc'].includes(requested) ? 'vimrc.vim' : requested
  if (target !== 'vimrc.vim') {
    showWorkspaceNotice(t.value.sourceOnlyVimrc, true)
    return
  }
  if (activeFileName.value !== target && !await loadEditorFile(target)) return
  vimrc.value = buffer.value
  applyConfig(true)
}

function handleClipboard(result: ClipboardResult) {
  showWorkspaceNotice(result.ok ? t.value.clipboardCopied : t.value.clipboardBlocked, !result.ok)
}

function toggleComplete() {
  completed.value[lessonId.value] = !completed.value[lessonId.value]
  localStorage.setItem(`learning-vim:completed:${locale.value}`, JSON.stringify(completed.value))
}

function applyConfig(showConfirmation = false, closeOnSuccess = true) {
  const result = parseVimrc(vimrc.value)
  preferences.value = result.preferences
  mappings.value = result.mappings
  configWarnings.value = result.warnings
  localStorage.setItem('learning-vim:vimrc', vimrc.value)
  if (!result.warnings.length) {
    if (closeOnSuccess) vimConfigOpen.value = false
    if (showConfirmation) showWorkspaceNotice(t.value.configApplied)
  }
}

function resetVimConfig() {
  vimrc.value = initialVimrc
  applyConfig(false, false)
  showWorkspaceNotice(t.value.configReset)
}

function reloadApp() {
  installUpdate.value()
}

function toggleNav() {
  navVisible.value = !navVisible.value
  localStorage.setItem('learning-vim:nav-visible', String(navVisible.value))
}

function toggleLesson() {
  lessonVisible.value = !lessonVisible.value
  localStorage.setItem('learning-vim:lesson-visible', String(lessonVisible.value))
  if (!lessonVisible.value) workspaceMode.value = 'edit'
}

function exportLearningData() {
  const backup = createBackup(localStorage, appVersion)
  const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `learning-vim-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function importLearningData(event: Event) {
  backupError.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const backup = parseBackup(await file.text())
    for (const [key, value] of Object.entries(backup.data)) localStorage.setItem(key, value)
    window.location.reload()
  } catch {
    backupError.value = t.value.invalidBackup
    input.value = ''
  }
}

function readCompleted(): Record<string, boolean> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`learning-vim:completed:${locale.value}`) || '{}')
    return value && typeof value === 'object' ? value as Record<string, boolean> : {}
  } catch {
    return {}
  }
}

watch(buffer, (value) => {
  if (loading.value) return
  if (value === editorSource.value) localStorage.removeItem(storageKey('buffer'))
  else localStorage.setItem(storageKey('buffer'), value)
})

watch(locale, async (value) => {
  localStorage.setItem('learning-vim:locale', value)
  if (manifest.value && currentLesson.value) {
    window.history.replaceState(null, '', lessonPath(value, lessonId.value))
  }
  await loadLesson()
})

watch(lessonId, loadLesson)
watch([currentLesson, locale], ([lesson]) => {
  if (lesson) updateDocumentMetadata()
})

onMounted(async () => {
  locale.value = initialLocale()
  vimrc.value = localStorage.getItem('learning-vim:vimrc') ?? vimrc.value
  applyConfig()
  window.addEventListener('learning-vim:update-ready', (event) => {
    updateReady.value = true
    const install = (event as CustomEvent<() => void>).detail
    if (install) installUpdate.value = install
  })
  try {
    const response = await fetch('/course/manifest.json')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    manifest.value = await response.json()
    syncLessonFromLocation()
    if (!routeFromLocation()) window.history.replaceState(null, '', lessonPath(locale.value, lessonId.value))
    await nextTick()
    await loadLesson()
  } catch (reason) {
    error.value = `${t.value.error} ${String(reason)}`
    loading.value = false
  }
  window.addEventListener('popstate', syncLessonFromLocation)
  phoneMediaQuery.addEventListener('change', syncResponsiveViewport)
  narrowTabletMediaQuery.addEventListener('change', syncResponsiveViewport)
  touchTabletMediaQuery.addEventListener('change', syncResponsiveViewport)
})

onBeforeUnmount(() => {
  window.clearTimeout(workspaceNoticeTimer)
  window.removeEventListener('popstate', syncLessonFromLocation)
  phoneMediaQuery.removeEventListener('change', syncResponsiveViewport)
  narrowTabletMediaQuery.removeEventListener('change', syncResponsiveViewport)
  touchTabletMediaQuery.removeEventListener('change', syncResponsiveViewport)
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Learning Vim home">
        <img class="brand-mark" src="/vim-mark.svg" alt="">
        <span>Learning Vim</span>
        <span class="brand-version">v{{ appVersion }}</span>
      </a>
      <div class="topbar-actions">
        <span class="sync-note">{{ t.source }}</span>
        <div v-if="!phoneViewport" class="view-controls" aria-label="Layout controls">
          <button
            class="view-button"
            :class="{ active: navVisible }"
            type="button"
            :aria-pressed="navVisible"
            @click="toggleNav"
          >
            <span class="view-icon nav-icon" aria-hidden="true" />
            {{ navVisible ? t.hideNav : t.showNav }}
          </button>
          <button
            v-if="!tabletViewport"
            class="view-button"
            :class="{ active: lessonVisible }"
            type="button"
            :aria-pressed="lessonVisible"
            @click="toggleLesson"
          >
            <span class="view-icon lesson-icon" aria-hidden="true" />
            {{ lessonVisible ? t.hideLesson : t.showLesson }}
          </button>
        </div>
        <select v-model="locale" aria-label="Course language">
          <option value="en">English</option>
          <option value="zh-CN">简体中文</option>
          <option value="ja">日本語</option>
        </select>
        <button class="quiet-button" type="button" @click="vimConfigOpen = !vimConfigOpen">
          {{ t.config }}
        </button>
        <a
          class="github-link"
          href="https://github.com/dofy/learning-vim"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub · dofy/learning-vim"
          title="GitHub · dofy/learning-vim"
        >
          <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.28-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18a10.98 10.98 0 0 1 5.75 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.78 1.07.78 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
          </svg>
        </a>
      </div>
    </header>

    <main class="workspace" :class="{ 'nav-hidden': !showNav, 'tablet-layout': tabletViewport }">
      <div class="navigation-shell">
        <aside v-if="showNav" class="course-map">
          <div class="course-map-heading">
            <h1>{{ t.course }}</h1>
            <span>{{ progress }}%</span>
          </div>
          <div class="progress-track"><span :style="{ width: `${progress}%` }" /></div>
          <nav aria-label="Course chapters">
            <button
              v-for="lesson in lessons"
              :key="lesson.id"
              type="button"
              :class="{ active: lesson.id === lessonId, done: completed[lesson.id] }"
              @click="chooseLesson(lesson.id)"
            >
              <span class="chapter-title">{{ lesson.titles[locale] }}</span>
              <span class="completion-dot" aria-hidden="true" />
            </button>
          </nav>
        </aside>

      </div>

      <section class="learning-area" :class="{ 'lesson-hidden': !showLesson }">
        <div v-if="tabletViewport" class="pane-tabs" role="tablist" :aria-label="`${t.readMode} / ${t.editMode}`">
          <button
            type="button"
            :class="{ active: workspaceMode === 'read' }"
            role="tab"
            :aria-selected="workspaceMode === 'read'"
            :aria-label="t.readMode"
            @click="workspaceMode = 'read'"
          >
            <span class="pane-tab-icon read-tab-icon" aria-hidden="true" />
            <span>{{ t.readMode }}</span>
          </button>
          <button
            type="button"
            :class="{ active: workspaceMode === 'edit' }"
            role="tab"
            :aria-selected="workspaceMode === 'edit'"
            :aria-label="t.editMode"
            @click="workspaceMode = 'edit'"
          >
            <span class="pane-tab-icon practice-tab-icon" aria-hidden="true">›_</span>
            <span>{{ t.editMode }}</span>
          </button>
        </div>
        <article
          v-if="showLesson"
          class="lesson-pane"
          :class="{ 'pane-hidden': tabletViewport && workspaceMode !== 'read' }"
        >
          <div class="pane-heading">
            <span>{{ t.lesson }}</span>
            <button
              class="complete-button"
              :class="{ completed: completed[lessonId] }"
              type="button"
              @click="toggleComplete"
            >
              {{ completed[lessonId] ? t.completed : t.complete }}
            </button>
          </div>
          <p v-if="loading" class="state-message">{{ t.loading }}</p>
          <p v-else-if="error" class="state-message error">{{ error }}</p>
          <div v-else class="lesson-copy" @click="handleLessonLink" v-html="renderedLesson" />
        </article>

        <section
          v-if="!phoneViewport"
          class="practice-pane"
          :class="{ 'pane-hidden': tabletViewport && workspaceMode !== 'edit' }"
        >
          <div class="pane-heading practice-heading">
            <div class="practice-title">
              <span>{{ t.practice }}</span>
              <span
                class="buffer-state"
                :class="{ modified: editorStatus.dirty }"
                :aria-label="editorStatus.dirty ? t.modified : t.original"
                :title="editorStatus.dirty ? t.modified : t.original"
              />
            </div>
            <div class="practice-actions">
              <span class="editor-position" :title="editorPosition">{{ editorPositionCompact }}</span>
              <button
                class="lesson-step"
                type="button"
                :disabled="!hasPreviousLesson"
                :aria-label="t.previous"
                :title="t.previous"
                @click="navigateLesson(-1)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m14 5-5 5 5 5m-5-10-5 5 5 5" /></svg>
                <span class="visually-hidden">{{ t.previous }}</span>
              </button>
              <button
                class="lesson-step"
                type="button"
                :disabled="!hasNextLesson"
                :aria-label="t.next"
                :title="t.next"
                @click="navigateLesson(1)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 5 5 5-5 5m5-10 5 5-5 5" /></svg>
                <span class="visually-hidden">{{ t.next }}</span>
              </button>
              <button
                v-if="activeEditorFile?.role === 'config'"
                class="practice-icon-button apply-file-config"
                type="button"
                :aria-label="t.applyFileConfig"
                :title="t.applyFileConfig"
                @click="sourceCourseConfig()"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3 3 7-7" /></svg>
                <span class="visually-hidden">{{ t.applyFileConfig }}</span>
              </button>
              <button
                class="practice-icon-button reset-button"
                type="button"
                :aria-label="t.reset"
                :title="t.reset"
                @click="resetBuffer"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.2 7.2A5.5 5.5 0 1 1 5 12m.2-4.8V3.8M5.2 7.2h3.4" /></svg>
                <span class="visually-hidden">{{ t.reset }}</span>
              </button>
            </div>
          </div>
          <div v-if="editorFiles.length > 1" class="buffer-tabs" role="tablist" aria-label="Course files">
            <button
              v-for="file in editorFiles"
              :key="file.name"
              type="button"
              role="tab"
              :aria-selected="file.name === activeFileName"
              :class="{ active: file.name === activeFileName }"
              @click="openCourseFile(file.name)"
            >{{ file.name }}</button>
          </div>
          <VimEditor
            v-if="!loading && !error"
            v-model="buffer"
            :source-value="editorSource"
            :file-name="activeFileName"
            :language="activeEditorFile?.language ?? 'markdown'"
            :preferences="preferences"
            :mappings="mappings"
            @open-course-file="openCourseFile"
            @source-current-file="sourceCourseConfig"
            @clipboard="handleClipboard"
            @preferences-change="preferences = $event"
            @status="editorStatus = $event"
          />
        </section>
      </section>
    </main>

    <footer class="site-footer">
      <span>© 2026 Seven Yu · Made with ❤️</span>
      <a href="https://learning-vim.phpz.org/">learning-vim.phpz.org</a>
      <span class="footer-source">
        {{ t.contentBy }}
        <a href="https://github.com/dofy/learn-vim" target="_blank" rel="noreferrer">dofy/learn-vim</a>
      </span>
    </footer>

    <div class="toast-region" aria-live="polite" aria-atomic="true">
      <AppToast
        v-if="updateReady"
        :message="t.update"
        :action-label="t.reload"
        @action="reloadApp"
      />
      <AppToast
        v-if="workspaceNotice"
        :message="workspaceNotice"
        :kind="workspaceNoticeError ? 'error' : 'success'"
      />
    </div>

    <div v-if="vimConfigOpen" class="config-backdrop" @click.self="vimConfigOpen = false">
      <section class="config-panel" role="dialog" aria-modal="true" :aria-label="t.config">
        <div class="config-heading">
          <h2>{{ t.config }}</h2>
          <button type="button" aria-label="Close" @click="vimConfigOpen = false">×</button>
        </div>
        <p>{{ t.configHelp }}</p>
        <textarea v-model="vimrc" spellcheck="false" aria-label="vimrc" />
        <ul v-if="configWarnings.length" class="config-warnings">
          <li v-for="warning in configWarnings" :key="warning">{{ warning }}</li>
        </ul>
        <div class="config-actions">
          <button class="apply-button" type="button" @click="applyConfig(true)">{{ t.apply }}</button>
          <button class="reset-config-button" type="button" @click="resetVimConfig">{{ t.resetConfig }}</button>
        </div>
        <p class="reset-config-help">{{ t.resetConfigHelp }}</p>
        <div class="data-tools">
          <div>
            <h3>{{ t.learningData }}</h3>
            <p>{{ t.dataHelp }}</p>
          </div>
          <div class="data-actions">
            <button type="button" @click="exportLearningData">{{ t.exportData }}</button>
            <button type="button" @click="importInput?.click()">{{ t.importData }}</button>
            <input
              ref="importInput"
              class="visually-hidden"
              type="file"
              accept="application/json,.json"
              @change="importLearningData"
            >
          </div>
        </div>
        <p v-if="backupError" class="data-error" role="alert">{{ backupError }}</p>
      </section>
    </div>

    <div v-if="previewOpen" class="config-backdrop" @click.self="previewOpen = false">
      <section class="file-preview-panel" role="dialog" aria-modal="true" :aria-label="t.readOnlyPreview">
        <div class="config-heading">
          <div>
            <span>{{ t.readOnlyPreview }}</span>
            <h2>{{ previewFileName }}</h2>
          </div>
          <button type="button" :aria-label="t.closePreview" @click="previewOpen = false">×</button>
        </div>
        <pre><code>{{ previewSource }}</code></pre>
      </section>
    </div>
  </div>
</template>
