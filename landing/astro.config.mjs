import { defineConfig } from 'astro/config'

/** /estilos existe solo en desarrollo: la ruta nunca se registra en el build de producción. */
const estilosSoloEnDev = {
  name: 'estilos-solo-en-dev',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command === 'dev') {
        injectRoute({ pattern: '/estilos', entrypoint: './src/dev/estilos.astro' })
      }
    },
  },
}

export default defineConfig({
  site: 'https://mesh-app.com.ar',
  devToolbar: { enabled: false },
  integrations: [estilosSoloEnDev],
})
