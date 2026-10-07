import { AlertTriangle, Check, ExternalLink, FastForward, Library, ListMusic, Music, Pause, Pencil, Play, Plus, Rewind, Shuffle, SkipBack, SkipForward, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { aggiornaImpostazioni, impostazioni, useImpostazioni } from '../lib/impostazioni'
import { mmss } from '../lib/formato'
import { leggiLinkYouTube, linkNelTesto, stessoLink, urlApp } from '../lib/musica'
import { caricaYouTube, nomeDaLink, STATO, titoloVideo, type LettoreYouTube } from '../lib/youtube'
import { Foglio } from './ui'

function tipoLink(link: string): string {
  const l = leggiLinkYouTube(link)
  if (l?.lista?.startsWith('RD')) return 'Mix di YouTube'
  return l?.lista ? 'Playlist' : 'Video singolo'
}

/** Segna una playlist come ascoltabile o no dentro l'app */
function segnaBloccata(link: string, bloccata: boolean) {
  const musica = impostazioni().musica
  if (musica.some((m) => m.link === link && !!m.bloccata !== bloccata)) {
    aggiornaImpostazioni({ musica: musica.map((m) => (m.link === link ? { ...m, bloccata: bloccata || undefined } : m)) })
  }
}

/** Le tue playlist: scegli, rinomina, elimina e aggiungine anche più di una alla volta */
export function GestionePlaylist({ scelta }: { scelta?: () => void }) {
  const imp = useImpostazioni()
  const [testo, setTesto] = useState('')
  const [nome, setNome] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [occupato, setOccupato] = useState(false)
  const [rinomina, setRinomina] = useState<{ indice: number; nome: string } | null>(null)
  const trovati = linkNelTesto(testo)

  const aggiungi = async () => {
    if (!trovati.length) {
      setMessaggio('Non trovo link di YouTube: copiali da YouTube con Condividi → Copia link')
      return
    }
    setOccupato(true)
    const prima = impostazioni().musica
    const nuovi = trovati.filter((l) => !prima.some((m) => stessoLink(m.link, l)))
    const conNome = await Promise.all(
      nuovi.map(async (link, i) => ({
        link,
        nome: (trovati.length === 1 && nome.trim()) || (await nomeDaLink(leggiLinkYouTube(link)!)) || `Playlist ${prima.length + i + 1}`,
      })),
    )
    const attuali = impostazioni().musica
    aggiornaImpostazioni({ musica: [...attuali, ...conNome], ...(conNome.length ? { musicaScelta: attuali.length } : {}) })
    setMessaggio(!conNome.length ? 'Le avevi già salvate' : conNome.length === 1 ? `Aggiunta «${conNome[0].nome}»` : `Aggiunte ${conNome.length} playlist`)
    setTesto('')
    setNome('')
    setOccupato(false)
  }

  const elimina = (i: number) => {
    const m = imp.musica[i]
    if (!confirm(`Togliere «${m.nome}»?`)) return
    const scelta = imp.musicaScelta > i ? imp.musicaScelta - 1 : imp.musicaScelta === i ? 0 : imp.musicaScelta
    aggiornaImpostazioni({ musica: imp.musica.filter((_, j) => j !== i), musicaScelta: scelta })
  }

  const salvaNome = () => {
    if (rinomina && rinomina.nome.trim()) {
      aggiornaImpostazioni({ musica: imp.musica.map((m, j) => (j === rinomina.indice ? { ...m, nome: rinomina.nome.trim() } : m)) })
    }
    setRinomina(null)
  }

  return (
    <div className="colonna">
      {imp.musica.length > 0 && (
        <div className="lista">
          {imp.musica.map((m, i) => (
            <div key={m.link} className="voce" style={{ gap: 4, paddingRight: 6 }}>
              {rinomina?.indice === i ? (
                <input
                  className="input cresci"
                  autoFocus
                  value={rinomina.nome}
                  onChange={(e) => setRinomina({ indice: i, nome: e.target.value })}
                  onBlur={salvaNome}
                  onKeyDown={(e) => e.key === 'Enter' && salvaNome()}
                  aria-label="Nuovo nome"
                />
              ) : (
                <button
                  className="corpo"
                  style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', minWidth: 0 }}
                  onClick={() => {
                    aggiornaImpostazioni({ musicaScelta: i })
                    scelta?.()
                  }}
                >
                  <div className="titolo riga" style={{ gap: 6, color: i === imp.musicaScelta ? 'var(--accento)' : undefined }}>
                    {i === imp.musicaScelta && <Check size={16} style={{ flexShrink: 0 }} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nome}</span>
                  </div>
                  <div className={`sotto${m.bloccata ? ' attenzione' : ''}`}>{m.bloccata ? 'Si ascolta solo nell’app YouTube' : tipoLink(m.link)}</div>
                </button>
              )}
              <button className="btn-icona" aria-label={`Rinomina ${m.nome}`} onClick={() => setRinomina({ indice: i, nome: m.nome })}>
                <Pencil size={17} />
              </button>
              <button className="btn-icona" aria-label={`Togli ${m.nome}`} onClick={() => elimina(i)}>
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="campo">
        <span>Aggiungi playlist: incolla uno o più link, anche tutti insieme</span>
        <textarea
          className="input"
          style={{ minHeight: 84 }}
          placeholder={'https://www.youtube.com/playlist?list=…\nhttps://www.youtube.com/watch?v=…&list=…'}
          value={testo}
          onChange={(e) => {
            setTesto(e.target.value)
            setMessaggio('')
          }}
        />
      </label>
      {trovati.length <= 1 ? (
        <input className="input" placeholder="Nome (facoltativo: lo prendo da YouTube)" value={nome} onChange={(e) => setNome(e.target.value)} />
      ) : (
        <p className="piccolo muto">Trovati {trovati.length} link: i nomi li prendo da YouTube, poi puoi cambiarli.</p>
      )}
      <button className="btn tenue" onClick={aggiungi} disabled={!testo.trim() || occupato}>
        <Plus size={18} /> {occupato ? 'Aggiungo…' : trovati.length > 1 ? `Aggiungi ${trovati.length} playlist` : 'Aggiungi playlist'}
      </button>
      {messaggio && <p className="piccolo muto">{messaggio}</p>}
    </div>
  )
}

/** Lettore con comandi dell'app (indietro, play/pausa, avanti, casuale, scelta del brano) */
function Lettore({ indirizzo }: { indirizzo: string }) {
  const link = useMemo(() => leggiLinkYouTube(indirizzo), [indirizzo])
  const contenitore = useRef<HTMLDivElement>(null)
  const comandi = useRef<HTMLDivElement>(null)
  const lettore = useRef<LettoreYouTube | null>(null)
  const [stato, setStato] = useState(-1)
  const [titolo, setTitolo] = useState('')
  const [indice, setIndice] = useState(-1)
  const [lista, setLista] = useState<string[]>([])
  const [casuale, setCasuale] = useState(false)
  const [elenco, setElenco] = useState(false)
  const [nomi, setNomi] = useState<Record<string, string>>({})
  const [avviso, setAvviso] = useState('')
  const [comandiVisibili, setComandiVisibili] = useState(true)
  const [altezzaTestata, setAltezzaTestata] = useState(56)
  /** nemmeno il primo brano si può ascoltare qui: la lista non si carica */
  const [bloccata, setBloccata] = useState(false)
  const [tempo, setTempo] = useState(0)
  const [durata, setDurata] = useState(0)

  useEffect(() => {
    if (!link || !contenitore.current) return
    let finito = false
    const segnaposto = document.createElement('div')
    contenitore.current.replaceChildren(segnaposto)
    const aggiornaInfo = (p: LettoreYouTube) => {
      setDurata(p.getDuration?.() ?? 0)
      setTempo(p.getCurrentTime?.() ?? 0)
      setTitolo(p.getVideoData()?.title ?? '')
      setIndice(p.getPlaylistIndex())
      setLista(p.getPlaylist() ?? [])
    }
    caricaYouTube()
      .then((YT) => {
        if (finito) return
        lettore.current = new YT.Player(segnaposto, {
          width: '100%',
          height: '100%',
          // con un link solo-playlist il campo non va proprio messo: vuoto dà "Invalid video id"
          ...(link.video ? { videoId: link.video } : {}),
          playerVars: { playsinline: 1, rel: 0, controls: 0, ...(link.lista ? { listType: 'playlist', list: link.lista } : {}) },
          events: {
            onReady: (e) => aggiornaInfo(e.target),
            onStateChange: (e) => {
              setStato(e.data)
              aggiornaInfo(e.target)
              if (e.data === STATO.inRiproduzione || e.data === STATO.caricamento) setAvviso('')
              if (e.data === STATO.inRiproduzione) segnaBloccata(indirizzo, false)
            },
            onError: (e) => {
              const bloccato = e.data === 101 || e.data === 150 || e.data === 100
              const altri = (e.target.getPlaylist()?.length ?? 0) > 1
              if (bloccato && !altri) {
                setBloccata(true)
                segnaBloccata(indirizzo, true)
                return
              }
              setAvviso(bloccato ? `Questo brano non si può ascoltare fuori da YouTube${altri ? ': passo al successivo' : ''}` : 'YouTube non riesce a riprodurre questo brano')
              if (altri) setTimeout(() => e.target.nextVideo(), 1500)
            },
          },
        })
      })
      .catch((e: Error) => setAvviso(e.message === 'YouTube non raggiungibile' ? 'Serve la connessione a internet per la musica' : 'YouTube non riesce ad aprire questo link'))
    return () => {
      finito = true
      lettore.current?.destroy()
      lettore.current = null
    }
  }, [link, indirizzo])

  // barra piccola in alto quando i comandi escono dallo schermo
  useEffect(() => {
    setAltezzaTestata(document.querySelector('.testata')?.getBoundingClientRect().height ?? 56)
    const el = comandi.current
    if (!el) return
    const oss = new IntersectionObserver(([v]) => setComandiVisibili(v.isIntersecting), { rootMargin: '-60px 0px 0px 0px' })
    oss.observe(el)
    return () => oss.disconnect()
  }, [])

  // titoli dei brani della playlist, a gruppi, solo quando apri l'elenco
  useEffect(() => {
    if (!elenco) return
    let fermo = false
    void (async () => {
      const mancanti = lista.slice(0, 200).filter((id) => !nomi[id])
      for (let i = 0; i < mancanti.length && !fermo; i += 6) {
        const gruppo = mancanti.slice(i, i + 6)
        const trovati = await Promise.all(gruppo.map(async (id) => [id, (await titoloVideo(id)) ?? ''] as const))
        if (!fermo) setNomi((n) => ({ ...n, ...Object.fromEntries(trovati.filter(([, t]) => t)) }))
      }
    })()
    return () => {
      fermo = true
    }
  }, [elenco, lista])

  const suona = stato === STATO.inRiproduzione || stato === STATO.caricamento

  // posizione nel brano aggiornata mentre suona
  useEffect(() => {
    if (!suona) return
    const t = setInterval(() => {
      const p = lettore.current
      if (!p) return
      setTempo(p.getCurrentTime())
      setDurata(p.getDuration())
    }, 500)
    return () => clearInterval(t)
  }, [suona])

  if (!link) return <p className="piccolo pericolo">Questo link non è valido: cambialo nelle impostazioni.</p>

  const vaiA = (secondi: number) => {
    const t = Math.max(0, Math.min(durata || secondi, secondi))
    setTempo(t)
    lettore.current?.seekTo(t, true)
  }
  const playPausa = () => {
    const p = lettore.current
    if (!p) return
    if (suona) {
      p.pauseVideo()
      return
    }
    p.playVideo()
    setTimeout(() => {
      const s = p.getPlayerState()
      if (s !== STATO.inRiproduzione && s !== STATO.caricamento) setAvviso('La prima volta tocca il video qui sopra per farlo partire')
    }, 1500)
  }
  const avanti = () => {
    setAvviso('')
    lettore.current?.nextVideo()
  }
  const indietro = () => {
    setAvviso('')
    lettore.current?.previousVideo()
  }
  const mescola = () => {
    lettore.current?.setShuffle(!casuale)
    setCasuale(!casuale)
  }
  const playlist = lista.length > 1

  const tastiPrincipali = (piccoli: boolean) => (
    <>
      <button className="btn-icona" aria-label="Brano precedente" onClick={indietro} disabled={!playlist}>
        <SkipBack size={piccoli ? 18 : 24} />
      </button>
      <button className={piccoli ? 'btn-icona pieno' : 'tasto-play'} aria-label={suona ? 'Pausa' : 'Riproduci'} onClick={playPausa}>
        {suona ? <Pause size={piccoli ? 18 : 28} /> : <Play size={piccoli ? 18 : 28} />}
      </button>
      <button className="btn-icona" aria-label="Brano successivo" onClick={avanti} disabled={!playlist}>
        <SkipForward size={piccoli ? 18 : 24} />
      </button>
    </>
  )

  if (bloccata) {
    return (
      <>
        <div ref={contenitore} hidden />
        <div className="avviso">
          <p>La casa discografica non permette di ascoltare questa musica fuori da YouTube, quindi qui dentro non parte.</p>
        </div>
        <a className="btn primario" href={urlApp(indirizzo)}>
          <ExternalLink size={18} /> Apri nell'app YouTube
        </a>
        <p className="piccolo muto">
          Con YouTube Premium continua a suonare mentre usi la Palestra; senza Premium si ferma quando torni qui. Oppure scegli un'altra playlist.
        </p>
      </>
    )
  }

  return (
    <>
      <div className="musica-video" ref={contenitore} />
      <div>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titolo || 'Caricamento…'}</div>
        <div className="piccolo muto">{playlist ? `Brano ${indice + 1} di ${lista.length}` : 'Video singolo: per scegliere le canzoni salva il link di una playlist'}</div>
      </div>
      <div className="avanzamento-musica">
        <button className="btn-icona" aria-label="Indietro di 10 secondi" onClick={() => vaiA(tempo - 10)} disabled={!durata}>
          <Rewind size={18} />
        </button>
        <span>{mmss(tempo)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(durata))}
          step={1}
          value={Math.min(Math.floor(tempo), Math.floor(durata) || 0)}
          onChange={(e) => vaiA(Number(e.target.value))}
          disabled={!durata}
          aria-label="Posizione nel brano"
        />
        <span>{mmss(durata)}</span>
        <button className="btn-icona" aria-label="Avanti di 10 secondi" onClick={() => vaiA(tempo + 10)} disabled={!durata}>
          <FastForward size={18} />
        </button>
      </div>
      <div className="comandi-musica" ref={comandi}>
        <button className={`btn-icona${casuale ? ' pieno' : ''}`} aria-label="Ordine casuale" aria-pressed={casuale} onClick={mescola} disabled={!playlist} style={casuale ? { color: 'var(--accento)' } : undefined}>
          <Shuffle size={20} />
        </button>
        {tastiPrincipali(false)}
        <button className={`btn-icona${elenco ? ' pieno' : ''}`} aria-label="Scegli il brano" aria-expanded={elenco} onClick={() => setElenco(!elenco)} disabled={!playlist}>
          <ListMusic size={20} />
        </button>
      </div>
      {avviso && <p className="piccolo attenzione centro">{avviso}</p>}
      {elenco && playlist && (
        <div className="lista" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {lista.map((id, i) => (
            <button
              key={`${id}-${i}`}
              className="voce"
              style={{ minHeight: 44, padding: '8px 12px' }}
              onClick={() => {
                setAvviso('')
                lettore.current?.playVideoAt(i)
              }}
            >
              <span className="serie-n" style={{ minWidth: 24 }}>
                {i === indice && suona ? <Music size={14} style={{ color: 'var(--accento)' }} /> : i + 1}
              </span>
              <span className="corpo titolo" style={{ fontWeight: i === indice ? 650 : 400, color: i === indice ? 'var(--accento)' : undefined }}>
                {nomi[id] ?? '…'}
              </span>
            </button>
          ))}
        </div>
      )}
      <a className="piccolo muto riga" style={{ alignSelf: 'center', gap: 4 }} href={urlApp(indirizzo)}>
        <ExternalLink size={13} /> Apri nell'app YouTube (in sottofondo solo con Premium)
      </a>

      {!comandiVisibili && (
        <div className="mini-musica" style={{ top: altezzaTestata }}>
          <div className="contenuto">
            <Music size={16} style={{ color: 'var(--accento)', flexShrink: 0 }} />
            <span className="cresci piccolo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
              {titolo || 'Musica'}
            </span>
            {tastiPrincipali(true)}
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Musica da YouTube dentro l'app: va finché l'app è aperta e il pannello è aperto.
 * Chiudendo il pannello la musica si ferma.
 */
export function PannelloMusica({ chiudi }: { chiudi: () => void }) {
  const imp = useImpostazioni()
  const [gestione, setGestione] = useState(false)
  const scelta = Math.min(imp.musicaScelta, Math.max(0, imp.musica.length - 1))
  const brano = imp.musica[scelta]

  return (
    <div className="card colonna" style={{ gap: 10 }}>
      <div className="riga spazio">
        <div className="riga" style={{ gap: 6 }}>
          <Music size={18} style={{ color: 'var(--accento)' }} />
          <h3>Musica</h3>
        </div>
        <div className="riga" style={{ gap: 2 }}>
          {brano && (
            <button className="btn piccolo" onClick={() => setGestione(true)}>
              <Library size={16} /> Playlist
            </button>
          )}
          <button className="btn-icona" aria-label="Chiudi la musica" onClick={chiudi}>
            <X size={20} />
          </button>
        </div>
      </div>

      {!brano ? (
        <>
          <p className="piccolo muto">In YouTube apri una playlist, tocca Condividi → Copia link e incollala qui. Puoi aggiungerne quante vuoi.</p>
          <GestionePlaylist />
        </>
      ) : (
        <>
          <div className="chips">
            {imp.musica.map((m, i) => (
              <button key={m.link} className={`chip${i === scelta ? ' attivo' : ''}`} onClick={() => aggiornaImpostazioni({ musicaScelta: i })}>
                {m.bloccata && <AlertTriangle size={13} />}
                {m.nome.length > 28 ? `${m.nome.slice(0, 27)}…` : m.nome}
              </button>
            ))}
            <button className="chip" onClick={() => setGestione(true)} aria-label="Aggiungi playlist">
              <Plus size={14} /> Aggiungi
            </button>
          </div>
          <Lettore key={brano.link} indirizzo={brano.link} />
        </>
      )}

      <Foglio aperto={gestione} chiudi={() => setGestione(false)} titolo="Le tue playlist">
        <GestionePlaylist scelta={() => setGestione(false)} />
      </Foglio>
    </div>
  )
}
