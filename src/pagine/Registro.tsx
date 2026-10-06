import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardPen, Dumbbell, MoreHorizontal, Music, Play, Plus, Save, Trash2, Undo2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { PannelloMusica } from '../componenti/PannelloMusica'
import { ScegliEsercizio } from '../componenti/ScegliEsercizio'
import { aggiornaVoce, conKg, conValore, IntestazioneSerie, RigaSerie, serieInPiu, UltimaVolta } from '../componenti/Serie'
import { CampoNumero, CampoTesto, Foglio, Segmentato, Testata, Vuoto } from '../componenti/ui'
import { db, type Esercizio, type Sessione, type VoceSessione } from '../db'
import { aggiungiVoce, assicuraEsercizio, percorsoSessione, salvaRegistro } from '../lib/allenamento'
import { descriviObiettivo } from '../lib/descrizioni'
import { chiaveGiorno, daChiaveGiorno, giorniFa } from '../lib/formato'
import { useImpostazioni } from '../lib/impostazioni'
import { obiettivoSerie, storicoEsercizio, type Prestazione } from '../lib/statistiche'

function oraDi(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function SchedaRegistro({ sessione, voce, esercizio, storico }: { sessione: Sessione; voce: VoceSessione; esercizio?: Esercizio; storico: Prestazione[] }) {
  const aggiorna = (f: (v: VoceSessione) => VoceSessione) => aggiornaVoce(sessione.id, voce.uid, f)
  return (
    <div className="card colonna" style={{ gap: 10, opacity: voce.saltato ? 0.55 : 1 }}>
      <div className="riga spazio" style={{ alignItems: 'flex-start' }}>
        <div className="cresci">
          <h3>{esercizio?.nome ?? 'Esercizio'}</h3>
          <p className="piccolo muto">{voce.saltato ? 'Saltato: non verrà salvato' : descriviObiettivo(voce.obiettivo, voce.tipo)}</p>
        </div>
        <button className="btn piccolo" onClick={() => aggiorna((v) => ({ ...v, saltato: !v.saltato || undefined }))}>
          {voce.saltato ? (
            <>
              <Undo2 size={16} /> Rimetti
            </>
          ) : (
            <>
              <X size={16} /> Saltato
            </>
          )}
        </button>
      </div>

      {!voce.saltato && (
        <>
          {storico[0] && (
            <p className="piccolo muto">
              Ultima volta ({giorniFa(storico[0].sessione.inizio)}): <UltimaVolta p={storico[0]} />
            </p>
          )}
          {voce.tipo === 'cardio' ? (
            <>
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
              <CampoTesto
                className="input"
                valore={voce.cardio?.note ?? ''}
                placeholder="velocità, inclinazione, livello…"
                cambia={(note) => aggiorna((v) => ({ ...v, cardio: { esito: null, ...v.cardio, note: note || undefined } }))}
              />
            </>
          ) : (
            <div className="serie-tabella">
              <IntestazioneSerie tipo={voce.tipo} />
              {voce.serie.map((s, i) => (
                <RigaSerie
                  key={i}
                  s={s}
                  i={i}
                  tipo={voce.tipo}
                  colorata={false}
                  cambiaKg={(kg) => aggiorna((v) => conKg(v, i, kg))}
                  cambiaValore={(valore) => aggiorna((v) => conValore(v, i, valore))}
                  azione={
                    <button className="btn-icona" aria-label={`Togli la serie ${i + 1}`} onClick={() => aggiorna((v) => ({ ...v, serie: v.serie.filter((_, j) => j !== i) }))}>
                      <Trash2 size={18} />
                    </button>
                  }
                />
              ))}
              <button
                className="btn piccolo"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => aggiorna((v) => serieInPiu(v, obiettivoSerie(v.obiettivo, v.serie.length, v.tipo)))}
              >
                <Plus size={16} /> Serie
              </button>
            </div>
          )}
          <CampoTesto className="input" valore={voce.note ?? ''} placeholder="Note (facoltative)" cambia={(note) => aggiorna((v) => ({ ...v, note: note || undefined }))} />
        </>
      )}
    </div>
  )
}

/** Registro: per segnare i risultati di un allenamento già fatto o in corso, senza timer */
export function Registro() {
  const naviga = useNavigate()
  const imp = useImpostazioni()
  const sessioni = useLiveQuery(() => db.sessioni.toArray(), [])
  const esercizi = useLiveQuery(async () => new Map((await db.esercizi.toArray()).map((e) => [e.id, e])), [])
  const [quando, setQuando] = useState<'adesso' | 'prima'>('adesso')
  const [durata, setDurata] = useState<number | undefined>()
  const [menu, setMenu] = useState(false)
  const [libreria, setLibreria] = useState(false)
  const [musica, setMusica] = useState(false)
  const concluse = useMemo(() => (sessioni ?? []).filter((s) => s.fine), [sessioni])
  const sessione = sessioni?.find((s) => !s.fine)

  if (!sessioni || !esercizi) return null
  if (sessione && sessione.modalita !== 'registro') return <Navigate to={percorsoSessione(sessione)} replace />
  if (!sessione) {
    return (
      <>
        <Testata titolo="Registro" indietro="/" />
        <div className="pagina">
          <Vuoto icona={<ClipboardPen size={40} />} titolo="Nessun registro aperto" azione={<Link to="/" className="btn primario">Torna alla home</Link>} />
        </div>
      </>
    )
  }

  const cambiaData = (data: string, ora: string) => {
    const [h, m] = ora.split(':').map(Number)
    const d = daChiaveGiorno(data)
    d.setHours(h || 0, m || 0, 0, 0)
    void db.sessioni.update(sessione.id, { inizio: d.getTime() })
  }

  const salva = async () => {
    const s = await db.sessioni.get(sessione.id)
    if (!s) return
    const daSalvare = s.voci.filter((v) => !v.saltato)
    if (!daSalvare.length) {
      alert('Non ci sono esercizi da salvare.')
      return
    }
    const adesso = Date.now()
    const inizio = quando === 'adesso' ? s.inizio : Math.min(s.inizio, adesso)
    const fine = quando === 'adesso' ? adesso : durata ? inizio + durata * 60000 : inizio
    await salvaRegistro(s, { inizio, fine, senzaDurata: quando === 'prima' && !durata })
    naviga(`/storico/${s.id}?riepilogo=1`, { replace: true })
  }

  const annulla = async () => {
    if (!confirm('Annullare questo registro? Quello che hai scritto verrà perso.')) return
    await db.sessioni.delete(sessione.id)
    naviga('/', { replace: true })
  }

  const passaAdAllenamento = async () => {
    await db.sessioni.update(sessione.id, { modalita: 'allenamento' })
    naviga('/allenamento', { replace: true })
  }

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
            <button className="btn-icona pieno" aria-label="Menu registro" onClick={() => setMenu(true)}>
              <MoreHorizontal size={22} />
            </button>
          </>
        }
      />
      <div className="pagina">
        <div className="riga muto piccolo" style={{ marginTop: -8, gap: 6 }}>
          <ClipboardPen size={15} /> Registro: scrivi i risultati, senza timer
        </div>

        {musica && <PannelloMusica chiudi={() => setMusica(false)} />}

        <div className="card colonna">
          <Segmentato
            opzioni={[
              { valore: 'adesso', etichetta: 'Mi sto allenando' },
              { valore: 'prima', etichetta: 'Già fatto' },
            ]}
            valore={quando}
            cambia={setQuando}
          />
          {quando === 'prima' && (
            <div className="griglia-3">
              <label className="campo">
                <span>Giorno</span>
                <input type="date" value={chiaveGiorno(sessione.inizio)} max={chiaveGiorno()} onChange={(e) => e.target.value && cambiaData(e.target.value, oraDi(sessione.inizio))} />
              </label>
              <label className="campo">
                <span>Ora</span>
                <input type="time" value={oraDi(sessione.inizio)} onChange={(e) => e.target.value && cambiaData(chiaveGiorno(sessione.inizio), e.target.value)} />
              </label>
              <label className="campo">
                <span>Durata (min)</span>
                <CampoNumero className="input" valore={durata} cambia={setDurata} decimali={false} placeholder="—" />
              </label>
            </div>
          )}
          <p className="piccolo muto">
            «0» = ripetizioni come da scheda; usa + e − se ne hai fatte di più o di meno. Le serie che lasci valgono come fatte: togli quelle che non hai fatto.
          </p>
        </div>

        {sessione.voci.length === 0 && (
          <Vuoto
            icona={<Dumbbell size={40} />}
            titolo="Nessun esercizio"
            azione={
              <button className="btn primario" onClick={() => setLibreria(true)}>
                <Plus size={18} /> Aggiungi esercizio
              </button>
            }
          />
        )}

        {sessione.voci.map((v) => (
          <SchedaRegistro key={v.uid} sessione={sessione} voce={v} esercizio={esercizi.get(v.esercizioId)} storico={storicoEsercizio(concluse, v.esercizioId)} />
        ))}

        {sessione.voci.length > 0 && (
          <button className="btn pieno" onClick={() => setLibreria(true)}>
            <Plus size={18} /> Aggiungi esercizio
          </button>
        )}

        <button className="btn primario grande pieno" onClick={salva}>
          <Save size={20} /> Salva allenamento
        </button>
      </div>

      <Foglio aperto={menu} chiudi={() => setMenu(false)} titolo="Registro">
        <div className="lista">
          <button className="voce" onClick={passaAdAllenamento}>
            <Play size={20} /> <span className="corpo">Passa all'allenamento guidato (timer, un esercizio alla volta)</span>
          </button>
          <button className="voce pericolo" onClick={annulla}>
            <Trash2 size={20} /> <span className="corpo">Annulla registro</span>
          </button>
        </div>
      </Foglio>

      <ScegliEsercizio
        aperto={libreria}
        chiudi={() => setLibreria(false)}
        scegli={async (scelta) => {
          setLibreria(false)
          const es = await assicuraEsercizio(scelta)
          const s = await db.sessioni.get(sessione.id)
          if (s) await aggiungiVoce(s, es, imp.recuperoPredefinito)
        }}
      />
    </>
  )
}
