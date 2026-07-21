# ScanEan - Aggiornamento TheMealDB

## Cosa cambia

### Prima (Gemini API)
- ❌ Richiedeva API Key personale
- ❌ Chiamate POST complesse con JSON
- ❌ Ricette generate da AI (non sempre realistiche)
- ❌ Salvate per prodotto singolo

### Ora (TheMealDB)
- ✅ API pubblica gratuita, **nessuna chiave**
- ✅ Chiamate GET semplicissime
- ✅ Ricette reali dal database mondiale
- ✅ Salvate per giornata (auto-cleanup)

---

## Flusso Ricette

```
1. Ogni giorno l'app controlla prodotti con scadenza = OGGI
2. Per il primo prodotto scadente → chiama TheMealDB
   URL: https://www.themealdb.com/api/json/v1/1/filter.php?i=tomato
3. Riceve JSON con ricette, le salva in localStorage
   Chiave: scanEan_recipes_YYYYMMDD
4. Se domani non ci sono prodotti scaduti → ricette vecchie cancellate
5. Prodotto non consumato + scaduto → spostato in lista spesa
```

---

## Chiamate API

| Endpoint | Uso | Esempio |
|----------|-----|---------|
| `/filter.php?i=X` | Cerca per ingrediente | `?i=chicken` |
| `/lookup.php?i=ID` | Dettaglio ricetta | `?i=52772` |

---

## Pulizia Automatica Giornaliera

Ogni volta che apri l'app:

1. **Prodotti scaduti** (`expiryDate < oggi`)
   - Spostati in lista spesa con motivo "Scaduto"
   - Rimossi dalla dispensa
   - Ricette associate cancellate

2. **Ricette vecchie**
   - Tutte le chiavi `scanEan_recipes_*` di ieri cancellate

3. **Ricette orfane**
   - Ricette di prodotti eliminati pulite

---

## File Modificati

| File | Modifica |
|------|----------|
| `recipes-api.js` | **NUOVO** - Modulo TheMealDB |
| `app.js` | Logica ricette, cleanup giornaliero, compressione foto |
| `index.html` | Sezione ricette dinamica, stili thumb |

---

## Compressione Foto

Le foto scattate manualmente ora vengono:
- Ridimensionate a max 400px larghezza
- Comprese in JPEG con qualità adattiva
- Limitate a ~500KB per non esaurire localStorage

Le foto da Open Food Facts restano URL esterni (non occupano spazio).

---

## Installazione

1. Sostituisci i file nella cartella dell'app
2. Ricarica la pagina
3. Elimina `gemini-api.js` (non più necessario)
4. Fatto! Nessuna configurazione API richiesta.
