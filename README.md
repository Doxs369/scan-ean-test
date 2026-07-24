# ScanEan PWA

App per scansionare prodotti e tenere sotto controllo le scadenze.

## Requisiti Server

- **HTTPS obbligatorio** per Service Worker e installazione PWA
- Supporto a file statici (HTML, CSS, JS, PNG)
- Modulo `mod_rewrite` abilitato (per Apache) o equivalente

## Installazione

1. Carica **tutti i file** nella root del tuo dominio (es. `https://tuo-dominio.com/`)
   o in una sottocartella (es. `https://tuo-dominio.com/scanean/`)

2. Assicurati che il sito sia servito su **HTTPS** (obbligatorio per PWA)

3. Se usi Apache, il file `.htaccess` gestisce automaticamente:
   - SPA fallback (tutte le route vanno a index.html)
   - Header di cache per asset statici
   - Compressione GZIP

4. Se usi Nginx, aggiungi questo nel server block:
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }

   # Cache asset statici
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

5. Se usi Vercel/Netlify, il file `vercel.json` o `_redirects` e incluso.

## File Struttura

```
/
├── index.html          # Entry point SPA
├── manifest.json       # Manifest PWA
├── sw.js               # Service Worker (offline)
├── style.css           # Stili app
├── app.js              # Logica principale
├── storage.js          # Persistenza dati
├── openfoodfacts.js    # API Open Food Facts
├── recipes-api.js      # API ricette TheMealDB
├── camera.js           # Gestione fotocamera
├── barcode-scanner.js  # Scanner barcode
├── .htaccess           # Config Apache
├── favicon.ico         # Favicon
├── favicon-16x16.png
├── favicon-32x32.png
└── icons/
    ├── icon-72x72.png
    ├── icon-96x96.png
    ├── icon-128x128.png
    ├── icon-144x144.png
    ├── icon-152x152.png
    ├── icon-192x192.png
    ├── icon-384x384.png
    ├── icon-512x512.png
    ├── shortcut-scan.png
    └── shortcut-list.png
```

## Test PWA

1. Apri Chrome DevTools > Application > Manifest
2. Verifica che il manifest venga caricato correttamente
3. Vai su "Service Workers" e controlla che sia attivo
4. Usa "Lighthouse" per audit PWA completo

## Problemi Comuni

### Schermo bianco / 404
- Verifica che **tutti i file** siano caricati sul server
- Controlla che i percorsi siano corretti (relativi, non assoluti)
- Assicurati che il server serva index.html per route SPA

### Install prompt non appare
- Devi usare **HTTPS** (localhost e OK in sviluppo)
- Il Service Worker deve essere registrato correttamente
- Controlla Console per errori

### Cache non si aggiorna
- Incrementa la versione in `sw.js` (riga `CACHE_NAME`)
- Oppure usa "Clear site data" in DevTools > Application
