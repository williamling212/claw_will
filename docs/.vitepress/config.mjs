import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '拉萨路计划',
  description: '一个基于 OpenClaw 能力的探索网站',

  // Project Pages base path: https://williamling212.github.io/claw_will/
  base: '/claw_will/',

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '公司分析', link: '/company/' }
    ],
    sidebar: {
      '/company/': [
        {
          text: '公司分析',
          items: [
            { text: '导览', link: '/company/' },
            { text: '内容目录', link: '/company/content/' },
            {
              text: '字节跳动',
              link: '/company/content/company_analysis/字节跳动/notes'
            }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/williamling212' }
    ]
  }
})
