import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const appRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.resolve(
  process.env.LEARN_VIM_CONTENT_DIR || path.join(appRoot, '..', 'learn-vim'),
)
const outputRoot = path.join(appRoot, 'public', 'course')
const locales = ['en', 'zh-CN', 'ja']
const lessonIds = Array.from(
  { length: 11 },
  (_, index) => `chapter${String(index + 1).padStart(2, '0')}`,
)
const workspaceFilesByLesson = {
  chapter04: [
    { name: 'vimrc.vim', role: 'config', language: 'vim' },
    { name: 'chapter04-demo.js', role: 'exercise', language: 'javascript' },
  ],
}

function titleOf(markdown, fallback) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback
}

async function gitValue(args, fallback) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', sourceRoot, ...args])
    return stdout.trim() || fallback
  } catch {
    return fallback
  }
}

await rm(outputRoot, { recursive: true, force: true })
await mkdir(outputRoot, { recursive: true })

const lessons = []

for (const locale of locales) {
  const sourceLocale = path.join(sourceRoot, locale)
  const outputLocale = path.join(outputRoot, locale)
  await cp(sourceLocale, outputLocale, { recursive: true })
}

for (const id of lessonIds) {
  const titles = {}
  const files = {}

  for (const locale of locales) {
    const relativePath = `${locale}/${id}.md`
    const markdown = await readFile(path.join(sourceRoot, relativePath), 'utf8')
    titles[locale] = titleOf(markdown, id)
    files[locale] = relativePath
  }

  const workspaceFiles = workspaceFilesByLesson[id]?.map((file) => ({
    ...file,
    files: Object.fromEntries(locales.map((locale) => [locale, `${locale}/${file.name}`])),
  }))

  lessons.push({ id, titles, files, ...(workspaceFiles ? { workspaceFiles } : {}) })
}

const sourceRevision = await gitValue(['rev-parse', 'HEAD'], 'local-content')
const generatedAt = await gitValue(['show', '-s', '--format=%cI', 'HEAD'], new Date().toISOString())

const manifest = {
  schemaVersion: 3,
  generatedAt,
  source: 'dofy/learn-vim',
  sourceRevision,
  locales,
  lessons,
}

await writeFile(
  path.join(outputRoot, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)

console.log(`Synced ${lessons.length} lessons in ${locales.length} locales from ${sourceRoot}`)
