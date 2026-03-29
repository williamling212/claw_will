---
layout: home
hero:
  name: 拉萨路计划
  text: 一个基于 OpenClaw 能力的探索网站
  tagline: 把零散的洞察整理成可持续迭代的知识库。
  actions:
    - theme: brand
      text: 进入公司分析
      link: /company/
    - theme: alt
      text: 进入经济观察
      link: /econ/
features:
  - title: 内容与网站解耦
    details: company_analysis 与 economic_observation 作为内容仓库独立演进；网站负责展示与导航。
  - title: 自动同步
    details: 每次 push 内容仓库都会触发站点重新部署。
  - title: 极简但不简陋
    details: 更舒服的中文排版与站内搜索，重点是"能读、好找、好维护"。
---

<script setup>
import { withBase } from 'vitepress'
import { recentCompanyUpdates } from './.vitepress/generated/recentCompanyUpdates.mjs'
import { recentEconUpdates } from './.vitepress/generated/recentEconUpdates.mjs'
import { computed } from 'vue'

const allRecent = computed(() => {
  return [...recentCompanyUpdates, ...recentEconUpdates]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
})
</script>

## 最近更新

<div v-if="allRecent.length" class="recent-updates">
  <ul>
    <li v-for="item in allRecent" :key="item.link">
      <a :href="withBase(item.link)">{{ item.text }}</a>
      <span class="date">{{ item.date }}</span>
    </li>
  </ul>
</div>
<div v-else class="recent-updates-empty">
  暂无（构建后会自动生成最近更新列表）。
</div>
