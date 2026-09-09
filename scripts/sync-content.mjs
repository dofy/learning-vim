import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

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

function titleOf(markdown, fallback) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback
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

  lessons.push({ id, titles, files })
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'dofy/learn-vim',
  locales,
  lessons,
}

await writeFile(
  path.join(outputRoot, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)

console.log(`Synced ${lessons.length} lessons in ${locales.length} locales from ${sourceRoot}`)
