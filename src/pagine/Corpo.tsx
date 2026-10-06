import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ImagePlus, Plus, Ruler, Scale, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { GraficoLinea } from '../componenti/GraficoLinea'
import { CampoNumero, Foglio, mostraMessaggio, Segmentato, Testata, Vuoto } from '../componenti/ui'
import { db, nuovoId, type FotoProgresso, type MisuraCorpo } from '../db'
import { chiaveGiorno, daChiaveGiorno, dataBreve, numero } from '../lib/formato'

type CampoMisura = 'peso' | 'vita' | 'petto' | 'braccio' | 'coscia' | 'fianchi' | 'grasso'

const CAMPI: { chiave: CampoMisura; etichetta: string; unita: string }[] = [
  { chiave: 'peso', etichetta: 'Peso', unita: 'kg' },
  { chiave: 'vita', etichetta: 'Vita', unita: 'cm' },
  { chiave: 'petto', etichetta: 'Petto', unita: 'cm' },
  { chiave: 'braccio', etichetta: 'Braccio', unita: 'cm' },
  { chiave: 'coscia', etichetta: 'Coscia', unita: 'cm' },
  { chiave: 'fianchi', etichetta: 'Fianchi', unita: 'cm' },
  { chiave: 'grasso', etichetta: 'Massa grassa', unita: '%' },
]

/** Ridimensiona la foto a 1080 px per non riempire la memoria del telefono */
async function comprimiFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scala = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scala)
  canvas.height = Math.round(bitmap.height * scala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((ok) => canvas.toBlob((b) => ok(b ?? file), 'image/jpeg', 0.82))
}

function MiniaturaFoto({ foto, apri }: { foto: FotoProgresso; apri: () => void }) {
  const url = useMemo(() => URL.createObjectURL(foto.immagine), [foto.immagine])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <button onClick={apri}>
      <img src={url} alt={`Foto del ${dataBreve(foto.data)}`} loading="lazy" />
      <span>{dataBreve(foto.data)}</span>
    </button>
  )
}

function FotoGrande({ foto }: { foto: FotoProgresso }) {
  const url = useMemo(() => URL.createObjectURL(foto.immagine), [foto.immagine])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <img className="foto-grande" src={url} alt={`Foto del ${dataBreve(foto.data)}`} />
}

export function Corpo() {
  const misure = useLiveQuery(() => db.misure.orderBy('data').toArray(), [])
  const foto = useLiveQuery(() => db.foto.orderBy('data').reverse().toArray(), [])
  const [vista, setVista] = useState<'peso' | 'misure' | 'foto'>('peso')
  const [campo, setCampo] = useState<CampoMisura>('vita')
  const [bozza, setBozza] = useState<MisuraCorpo | null>(null)
  const [fotoAperta, setFotoAperta] = useState<FotoProgresso | null>(null)

  if (!misure || !foto) return null

  const nuovaMisura = () => {
    const oggi = chiaveGiorno()
    setBozza(misure.find((m) => m.data === oggi) ?? { id: nuovoId(), data: oggi })
  }

  const salva = async () => {
    if (!bozza) return
    const stessoGiorno = misure.find((m) => m.data === bozza.data && m.id !== bozza.id)
    if (stessoGiorno) {
      await db.misure.update(stessoGiorno.id, { ...bozza, id: stessoGiorno.id })
      if (misure.some((m) => m.id === bozza.id)) await db.misure.delete(bozza.id)
    } else await db.misure.put(bozza)
    setBozza(null)
    mostraMessaggio('Misurazione salvata')
  }

  const aggiungiFoto = async (file: File | undefined) => {
    if (!file) return
    try {
      const immagine = await comprimiFoto(file)
      await db.foto.add({ id: nuovoId(), data: chiaveGiorno(), immagine })
      mostraMessaggio('Foto salvata')
    } catch {
      mostraMessaggio('Non sono riuscito a leggere la foto')
    }
  }

  const campoAttivo = vista === 'peso' ? 'peso' : campo
  const info = CAMPI.find((c) => c.chiave === campoAttivo)!
  const valori = misure.filter((m) => m[campoAttivo] !== undefined)
  const punti = valori.map((m) => ({ x: daChiaveGiorno(m.data).getTime(), y: m[campoAttivo]! }))
  const ultimo = valori[valori.length - 1]
  const trentaGiorniFa = Date.now() - 30 * 86400000
  const riferimento = [...valori].reverse().find((m) => daChiaveGiorno(m.data).getTime() <= trentaGiorniFa) ?? valori[0]
  const differenza = ultimo && riferimento && ultimo !== riferimento ? ultimo[campoAttivo]! - riferimento[campoAttivo]! : undefined

  return (
    <>
      <Testata
        grande
        titolo="Corpo"
        azioni={
          vista === 'foto' ? (
            <label className="btn tenue piccolo">
              <Camera size={16} /> Foto
              <input type="file" accept="image/*" hidden onChange={(e) => aggiungiFoto(e.target.files?.[0]).then(() => (e.target.value = ''))} />
            </label>
          ) : (
            <button className="btn tenue piccolo" onClick={nuovaMisura}>
              <Plus size={16} /> Misura
            </button>
          )
        }
      />
      <div className="pagina">
        <Segmentato
          opzioni={[
            { valore: 'peso', etichetta: 'Peso' },
            { valore: 'misure', etichetta: 'Misure' },
            { valore: 'foto', etichetta: 'Foto' },
          ]}
          valore={vista}
          cambia={setVista}
        />

        {vista === 'misure' && (
          <div className="chips">
            {CAMPI.filter((c) => c.chiave !== 'peso').map((c) => (
              <button key={c.chiave} className={`chip${campo === c.chiave ? ' attivo' : ''}`} onClick={() => setCampo(c.chiave)}>
                {c.etichetta}
              </button>
            ))}
          </div>
        )}

        {vista !== 'foto' &&
          (valori.length ? (
            <>
              <div className="metriche">
                <div className="metrica">
                  <div className="etichetta">Ultima · {dataBreve(ultimo.data)}</div>
                  <div className="valore">
                    {numero(ultimo[campoAttivo], 1)} <small>{info.unita}</small>
                  </div>
                </div>
                {differenza !== undefined && (
                  <div className="metrica">
                    <div className="etichetta">Dal {dataBreve(riferimento.data)}</div>
                    <div className="valore">
                      {differenza > 0 ? '+' : ''}
                      {numero(differenza, 1)} <small>{info.unita}</small>
                    </div>
                  </div>
                )}
              </div>
              <div className="card">
                <GraficoLinea punti={punti} formatoY={(v) => `${numero(v, 1)} ${info.unita}`} formatoX={(x) => new Date(x).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} />
              </div>
              <div className="lista">
                {[...valori].reverse().map((m) => (
                  <button key={m.id} className="voce" onClick={() => setBozza(m)}>
                    <div className="corpo">
                      <div className="titolo" style={{ fontWeight: 500 }}>
                        {dataBreve(m.data)}
                      </div>
                      {m.note && <div className="sotto">{m.note}</div>}
                    </div>
                    <strong>
                      {numero(m[campoAttivo], 1)} {info.unita}
                    </strong>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Vuoto
              icona={vista === 'peso' ? <Scale size={40} /> : <Ruler size={40} />}
              titolo={vista === 'peso' ? 'Registra il tuo peso' : `Nessuna misura: ${info.etichetta.toLowerCase()}`}
              testo="Pesati sempre nelle stesse condizioni, per esempio la mattina a digiuno."
              azione={
                <button className="btn primario" onClick={nuovaMisura}>
                  Aggiungi misura
                </button>
              }
            />
          ))}

        {vista === 'foto' &&
          (foto.length ? (
            <div className="foto-griglia">
              {foto.map((f) => (
                <MiniaturaFoto key={f.id} foto={f} apri={() => setFotoAperta(f)} />
              ))}
            </div>
          ) : (
            <Vuoto
              icona={<ImagePlus size={40} />}
              titolo="Foto dei progressi"
              testo="Restano solo sul telefono. Scattale con la stessa luce e la stessa posa per confrontarle."
              azione={
                <label className="btn primario">
                  <Camera size={18} /> Aggiungi foto
                  <input type="file" accept="image/*" hidden onChange={(e) => aggiungiFoto(e.target.files?.[0]).then(() => (e.target.value = ''))} />
                </label>
              }
            />
          ))}
      </div>

      <Foglio aperto={!!bozza} chiudi={() => setBozza(null)} titolo="Misurazione">
        {bozza && (
          <div className="colonna">
            <label className="campo">
              <span>Data</span>
              <input type="date" value={bozza.data} max={chiaveGiorno()} onChange={(e) => e.target.value && setBozza({ ...bozza, data: e.target.value })} />
            </label>
            <div className="griglia-2">
              {CAMPI.map((c) => (
                <label key={c.chiave} className="campo">
                  <span>
                    {c.etichetta} ({c.unita})
                  </span>
                  <CampoNumero className="input" valore={bozza[c.chiave]} cambia={(v) => setBozza({ ...bozza, [c.chiave]: v })} />
                </label>
              ))}
            </div>
            <label className="campo">
              <span>Note</span>
              <input value={bozza.note ?? ''} onChange={(e) => setBozza({ ...bozza, note: e.target.value || undefined })} />
            </label>
            <div className="griglia-2">
              {misure.some((m) => m.id === bozza.id) ? (
                <button
                  className="btn pericolo"
                  onClick={async () => {
                    if (!confirm('Eliminare questa misurazione?')) return
                    await db.misure.delete(bozza.id)
                    setBozza(null)
                  }}
                >
                  <Trash2 size={18} /> Elimina
                </button>
              ) : (
                <button className="btn" onClick={() => setBozza(null)}>
                  Annulla
                </button>
              )}
              <button className="btn primario" onClick={salva}>
                Salva
              </button>
            </div>
          </div>
        )}
      </Foglio>

      <Foglio aperto={!!fotoAperta} chiudi={() => setFotoAperta(null)} titolo={fotoAperta ? dataBreve(fotoAperta.data) : ''}>
        {fotoAperta && (
          <div className="colonna">
            <FotoGrande foto={fotoAperta} />
            <button
              className="btn pericolo"
              onClick={async () => {
                if (!confirm('Eliminare questa foto?')) return
                await db.foto.delete(fotoAperta.id)
                setFotoAperta(null)
              }}
            >
              <Trash2 size={18} /> Elimina foto
            </button>
          </div>
        )}
      </Foglio>
    </>
  )
}
