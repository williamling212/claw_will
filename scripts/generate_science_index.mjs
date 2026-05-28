import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const contentRoot = path.join(repoRoot, 'docs/science/content/science_exploration')
const scienceDocRoot = path.join(repoRoot, 'docs/science')
const outIndexMd = path.join(repoRoot, 'docs/science/content/index.md')
const outSidebar = path.join(repoRoot, 'docs/.vitepress/generated/scienceSidebar.mjs')
const outHomeRecent = path.join(repoRoot, 'docs/.vitepress/generated/recentScienceUpdates.mjs')

function walk(dir) {
  const out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(p))
    else if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) out.push(p)
  }
  return out
}

function toPosix(p) {
  return p.split(path.sep).join('/')
}

function stripMd(rel) {
  return rel.replace(/\.md$/i, '')
}

function docLinkFromRel(rel) {
  return '/science/content/science_exploration/' + toPosix(stripMd(rel))
}

function mdLinkFromRel(rel) {
  return './science_exploration/' + toPosix(stripMd(rel))
}

function titleFromRel(rel) {
  return path.basename(rel, '.md')
}

function gitDate(absPath) {
  try {
    const out = execSync(`git log -1 --format=%ci -- "${absPath}"`, {
      cwd: contentRoot,
      encoding: 'utf-8',
      timeout: 5000
    }).trim()
    return out ? out.slice(0, 10) : null
  } catch {
    return null
  }
}

// Scan local science articles: docs/science/*/index.md (excluding content/)
function scanLocalArticles() {
  const articles = []
  if (!fs.existsSync(scienceDocRoot)) return articles
  for (const ent of fs.readdirSync(scienceDocRoot, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name === 'content' || ent.name.startsWith('.')) continue
    const indexPath = path.join(scienceDocRoot, ent.name, 'index.md')
    if (!fs.existsSync(indexPath)) continue
    const content = fs.readFileSync(indexPath, 'utf-8')
    const titleMatch = content.match(/^title:\s*(.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : ent.name
    // Get file mtime as fallback date
    const mtime = fs.statSync(indexPath).mtime.toISOString().slice(0, 10)
    articles.push({
      text: title,
      link: `/science/${ent.name}/`,
      date: mtime,
    })
  }
  return articles
}

const localArticles = scanLocalArticles()

const filesAbs = fs.existsSync(contentRoot) ? walk(contentRoot) : []
const filesRel = filesAbs.map(f => path.relative(contentRoot, f))

// Group by first segment
const groups = new Map()
for (const rel of filesRel) {
  const parts = rel.split(path.sep)
  const isRootFile = parts.length === 1
  const isReadme = rel.toLowerCase() === 'readme.md'
  let group
  if (isReadme) {
    group = 'ROOT'
  } else if (isRootFile) {
    group = '散篇'
  } else {
    group = parts[0]
  }
  if (!groups.has(group)) groups.set(group, [])
  groups.get(group).push(rel)
}

// -------- 1) Generate auto index page (Markdown) --------
const lines = []
lines.push('---')
lines.push('title: 科学探索 · 内容目录')
lines.push('---')
lines.push('')
lines.push('# 内容目录')
lines.push('')
lines.push('本页由构建脚本自动生成：扫描 `science_exploration` 仓库并生成可点击目录。')
lines.push('')

if (groups.has('ROOT')) {
  const rootReadme = groups.get('ROOT').find(x => x.toLowerCase() === 'readme.md')
  if (rootReadme) {
    lines.push('## 总览')
    lines.push('')
    lines.push('<div class="dir-list">')
    lines.push(`  <a class="dir-item" href="${mdLinkFromRel(rootReadme)}">README</a>`)
    lines.push('</div>')
    lines.push('')
  }
}

const groupNames = [...groups.keys()]
  .filter(g => g !== 'ROOT')
  .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))

for (const g of groupNames) {
  lines.push(`## ${g}`)
  lines.push('')
  const rels = groups.get(g)
    .filter(r => !r.toLowerCase().endsWith('/readme.md'))
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))

  lines.push('<div class="dir-list">')
  for (const rel of rels) {
    lines.push(`  <a class="dir-item" href="${mdLinkFromRel(rel)}">${titleFromRel(rel)}</a>`)
  }
  lines.push('</div>')
  lines.push('')
}

fs.mkdirSync(path.dirname(outIndexMd), { recursive: true })
fs.writeFileSync(outIndexMd, lines.join('\n'), 'utf-8')

// -------- 2) Generate VitePress sidebar --------
const sidebarGroups = []
for (const g of groupNames) {
  const rels = groups.get(g)
    .filter(r => !r.toLowerCase().endsWith('/readme.md'))
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))

  const items = rels.map(rel => ({ text: titleFromRel(rel), link: docLinkFromRel(rel) }))

  if (items.length) {
    sidebarGroups.push({ text: g, collapsed: true, items })
  }
}

const rootFiles = (groups.get('ROOT') || [])
  .filter(r => r.toLowerCase() !== 'readme.md')
  .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
if (rootFiles.length) {
  const items = rootFiles.map(rel => ({ text: titleFromRel(rel), link: docLinkFromRel(rel) }))
  sidebarGroups.unshift({ text: '通用', collapsed: false, items })
}

const sidebarObj = {
  '/science/': [
    {
      text: '科学探索',
      items: [
        { text: '导览', link: '/science/' },
        { text: '内容目录', link: '/science/content/' },
        // Local articles under docs/science/*/index.md are appended automatically
        ...localArticles.map(a => ({ text: a.text, link: a.link }))
      ]
    },
    ...sidebarGroups
  ]
}

fs.mkdirSync(path.dirname(outSidebar), { recursive: true })
fs.writeFileSync(
  outSidebar,
  `// Auto-generated by scripts/generate_science_index.mjs\nexport const scienceSidebar = ${JSON.stringify(sidebarObj, null, 2)}\n`,
  'utf-8'
)

// -------- 3) Generate "recent updates" list for homepage --------
const withDates = filesRel
  .filter(r => !r.toLowerCase().endsWith('/readme.md'))
  .map(rel => ({
    rel,
    date: gitDate(path.join(contentRoot, rel))
  }))
  .filter(x => x.date)
  .sort((a, b) => b.date.localeCompare(a.date))

const recentFromRepo = withDates.slice(0, 8).map(x => ({
  text: titleFromRel(x.rel),
  date: x.date,
  link: docLinkFromRel(x.rel)
}))

// Merge local articles into recent list, sort by date descending, take top 8
const allRecent = [...localArticles, ...recentFromRepo]
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 8)
  .map(({ text, date, link }) => ({ text, date, link }))

fs.mkdirSync(path.dirname(outHomeRecent), { recursive: true })
fs.writeFileSync(
  outHomeRecent,
  `// Auto-generated by scripts/generate_science_index.mjs\nexport const recentScienceUpdates = ${JSON.stringify(allRecent, null, 2)}\n`,
  'utf-8'
)

console.log(`Generated: ${path.relative(repoRoot, outIndexMd)} (${filesRel.length} repo md + ${localArticles.length} local articles scanned)`)
