import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const contentRoot = path.join(repoRoot, 'docs/company/content/company_analysis')
const outFile = path.join(repoRoot, 'docs/company/content/index.md')

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

const files = fs.existsSync(contentRoot) ? walk(contentRoot) : []

// Build groups by first path segment under company_analysis
const groups = new Map()
for (const f of files) {
  const rel = path.relative(contentRoot, f)
  const seg = rel.split(path.sep)[0] || ''
  const group = seg === 'README.md' ? 'ROOT' : seg
  if (!groups.has(group)) groups.set(group, [])
  groups.get(group).push(rel)
}

function titleFromFile(rel) {
  const base = path.basename(rel, '.md')
  // keep original filename; it's already descriptive
  return base
}

function linkFromRel(rel) {
  // VitePress routes drop .md extension
  const noExt = rel.replace(/\.md$/i, '')
  return './company_analysis/' + toPosix(noExt)
}

const lines = []
lines.push('# 内容目录')
lines.push('')
lines.push('本页由构建脚本自动生成：扫描 `company_analysis` 仓库并生成可点击目录。')
lines.push('')

// ROOT (README)
if (groups.has('ROOT')) {
  const rootFiles = groups.get('ROOT').filter(x => x.toLowerCase() === 'readme.md')
  if (rootFiles.length) {
    lines.push('## 总览')
    lines.push('')
    lines.push(`- [README](${linkFromRel(rootFiles[0])})`)
    lines.push('')
  }
}

// Other groups
const groupNames = [...groups.keys()].filter(g => g !== 'ROOT').sort((a,b) => a.localeCompare(b, 'zh-Hans-CN'))
for (const g of groupNames) {
  lines.push(`## ${g}`)
  lines.push('')
  const rels = groups.get(g)
    .filter(r => !r.toLowerCase().endsWith('/readme.md'))
    .sort((a,b) => a.localeCompare(b, 'zh-Hans-CN'))

  for (const rel of rels) {
    const t = titleFromFile(rel)
    lines.push(`- [${t}](${linkFromRel(rel)})`)
  }
  lines.push('')
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, lines.join('\n'), 'utf-8')
console.log(`Generated: ${path.relative(repoRoot, outFile)} (${files.length} md files scanned)`)