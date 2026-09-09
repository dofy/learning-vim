<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createBackup, parseBackup } from './backup'
import VimEditor from './components/VimEditor.vue'
import type { CourseManifest, EditorStatus, Locale } from './types'
import { defaultPreferences, parseVimrc } from './vimrc'

const labels = {
  en: {
    course: 'Course map', lesson: 'Lesson', practice: 'Practice buffer', reset: 'Reset buffer',
    complete: 'Mark complete', completed: 'Completed', config: 'Vim config', apply: 'Apply config',
    configHelp: 'Supports lesson options including line numbers, search highlighting, indentation, tabs, filetype, syntax, and mappings.',
    source: 'Content synced from dofy/learn-vim', loading: 'Loading course…', update: 'A new version is ready.',
    reload: 'Reload', mobileLesson: 'Read', mobilePractice: 'Practice', error: 'Course could not be loaded.',
    showNav: 'Show course map', hideNav: 'Hide course map', showLesson: 'Show lesson', hideLesson: 'Hide lesson',
    contentBy: 'Course content', previous: 'Previous lesson', next: 'Next lesson',
    original: 'Course copy', modified: 'Saved locally', line: 'Line', learningData: 'Learning data',
    dataHelp: 'Move progress and preferences between browsers without an account.',
    exportData: 'Export data', importData: 'Import data', invalidBackup: 'This backup could not be imported.',
  },
  'zh-CN': {
    course: '课程航线', lesson: '课程正文', practice: '练习缓冲区', reset: '重置缓冲区',
    complete: '标记完成', completed: '已完成', config: 'Vim 配置', apply: '应用配置',
    configHelp: '支持课程中的行号、搜索高亮、缩进、Tab、filetype、syntax 和 map 系列配置。',
    source: '课程同步自 dofy/learn-vim', loading: '正在装载课程…', update: '新版本已准备好。',
    reload: '重新载入', mobileLesson: '阅读', mobilePractice: '练习', error: '课程加载失败。',
    showNav: '显示导航', hideNav: '隐藏导航', showLesson: '显示正文', hideLesson: '隐藏正文',
    contentBy: '课程内容', previous: '上一课', next: '下一课',
    original: '课程原稿', modified: '已保存到本机', line: '行', learningData: '学习数据',
    dataHelp: '无需账号，在不同浏览器之间迁移进度和偏好设置。',
    exportData: '导出数据', importData: '导入数据', invalidBackup: '无法导入这份备份。',
  },
  ja: {
    course: 'コースマップ', lesson: 'レッスン', practice: '練習バッファ', reset: 'バッファを戻す',
    complete: '完了にする', completed: '完了', config: 'Vim 設定', apply: '設定を適用',
    configHelp: '行番号、検索ハイライト、インデント、Tab、filetype、syntax、map 設定に対応します。',
    source: 'dofy/learn-vim から同期', loading: 'コースを読み込み中…', update: '新しい版があります。',
    reload: '再読み込み', mobileLesson: '読む', mobilePractice: '練習', error: 'コースを読み込めません。',
    showNav: 'ナビを表示', hideNav: 'ナビを隠す', showLesson: '本文を表示', hideLesson: '本文を隠す',
    contentBy: 'コース内容', previous: '前のレッスン', next: '次のレッスン',
    original: '教材の原文', modified: '端末に保存済み', line: '行', learningData: '学習データ',
    dataHelp: 'アカウントなしで進捗と設定を別のブラウザへ移行できます。',
    exportData: 'データを書き出す', importData: 'データを読み込む', invalidBackup: 'バックアップを読み込めません。',
  },
} as const

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })
const renderLinkOpen = md.renderer.rules.link_open
md.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
  const token = tokens[index]
  const href = token.attrGet('href')
  const lessonMatch = typeof href === 'string' ? href.match(/^(chapter\d{2})\.md(?:#.*)?$/) : null
  if (lessonMatch?.[1]) {
    token.attrSet('href', lessonPath(locale.value, lessonMatch[1]))
    token.attrSet('data-lesson-id', lessonMatch[1])
  }
  return renderLinkOpen
    ? renderLinkOpen(tokens, index, options, environment, renderer)
    : renderer.renderToken(tokens, index, options)
}
const manifest = ref<CourseManifest>()
const locale = ref<Locale>('zh-CN')
const lessonId = ref('chapter01')
const source = ref('')
const buffer = ref('')
const loading = ref(true)
const error = ref('')
const completed = ref<Record<string, boolean>>({})
const vimrc = ref('syntax on\nset number\nset tabstop=4\n" Try: inoremap jj <Esc>')
const vimConfigOpen = ref(false)
const configWarnings = ref<string[]>([])
const mobilePane = ref<'lesson' | 'practice'>('lesson')
const updateReady = ref(false)
const preferences = ref({ ...defaultPreferences })
const mappings = ref<ReturnType<typeof parseVimrc>['mappings']>([])
const installUpdate = ref<() => void>(() => window.location.reload())
const appVersion = __APP_VERSION__
const navVisible = ref(localStorage.getItem('learning-vim:nav-visible') !== 'false')
const lessonVisible = ref(localStorage.getItem('learning-vim:lesson-visible') !== 'false')
const mobileMediaQuery = window.matchMedia('(max-width: 720px)')
const mobileViewport = ref(mobileMediaQuery.matches)
const editorStatus = ref<EditorStatus>({ cursorLine: 1, totalLines: 1, dirty: false })
const importInput = ref<HTMLInputElement>()
const backupError = ref('')

const t = computed(() => labels[locale.value])
const lessons = computed(() => manifest.value?.lessons ?? [])
const currentLesson = computed(() => lessons.value.find((lesson) => lesson.id === lessonId.value))
const showNav = computed(() => mobileViewport.value || navVisible.value)
const showLesson = computed(() => mobileViewport.value || lessonVisible.value)
const currentLessonIndex = computed(() => lessons.value.findIndex((lesson) => lesson.id === lessonId.value))
const hasPreviousLesson = computed(() => currentLessonIndex.value > 0)
const hasNextLesson = computed(() => currentLessonIndex.value >= 0 && currentLessonIndex.value < lessons.value.length - 1)
const renderedLesson = computed(() => md.render(source.value))
const progress = computed(() => {
  if (!lessons.value.length) return 0
  const count = lessons.value.filter((lesson) => completed.value[lesson.id]).length
  return Math.round((count / lessons.value.length) * 100)
})

function storageKey(kind: string) {
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
    buffer.value = localStorage.getItem(storageKey('buffer')) ?? source.value
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

function syncMobileViewport(event: MediaQueryListEvent) {
  mobileViewport.value = event.matches
}

function handleLessonLink(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-lesson-id]')
  const targetLesson = link?.dataset.lessonId
  if (!targetLesson) return
  event.preventDefault()
  chooseLesson(targetLesson)
}

function resetBuffer() {
  buffer.value = source.value
  localStorage.removeItem(storageKey('buffer'))
}

function toggleComplete() {
  completed.value[lessonId.value] = !completed.value[lessonId.value]
  localStorage.setItem(`learning-vim:completed:${locale.value}`, JSON.stringify(completed.value))
}

function applyConfig() {
  const result = parseVimrc(vimrc.value)
  preferences.value = result.preferences
  mappings.value = result.mappings
  configWarnings.value = result.warnings
  localStorage.setItem('learning-vim:vimrc', vimrc.value)
  if (!result.warnings.length) vimConfigOpen.value = false
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
  if (!lessonVisible.value) mobilePane.value = 'practice'
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
  if (value === source.value) localStorage.removeItem(storageKey('buffer'))
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
  mobileMediaQuery.addEventListener('change', syncMobileViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', syncLessonFromLocation)
  mobileMediaQuery.removeEventListener('change', syncMobileViewport)
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
        <div class="view-controls" aria-label="Layout controls">
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
        <button
          class="mobile-config-button"
          type="button"
          :aria-label="t.config"
          :title="t.config"
          @click="vimConfigOpen = !vimConfigOpen"
        >⚙</button>
      </div>
    </header>

    <div v-if="updateReady" class="update-banner">
      {{ t.update }} <button type="button" @click="reloadApp">{{ t.reload }}</button>
    </div>

    <main class="workspace" :class="{ 'nav-hidden': !showNav }">
      <div class="navigation-shell">
        <aside v-if="showNav" class="course-map">
          <div class="course-map-heading">
            <h1>{{ t.course }}</h1>
            <span>{{ progress }}%</span>
          </div>
          <div class="progress-track"><span :style="{ width: `${progress}%` }" /></div>
          <nav aria-label="Course chapters">
            <button
              v-for="(lesson, index) in lessons"
              :key="lesson.id"
              type="button"
              :class="{ active: lesson.id === lessonId, done: completed[lesson.id] }"
              @click="chooseLesson(lesson.id)"
            >
              <span class="chapter-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span>{{ lesson.titles[locale] }}</span>
              <span class="completion-dot" aria-hidden="true" />
            </button>
          </nav>
        </aside>

        <div class="mobile-tabs" :class="{ single: !showLesson }" role="tablist">
          <button
            v-if="showLesson"
            type="button"
            :class="{ active: mobilePane === 'lesson' }"
            :aria-label="t.mobileLesson"
            :title="t.mobileLesson"
            @click="mobilePane = 'lesson'"
          >
            <span class="mobile-tab-icon read-tab-icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            :class="{ active: mobilePane === 'practice' }"
            :aria-label="t.mobilePractice"
            :title="t.mobilePractice"
            @click="mobilePane = 'practice'"
          >
            <span class="mobile-tab-icon practice-tab-icon" aria-hidden="true">›_</span>
          </button>
        </div>
      </div>

      <section class="learning-area" :class="{ 'lesson-hidden': !showLesson }">
        <article
          v-if="showLesson"
          class="lesson-pane"
          :class="{ 'mobile-hidden': mobilePane !== 'lesson' }"
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

        <section class="practice-pane" :class="{ 'mobile-hidden': mobilePane !== 'practice' }">
          <div class="pane-heading practice-heading">
            <div class="practice-title">
              <span>{{ t.practice }}</span>
              <span class="buffer-state" :class="{ modified: editorStatus.dirty }">
                {{ editorStatus.dirty ? t.modified : t.original }}
              </span>
            </div>
            <div class="practice-actions">
              <span>{{ t.line }} {{ editorStatus.cursorLine }}/{{ editorStatus.totalLines }}</span>
              <kbd>Esc</kbd><span> Normal</span>
              <button
                class="lesson-step"
                type="button"
                :disabled="!hasPreviousLesson"
                :aria-label="t.previous"
                :title="t.previous"
                @click="navigateLesson(-1)"
              >←</button>
              <button
                class="lesson-step"
                type="button"
                :disabled="!hasNextLesson"
                :aria-label="t.next"
                :title="t.next"
                @click="navigateLesson(1)"
              >→</button>
              <button class="reset-button" type="button" @click="resetBuffer">{{ t.reset }}</button>
            </div>
          </div>
          <VimEditor
            v-if="!loading && !error"
            v-model="buffer"
            :source-value="source"
            :preferences="preferences"
            :mappings="mappings"
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
        <button class="apply-button" type="button" @click="applyConfig">{{ t.apply }}</button>
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
  </div>
</template>
