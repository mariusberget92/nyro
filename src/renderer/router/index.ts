import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '../pages/Dashboard.vue'
import Settings from '../pages/Settings.vue'
import Podcasts from '../pages/Podcasts.vue'
import Library from '../pages/Library.vue'
import Playlists from '../pages/Playlists.vue'
import History from '../pages/History.vue'
import Equalizer from '../pages/Equalizer.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: Dashboard },
    { path: '/settings', component: Settings },
    { path: '/podcasts', component: Podcasts },
    { path: '/library', component: Library },
    { path: '/playlists', component: Playlists },
    { path: '/history', component: History },
    { path: '/equalizer', component: Equalizer },
  ]
})
