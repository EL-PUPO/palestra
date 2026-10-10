# Palestra

Diario di allenamento: una web app da installare sull'iPhone (PWA) che funziona anche offline.
Può usarla chiunque dallo stesso link: ognuno ha i suoi dati, che restano solo sul suo telefono (niente account).

## Cosa fa

- **Schede**: incolli il testo della scheda (anche copiato da una foto con *Testo live* dell'iPhone, da un PDF o da una tabella) e l'app la divide da sola in giorni (Giorno 1, 2, 3…) ed esercizi, assegnando il gruppo muscolare. Prima di salvare puoi correggere tutto, unire o dividere i giorni.
- **Libreria di esercizi**: oltre 240 esercizi divisi per gruppo muscolare (petto, dorso, spalle, bicipiti, tricipiti, avambracci, quadricipiti, femorali, glutei, polpacci, addome, cardio, total body, mobilità), con ricerca.
- **Due modalità**:
  - **Allenati** (guidata): un esercizio alla volta, timer di recupero automatico con «cosa viene dopo», passaggio automatico all'esercizio successivo, suggerimenti di carico, riscaldamento, calcolatore dischi, sostituzione esercizio (macchina occupata), schermo sempre acceso, musica.
  - **Registra**: tutti gli esercizi in una pagina, senza timer, per segnare i risultati mentre ti alleni o dopo (con giorno, ora e durata).
- **Serie con − 0 +**: «0» = ripetizioni come da scheda; ogni + è una ripetizione in più, ogni − una in meno. I carichi dell'ultima volta sono già compilati.
- **Massimale**: una serie da 1 colpo diventa da sola un massimale (MAX, fino a 3 colpi); nella scheda basta scrivere «massimale», «1RM» o «max 3 colpi». Il massimale reale compare tra i record.
- **Recupero unico** per tutto l'allenamento (tasto «Recupero»), con ±15 secondi sulla barra durante il recupero; cronometro nascondibile; data, ora e durata degli allenamenti modificabili.
- **Musica**, due fonti: **YouTube** (le tue playlist in un lettore dentro l'app, con comandi propri) e **I miei brani** (MP3 importati dall'app File: senza pubblicità e senza internet, continuano cambiando pagina, comandi anche nella schermata di blocco). I brani non entrano nel backup.
- **Suggerimenti di carico**: se chiudi tutte le serie (e, se c'è un intervallo come 8-10, arrivi al massimo) l'app ti propone di aumentare il carico.
- **Cardio** a tempo e/o distanza, esercizi **a tempo** (plank), **piramidali** (10/8/6), superserie.
- **Storico** con calendario, **progressi** con grafici e record, **corpo** (peso, misure, foto).
- **Impostazioni**: tema chiaro/scuro/automatico, colore, dimensione del testo, recupero predefinito, aumento dei carichi, bilanciere e dischi, backup.

## Comandi

```bash
npm install          # la prima volta
npm run dev          # avvia l'app su http://localhost:5173
npm test             # test automatici
npm run icons        # rigenera le icone da public/icona.svg (le altre proposte di logo sono in design/)
npm run build        # versione da pubblicare (cartella dist)
```

## Provarla sull'iPhone

**Di passaggio, sulla stessa rete Wi-Fi:** `npm run dev:telefono` e apri sull'iPhone l'indirizzo «Network» che compare (es. `http://192.168.1.20:5173`).
Su questo indirizzo non si può installare né usare offline: serve solo per provarla.

**Per usarla davvero** va pubblicata su un indirizzo HTTPS. Con GitHub Pages è gratis:

1. Crea un account su github.com e un repository nuovo (es. `palestra`).
2. Carica questo progetto sul ramo `main`.
3. Nel repository: *Settings → Pages → Source: GitHub Actions*.
4. A ogni aggiornamento il workflow `.github/workflows/pubblica.yml` esegue i test e pubblica l'app su `https://<utente>.github.io/palestra/`.
5. Sull'iPhone apri l'indirizzo con Safari, tocca **Condividi → Aggiungi alla schermata Home**.

L'indirizzo è pubblico, ma i dati non passano da nessun server: restano sul telefono.

## Dati e backup

I dati sono salvati nel telefono (IndexedDB). Fai ogni tanto **Impostazioni → Esporta backup** e salva il file su File o iCloud Drive.
Se cambi telefono, o se cancelli l'app dalla schermata Home, lo ripristini da **Impostazioni → Ripristina da backup**.

## Struttura

```
src/
  db.ts                 modello dei dati (esercizi, schede, sessioni, misure, foto)
  lib/leggiScheda.ts    lettore automatico delle schede scritte a testo
  lib/catalogo.ts       libreria di esercizi per gruppo muscolare
  lib/statistiche.ts    record, grafici, settimane di fila, suggerimenti di carico
  lib/allenamento.ts    avvio/chiusura allenamenti, salvataggio schede
  lib/timer.ts          timer di recupero con suono
  lib/backup.ts         esporta / ripristina
  lib/impostazioni.ts   impostazioni e tema
  pagine/               le schermate
  componenti/           pezzi riutilizzabili (grafico, calendario, dischi…)
```
