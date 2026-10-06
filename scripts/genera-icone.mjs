// Genera le icone PNG (iPhone, Android, favicon) partendo da public/icona.svg (impostazioni in pwa-assets.config.ts)
import { execSync } from 'node:child_process'

execSync('npx pwa-assets-generator', { stdio: 'inherit' })
