<script setup>
import { computed } from 'vue'
import { useRoute, withBase } from 'vitepress'

const route = useRoute()

const crumbs = computed(() => {
  const path = route.path || '/'
  // only show breadcrumbs for company content pages
  if (!path.startsWith('/company/')) return []

  const segs = path.split('/').filter(Boolean)

  // Build cumulative links
  const out = []
  let acc = ''

  const labelMap = new Map([
    ['company', '公司分析'],
    ['content', '内容目录'],
    ['company_analysis', 'company_analysis']
  ])

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    acc += '/' + s

    // Prefer human labels for some fixed segments
    let text = labelMap.get(s)
    if (!text) {
      try {
        text = decodeURIComponent(s)
      } catch {
        text = s
      }
    }

    // Skip showing the repo folder name; it's noise, but keep link structure intact
    if (s === 'company_analysis') continue

    out.push({
      text,
      link: withBase(acc + '/')
    })
  }

  // Ensure first crumb is home-ish within company section
  if (out.length && out[0].text !== '公司分析') {
    out.unshift({ text: '公司分析', link: withBase('/company/') })
  }

  // Deduplicate consecutive same links/text
  return out.filter((c, idx) => idx === 0 || c.link !== out[idx - 1].link)
})
</script>

<template>
  <nav v-if="crumbs.length" class="breadcrumb" aria-label="Breadcrumb">
    <a class="breadcrumb__home" :href="withBase('/company/')">公司分析</a>
    <span class="breadcrumb__sep">/</span>
    <template v-for="(c, i) in crumbs" :key="c.link">
      <a class="breadcrumb__item" :href="c.link">{{ c.text }}</a>
      <span v-if="i !== crumbs.length - 1" class="breadcrumb__sep">/</span>
    </template>
  </nav>
</template>

<style scoped>
.breadcrumb {
  font-size: 13px;
  color: var(--vp-c-text-2);
  margin: 0 0 12px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.breadcrumb__sep {
  color: var(--vp-c-text-3);
}

.breadcrumb__item,
.breadcrumb__home {
  color: var(--vp-c-text-2);
  text-decoration: none;
}

.breadcrumb__item:hover,
.breadcrumb__home:hover {
  color: var(--vp-c-text-1);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
