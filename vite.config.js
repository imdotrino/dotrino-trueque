import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { execSync } from 'node:child_process'

// base relativo: la app se sirve bajo el subdominio cerca.dotrino.com
// <meta name="commit"> con el hash del commit del build (CONVENCIONES-APPS §3).
function commitMeta () {
  let hash = 'dev'
  try { hash = execSync('git rev-parse --short HEAD').toString().trim() } catch { /* sin git */ }
  return {
    name: 'commit-meta',
    transformIndexHtml: (html) =>
      html.replace('</head>', `  <meta name="commit" content="${hash}" />
  </head>`),
  }
}

export default defineConfig({
  base: './',
  // Los `dotrino-*` son Web Components (custom elements), no componentes Vue.
  plugins: [commitMeta(), vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('dotrino-') } } })]
})
