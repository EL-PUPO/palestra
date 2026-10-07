import { useLiveQuery } from 'dexie-react-hooks'
import {
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPen,
  Dumbbell,
  Flame,
  Flag,
  Minus,
  MoreHorizontal,
  Music,
  Plus,
  Replace,
  StickyNote,
  Timer,
  TimerOff,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BarraRecupero } from '../componenti/BarraRecupero'
import { CalcolatoreDischi } from '../componenti/CalcolatoreDischi'
import { PannelloMusica } from '../componenti/PannelloMusica'
import { ScegliEsercizio } from '../componenti/ScegliEsercizio'
import { aggiornaVoce, conKg, conValore, IntestazioneSerie, RigaSerie, Riscaldamento, serieInPiu, UltimaVolta } from '../componenti/Serie'
import { CampoNumero, CampoTesto, Foglio, mostraMessaggio, Testata, Vuoto } from '../componenti/ui'
import { db, type Esercizio, type Sessione, type VoceSessione } from '../db'
import {
  aggiungiVoce,
  assicuraEsercizio,
  concludiSessione,
  creaVoce,
  esitoCardio,
  esitoDa,
  obiettivoIniziale,
  percorsoSessione,
  type SceltaEsercizio,
} from '../lib/allenamento'
import { cercaNelCatalogo } from '../lib/catalogo'
import { descriviObiettivo } from '../lib/descrizioni'
import { giorniFa, mmss, numero, recupero } from '../lib/formato'
import { aggiornaImpostazioni, useImpostazioni, type Impostazioni } from '../lib/impostazioni'
import { contaSerie, obiettivoSerie, storicoEsercizio, suggerisci, type Prestazione } from '../lib/statistiche'
import { avviaRecupero, fermaRecupero, sbloccaAudio } from '../lib/timer'

function useSchermoAcceso(attivo: boolean) {
  useEffect(() => {
    if (!attivo || !('wakeLock' in navigator)) return
    let blocco: WakeLockSentinel | null = null
    let finito = false
    const richiedi = async () => {
      try {
        blocco = await navigator.wakeLock.request('screen')
      } catch {
        // non disponibile (es. batteria scarica)
      }
    }
    const visibilita = () => {
      if (document.visibilityState === 'visible' && !finito) void richiedi()
    }
    void richiedi()
    document.addEventListener('visibilitychange', visibilita)
    return () => {
      finito = true
      document.removeEventListener('visibilitychange', visibilita)
      void blocco?.release()
    }
  }, [attivo])
}

function Cronometro({ inizio }: { inizio: number }) {
  const [adesso, setAdesso] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setAdesso(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const sec = Math.floor((adesso - inizio) / 1000)
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{sec >= 3600 ? `${Math.floor(sec / 3600)}:${mmss(sec % 3600).padStart(5, '0')}` : mmss(sec)}</span>
}

const voceCompletata = (v: VoceSessione) => (v.tipo === 'cardio' ? v.cardio?.esito != null : v.serie.length > 0 && v.serie.every((s) => s.esito !== null))

function SchedaEsercizio({
  sessione,
  voce,
  esercizio,
  storico,
  imp,
  apriDischi,
  apriRiscaldamento,
  serieFatta,
}: {
  sessione: Sessione
  voce: VoceSessione
  esercizio: Esercizio | undefined
  storico: Prestazione[]
  imp: Impostazioni
  apriDischi: (kg?: number) => void
  apriRiscaldamento: (kg?: number) => void
  /** chiamata quando una serie viene segnata: ultima = era l'ultima serie dell'esercizio */
  serieFatta: (ultima: boolean) => void
}) {
  const [noteAperte, setNoteAperte] = useState(!!voce.note)
  const aggiorna = (f: (v: VoceSessione) => VoceSessione) => aggiornaVoce(sessione.id, voce.uid, f)
  const o = voce.obiettivo
  const sugg = voce.tipo === 'ripetizioni' ? suggerisci(storico, o, esercizio?.incrementoKg ?? imp.incrementoKg, imp.sessioniPerAumento) : undefined
  const recuperoSec = sessione.recuperoSec ?? o.recuperoSec ?? imp.recuperoPredefinito
  const range = o.repMin !== undefined && o.repMax !== undefined && o.repMax > o.repMin && !o.repPerSerie
  const ultimaNota = storico[0]?.voce.note

  const segna = (i: number) => {
    sbloccaAudio()
    const giaFatta = voce.serie[i]?.esito !== null
    void aggiorna((v) => ({
      ...v,
      serie: v.serie.map((x, j) => {
        if (j !== i) return x
        if (x.esito !== null) return { ...x, esito: null }
        const valore = x.valore ?? x.obiettivo
        return { ...x, valore, esito: esitoDa({ ...x, valore }) ?? 'si' }
      }),
    }))
    if (!giaFatta) serieFatta(voce.serie.filter((x, j) => j !== i && x.esito === null).length === 0)
  }

  const segnaCardio = () => {
    sbloccaAudio()
    const giaFatto = voce.cardio?.esito != null
    void aggiorna((v) => ({ ...v, cardio: { ...v.cardio, esito: v.cardio?.esito != null ? null : (esitoCardio(v.obiettivo, v.cardio) ?? 'si') } }))
    if (!giaFatto) serieFatta(true)
  }

  const applicaSuggerimento = () => {
    if (!sugg?.kg) return
    void aggiorna((v) => ({
      ...v,
      serie: v.serie.map((s) => (s.esito !== null ? s : { ...s, kg: sugg.kg, valore: sugg.tipo === 'aumenta' && range ? s.obiettivo : s.valore })),
    }))
  }

  const kgCorrente = voce.serie.find((s) => s.esito === null)?.kg ?? voce.serie[voce.serie.length - 1]?.kg
  const kgLavoro = Math.max(0, ...voce.serie.map((s) => s.kg ?? 0)) || undefined

  return (
    <div className="colonna" style={{ gap: 14 }}>
      <div>
        <div className="riga a-capo" style={{ gap: 6 }}>
          <h2 style={{ fontSize: '1.4rem' }}>{esercizio?.nome ?? 'Esercizio'}</h2>
          {esercizio?.gruppo && <span className="badge">{esercizio.gruppo}</span>}
        </div>
        <p className="muto">
          {descriviObiettivo(o, voce.tipo, { senzaRecupero: true })}
          {range ? ' · conta da ' + o.repMin : ''}
        </p>
        {o.note && <p className="piccolo muto">{o.note}</p>}
        {esercizio?.note && <p className="piccolo muto">{esercizio.note}</p>}
      </div>

      {storico[0] && (
        <div className="metrica">
          <div className="etichetta">Ultima volta · {giorniFa(storico[0].sessione.inizio)}</div>
          <div style={{ fontWeight: 600 }}>
            <UltimaVolta p={storico[0]} />
          </div>
          {ultimaNota && <div className="piccolo muto">«{ultimaNota}»</div>}
        </div>
      )}

      {sugg && (
        <div className={`avviso${sugg.tipo === 'aumenta' ? ' info' : ''}`} style={{ alignItems: 'center' }}>
          <TrendingUp size={18} />
          <p className="cresci piccolo">{sugg.testo}</p>
          {sugg.kg !== undefined && voce.serie.some((s) => s.esito === null && s.kg !== sugg.kg) && (
            <button className="btn piccolo" onClick={applicaSuggerimento}>
              Usa {numero(sugg.kg)} kg
            </button>
          )}
        </div>
      )}

      {voce.tipo === 'cardio' ? (
        <div className="card colonna">
          <div className="griglia-2">
            <label className="campo">
              <span>Durata (min)</span>
              <CampoNumero className="input" valore={voce.cardio?.durataMin} cambia={(durataMin) => aggiorna((v) => ({ ...v, cardio: { esito: null, ...v.cardio, durataMin } }))} />
            </label>
            <label className="campo">
              <span>Distanza (km)</span>
              <CampoNumero className="input" valore={voce.cardio?.distanzaKm} cambia={(distanzaKm) => aggiorna((v) => ({ ...v, cardio: { esito: null, ...v.cardio, distanzaKm } }))} />
            </label>
          </div>
          <label className="campo">
            <span>Dettagli</span>
            <CampoTesto
              valore={voce.cardio?.note ?? ''}
              placeholder="velocità, inclinazione, livello, calorie…"
              cambia={(note) => aggiorna((v) => ({ ...v, cardio: { esito: null, ...v.cardio, note: note || undefined } }))}
            />
          </label>
          <button className={`btn grande${voce.cardio?.esito ? ' primario' : ''}`} onClick={segnaCardio}>
            <Check size={20} /> {voce.cardio?.esito ? 'Fatto' : 'Segna come fatto'}
          </button>
        </div>
      ) : (
        <div className="serie-tabella">
          <IntestazioneSerie tipo={voce.tipo} ultima="Fatta" />
          {voce.serie.map((s, i) => (
            <RigaSerie
              key={i}
              s={s}
              i={i}
              tipo={voce.tipo}
              cambiaKg={(kg) => aggiorna((v) => conKg(v, i, kg))}
              cambiaValore={(valore) => aggiorna((v) => conValore(v, i, valore))}
              azione={
                <button className={`btn-fatta ${s.esito ?? ''}`} onClick={() => segna(i)} aria-label={s.esito ? `Serie ${i + 1} fatta, tocca per annullare` : `Segna serie ${i + 1} come fatta`}>
                  <Check size={22} />
                </button>
              }
            />
          ))}
          <div className="riga a-capo" style={{ justifyContent: 'space-between' }}>
            <div className="riga">
              <button className="btn piccolo" onClick={() => aggiorna((v) => serieInPiu(v, obiettivoSerie(v.obiettivo, v.serie.length, v.tipo)))}>
                <Plus size={16} /> Serie
              </button>
              {voce.serie.length > 0 && (
                <button className="btn piccolo" aria-label="Togli l'ultima serie" onClick={() => aggiorna((v) => ({ ...v, serie: v.serie.slice(0, -1) }))}>
                  <Minus size={16} />
                </button>
              )}
            </div>
            <div className="riga">
              {voce.tipo === 'ripetizioni' && (
                <>
                  <button className="btn piccolo" aria-label="Riscaldamento" onClick={() => apriRiscaldamento(kgLavoro)}>
                    <Flame size={16} />
                  </button>
                  <button className="btn piccolo" aria-label="Calcolatore dischi" onClick={() => apriDischi(kgCorrente)}>
                    <Calculator size={16} />
                  </button>
                </>
              )}
              <button className="btn piccolo" onClick={() => avviaRecupero(recuperoSec)}>
                {recupero(recuperoSec)}
              </button>
            </div>
          </div>
          <p className="piccolo muto">
            «0» = ripetizioni come da scheda. Usa + e − se ne fai di più o di meno, poi tocca <Check size={13} style={{ verticalAlign: -2 }} />.
          </p>
        </div>
      )}

      {noteAperte ? (
        <label className="campo">
          <span>Note</span>
          <CampoTesto valore={voce.note ?? ''} placeholder="come è andata, regolazioni…" cambia={(note) => aggiorna((v) => ({ ...v, note: note || undefined }))} />
        </label>
      ) : (
        <button className="btn piccolo" style={{ alignSelf: 'flex-start' }} onClick={() => setNoteAperte(true)}>
          <StickyNote size={16} /> Aggiungi nota
        </button>
      )}
    </div>
  )
}

export function Allenamento() {
  const naviga = useNavigate()
  const imp = useImpostazioni()
  const sessioni = useLiveQuery(() => db.sessioni.toArray(), [])
  const esercizi = useLiveQuery(async () => new Map((await db.esercizi.toArray()).map((e) => [e.id, e])), [])
  const [menu, setMenu] = useState(false)
  const [libreria, setLibreria] = useState<'aggiungi' | 'sostituisci' | null>(null)
  const [dischi, setDischi] = useState<{ kg?: number } | null>(null)
  const [riscaldamento, setRiscaldamento] = useState<{ kg?: number } | null>(null)
  const [musica, setMusica] = useState(false)
  const [sceltaRecupero, setSceltaRecupero] = useState(false)
  useSchermoAcceso(imp.schermoAcceso)

  const concluse = useMemo(() => (sessioni ?? []).filter((s) => s.fine), [sessioni])
  const sessione = sessioni?.find((s) => !s.fine)

  if (!sessioni || !esercizi) return null
  if (sessione && sessione.modalita === 'registro') return <Navigate to={percorsoSessione(sessione)} replace />
  if (!sessione) {
    return (
      <>
        <Testata titolo="Allenamento" indietro="/" />
        <div className="pagina">
          <Vuoto icona={<Dumbbell size={40} />} titolo="Nessun allenamento in corso" azione={<Link to="/" className="btn primario">Torna alla home</Link>} />
        </div>
      </>
    )
  }

  const voci = sessione.voci
  const indice = Math.min(sessione.indiceCorrente ?? 0, Math.max(0, voci.length - 1))
  const voce = voci[indice]
  // un solo recupero per tutto l'allenamento (i ±15 della barra valgono solo per quello in corso)
  const recuperoAttuale = sessione.recuperoSec ?? voce?.obiettivo.recuperoSec ?? imp.recuperoPredefinito
  const impostaRecupero = (secondi: number) => db.sessioni.update(sessione.id, { recuperoSec: Math.max(0, Math.min(600, secondi)) })
  const { fatte } = contaSerie(sessione)
  const totali = voci.reduce((t, v) => t + (v.tipo === 'cardio' ? 1 : v.serie.length), 0)
  const nome = (v?: VoceSessione) => (v ? (esercizi.get(v.esercizioId)?.nome ?? 'Esercizio') : '')

  const vai = (i: number) => {
    void db.sessioni.update(sessione.id, { indiceCorrente: i })
    window.scrollTo({ top: 0 })
  }

  // cosa viene dopo, mostrato durante il recupero
  const prossima = (() => {
    if (voce && voce.tipo !== 'cardio') {
      const i = voce.serie.findIndex((s) => s.esito === null)
      if (i >= 0) {
        const s = voce.serie[i]
        const rip = s.valore ?? s.obiettivo
        const quanto = voce.tipo === 'tempo' ? recupero(rip) : s.kg !== undefined ? `${numero(s.kg)} kg × ${rip ?? ''}` : `${rip ?? ''} rip`
        return `Serie ${i + 1} · ${quanto}`
      }
    }
    const dopo = voci.slice(indice + 1).find((v) => !voceCompletata(v))
    return dopo ? `Poi: ${nome(dopo)}` : undefined
  })()

  const serieFatta = (ultimaDellEsercizio: boolean) => {
    const restaAltro = voci.some((v, i) => i !== indice && !voceCompletata(v)) || !ultimaDellEsercizio
    if (imp.recuperoAutomatico && restaAltro && voce?.tipo !== 'cardio') {
      const rec = recuperoAttuale
      if (rec > 0) avviaRecupero(rec)
    }
    if (ultimaDellEsercizio && imp.avanzamentoAutomatico) {
      const successivo = voci.findIndex((v, i) => i > indice && !voceCompletata(v))
      if (successivo >= 0) {
        setTimeout(() => {
          vai(successivo)
          mostraMessaggio(`Prossimo: ${nome(voci[successivo])}`)
        }, 700)
      } else if (!restaAltro) mostraMessaggio('Tutti gli esercizi fatti: puoi terminare')
    }
  }

  const annulla = async () => {
    if (!confirm('Annullare questo allenamento? Quello che hai segnato verrà perso.')) return
    fermaRecupero()
    await db.sessioni.delete(sessione.id)
    naviga('/', { replace: true })
  }

  const termina = async () => {
    const s = await db.sessioni.get(sessione.id)
    if (!s) return
    const { fatte: segnate } = contaSerie(s)
    if (segnate === 0) {
      if (confirm('Non hai segnato nessuna serie. Vuoi annullare l’allenamento?')) {
        fermaRecupero()
        await db.sessioni.delete(s.id)
        naviga('/', { replace: true })
      }
      return
    }
    const mancanti = s.voci.reduce((t, v) => t + (v.tipo === 'cardio' ? (v.cardio?.esito == null ? 1 : 0) : v.serie.filter((x) => x.esito === null).length), 0)
    if (mancanti > 0 && !confirm(`${mancanti} ${mancanti === 1 ? 'serie non segnata verrà scartata' : 'serie non segnate verranno scartate'}. Terminare?`)) return
    fermaRecupero()
    await concludiSessione(s)
    naviga(`/storico/${s.id}?riepilogo=1`, { replace: true })
  }

  const passaARegistro = async () => {
    fermaRecupero()
    await db.sessioni.update(sessione.id, { modalita: 'registro' })
    naviga('/registro', { replace: true })
  }

  const sceltoDallaLibreria = async (scelta: SceltaEsercizio) => {
    const modo = libreria
    setLibreria(null)
    const es = await assicuraEsercizio(scelta)
    const s = await db.sessioni.get(sessione.id)
    if (!s) return
    if (modo === 'aggiungi') {
      await aggiungiVoce(s, es, imp.recuperoPredefinito)
      return
    }
    // sostituisci (es. macchina occupata): stesse serie, carichi dell'ultima volta del nuovo esercizio
    const vecchia = s.voci[indice]
    if (!vecchia) return
    const obiettivo = vecchia.tipo === es.tipo ? vecchia.obiettivo : obiettivoIniziale(es.tipo, imp.recuperoPredefinito)
    const nuova = creaVoce(es, obiettivo, storicoEsercizio(await db.sessioni.toArray(), es.id, s.id))
    await db.sessioni.update(s.id, { voci: s.voci.map((v) => (v.uid === vecchia.uid ? nuova : v)) })
  }

  const esercizioCorrente = voce ? esercizi.get(voce.esercizioId) : undefined
  const conBilanciere = cercaNelCatalogo(esercizioCorrente?.nome ?? '')?.attrezzo === 'Bilanciere' || /bilanciere|squat|stacco|panca piana|military/i.test(esercizioCorrente?.nome ?? '')

  return (
    <>
      <Testata
        titolo={sessione.nomeGiorno}
        indietro="/"
        azioni={
          <>
            <button className={`btn-icona${musica ? ' pieno' : ''}`} aria-label="Musica" onClick={() => setMusica(!musica)} style={musica ? { color: 'var(--accento)' } : undefined}>
              <Music size={21} />
            </button>
            <button className="btn-icona pieno" aria-label="Menu allenamento" onClick={() => setMenu(true)}>
              <MoreHorizontal size={22} />
            </button>
          </>
        }
      />
      <div className="pagina" style={{ paddingBottom: 110 }}>
        <div className="riga spazio muto piccolo" style={{ marginTop: -8 }}>
          {imp.mostraCronometro ? <Cronometro inizio={sessione.inizio} /> : <span>{fatte} / {totali} serie</span>}
          <button className="chip" style={{ padding: '4px 10px' }} onClick={() => setSceltaRecupero(true)} aria-label="Cambia il recupero di questo allenamento">
            <Timer size={14} /> Recupero {recupero(recuperoAttuale)}
          </button>
          {imp.mostraCronometro && (
            <span>
              {fatte} / {totali} serie
            </span>
          )}
        </div>

        {musica && <PannelloMusica chiudi={() => setMusica(false)} />}

        {voci.length > 1 && (
          <div className="navigazione-esercizi" role="tablist" aria-label="Esercizi">
            {voci.map((v, i) => (
              <button
                key={v.uid}
                role="tab"
                aria-selected={i === indice}
                aria-label={nome(v)}
                className={i === indice ? 'attuale' : voceCompletata(v) ? 'fatto' : ''}
                onClick={() => vai(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}

        {voce ? (
          <SchedaEsercizio
            key={voce.uid}
            sessione={sessione}
            voce={voce}
            esercizio={esercizioCorrente}
            storico={storicoEsercizio(concluse, voce.esercizioId)}
            imp={imp}
            apriDischi={(kg) => setDischi({ kg })}
            apriRiscaldamento={(kg) => setRiscaldamento({ kg })}
            serieFatta={serieFatta}
          />
        ) : (
          <Vuoto
            icona={<Dumbbell size={40} />}
            titolo="Allenamento libero"
            testo="Aggiungi gli esercizi man mano che li fai."
            azione={
              <button className="btn primario" onClick={() => setLibreria('aggiungi')}>
                <Plus size={18} /> Aggiungi esercizio
              </button>
            }
          />
        )}

        {voce && (
          <div className="piede-allenamento">
            <button className="btn" disabled={indice === 0} onClick={() => vai(indice - 1)} aria-label="Esercizio precedente">
              <ChevronLeft size={20} />
            </button>
            {indice < voci.length - 1 ? (
              <button className={`btn cresci${voceCompletata(voce) ? ' primario' : ''}`} onClick={() => vai(indice + 1)}>
                Prossimo: {nome(voci[indice + 1])}
                <ChevronRight size={20} />
              </button>
            ) : (
              <button className="btn primario cresci" onClick={termina}>
                <Flag size={18} /> Termina allenamento
              </button>
            )}
          </div>
        )}
      </div>

      <BarraRecupero dopo={prossima} />

      <Foglio aperto={menu} chiudi={() => setMenu(false)} titolo="Allenamento">
        <div className="lista">
          <button
            className="voce"
            onClick={() => {
              setMenu(false)
              setLibreria('aggiungi')
            }}
          >
            <Plus size={20} /> <span className="corpo">Aggiungi esercizio</span>
          </button>
          {voce && (
            <button
              className="voce"
              onClick={() => {
                setMenu(false)
                setLibreria('sostituisci')
              }}
            >
              <Replace size={20} /> <span className="corpo">Sostituisci questo esercizio</span>
            </button>
          )}
          <button
            className="voce"
            onClick={() => {
              setMenu(false)
              setDischi({})
            }}
          >
            <Calculator size={20} /> <span className="corpo">Calcolatore dischi</span>
          </button>
          {voce && (
            <button
              className="voce"
              onClick={async () => {
                if (!confirm(`Togliere «${nome(voce)}» da questo allenamento?`)) return
                await db.sessioni.update(sessione.id, { voci: voci.filter((v) => v.uid !== voce.uid), indiceCorrente: Math.max(0, indice - 1) })
                setMenu(false)
              }}
            >
              <Minus size={20} /> <span className="corpo">Togli questo esercizio</span>
            </button>
          )}
          <button
            className="voce"
            onClick={() => {
              aggiornaImpostazioni({ mostraCronometro: !imp.mostraCronometro })
              setMenu(false)
            }}
          >
            {imp.mostraCronometro ? <TimerOff size={20} /> : <Timer size={20} />}
            <span className="corpo">{imp.mostraCronometro ? 'Nascondi il cronometro' : 'Mostra il cronometro'}</span>
          </button>
          <button className="voce" onClick={passaARegistro}>
            <ClipboardPen size={20} /> <span className="corpo">Passa al registro (scrivi solo i risultati)</span>
          </button>
          <button
            className="voce"
            onClick={() => {
              setMenu(false)
              void termina()
            }}
          >
            <Flag size={20} /> <span className="corpo">Termina allenamento</span>
          </button>
          <button className="voce pericolo" onClick={annulla}>
            <Trash2 size={20} /> <span className="corpo">Annulla allenamento</span>
          </button>
        </div>
      </Foglio>

      <Foglio aperto={sceltaRecupero} chiudi={() => setSceltaRecupero(false)} titolo="Recupero">
        <div className="colonna">
          <p className="piccolo muto">Vale per tutti gli esercizi di questo allenamento. Mentre recuperi puoi sempre aggiungere o togliere 15 secondi.</p>
          <div className="centro" style={{ fontSize: '2.4rem', fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
            {mmss(recuperoAttuale)}
          </div>
          <div className="griglia-2">
            <button className="btn grande" onClick={() => impostaRecupero(recuperoAttuale - 15)}>
              −15 s
            </button>
            <button className="btn grande" onClick={() => impostaRecupero(recuperoAttuale + 15)}>
              +15 s
            </button>
          </div>
          <div className="riga a-capo" style={{ justifyContent: 'center' }}>
            {[45, 60, 90, 120, 150, 180, 240].map((s) => (
              <button key={s} className={`chip${s === recuperoAttuale ? ' attivo' : ''}`} onClick={() => impostaRecupero(s)}>
                {recupero(s)}
              </button>
            ))}
          </div>
          <button className="btn primario" onClick={() => setSceltaRecupero(false)}>
            Fatto
          </button>
        </div>
      </Foglio>

      <ScegliEsercizio
        aperto={libreria !== null}
        chiudi={() => setLibreria(null)}
        titolo={libreria === 'sostituisci' ? 'Sostituisci esercizio' : 'Aggiungi esercizio'}
        scegli={sceltoDallaLibreria}
      />

      {dischi && <CalcolatoreDischi aperto chiudi={() => setDischi(null)} kgIniziale={dischi.kg} />}
      {riscaldamento && <Riscaldamento aperto chiudi={() => setRiscaldamento(null)} kg={riscaldamento.kg} bilanciere={conBilanciere ? imp.pesoBilanciere : 0} />}
    </>
  )
}
