import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, ClipboardPaste, ClipboardPen, Download, Flame, Music, Play, Settings, Share, Timer } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PannelloMusica } from '../componenti/PannelloMusica'
import { Testata, Vuoto } from '../componenti/ui'
import { db, type GiornoScheda, type Modalita } from '../db'
import { iniziaSessione, percorsoSessione, prossimoGiorno } from '../lib/allenamento'
import { dataBreve, dataLunga, durataLeggibile, giorniFa, maiuscolaIniziale, ora } from '../lib/formato'
import { useImpostazioni } from '../lib/impostazioni'
import { contaSerie, sessioniSettimana, settimaneDiFila } from '../lib/statistiche'
import { impostaMusicaAperta, useMusicaAperta } from '../lib/statoMusica'

const suIphoneNelBrowser =
  typeof navigator !== 'undefined' &&
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  !(navigator as Navigator & { standalone?: boolean }).standalone

export function Home() {
  const naviga = useNavigate()
  const imp = useImpostazioni()
  const sessioni = useLiveQuery(() => db.sessioni.orderBy('inizio').reverse().toArray(), [])
  const schede = useLiveQuery(() => db.schede.toArray(), [])
  const [giornoScelto, setGiornoScelto] = useState<string | null>(null)
  const musica = useMusicaAperta()

  if (!sessioni || !schede) return null

  const inCorso = sessioni.find((s) => !s.fine)
  const concluse = sessioni.filter((s) => s.fine)
  const scheda = schede.find((s) => s.attiva)
  const suggerito = scheda ? prossimoGiorno(scheda, sessioni) : undefined
  const giorno: GiornoScheda | undefined = scheda?.giorni.find((g) => g.uid === giornoScelto) ?? suggerito
  const settimana = sessioniSettimana(concluse)
  const diFila = settimaneDiFila(concluse)
  const backupVecchio = concluse.length >= 3 && (!imp.ultimoBackup || Date.now() - imp.ultimoBackup > 14 * 86400000)

  const inizia = async (modalita: Modalita, conScheda = true) => {
    await iniziaSessione(conScheda ? scheda : undefined, conScheda ? giorno : undefined, modalita)
    naviga(modalita === 'registro' ? '/registro' : '/allenamento')
  }

  return (
    <>
      <Testata
        grande
        titolo={
          <span className="riga" style={{ gap: 10 }}>
            <img src="icona.svg" alt="" width={34} height={34} style={{ borderRadius: 9 }} />
            Palestra
          </span>
        }
        azioni={
          <>
            <button
              className={`btn-icona${musica ? ' pieno' : ''}`}
              aria-label="Musica"
              aria-pressed={musica}
              onClick={() => impostaMusicaAperta(!musica)}
              style={musica ? { color: 'var(--accento)' } : undefined}
            >
              <Music size={22} />
            </button>
            <Link to="/impostazioni" className="btn-icona" aria-label="Impostazioni">
              <Settings size={22} />
            </Link>
          </>
        }
      />
      <div className="pagina">
        <p className="muto" style={{ marginTop: -10 }}>
          {maiuscolaIniziale(dataLunga(Date.now()))}
        </p>

        {musica && <PannelloMusica chiudi={() => impostaMusicaAperta(false)} />}

        {suIphoneNelBrowser && (
          <div className="avviso info">
            <Share size={18} />
            <p>
              Per installarla: tocca <strong>Condividi</strong> e poi <strong>Aggiungi alla schermata Home</strong>. Funzionerà anche senza
              connessione.
            </p>
          </div>
        )}

        {inCorso ? (
          <div className="card evidenza colonna">
            <div className="riga">
              {inCorso.modalita === 'registro' ? <ClipboardPen size={20} className="successo" /> : <Timer size={20} className="successo" />}
              <span className="badge successo">{inCorso.modalita === 'registro' ? 'Registro aperto' : 'Allenamento in corso'}</span>
            </div>
            <div>
              <h2>{inCorso.nomeGiorno}</h2>
              <p className="muto piccolo">
                Iniziato alle {ora(inCorso.inizio)} · {contaSerie(inCorso).fatte} serie fatte
              </p>
            </div>
            <Link to={percorsoSessione(inCorso)} className="btn primario grande pieno">
              <Play size={20} /> Riprendi
            </Link>
          </div>
        ) : scheda && giorno ? (
          <div className="card colonna">
            <div>
              <p className="muto piccolo">{giorno.uid === suggerito?.uid ? 'Prossimo allenamento' : 'Allenamento scelto'}</p>
              <h2 style={{ fontSize: '1.35rem' }}>{giorno.nome}</h2>
              <p className="muto piccolo">
                {scheda.nome} · {giorno.esercizi.length} esercizi
              </p>
            </div>
            {scheda.giorni.length > 1 && (
              <div className="chips">
                {scheda.giorni.map((g) => (
                  <button key={g.uid} className={`chip${g.uid === giorno.uid ? ' attivo' : ''}`} onClick={() => setGiornoScelto(g.uid)}>
                    {g.nome}
                  </button>
                ))}
              </div>
            )}
            <div className="griglia-2">
              <button className="btn primario grande" onClick={() => inizia('allenamento')}>
                <Play size={20} /> Allenati
              </button>
              <button className="btn grande" onClick={() => inizia('registro')}>
                <ClipboardPen size={20} /> Registra
              </button>
            </div>
            <p className="piccolo muto">
              <strong>Allenati</strong>: l'app ti guida con timer e un esercizio alla volta. <strong>Registra</strong>: scrivi solo i risultati, anche
              di un allenamento già fatto.
            </p>
          </div>
        ) : (
          <div className="card">
            <Vuoto
              icona={<ClipboardPaste size={40} />}
              titolo="Inserisci la tua scheda"
              testo="Incolla il testo della scheda: giorni ed esercizi vengono sistemati in automatico."
              azione={
                <Link to="/schede/nuova" className="btn primario">
                  Inserisci scheda
                </Link>
              }
            />
          </div>
        )}

        <div className="metriche">
          <div className="metrica">
            <div className="etichetta">Questa settimana</div>
            <div className="valore">
              {settimana} <small>/ {imp.obiettivoSettimanale}</small>
            </div>
          </div>
          <div className="metrica">
            <div className="etichetta">Settimane di fila</div>
            <div className="valore riga" style={{ gap: 4 }}>
              {diFila} {diFila > 0 && <Flame size={18} className="attenzione" />}
            </div>
          </div>
          <div className="metrica">
            <div className="etichetta">Totale</div>
            <div className="valore">{concluse.length}</div>
          </div>
        </div>

        {backupVecchio && (
          <Link to="/impostazioni" className="avviso">
            <Download size={18} />
            <p>
              {imp.ultimoBackup ? `Ultimo backup ${giorniFa(imp.ultimoBackup)}.` : 'Non hai ancora fatto un backup.'} I dati sono solo su questo
              telefono: salvane una copia.
            </p>
          </Link>
        )}

        {concluse.length > 0 && (
          <div className="sezione">
            <div className="riga spazio">
              <span className="etichetta-sezione">Ultimi allenamenti</span>
              <Link to="/storico" className="piccolo" style={{ color: 'var(--accento)' }}>
                Vedi tutti
              </Link>
            </div>
            <div className="lista">
              {concluse.slice(0, 3).map((s) => (
                <Link key={s.id} to={`/storico/${s.id}`} className="voce">
                  <div className="corpo">
                    <div className="titolo">{s.nomeGiorno}</div>
                    <div className="sotto">
                      {dataBreve(s.inizio)}
                      {s.senzaDurata ? '' : ` · ${durataLeggibile((s.fine ?? s.inizio) - s.inizio)}`}
                    </div>
                  </div>
                  <ChevronRight size={18} className="freccia" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {!inCorso && (
          <div className="griglia-2">
            <button className="btn" onClick={() => inizia('allenamento', false)}>
              Allenamento libero
            </button>
            <button className="btn" onClick={() => inizia('registro', false)}>
              Registra senza scheda
            </button>
          </div>
        )}
      </div>
    </>
  )
}
