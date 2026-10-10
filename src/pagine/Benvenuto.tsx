import { Lock, Upload } from 'lucide-react'
import { useState } from 'react'
import { Passi, Segmentato, mostraMessaggio } from '../componenti/ui'
import { ripristinaBackup } from '../lib/backup'
import { aggiornaImpostazioni, useImpostazioni } from '../lib/impostazioni'

/**
 * Prima apertura: ognuno usa l'app sul proprio telefono, con i propri dati.
 * Chiede il nome e le scelte principali (tutto si cambia poi nelle Impostazioni).
 */
export function Benvenuto() {
  const imp = useImpostazioni()
  const [nome, setNome] = useState(imp.nomeUtente ?? '')
  const [occupato, setOccupato] = useState(false)

  const inizia = () => aggiornaImpostazioni({ nomeUtente: nome.trim() || undefined, configurato: true })

  const ripristina = async (file: File | undefined) => {
    if (!file) return
    setOccupato(true)
    try {
      await ripristinaBackup(file)
      aggiornaImpostazioni({ configurato: true })
      mostraMessaggio('Backup ripristinato')
    } catch (e) {
      mostraMessaggio((e as Error).message || 'File non valido')
    } finally {
      setOccupato(false)
    }
  }

  return (
    <div className="pagina" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 32px)', gap: 18 }}>
      <div className="colonna centro" style={{ alignItems: 'center', gap: 12 }}>
        <img src="icona.svg" alt="" width={84} height={84} style={{ borderRadius: 20 }} />
        <h1>Benvenuto in Palestra</h1>
        <p className="muto">Il tuo diario di allenamento: schede, serie, progressi e musica.</p>
      </div>

      <div className="card colonna">
        <label className="campo">
          <span>Come ti chiami?</span>
          <input
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && inizia()}
            placeholder="Il tuo nome"
            autoComplete="given-name"
            enterKeyHint="go"
          />
        </label>
        <div className="campo">
          <span>Quante volte ti alleni a settimana?</span>
          <div style={{ alignSelf: 'flex-start' }}>
            <Passi valore={imp.obiettivoSettimanale} min={1} max={7} etichetta="allenamenti a settimana" cambia={(obiettivoSettimanale) => aggiornaImpostazioni({ obiettivoSettimanale })} />
          </div>
        </div>
        <div className="campo">
          <span>Aspetto</span>
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
      </div>

      <div className="avviso info">
        <Lock size={18} />
        <p className="piccolo">I tuoi dati restano solo su questo telefono: nessun account, nessuno li vede. Ogni persona che usa l'app ha i suoi.</p>
      </div>

      <button className="btn primario grande pieno" onClick={inizia}>
        Inizia
      </button>
      <label className="btn pieno" aria-disabled={occupato}>
        <Upload size={18} /> Ho già un backup: ripristinalo
        <input type="file" accept="application/json,.json" hidden disabled={occupato} onChange={(e) => ripristina(e.target.files?.[0])} />
      </label>
    </div>
  )
}
