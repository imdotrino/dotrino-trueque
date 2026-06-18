import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base relativo: la app se sirve bajo el subdominio cerca.dotrino.com
export default defineConfig({
  base: './',
  // Los `dotrino-*` son Web Components (custom elements), no componentes Vue.
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('dotrino-') } } })]
})
