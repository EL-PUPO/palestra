import { useEffect, useMemo, useRef, useState } from 'react'

export interface PuntoGrafico {
  x: number
  y: number
}

interface Props {
  punti: PuntoGrafico[]
  formatoY: (v: number) => string
  formatoX: (x: number) => string
  altezza?: number
}

const MARGINE = { sopra: 16, destra: 44, sotto: 24, sinistra: 40 }

function passoPulito(intervallo: number, tacche: number): number {
  const grezzo = intervallo / tacche
  const potenza = 10 ** Math.floor(Math.log10(grezzo))
  const n = grezzo / potenza
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * potenza
}

/** Grafico a linea singola con cursore che segue il dito */
export function GraficoLinea({ punti, formatoY, formatoX, altezza = 190 }: Props) {
  const contenitore = useRef<HTMLDivElement>(null)
  const [larghezza, setLarghezza] = useState(340)
  const [selezionato, setSelezionato] = useState<number | null>(null)

  useEffect(() => {
    const el = contenitore.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setLarghezza(Math.max(200, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const g = useMemo(() => {
    if (!punti.length) return null
    const ys = punti.map((p) => p.y)
    let min = Math.min(...ys)
    let max = Math.max(...ys)
    if (min === max) {
      min -= Math.max(1, Math.abs(min) * 0.1)
      max += Math.max(1, Math.abs(max) * 0.1)
    }
    const passo = passoPulito(max - min, 3)
    const yMin = Math.floor(min / passo) * passo
    const yMax = Math.ceil(max / passo) * passo
    const tacche: number[] = []
    for (let v = yMin; v <= yMax + passo / 2; v += passo) tacche.push(Math.round(v * 1000) / 1000)

    const xMin = punti[0].x
    const xMax = punti[punti.length - 1].x
    const w = larghezza - MARGINE.sinistra - MARGINE.destra
    const h = altezza - MARGINE.sopra - MARGINE.sotto
    const sx = (x: number) => MARGINE.sinistra + (xMax === xMin ? w / 2 : ((x - xMin) / (xMax - xMin)) * w)
    const sy = (y: number) => MARGINE.sopra + h - ((y - yMin) / (yMax - yMin)) * h
    const coord = punti.map((p) => ({ ...p, cx: sx(p.x), cy: sy(p.y) }))
    const linea = coord.map((c, i) => `${i ? 'L' : 'M'}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(' ')
    const base = MARGINE.sopra + h
    const area = coord.length > 1 ? `${linea} L${coord[coord.length - 1].cx.toFixed(1)},${base} L${coord[0].cx.toFixed(1)},${base} Z` : ''
    return { tacche, sy, coord, linea, area, base }
  }, [punti, larghezza, altezza])

  if (!g) return null

  const indice = selezionato ?? g.coord.length - 1
  const attivo = g.coord[indice]
  const ultimo = g.coord[g.coord.length - 1]

  const muovi = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    let migliore = 0
    g.coord.forEach((c, i) => {
      if (Math.abs(c.cx - x) < Math.abs(g.coord[migliore].cx - x)) migliore = i
    })
    setSelezionato(migliore)
  }

  return (
    <div ref={contenitore}>
      <p className="suggerimento-grafico">
        <strong style={{ color: 'var(--testo)' }}>{formatoY(attivo.y)}</strong> · {formatoX(attivo.x)}
      </p>
      <svg
        className="grafico"
        width={larghezza}
        height={altezza}
        viewBox={`0 0 ${larghezza} ${altezza}`}
        onPointerDown={muovi}
        onPointerMove={muovi}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setSelezionato(null)}
        role="img"
        aria-label={`Andamento: da ${formatoY(g.coord[0].y)} a ${formatoY(ultimo.y)}`}
      >
        {g.tacche.map((t) => (
          <g key={t}>
            <line className="griglia" x1={MARGINE.sinistra} x2={larghezza - MARGINE.destra} y1={g.sy(t)} y2={g.sy(t)} />
            <text x={MARGINE.sinistra - 6} y={g.sy(t) + 4} textAnchor="end">
              {t.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
            </text>
          </g>
        ))}
        <text x={g.coord[0].cx} y={altezza - 6} textAnchor={g.coord.length > 1 ? 'start' : 'middle'}>
          {formatoX(g.coord[0].x)}
        </text>
        {g.coord.length > 1 && (
          <text x={ultimo.cx} y={altezza - 6} textAnchor="end">
            {formatoX(ultimo.x)}
          </text>
        )}
        {g.area && <path className="area" d={g.area} />}
        <path className="linea" d={g.linea} />
        {selezionato !== null && <line className="cursore" x1={attivo.cx} x2={attivo.cx} y1={MARGINE.sopra - 6} y2={g.base} />}
        {g.coord.length <= 24 &&
          g.coord.map((c, i) => <circle key={i} cx={c.cx} cy={c.cy} r={i === indice ? 5 : 3} className="punto" />)}
        {g.coord.length > 24 && <circle cx={attivo.cx} cy={attivo.cy} r={5} className="punto" />}
        <text x={ultimo.cx + 8} y={ultimo.cy + 4} style={{ fill: 'var(--testo-2)', fontWeight: 600 }}>
          {formatoY(ultimo.y).replace(/\s.*$/, '')}
        </text>
      </svg>
    </div>
  )
}
