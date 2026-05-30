import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '../pages/Dashboard.vue'
import Settings from '../pages/Settings.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: Dashboard },
    { path: '/settings', component: Settings },
  ]
})
