import { createApp } from 'vue'
import App from './App.vue'
import { createBackNav } from '@dotrino/nav'
import '@dotrino/install'
import './style.css'

// Navegación "volver" unificada del ecosistema (botón físico de Android / gesto
// de iOS / atrás del navegador / chevron del header → cierra modal o va a la
// página anterior; si no hay nada → dotrino.com).
createBackNav()

createApp(App).mount('#app')
