import { db, type FotoProgresso } from '../db'
import { chiaveGiorno } from './formato'
import { aggiornaImpostazioni, impostazioni, sostituisciImpostazioni } from './impostazioni'

interface FotoEsportata extends Omit<FotoProgresso, 'immagine'> {
  immagine: string
}

interface FileBackup {
  app: 'palestra'
  versione: 1
  esportatoIl: number
  impostazioni: ReturnType<typeof impostazioni>
  esercizi: unknown[]
  schede: unknown[]
  sessioni: unknown[]
  misure: unknown[]
  foto: FotoEsportata[]
}

function blobInDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, ko) => {
    const r = new FileReader()
    r.onload = () => ok(r.result as string)
    r.onerror = () => ko(r.error)
    r.readAsDataURL(b)
  })
}

async function dataUrlInBlob(u: string): Promise<Blob> {
  return (await fetch(u)).blob()
}

export async function creaBackup(includiFoto: boolean): Promise<File> {
  const [esercizi, schede, sessioni, misure, foto] = await Promise.all([
    db.esercizi.toArray(),
    db.schede.toArray(),
    db.sessioni.toArray(),
    db.misure.toArray(),
    includiFoto ? db.foto.toArray() : Promise.resolve([] as FotoProgresso[]),
  ])
  const dati: FileBackup = {
    app: 'palestra',
    versione: 1,
    esportatoIl: Date.now(),
    impostazioni: impostazioni(),
    esercizi,
    schede,
    sessioni,
    misure,
    foto: await Promise.all(foto.map(async (f) => ({ ...f, immagine: await blobInDataUrl(f.immagine) }))),
  }
  const nome = `palestra-backup-${chiaveGiorno()}.json`
  return new File([JSON.stringify(dati)], nome, { type: 'application/json' })
}

/** Su iPhone apre il menu Condividi (Salva su File, iCloud, AirDrop…); altrove scarica il file */
export async function condividiBackup(includiFoto: boolean): Promise<'condiviso' | 'scaricato' | 'annullato'> {
  const file = await creaBackup(includiFoto)
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Backup palestra' })
      aggiornaImpostazioni({ ultimoBackup: Date.now() })
      return 'condiviso'
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'annullato'
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  aggiornaImpostazioni({ ultimoBackup: Date.now() })
  return 'scaricato'
}

export async function ripristinaBackup(file: File): Promise<void> {
  const dati = JSON.parse(await file.text()) as FileBackup
  if (dati?.app !== 'palestra' || !Array.isArray(dati.sessioni)) {
    throw new Error('Questo file non è un backup dell’app')
  }
  const foto = await Promise.all((dati.foto ?? []).map(async (f) => ({ ...f, immagine: await dataUrlInBlob(f.immagine) })))
  await db.transaction('rw', [db.esercizi, db.schede, db.sessioni, db.misure, db.foto], async () => {
    await Promise.all([db.esercizi.clear(), db.schede.clear(), db.sessioni.clear(), db.misure.clear(), db.foto.clear()])
    await db.esercizi.bulkAdd(dati.esercizi as never[])
    await db.schede.bulkAdd(dati.schede as never[])
    await db.sessioni.bulkAdd(dati.sessioni as never[])
    await db.misure.bulkAdd(dati.misure as never[])
    await db.foto.bulkAdd(foto)
  })
  if (dati.impostazioni) sostituisciImpostazioni(dati.impostazioni)
}

export async function cancellaTutto() {
  await Promise.all([db.esercizi.clear(), db.schede.clear(), db.sessioni.clear(), db.misure.clear(), db.foto.clear()])
}

/** Chiede al browser di non cancellare mai i dati per liberare spazio */
export async function richiediMemoriaPersistente(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
