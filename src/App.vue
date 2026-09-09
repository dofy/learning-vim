<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import VimEditor from './components/VimEditor.vue'
import type { CourseManifest, Locale } from './types'
import { defaultPreferences, parseVimrc } from './vimrc'

const labels = {
  en: {
    course: 'Course map', lesson: 'Lesson', practice: 'Practice buffer', reset: 'Reset buffer',
    complete: 'Mark complete', completed: 'Completed', config: 'Vim config', apply: 'Apply config',
    configHelp: 'MVP support: set number, relativenumber, wrap, tabstop and map commands.',
    source: 'Content synced from dofy/learn-vim', loading: 'Loading course…', update: 'A new version is ready.',
    reload: 'Reload', mobileLesson: 'Read', mobilePractice: 'Practice', error: 'Course could not be loaded.',
    showNav: 'Show course map', hideNav: 'Hide course map', showLesson: 'Show lesson', hideLesson: 'Hide lesson',
    contentBy: 'Course content',
  },
  'zh-CN': {
    course: '课程航线', lesson: '课程正文', practice: '练习缓冲区', reset: '重置缓冲区',
    complete: '标记完成', completed: '已完成', config: 'Vim 配置', apply: '应用配置',
    configHelp: 'MVP 支持 set number、relativenumber、wrap、tabstop 和 map 系列命令。',
    source: '课程同步自 dofy/learn-vim', loading: '正在装载课程…', update: '新版本已准备好。',
    reload: '重新载入', mobileLesson: '阅读', mobilePractice: '练习', error: '课程加载失败。',
    showNav: '显示导航', hideNav: '隐藏导航', showLesson: '显示正文', hideLesson: '隐藏正文',
    contentBy: '课程内容',
  },
  ja: {
    course: 'コースマップ', lesson: 'レッスン', practice: '練習バッファ', reset: 'バッファを戻す',
    complete: '完了にする', completed: '完了', config: 'Vim 設定', apply: '設定を適用',
    configHelp: 'MVP は number、relativenumber、wrap、tabstop、map コマンドに対応します。',
    source: 'dofy/learn-vim から同期', loading: 'コースを読み込み中…', update: '新しい版があります。',
    reload: '再読み込み', mobileLesson: '読む', mobilePractice: '練習', error: 'コースを読み込めません。',
    showNav: 'ナビを表示', hideNav: 'ナビを隠す', showLesson: '本文を表示', hideLesson: '本文を隠す',
    contentBy: 'コース内容',
  },
} as const

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })
const renderLinkOpen = md.renderer.rules.link_open
md.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
  const token = tokens[index]
  const href = token.attrGet('href')
  const lessonMatch = typeof href === 'string' ? href.match(/^(chapter\d{2})\.md(?:#.*)?$/) : null
  if (lessonMatch?.[1]) {
    token.attrSet('href', `#${lessonMatch[1]}`)
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
const vimrc = ref('set number\nset tabstop=4\n" Try: inoremap jj <Esc>')
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

const t = computed(() => labels[locale.value])
const lessons = computed(() => manifest.value?.lessons ?? [])
const currentLesson = computed(() => lessons.value.find((lesson) => lesson.id === lessonId.value))
const renderedLesson = computed(() => md.render(source.value))
const progress = computed(() => {
  if (!lessons.value.length) return 0
  const count = lessons.value.filter((lesson) => completed.value[lesson.id]).length
  return Math.round((count / lessons.value.length) * 100)
})

function storageKey(kind: string) {
  return `learning-vim:${kind}:${locale.value}:${lessonId.value}`
}

function initialLocale(): Locale {
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
    completed.value = JSON.parse(localStorage.getItem(`learning-vim:completed:${locale.value}`) || '{}')
    document.documentElement.lang = locale.value
  } catch (reason) {
    error.value = `${t.value.error} ${String(reason)}`
  } finally {
    loading.value = false
  }
}

function chooseLesson(id: string) {
  lessonId.value = id
  mobilePane.value = 'lesson'
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

watch(buffer, (value) => {
  if (value && value !== source.value) localStorage.setItem(storageKey('buffer'), value)
})

watch(locale, async (value) => {
  localStorage.setItem('learning-vim:locale', value)
  await loadLesson()
})

watch(lessonId, loadLesson)

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
    await nextTick()
    await loadLesson()
  } catch (reason) {
    error.value = `${t.value.error} ${String(reason)}`
    loading.value = false
  }
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Learning Vim home">
        <span class="brand-mark">V</span>
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
      </div>
    </header>

    <div v-if="updateReady" class="update-banner">
      {{ t.update }} <button type="button" @click="reloadApp">{{ t.reload }}</button>
    </div>

    <main class="workspace" :class="{ 'nav-hidden': !navVisible }">
      <aside v-if="navVisible" class="course-map">
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

      <section class="learning-area" :class="{ 'lesson-hidden': !lessonVisible }">
        <div class="mobile-tabs" :class="{ single: !lessonVisible }" role="tablist">
          <button
            v-if="lessonVisible"
            type="button"
            :class="{ active: mobilePane === 'lesson' }"
            @click="mobilePane = 'lesson'"
          >
            {{ t.mobileLesson }}
          </button>
          <button type="button" :class="{ active: mobilePane === 'practice' }" @click="mobilePane = 'practice'">
            {{ t.mobilePractice }}
          </button>
        </div>

        <article
          v-if="lessonVisible"
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
            <span>{{ t.practice }}</span>
            <div>
              <kbd>Esc</kbd><span> Normal</span>
              <button class="reset-button" type="button" @click="resetBuffer">{{ t.reset }}</button>
            </div>
          </div>
          <VimEditor
            v-if="!loading && !error"
            v-model="buffer"
            :preferences="preferences"
            :mappings="mappings"
          />
        </section>
      </section>
    </main>

    <footer class="site-footer">
      <span>⌨️ © 2026 Seven Yu</span>
      <a href="https://learning-vim.phpz.org/">🌐 learning-vim.phpz.org</a>
      <span class="footer-source">
        📚 {{ t.contentBy }}
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
      </section>
    </div>
  </div>
</template>
