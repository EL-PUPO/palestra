import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowUpToLine, Camera, Plus, Replace, SquareSplitVertical, Trash2, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { EditorObiettivo } from '../componenti/EditorObiettivo'
import { ScegliEsercizio } from '../componenti/ScegliEsercizio'
import { Foglio, Interruttore, mostraMessaggio, Testata } from '../componenti/ui'
import { db, nuovoId } from '../db'
import { obiettivoIniziale, pulisciEserciziInutilizzati, salvaScheda, type EsercizioDaSalvare, type SceltaEsercizio } from '../lib/allenamento'
import { indovinaGruppo } from '../lib/catalogo'
import { descriviObiettivo, GRUPPI } from '../lib/descrizioni'
import { normalizzaNome } from '../lib/formato'
import { useImpostazioni } from '../lib/impostazioni'
import { leggiScheda } from '../lib/leggiScheda'

interface EsercizioBozza extends EsercizioDaSalvare {
  chiave: string
  incerto?: boolean
  riga?: string
}

interface GiornoBozza {
  chiave: string
  nome: string
  esercizi: EsercizioBozza[]
}

/** Dati passati da "Rileggi questo testo" nella pagina di una scheda */
interface StatoIngresso {
  testo?: string
  sostituisci?: string
}

const ESEMPIO = `Giorno 1 - Petto e tricipiti
Panca piana 4x8 rec 2'
Croci manubri 3x12 90"
French press 3x10-12
Tapis roulant 15 min

Giorno 2 - Dorso e bicipiti
Lat machine 4x10
Rematore manubrio 3x10 1'30"
Curl bilanciere 3x12
Plank 3x30"`

function nomeMese() {
  const m = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return `Scheda ${m}`
}

export function NuovaScheda() {
  const naviga = useNavigate()
  const imp = useImpostazioni()
  const ingresso = (useLocation().state ?? {}) as StatoIngresso
  const esistenti = useLiveQuery(async () => new Set((await db.esercizi.toArray()).map((e) => normalizzaNome(e.nome))), [])
  const [testo, setTesto] = useState(ingresso.testo ?? '')
  const [bozza, setBozza] = useState<GiornoBozza[] | null>(null)
  const [nome, setNome] = useState('')
  const [ignorate, setIgnorate] = useState<string[]>([])
  const [attiva, setAttiva] = useState(true)
  const [inModifica, setInModifica] = useState<{ giorno: string; esercizio: string } | null>(null)
  /** libreria aperta per aggiungere a un giorno o per sostituire un esercizio */
  const [libreria, setLibreria] = useState<{ giorno: string; sostituisci?: string } | null>(null)
  const [salvo, setSalvo] = useState(false)

  const leggi = (t = testo) => {
    const r = leggiScheda(t)
    if (!r.giorni.length) {
      mostraMessaggio('Non ho trovato esercizi: controlla il testo')
      return
    }
    setBozza(
      r.giorni.map((g) => ({
        chiave: nuovoId(),
        nome: g.nome,
        esercizi: g.esercizi.map((e) => {
          const { riga, incerto, ...resto } = e
          return { ...resto, gruppo: resto.gruppo ?? indovinaGruppo(resto.nome), chiave: nuovoId(), riga, incerto }
        }),
      })),
    )
    setNome(r.titolo ?? nomeMese())
    setIgnorate(r.ignorate)
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    if (ingresso.testo) leggi(ingresso.testo)
  }, [])

  const creaVuota = () => {
    setBozza([{ chiave: nuovoId(), nome: 'Giorno 1', esercizi: [] }])
    setNome(nomeMese())
  }

  const modificaGiorno = (chiave: string, f: (g: GiornoBozza) => GiornoBozza) => setBozza((b) => b!.map((g) => (g.chiave === chiave ? f(g) : g)))
  const modificaEsercizio = (giorno: string, esercizio: string, modifiche: Partial<EsercizioBozza>) =>
    modificaGiorno(giorno, (g) => ({ ...g, esercizi: g.esercizi.map((x) => (x.chiave === esercizio ? { ...x, ...modifiche } : x)) }))

  const unisciAlPrecedente = (i: number) =>
    setBozza((b) => {
      const nuova = [...b!]
      nuova[i - 1] = { ...nuova[i - 1], esercizi: [...nuova[i - 1].esercizi, ...nuova[i].esercizi] }
      nuova.splice(i, 1)
      return nuova
    })

  /** Sposta l'esercizio scelto, e quelli dopo, in un giorno nuovo */
  const nuovoGiornoDa = (giorno: string, esercizio: string) =>
    setBozza((b) => {
      const i = b!.findIndex((g) => g.chiave === giorno)
      const g = b![i]
      const j = g.esercizi.findIndex((e) => e.chiave === esercizio)
      const nuova = [...b!]
      nuova.splice(i, 1, { ...g, esercizi: g.esercizi.slice(0, j) }, { chiave: nuovoId(), nome: `Giorno ${i + 2}`, esercizi: g.esercizi.slice(j) })
      return nuova
    })

  const sceltoDallaLibreria = (s: SceltaEsercizio) => {
    if (!libreria) return
    const { giorno, sostituisci } = libreria
    setLibreria(null)
    if (sostituisci) {
      const vecchio = bozza?.find((g) => g.chiave === giorno)?.esercizi.find((e) => e.chiave === sostituisci)
      const cambiaTipo = vecchio && vecchio.tipo !== s.tipo
      modificaEsercizio(giorno, sostituisci, {
        nome: s.nome,
        tipo: s.tipo,
        gruppo: s.gruppo,
        incerto: false,
        ...(cambiaTipo ? obiettivoIniziale(s.tipo, imp.recuperoPredefinito) : {}),
      })
      return
    }
    const nuovo: EsercizioBozza = { chiave: nuovoId(), nome: s.nome, tipo: s.tipo, gruppo: s.gruppo, ...obiettivoIniziale(s.tipo, imp.recuperoPredefinito) }
    modificaGiorno(giorno, (g) => ({ ...g, esercizi: [...g.esercizi, nuovo] }))
    setInModifica({ giorno, esercizio: nuovo.chiave })
  }

  const salva = async () => {
    if (!bozza) return
    setSalvo(true)
    try {
      const giorni = bozza
        .filter((g) => g.esercizi.length)
        .map((g, i) => ({ nome: g.nome.trim() || `Giorno ${i + 1}`, esercizi: g.esercizi.map(({ chiave: _c, incerto: _i, riga: _r, ...e }) => e) }))
      if (!giorni.length) {
        mostraMessaggio('Aggiungi almeno un esercizio')
        return
      }
      const id = await salvaScheda(nome.trim() || nomeMese(), giorni, { attiva, testoOriginale: testo || undefined })
      // la scheda riletta sostituisce quella vecchia, se non è ancora stata usata
      if (ingresso.sostituisci) {
        const usata = (await db.sessioni.toArray()).some((s) => s.schedaId === ingresso.sostituisci)
        if (!usata) {
          await db.schede.delete(ingresso.sostituisci)
          await pulisciEserciziInutilizzati()
        }
      }
      mostraMessaggio('Scheda salvata')
      naviga(`/schede/${id}`, { replace: true })
    } finally {
      setSalvo(false)
    }
  }

  const giornoCorrente = inModifica ? bozza?.find((g) => g.chiave === inModifica.giorno) : undefined
  const corrente = giornoCorrente?.esercizi.find((e) => e.chiave === inModifica?.esercizio)
  const indiceCorrente = corrente && giornoCorrente ? giornoCorrente.esercizi.indexOf(corrente) : -1

  if (!bozza) {
    return (
      <>
        <Testata titolo="Nuova scheda" indietro />
        <div className="pagina">
          <div className="avviso info">
            <Camera size={18} />
            <p className="piccolo">
              Hai la scheda su carta? Scatta una foto, tieni premuto sul testo, tocca <strong>Seleziona tutto</strong> e poi <strong>Copia</strong>.
              Poi incollala qui sotto.
            </p>
          </div>
          <textarea
            className="input"
            style={{ minHeight: 280, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 15 }}
            placeholder={ESEMPIO}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
          />
          <p className="piccolo muto">
            Va bene quasi ogni formato: «Panca 4x8 rec 90"», «Croci 3 serie da 12», «Plank 3x30"», «Tapis 20 min», anche tabelle copiate. Le righe come
            «Giorno 1», «Lunedì» o «Push» separano i giorni.
          </p>
          <button className="btn primario grande pieno" disabled={!testo.trim()} onClick={() => leggi()}>
            <Wand2 size={20} /> Sistema la scheda
          </button>
          <div className="riga" style={{ justifyContent: 'center', gap: 16 }}>
            <button className="btn piccolo" onClick={() => setTesto(ESEMPIO)}>
              Prova con un esempio
            </button>
            <button className="btn piccolo" onClick={creaVuota}>
              Crea a mano
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Testata titolo="Controlla la scheda" indietro={false} azioni={<button className="btn piccolo" onClick={() => setBozza(null)}>Modifica testo</button>} />
      <div className="pagina">
        <label className="campo">
          <span>Nome della scheda</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>

        <p className="piccolo muto">
          {bozza.length} {bozza.length === 1 ? 'giorno' : 'giorni'} · {bozza.reduce((t, g) => t + g.esercizi.length, 0)} esercizi. Tocca un esercizio per
          correggerlo; quelli evidenziati vanno controllati.
        </p>

        {bozza.map((g, i) => (
          <div key={g.chiave} className="anteprima-giorno">
            <header>
              <input value={g.nome} onChange={(e) => modificaGiorno(g.chiave, (x) => ({ ...x, nome: e.target.value }))} aria-label="Nome del giorno" />
              {i > 0 && (
                <button className="btn-icona" aria-label="Unisci al giorno precedente" title="Unisci al giorno precedente" onClick={() => unisciAlPrecedente(i)}>
                  <ArrowUpToLine size={18} />
                </button>
              )}
              <button className="btn-icona" aria-label="Elimina giorno" onClick={() => confirm(`Eliminare «${g.nome}»?`) && setBozza((b) => b!.filter((x) => x.chiave !== g.chiave))}>
                <Trash2 size={18} />
              </button>
            </header>
            {g.esercizi.map((e) => (
              <button
                key={e.chiave}
                className={`esercizio-anteprima voce${e.incerto ? ' incerto' : ''}`}
                style={{ minHeight: 0 }}
                onClick={() => setInModifica({ giorno: g.chiave, esercizio: e.chiave })}
              >
                <div className="corpo">
                  <div className="riga a-capo" style={{ gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>{e.nome}</span>
                    {esistenti && esistenti.size > 0 && !esistenti.has(normalizzaNome(e.nome)) && <span className="badge accento">nuovo</span>}
                    {e.gruppo && <span className="badge">{e.gruppo}</span>}
                  </div>
                  <div className="sotto">{descriviObiettivo(e, e.tipo)}</div>
                  {e.note && <div className="sotto">{e.note}</div>}
                  {e.incerto && (
                    <div className="sotto attenzione riga" style={{ gap: 4 }}>
                      <AlertTriangle size={14} /> Serie e ripetizioni non trovate
                    </div>
                  )}
                </div>
              </button>
            ))}
            <div style={{ padding: 8 }}>
              <button className="btn piccolo pieno" onClick={() => setLibreria({ giorno: g.chiave })}>
                <Plus size={16} /> Aggiungi esercizio
              </button>
            </div>
          </div>
        ))}

        <button className="btn pieno" onClick={() => setBozza((b) => [...b!, { chiave: nuovoId(), nome: `Giorno ${b!.length + 1}`, esercizi: [] }])}>
          <Plus size={18} /> Aggiungi giorno
        </button>

        {ignorate.length > 0 && (
          <div className="card">
            <h3>Righe non usate</h3>
            <ul className="piccolo muto" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {ignorate.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="card riga spazio">
          <div>
            <h3>Usala da subito</h3>
            <p className="piccolo muto">La scheda attiva attuale passerà tra le precedenti</p>
          </div>
          <Interruttore attivo={attiva} cambia={setAttiva} etichetta="Rendi attiva" />
        </div>

        <button className="btn primario grande pieno" disabled={salvo} onClick={salva}>
          Salva scheda
        </button>
      </div>

      <Foglio aperto={!!corrente} chiudi={() => setInModifica(null)} titolo="Esercizio">
        {corrente && inModifica && (
          <div className="colonna">
            <label className="campo">
              <span>Nome</span>
              <div className="riga">
                <input className="input cresci" value={corrente.nome} onChange={(ev) => modificaEsercizio(inModifica.giorno, corrente.chiave, { nome: ev.target.value })} />
                <button
                  className="btn"
                  aria-label="Scegli dalla libreria"
                  onClick={() => {
                    setLibreria({ giorno: inModifica.giorno, sostituisci: corrente.chiave })
                    setInModifica(null)
                  }}
                >
                  <Replace size={18} /> Libreria
                </button>
              </div>
            </label>
            <label className="campo">
              <span>Gruppo muscolare</span>
              <select value={corrente.gruppo ?? ''} onChange={(ev) => modificaEsercizio(inModifica.giorno, corrente.chiave, { gruppo: ev.target.value || undefined })}>
                <option value="">—</option>
                {[...new Set([...GRUPPI, ...(corrente.gruppo ? [corrente.gruppo] : [])])].map((gr) => (
                  <option key={gr}>{gr}</option>
                ))}
              </select>
            </label>
            <EditorObiettivo
              key={`${corrente.chiave}-${corrente.tipo}`}
              tipo={corrente.tipo}
              obiettivo={corrente}
              cambia={(o, tipo) => modificaEsercizio(inModifica.giorno, corrente.chiave, { ...o, tipo, incerto: false })}
            />
            {corrente.riga && <p className="piccolo muto">Riga originale: «{corrente.riga}»</p>}
            {indiceCorrente > 0 && (
              <button
                className="btn"
                onClick={() => {
                  nuovoGiornoDa(inModifica.giorno, corrente.chiave)
                  setInModifica(null)
                }}
              >
                <SquareSplitVertical size={18} /> Inizia un nuovo giorno da qui
              </button>
            )}
            <div className="griglia-2">
              <button
                className="btn pericolo"
                onClick={() => {
                  modificaGiorno(inModifica.giorno, (g) => ({ ...g, esercizi: g.esercizi.filter((x) => x.chiave !== corrente.chiave) }))
                  setInModifica(null)
                }}
              >
                <Trash2 size={18} /> Elimina
              </button>
              <button className="btn primario" onClick={() => setInModifica(null)}>
                Fatto
              </button>
            </div>
          </div>
        )}
      </Foglio>

      <ScegliEsercizio
        aperto={!!libreria}
        chiudi={() => setLibreria(null)}
        titolo={libreria?.sostituisci ? 'Sostituisci esercizio' : 'Aggiungi esercizio'}
        scegli={sceltoDallaLibreria}
      />
    </>
  )
}
