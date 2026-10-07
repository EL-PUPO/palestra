import { useLiveQuery } from 'dexie-react-hooks'
import { FileAudio, Pause, Play, Search, Shuffle, SkipBack, SkipForward, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { db, nuovoId } from '../db'
import { mmss, normalizzaNome, numero } from '../lib/formato'
import {
  avanti,
  cambiaCasuale,
  ferma,
  impostaComandiVisibili,
  indietro,
  playPausa,
  suonaBrani,
  useLettoreLocale,
  vaiA,
} from '../lib/lettoreLocale'
import { durataFile, leggiTagFile, nomeDaFile } from '../lib/tagAudio'
import { mostraMessaggio } from './ui'

const FORMATI = /\.(mp3|m4a|aac|wav|aiff?|flac|ogg|opus)$/i

function megabyte(byte: number) {
  return `${numero(byte / 1048576, byte > 100 * 1048576 ? 0 : 1)} MB`
}

/** Importa file musicali dall'app File: titolo e artista dai tag o dal nome del file */
async function importaFile(file: File[], avanzamento: (fatti: number) => void): Promise<{ aggiunti: number; doppi: number; errore?: string }> {
  const esistenti = await db.brani.toArray()
  let aggiunti = 0
  let doppi = 0
  for (const [i, f] of file.entries()) {
    avanzamento(i)
    if (!f.type.startsWith('audio/') && !FORMATI.test(f.name)) continue
    const tag = await leggiTagFile(f)
    const daNome = nomeDaFile(f.name)
    const titolo = tag.titolo || daNome.titolo || 'Brano'
    const artista = tag.artista || daNome.artista
    if (esistenti.some((b) => b.dimensione === f.size && normalizzaNome(b.titolo) === normalizzaNome(titolo))) {
      doppi++
      continue
    }
    try {
      await db.brani.add({
        id: nuovoId(),
        titolo,
        artista,
        durata: await durataFile(f),
        file: new Blob([f], { type: f.type || 'audio/mpeg' }),
        dimensione: f.size,
        aggiuntoIl: Date.now() + i,
      })
      aggiunti++
    } catch {
      return { aggiunti, doppi, errore: 'Spazio finito sul telefono: non tutti i brani sono stati aggiunti' }
    }
  }
  avanzamento(file.length)
  return { aggiunti, doppi }
}

/** "I miei brani": libreria di MP3 importati, senza pubblicità e senza internet */
export function LibreriaBrani() {
  const brani = useLiveQuery(() => db.brani.orderBy('aggiuntoIl').toArray(), [])
  const s = useLettoreLocale()
  const comandi = useRef<HTMLDivElement>(null)
  const [cerca, setCerca] = useState('')
  const [importo, setImporto] = useState<{ fatti: number; totale: number } | null>(null)

  // quando i comandi grandi escono dallo schermo (o chiudi il pannello) compare la barra piccola
  useEffect(() => {
    const el = comandi.current
    if (!el) return
    const oss = new IntersectionObserver(([v]) => impostaComandiVisibili(v.isIntersecting), { rootMargin: '-60px 0px 0px 0px' })
    oss.observe(el)
    return () => {
      oss.disconnect()
      impostaComandiVisibili(false)
    }
  }, [brani?.length])

  if (!brani) return null

  const importa = async (lista: FileList | null) => {
    if (!lista?.length) return
    const file = [...lista]
    setImporto({ fatti: 0, totale: file.length })
    const r = await importaFile(file, (fatti) => setImporto({ fatti, totale: file.length }))
    setImporto(null)
    if (r.errore) mostraMessaggio(r.errore)
    else if (!r.aggiunti && r.doppi) mostraMessaggio('Questi brani c’erano già')
    else mostraMessaggio(r.aggiunti === 1 ? '1 brano aggiunto' : `${r.aggiunti} brani aggiunti`)
  }

  const elimina = async (id: string, titolo: string) => {
    if (!confirm(`Togliere «${titolo}» dall'app? Il file nell'app File resta.`)) return
    if (s.coda[s.indice] === id) {
      if (s.coda.length > 1) avanti()
      else ferma()
    }
    await db.brani.delete(id)
  }

  const q = normalizzaNome(cerca)
  const visibili = q ? brani.filter((b) => normalizzaNome(`${b.titolo} ${b.artista ?? ''}`).includes(q)) : brani
  const ids = brani.map((b) => b.id)
  const idCorrente = s.coda[s.indice]
  const spazio = brani.reduce((t, b) => t + b.dimensione, 0)

  const pulsanteImporta = (
    <label className={`btn ${brani.length ? 'piccolo' : 'primario'}`} aria-disabled={!!importo}>
      <Upload size={brani.length ? 16 : 18} /> {importo ? `Importo ${importo.fatti + 1} di ${importo.totale}…` : brani.length ? 'Importa' : 'Importa dai File'}
      <input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg" multiple hidden disabled={!!importo} onChange={(e) => importa(e.target.files).then(() => (e.target.value = ''))} />
    </label>
  )

  if (!brani.length) {
    return (
      <div className="colonna centro" style={{ alignItems: 'center', padding: '8px 0' }}>
        <FileAudio size={36} style={{ color: 'var(--testo-3)' }} />
        <p className="piccolo muto">
          Importa gli MP3 che hai nell'app File (anche tanti insieme). Restano nell'app: si ascoltano senza pubblicità e senza internet.
        </p>
        {pulsanteImporta}
      </div>
    )
  }

  return (
    <>
      {s.indice >= 0 && (
        <div className="colonna" style={{ gap: 8 }}>
          <div>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titolo}</div>
            <div className="piccolo muto">{s.artista || `Brano ${s.indice + 1} di ${s.coda.length}`}</div>
          </div>
          <div className="avanzamento-musica">
            <span>{mmss(s.tempo)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(s.durata))}
              step={1}
              value={Math.min(Math.floor(s.tempo), Math.floor(s.durata) || 0)}
              onChange={(e) => vaiA(Number(e.target.value))}
              aria-label="Posizione nel brano"
            />
            <span>{mmss(s.durata)}</span>
          </div>
        </div>
      )}
      <div className="comandi-musica" ref={comandi}>
        <button className={`btn-icona${s.casuale ? ' pieno' : ''}`} aria-label="Ordine casuale" aria-pressed={s.casuale} onClick={cambiaCasuale} style={s.casuale ? { color: 'var(--accento)' } : undefined}>
          <Shuffle size={20} />
        </button>
        <button className="btn-icona" aria-label="Brano precedente" onClick={indietro} disabled={s.indice < 0}>
          <SkipBack size={24} />
        </button>
        <button
          className="tasto-play"
          aria-label={s.inRiproduzione ? 'Pausa' : 'Riproduci'}
          onClick={() => (s.indice < 0 ? suonaBrani(ids, s.casuale ? Math.floor(Math.random() * ids.length) : 0) : playPausa())}
        >
          {s.inRiproduzione ? <Pause size={28} /> : <Play size={28} />}
        </button>
        <button className="btn-icona" aria-label="Brano successivo" onClick={avanti} disabled={s.indice < 0}>
          <SkipForward size={24} />
        </button>
        <button className="btn-icona" aria-label="Ferma la musica" onClick={ferma} disabled={s.indice < 0}>
          <X size={20} />
        </button>
      </div>

      <div className="riga spazio">
        <span className="piccolo muto">
          {brani.length} {brani.length === 1 ? 'brano' : 'brani'} · {megabyte(spazio)}
        </span>
        {pulsanteImporta}
      </div>
      {brani.length > 8 && (
        <div className="riga" style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--testo-3)' }} />
          <input className="input" style={{ paddingLeft: 36, minHeight: 38 }} placeholder="Cerca un brano" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        </div>
      )}
      <div className="lista" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {visibili.map((b) => {
          const corrente = b.id === idCorrente
          return (
            <div key={b.id} className="voce" style={{ minHeight: 48, padding: '6px 6px 6px 12px', gap: 6 }}>
              <button className="corpo" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', minWidth: 0 }} onClick={() => suonaBrani(ids, ids.indexOf(b.id))}>
                <div className="titolo" style={{ fontWeight: corrente ? 650 : 500, color: corrente ? 'var(--accento)' : undefined }}>
                  {b.titolo}
                </div>
                <div className="sotto">{[b.artista, b.durata ? mmss(b.durata) : undefined].filter(Boolean).join(' · ')}</div>
              </button>
              <button className="btn-icona" aria-label={`Togli ${b.titolo}`} onClick={() => elimina(b.id, b.titolo)}>
                <Trash2 size={17} />
              </button>
            </div>
          )
        })}
        {!visibili.length && <div className="voce muto">Nessun brano trovato</div>}
      </div>
    </>
  )
}

/** Barra piccola in alto, in tutta l'app, quando i brani suonano e i comandi grandi non si vedono */
export function MiniBrani() {
  const s = useLettoreLocale()
  const [alto, setAlto] = useState(56)
  const visibile = s.indice >= 0 && !s.comandiVisibili && !s.youtubeAperto
  useEffect(() => {
    if (visibile) setAlto(document.querySelector('.testata')?.getBoundingClientRect().height ?? 56)
  }, [visibile])
  if (!visibile) return null
  return (
    <div className="mini-musica" style={{ top: alto }}>
      <div className="contenuto">
        <FileAudio size={16} style={{ color: 'var(--accento)', flexShrink: 0 }} />
        <span className="cresci piccolo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
          {s.titolo}
        </span>
        <button className="btn-icona pieno" aria-label={s.inRiproduzione ? 'Pausa' : 'Riproduci'} onClick={playPausa}>
          {s.inRiproduzione ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className="btn-icona" aria-label="Brano successivo" onClick={avanti}>
          <SkipForward size={18} />
        </button>
        <button className="btn-icona" aria-label="Ferma la musica" onClick={ferma}>
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
