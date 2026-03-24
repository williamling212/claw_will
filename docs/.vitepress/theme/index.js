import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import './custom.css'

import Breadcrumb from './Breadcrumb.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'doc-before': () => h(Breadcrumb)
    })
  }
}
