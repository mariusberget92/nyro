import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './index.css'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

createApp(App).use(createPinia()).use(router).mount('#root')
