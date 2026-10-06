import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// L'icona ha già il suo sfondo scuro e i margini giusti: niente bordi bianchi aggiunti
const sfondo = { background: '#0f1115' }

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: sfondo },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: sfondo },
  },
  images: ['public/icona.svg'],
})
