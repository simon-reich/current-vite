import { createRouter, createWebHashHistory } from 'vue-router'
import AllTodos from '../views/AllTodos.vue'
import Current from '../views/Current.vue'
import Calendar from '../views/Calendar.vue'
import Settings from '../views/Settings.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/all' },
    { path: '/all', component: AllTodos },
    { path: '/current', component: Current },
    { path: '/calendar', component: Calendar },
    { path: '/settings', component: Settings },
  ],
})

export default router
