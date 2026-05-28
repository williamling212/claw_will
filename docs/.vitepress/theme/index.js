import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import './custom.css'

import Breadcrumb from './Breadcrumb.vue'
import RocketCanvas from './RocketCanvas.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'doc-before': () => h(Breadcrumb)
    })
  },
  enhanceApp({ app }) {
    app.component('RocketCanvas', RocketCanvas)
  }
}
