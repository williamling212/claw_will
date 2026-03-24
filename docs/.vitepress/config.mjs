import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '拉萨路计划',
  description: '一个基于 OpenClaw 能力的探索网站',

  // Project Pages base path: https://williamling212.github.io/claw_will/
  base: '/claw_will/',

  lastUpdated: true,
  cleanUrls: true,
  // company_analysis 内容在 CI 构建时拉取；本地不一定存在，避免死链检查导致构建失败
  ignoreDeadLinks: true,

  themeConfig: {
    siteTitle: '拉萨路计划',

    nav: [
      { text: '首页', link: '/' },
      { text: '公司分析', link: '/company/' },
      { text: '内容目录', link: '/company/content/' }
    ],

    sidebar: {
      '/company/': [
        {
          text: '公司分析',
          items: [
            { text: '导览', link: '/company/' },
            { text: '内容目录', link: '/company/content/' },
            { text: '字节跳动', link: '/company/content/company_analysis/字节跳动/notes' }
          ]
        }
      ]
    },

    outline: { level: [2, 3], label: '本页目录' },

    footer: {
      message: '拉萨路计划 · 基于 OpenClaw 的探索',
      copyright: `Copyright © ${new Date().getUTCFullYear()} Claw_Will`
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/williamling212' }],

    search: {
      provider: 'local'
    }
  }
})
