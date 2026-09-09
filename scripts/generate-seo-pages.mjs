import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import MarkdownIt from 'markdown-it'

const siteUrl = 'https://learning-vim.phpz.org'
const appRoot = path.resolve(import.meta.dirname, '..')
const distRoot = path.join(appRoot, 'dist')
const courseRoot = path.join(distRoot, 'course')
const locales = ['en', 'zh-CN', 'ja']
const localeDescriptions = {
  en: (title) => `Learn ${title} with an interactive Vim editor and hands-on exercises.`,
  'zh-CN': (title) => `通过交互式 Vim 编辑器和动手练习学习${title}。`,
  ja: (title) => `インタラクティブな Vim エディターと演習で${title}を学びます。`,
}

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })
const defaultLinkOpen = md.renderer.rules.link_open
md.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
  const token = tokens[index]
  const href = token.attrGet('href')
  const match = typeof href === 'string' ? href.match(/^(chapter\d{2})\.md(#.*)?$/) : null
  if (match?.[1]) token.attrSet('href', `/${environment.locale}/${match[1]}/${match[2] || ''}`)
  return defaultLinkOpen
    ? defaultLinkOpen(tokens, index, options, environment, renderer)
    : renderer.renderToken(tokens, index, options)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeXml(value) {
  return escapeHtml(value)
}

function lessonUrl(locale, id) {
  return `${siteUrl}/${locale}/${id}/`
}

function seoBlock({ locale, lesson }) {
  const title = `${lesson.titles[locale]} · Learning Vim`
  const description = localeDescriptions[locale](lesson.titles[locale])
  const url = lessonUrl(locale, lesson.id)
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: `${siteUrl}/`,
        name: 'Learning Vim',
        inLanguage: locales,
      },
      {
        '@type': 'WebApplication',
        '@id': `${siteUrl}/#application`,
        name: 'Learning Vim',
        url: `${siteUrl}/`,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
      },
      {
        '@type': 'LearningResource',
        '@id': `${url}#lesson`,
        name: lesson.titles[locale],
        description,
        url,
        inLanguage: locale,
        learningResourceType: 'Lesson',
        isAccessibleForFree: true,
        isPartOf: { '@id': `${siteUrl}/#application` },
      },
    ],
  }).replaceAll('<', '\\u003c')
  const alternates = locales
    .map((alternate) => `    <link rel="alternate" hreflang="${alternate}" href="${lessonUrl(alternate, lesson.id)}" />`)
    .concat(`    <link rel="alternate" hreflang="x-default" href="${lessonUrl('en', lesson.id)}" />`)
    .join('\n')

  return `<!-- seo:start -->
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow" />
    <meta name="author" content="Seven Yu" />
    <link rel="canonical" href="${url}" />
${alternates}
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Learning Vim" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:locale" content="${locale === 'en' ? 'en_US' : locale.replace('-', '_')}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <script type="application/ld+json">${structuredData}</script>
    <title>${escapeHtml(title)}</title>
    <!-- seo:end -->`
}

function fallbackBlock({ locale, lesson, markdown, manifest }) {
  const chapterLinks = manifest.lessons
    .map((item) => `<a href="/${locale}/${item.id}/">${escapeHtml(item.titles[locale])}</a>`)
    .join('\n          ')
  return `<!-- seo-fallback:start -->
      <main class="seo-fallback">
        <article>${md.render(markdown, { locale })}</article>
        <nav aria-label="Course chapters">
          ${chapterLinks}
        </nav>
      </main>
      <!-- seo-fallback:end -->`
}

const manifest = JSON.parse(await readFile(path.join(courseRoot, 'manifest.json'), 'utf8'))
const template = await readFile(path.join(distRoot, 'index.html'), 'utf8')
const sitemapEntries = [`  <url><loc>${siteUrl}/</loc></url>`]

for (const lesson of manifest.lessons) {
  for (const locale of locales) {
    const markdown = await readFile(path.join(courseRoot, lesson.files[locale]), 'utf8')
    const html = template
      .replace('<html lang="zh-CN">', `<html lang="${locale}">`)
      .replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, seoBlock({ locale, lesson }))
      .replace(
        /<!-- seo-fallback:start -->[\s\S]*?<!-- seo-fallback:end -->/,
        fallbackBlock({ locale, lesson, markdown, manifest }),
      )
    const outputDirectory = path.join(distRoot, locale, lesson.id)
    await mkdir(outputDirectory, { recursive: true })
    await writeFile(path.join(outputDirectory, 'index.html'), html)

    const alternates = locales
      .map((alternate) => `<xhtml:link rel="alternate" hreflang="${alternate}" href="${escapeXml(lessonUrl(alternate, lesson.id))}" />`)
      .concat(`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(lessonUrl('en', lesson.id))}" />`)
      .join('')
    sitemapEntries.push(`  <url><loc>${escapeXml(lessonUrl(locale, lesson.id))}</loc>${alternates}</url>`)
  }
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries.join('\n')}
</urlset>
`
await writeFile(path.join(distRoot, 'sitemap.xml'), sitemap)

console.log(`Generated ${manifest.lessons.length * locales.length} localized SEO pages and sitemap.xml`)
