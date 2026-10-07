import { Download, Music, Trash2, Upload } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { GestionePlaylist } from '../componenti/PannelloMusica'
import { CampoNumero, Interruttore, mostraMessaggio, Passi, Segmentato, Testata } from '../componenti/ui'
import { cancellaTutto, condividiBackup, ripristinaBackup } from '../lib/backup'
import { giorniFa, numero } from '../lib/formato'
import { aggiornaImpostazioni, useImpostazioni, type Accento } from '../lib/impostazioni'

const COLORI: { valore: Accento; colore: string; nome: string }[] = [
  { valore: 'blu', colore: '#3b7cff', nome: 'Blu' },
  { valore: 'verde', colore: '#16a35a', nome: 'Verde' },
  { valore: 'arancio', colore: '#f0761a', nome: 'Arancio' },
  { valore: 'rosso', colore: '#e5484d', nome: 'Rosso' },
  { valore: 'viola', colore: '#8b5cf6', nome: 'Viola' },
  { valore: 'rosa', colore: '#e0457b', nome: 'Rosa' },
  { valore: 'ciano', colore: '#0ea5b7', nome: 'Ciano' },
]

const DISCHI_POSSIBILI = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5]

function Riga({ titolo, sotto, children }: { titolo: string; sotto?: string; children: ReactNode }) {
  return (
    <div className="voce">
      <div className="corpo">
        <div style={{ fontWeight: 550 }}>{titolo}</div>
        {sotto && <div className="sotto">{sotto}</div>}
      </div>
      {children}
    </div>
  )
}

export function Impostazioni() {
  const imp = useImpostazioni()
  const naviga = useNavigate()
  const [conFoto, setConFoto] = useState(true)
  const [occupato, setOccupato] = useState(false)

  const esporta = async () => {
    setOccupato(true)
    try {
      const r = await condividiBackup(conFoto)
      if (r !== 'annullato') mostraMessaggio('Backup creato')
    } catch {
      mostraMessaggio('Non sono riuscito a creare il backup')
    } finally {
      setOccupato(false)
    }
  }

  const importa = async (file: File | undefined) => {
    if (!file) return
    if (!confirm('Il ripristino sostituisce tutti i dati attuali con quelli del backup. Continuare?')) return
    setOccupato(true)
    try {
      await ripristinaBackup(file)
      mostraMessaggio('Backup ripristinato')
      naviga('/')
    } catch (e) {
      mostraMessaggio((e as Error).message || 'File non valido')
    } finally {
      setOccupato(false)
    }
  }

  const cancella = async () => {
    if (!confirm('Cancellare TUTTI i dati (schede, allenamenti, misure, foto)?')) return
    if (!confirm('Sicuro? Senza un backup non si possono recuperare.')) return
    await cancellaTutto()
    mostraMessaggio('Dati cancellati')
    naviga('/')
  }

  return (
    <>
      <Testata titolo="Impostazioni" indietro />
      <div className="pagina">
        <div className="sezione">
          <span className="etichetta-sezione">Aspetto</span>
          <div className="card colonna">
            <div className="campo">
              <span>Tema</span>
              <Segmentato
                opzioni={[
                  { valore: 'auto', etichetta: 'Automatico' },
                  { valore: 'chiaro', etichetta: 'Chiaro' },
                  { valore: 'scuro', etichetta: 'Scuro' },
                ]}
                valore={imp.tema}
                cambia={(tema) => aggiornaImpostazioni({ tema })}
              />
            </div>
            <div className="campo">
              <span>Colore</span>
              <div className="colori">
                {COLORI.map((c) => (
                  <button
                    key={c.valore}
                    className={imp.accento === c.valore ? 'attivo' : ''}
                    style={{ background: c.colore }}
                    aria-label={c.nome}
                    aria-pressed={imp.accento === c.valore}
                    onClick={() => aggiornaImpostazioni({ accento: c.valore })}
                  />
                ))}
              </div>
            </div>
            <div className="campo">
              <span>Dimensione del testo</span>
              <Segmentato
                opzioni={[
                  { valore: 'normale', etichetta: 'Normale' },
                  { valore: 'grande', etichetta: 'Grande' },
                ]}
                valore={imp.testo}
                cambia={(testo) => aggiornaImpostazioni({ testo })}
              />
            </div>
          </div>
        </div>

        <div className="sezione">
          <span className="etichetta-sezione">Allenamento</span>
          <div className="lista">
            <Riga titolo="Recupero predefinito" sotto="Secondi, se la scheda non lo indica. Durante l'allenamento lo cambi dal tasto Recupero">
              <Passi valore={imp.recuperoPredefinito} min={0} max={600} passo={15} etichetta="recupero" cambia={(recuperoPredefinito) => aggiornaImpostazioni({ recuperoPredefinito })} />
            </Riga>
            <Riga titolo="Avvia il recupero da solo" sotto="Quando segni una serie come fatta">
              <Interruttore attivo={imp.recuperoAutomatico} cambia={(recuperoAutomatico) => aggiornaImpostazioni({ recuperoAutomatico })} etichetta="Avvia il recupero da solo" />
            </Riga>
            <Riga titolo="Passa da solo all'esercizio dopo" sotto="Quando finisci tutte le serie">
              <Interruttore
                attivo={imp.avanzamentoAutomatico}
                cambia={(avanzamentoAutomatico) => aggiornaImpostazioni({ avanzamentoAutomatico })}
                etichetta="Passa da solo all'esercizio dopo"
              />
            </Riga>
            <Riga titolo="Cronometro" sotto="Tempo trascorso durante l'allenamento">
              <Interruttore attivo={imp.mostraCronometro} cambia={(mostraCronometro) => aggiornaImpostazioni({ mostraCronometro })} etichetta="Mostra il cronometro" />
            </Riga>
            <Riga titolo="Suono a fine recupero">
              <Interruttore attivo={imp.suono} cambia={(suono) => aggiornaImpostazioni({ suono })} etichetta="Suono a fine recupero" />
            </Riga>
            <Riga titolo="Schermo sempre acceso" sotto="Durante l'allenamento">
              <Interruttore attivo={imp.schermoAcceso} cambia={(schermoAcceso) => aggiornaImpostazioni({ schermoAcceso })} etichetta="Schermo sempre acceso" />
            </Riga>
            <Riga titolo="Obiettivo settimanale" sotto="Allenamenti a settimana">
              <Passi valore={imp.obiettivoSettimanale} min={1} max={7} etichetta="obiettivo" cambia={(obiettivoSettimanale) => aggiornaImpostazioni({ obiettivoSettimanale })} />
            </Riga>
          </div>
        </div>

        <div className="sezione">
          <span className="etichetta-sezione">Aumento dei carichi</span>
          <div className="lista">
            <Riga titolo="Di quanto aumentare" sotto="Kg suggeriti quando chiudi tutte le serie">
              <CampoNumero
                className="input stretto"
                valore={imp.incrementoKg}
                cambia={(v) => v !== undefined && v > 0 && aggiornaImpostazioni({ incrementoKg: v })}
                aria-label="Kg di aumento"
              />
            </Riga>
            <Riga titolo="Dopo quante sessioni" sotto="Di fila con tutte le ripetizioni fatte">
              <Passi valore={imp.sessioniPerAumento} min={1} max={4} etichetta="sessioni" cambia={(sessioniPerAumento) => aggiornaImpostazioni({ sessioniPerAumento })} />
            </Riga>
          </div>
        </div>

        <div className="sezione">
          <span className="etichetta-sezione">Bilanciere e dischi</span>
          <div className="card colonna">
            <label className="campo">
              <span>Peso del bilanciere (kg)</span>
              <CampoNumero className="input" valore={imp.pesoBilanciere} cambia={(v) => v !== undefined && aggiornaImpostazioni({ pesoBilanciere: v })} />
            </label>
            <div className="campo">
              <span>Dischi disponibili in palestra</span>
              <div className="riga a-capo">
                {DISCHI_POSSIBILI.map((d) => {
                  const attivo = imp.dischi.includes(d)
                  return (
                    <button
                      key={d}
                      className={`chip${attivo ? ' attivo' : ''}`}
                      aria-pressed={attivo}
                      onClick={() => aggiornaImpostazioni({ dischi: attivo ? imp.dischi.filter((x) => x !== d) : [...imp.dischi, d].sort((a, b) => b - a) })}
                    >
                      {numero(d)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="sezione" id="musica">
          <span className="etichetta-sezione">Musica da YouTube</span>
          <div className="card colonna">
            <p className="piccolo muto">
              Salva le tue playlist: durante l'allenamento le apri col tasto <Music size={13} style={{ verticalAlign: -2 }} /> in alto.
            </p>
            <GestionePlaylist />
          </div>
        </div>

        <div className="sezione">
          <span className="etichetta-sezione">I tuoi dati</span>
          <div className="card colonna">
            <p className="piccolo muto">
              Tutto è salvato solo su questo telefono. I brani MP3 non entrano nel backup: se cambi telefono li reimporti dall'app File. Fai un backup ogni tanto e salvalo su File o iCloud Drive: se cambi telefono o cancelli l'app, lo
              ripristini da qui.
              {imp.ultimoBackup ? ` Ultimo backup: ${giorniFa(imp.ultimoBackup)}.` : ' Non hai ancora fatto un backup.'}
            </p>
            <div className="riga spazio">
              <span>Includi le foto</span>
              <Interruttore attivo={conFoto} cambia={setConFoto} etichetta="Includi le foto nel backup" />
            </div>
            <button className="btn primario" disabled={occupato} onClick={esporta}>
              <Download size={18} /> Esporta backup
            </button>
            <label className="btn">
              <Upload size={18} /> Ripristina da backup
              <input type="file" accept="application/json,.json" hidden onChange={(e) => importa(e.target.files?.[0]).then(() => (e.target.value = ''))} />
            </label>
          </div>
          <button className="btn pericolo pieno" onClick={cancella}>
            <Trash2 size={18} /> Cancella tutti i dati
          </button>
        </div>
      </div>
    </>
  )
}
