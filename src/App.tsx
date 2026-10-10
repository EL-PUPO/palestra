import { ChartLine, ClipboardList, History, House, Scale } from 'lucide-react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { MiniBrani } from './componenti/LibreriaBrani'
import { Toast } from './componenti/ui'
import { configurazioneVerificata, useImpostazioni } from './lib/impostazioni'
import { Allenamento } from './pagine/Allenamento'
import { Benvenuto } from './pagine/Benvenuto'
import { Corpo } from './pagine/Corpo'
import { DettaglioEsercizio } from './pagine/DettaglioEsercizio'
import { DettaglioScheda } from './pagine/DettaglioScheda'
import { DettaglioSessione } from './pagine/DettaglioSessione'
import { Home } from './pagine/Home'
import { Impostazioni } from './pagine/Impostazioni'
import { NuovaScheda } from './pagine/NuovaScheda'
import { Progressi } from './pagine/Progressi'
import { Registro } from './pagine/Registro'
import { Schede } from './pagine/Schede'
import { Storico } from './pagine/Storico'

const TAB = [
  { a: '/', etichetta: 'Home', icona: House },
  { a: '/schede', etichetta: 'Schede', icona: ClipboardList },
  { a: '/storico', etichetta: 'Storico', icona: History },
  { a: '/progressi', etichetta: 'Progressi', icona: ChartLine },
  { a: '/corpo', etichetta: 'Corpo', icona: Scale },
]

function Struttura() {
  const { pathname } = useLocation()
  const imp = useImpostazioni()
  if (!imp.configurato) {
    if (!configurazioneVerificata()) return null
    return (
      <div className="app senza-tab">
        <Benvenuto />
        <Toast />
      </div>
    )
  }
  const senzaTab = pathname.startsWith('/allenamento') || pathname.startsWith('/registro')
  return (
    <div className={`app${senzaTab ? ' senza-tab' : ''}`}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/schede" element={<Schede />} />
        <Route path="/schede/nuova" element={<NuovaScheda />} />
        <Route path="/schede/:id" element={<DettaglioScheda />} />
        <Route path="/allenamento" element={<Allenamento />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/storico" element={<Storico />} />
        <Route path="/storico/:id" element={<DettaglioSessione />} />
        <Route path="/progressi" element={<Progressi />} />
        <Route path="/progressi/:id" element={<DettaglioEsercizio />} />
        <Route path="/corpo" element={<Corpo />} />
        <Route path="/impostazioni" element={<Impostazioni />} />
        <Route path="*" element={<Home />} />
      </Routes>
      {!senzaTab && (
        <div className="barra-tab">
          <nav>
            {TAB.map(({ a, etichetta, icona: Icona }) => (
              <NavLink key={a} to={a} end={a === '/'}>
                <Icona size={22} />
                {etichetta}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
      <MiniBrani />
      <Toast />
    </div>
  )
}

export function App() {
  return (
    <HashRouter>
      <Struttura />
    </HashRouter>
  )
}
