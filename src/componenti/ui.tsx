import { ChevronLeft, Minus, Plus } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { useNavigate } from 'react-router-dom'
import { leggiNumero, numero } from '../lib/formato'

export function Testata({ titolo, indietro, azioni, grande }: { titolo: ReactNode; indietro?: boolean | string; azioni?: ReactNode; grande?: boolean }) {
  const naviga = useNavigate()
  return (
    <header className={`testata${grande ? ' grande' : ''}`}>
      {indietro && (
        <button
          className="btn-icona"
          aria-label="Indietro"
          onClick={() => (typeof indietro === 'string' ? naviga(indietro) : naviga(-1))}
          style={{ marginLeft: -8 }}
        >
          <ChevronLeft size={26} />
        </button>
      )}
      <h1>{titolo}</h1>
      {azioni}
    </header>
  )
}

export function Foglio({ aperto, chiudi, titolo, alto, children }: { aperto: boolean; chiudi: () => void; titolo?: ReactNode; alto?: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!aperto) return
    const prima = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prima
    }
  }, [aperto])
  if (!aperto) return null
  return (
    <div className="velo" onClick={chiudi}>
      <div className="foglio" style={alto ? { height: '90dvh' } : undefined} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="maniglia" />
        {titolo && (
          <div className="card-titolo">
            <h2>{titolo}</h2>
            <button className="btn piccolo" onClick={chiudi}>
              Chiudi
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** Campo numerico che accetta la virgola (tastierino italiano dell'iPhone) */
export function CampoNumero({
  valore,
  cambia,
  decimali = true,
  className,
  placeholder,
  ref,
  ...resto
}: {
  valore: number | undefined
  cambia: (v: number | undefined) => void
  decimali?: boolean
  className?: string
  placeholder?: string
  ref?: Ref<HTMLInputElement>
  'aria-label'?: string
}) {
  const [testo, setTesto] = useState(valore === undefined ? '' : numero(valore))
  const [modifica, setModifica] = useState(false)
  useEffect(() => {
    if (!modifica) setTesto(valore === undefined ? '' : numero(valore))
  }, [valore, modifica])
  return (
    <input
      {...resto}
      ref={ref}
      className={className}
      placeholder={placeholder}
      inputMode={decimali ? 'decimal' : 'numeric'}
      value={testo}
      onFocus={(e) => {
        setModifica(true)
        e.currentTarget.select()
      }}
      onBlur={() => {
        setModifica(false)
        setTesto(valore === undefined ? '' : numero(valore))
      }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '')
        setTesto(t)
        cambia(leggiNumero(t))
      }}
    />
  )
}

/** Campo di testo che salva a ogni tasto senza far saltare il cursore quando il valore arriva dal database */
export function CampoTesto({ valore, cambia, ...resto }: { valore: string; cambia: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [testo, setTesto] = useState(valore)
  const [modifica, setModifica] = useState(false)
  useEffect(() => {
    if (!modifica) setTesto(valore)
  }, [valore, modifica])
  return (
    <input
      {...resto}
      value={testo}
      onFocus={() => setModifica(true)}
      onBlur={() => setModifica(false)}
      onChange={(e) => {
        setTesto(e.target.value)
        cambia(e.target.value)
      }}
    />
  )
}

export function Passi({ valore, cambia, min = 0, max = 999, passo = 1, etichetta }: { valore: number | undefined; cambia: (v: number) => void; min?: number; max?: number; passo?: number; etichetta?: string }) {
  const v = valore ?? 0
  return (
    <div className="passi">
      <button type="button" aria-label={`Diminuisci ${etichetta ?? ''}`} onClick={() => cambia(Math.max(min, Math.round((v - passo) * 100) / 100))}>
        <Minus size={16} />
      </button>
      <CampoNumero valore={valore} cambia={(n) => cambia(Math.min(max, Math.max(min, n ?? 0)))} decimali={passo % 1 !== 0} aria-label={etichetta} />
      <button type="button" aria-label={`Aumenta ${etichetta ?? ''}`} onClick={() => cambia(Math.min(max, Math.round((v + passo) * 100) / 100))}>
        <Plus size={16} />
      </button>
    </div>
  )
}

/**
 * Ripetizioni (o secondi) rispetto al previsto: "0" = come da scheda,
 * ogni + è una in più, ogni − una in meno. Senza obiettivo mostra il numero assoluto.
 */
export function Contatore({
  obiettivo,
  valore,
  cambia,
  passo = 1,
  unita = 'rip',
}: {
  obiettivo: number | undefined
  valore: number | undefined
  cambia: (v: number) => void
  passo?: number
  unita?: string
}) {
  const v = valore ?? obiettivo ?? 0
  const relativo = obiettivo !== undefined
  const delta = relativo ? v - obiettivo : 0
  const classe = delta > 0 ? ' piu' : delta < 0 ? ' meno' : ''
  return (
    <div className="contatore">
      <button type="button" aria-label={`${passo} ${unita} in meno`} onClick={() => cambia(Math.max(0, v - passo))}>
        <Minus size={18} />
      </button>
      {relativo ? (
        <div className={`contatore-valore${classe}`} aria-live="polite" aria-label={`${v} ${unita}, ${delta === 0 ? 'come previsto' : `${delta > 0 ? '+' : ''}${delta} rispetto al previsto`}`}>
          <span className="delta">{delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '0'}</span>
          <span className="totale">
            {v} {unita}
          </span>
        </div>
      ) : (
        <div className="contatore-valore">
          <CampoNumero className="contatore-campo" valore={valore} cambia={(n) => cambia(n ?? 0)} decimali={false} placeholder={unita} aria-label={unita} />
        </div>
      )}
      <button type="button" aria-label={`${passo} ${unita} in più`} onClick={() => cambia(v + passo)}>
        <Plus size={18} />
      </button>
    </div>
  )
}

export function Interruttore({ attivo, cambia, etichetta }: { attivo: boolean; cambia: (v: boolean) => void; etichetta: string }) {
  return (
    <label className="interruttore">
      <input type="checkbox" checked={attivo} onChange={(e) => cambia(e.target.checked)} aria-label={etichetta} />
      <span />
    </label>
  )
}

export function Segmentato<T extends string>({ opzioni, valore, cambia }: { opzioni: { valore: T; etichetta: ReactNode }[]; valore: T; cambia: (v: T) => void }) {
  return (
    <div className="segmentato" role="tablist">
      {opzioni.map((o) => (
        <button key={o.valore} type="button" role="tab" aria-selected={o.valore === valore} className={o.valore === valore ? 'attivo' : ''} onClick={() => cambia(o.valore)}>
          {o.etichetta}
        </button>
      ))}
    </div>
  )
}

export function Vuoto({ icona, titolo, testo, azione }: { icona: ReactNode; titolo: string; testo?: string; azione?: ReactNode }) {
  return (
    <div className="vuoto">
      {icona}
      <h3 style={{ color: 'var(--testo)' }}>{titolo}</h3>
      {testo && <p className="piccolo">{testo}</p>}
      {azione}
    </div>
  )
}

// --- messaggi brevi in alto ---

let messaggio: string | null = null
let scadenzaToast: ReturnType<typeof setTimeout> | undefined
const ascoltatoriToast = new Set<() => void>()

export function mostraMessaggio(testo: string) {
  messaggio = testo
  ascoltatoriToast.forEach((a) => a())
  clearTimeout(scadenzaToast)
  scadenzaToast = setTimeout(() => {
    messaggio = null
    ascoltatoriToast.forEach((a) => a())
  }, 2600)
}

export function Toast() {
  const m = useSyncExternalStore(
    (cb) => {
      ascoltatoriToast.add(cb)
      return () => ascoltatoriToast.delete(cb)
    },
    () => messaggio,
  )
  return m ? (
    <div className="toast" role="status">
      {m}
    </div>
  ) : null
}
