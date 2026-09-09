import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import './styles.css'

const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(
      new CustomEvent('learning-vim:update-ready', {
        detail: () => updateSW(true),
      }),
    )
  },
})

createApp(App).mount('#app')
