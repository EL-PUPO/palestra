import { describe, expect, it } from 'vitest'
import { leggiLinkYouTube, linkNelTesto, stessoLink, urlApp, urlLettore } from './musica'

describe('link di YouTube', () => {
  it('riconosce video, playlist e YouTube Music', () => {
    expect(leggiLinkYouTube('https://www.youtube.com/watch?v=abc123XYZ_-&list=PL1234')).toEqual({ video: 'abc123XYZ_-', lista: 'PL1234', musica: false })
    expect(leggiLinkYouTube('https://youtu.be/abc123XYZ_-?si=xyz')).toMatchObject({ video: 'abc123XYZ_-' })
    expect(leggiLinkYouTube('https://m.youtube.com/playlist?list=PLabc')).toMatchObject({ video: undefined, lista: 'PLabc' })
    expect(leggiLinkYouTube('https://music.youtube.com/playlist?list=OLAK5uy')).toMatchObject({ lista: 'OLAK5uy', musica: true })
    expect(leggiLinkYouTube('https://www.youtube.com/shorts/abc123XYZ_-')).toMatchObject({ video: 'abc123XYZ_-' })
  })

  it('scarta i link che non sono di YouTube', () => {
    expect(leggiLinkYouTube('https://open.spotify.com/playlist/123')).toBeUndefined()
    expect(leggiLinkYouTube('ciao')).toBeUndefined()
    expect(leggiLinkYouTube('https://www.youtube.com/')).toBeUndefined()
  })

  it('crea gli indirizzi per il lettore e per l’app', () => {
    expect(urlLettore({ lista: 'PLabc', musica: false })).toBe('https://www.youtube-nocookie.com/embed/videoseries?playsinline=1&rel=0&list=PLabc')
    expect(urlLettore({ video: 'abc123XYZ_-', musica: false })).toBe('https://www.youtube-nocookie.com/embed/abc123XYZ_-?playsinline=1&rel=0')
    expect(urlApp('https://www.youtube.com/playlist?list=PLabc')).toBe('youtube://www.youtube.com/playlist?list=PLabc')
  })
})

describe('più link insieme', () => {
  it('trova tutti i link di YouTube in un testo incollato', () => {
    const testo = `Mix palestra: https://www.youtube.com/watch?v=bgXslAqGJ58&list=RDbgXslAqGJ58&start_radio=1
https://www.youtube.com/playlist?list=PLRBp0Fe2GpgmsW46rJyudVFlY6IYjFBIK, e questa https://open.spotify.com/x
https://youtu.be/abc123XYZ_-`
    expect(linkNelTesto(testo)).toEqual([
      'https://www.youtube.com/watch?v=bgXslAqGJ58&list=RDbgXslAqGJ58&start_radio=1',
      'https://www.youtube.com/playlist?list=PLRBp0Fe2GpgmsW46rJyudVFlY6IYjFBIK',
      'https://youtu.be/abc123XYZ_-',
    ])
  })

  it('riconosce lo stesso link scritto in modo diverso', () => {
    expect(stessoLink('https://www.youtube.com/playlist?list=PLabc', 'https://m.youtube.com/watch?v=xyz123456&list=PLabc')).toBe(true)
    expect(stessoLink('https://youtu.be/abc123XYZ_-', 'https://www.youtube.com/watch?v=abc123XYZ_-')).toBe(true)
    expect(stessoLink('https://www.youtube.com/playlist?list=PLabc', 'https://www.youtube.com/playlist?list=PLdef')).toBe(false)
  })
})
