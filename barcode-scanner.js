/* ===== SCANNER BARCODE QUAGGAJS ===== */

let quaggaInitialized = false;
let lastScannedCode = null;
let scanCooldown = false;
let manualInputMode = false;

// ===== AVVIO SCANNER =====
function startScanner() {
  // Nascondi input manuale se visibile
  hideManualInput();

  if (quaggaInitialized) {
    Quagga.start();
    return;
  }

  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector('#camera-video'),
      constraints: {
        width: { min: 640 },
        height: { min: 480 },
        facingMode: "environment",
        aspectRatio: { min: 1, max: 2 }
      }
    },
    locator: {
      patchSize: "medium",
      halfSample: true
    },
    numOfWorkers: navigator.hardwareConcurrency || 4,
    decoder: {
      readers: [
        "ean_reader",
        "ean_8_reader",
        "code_128_reader",
        "upc_reader",
        "upc_e_reader"
      ],
      multiple: false
    },
    locate: true
  }, function(err) {
    if (err) {
      console.error("[Scanner] Errore init:", err);
      showToast("Errore fotocamera: " + err.name);
      // Se la camera fallisce, mostra subito input manuale
      showManualInput();
      return;
    }
    quaggaInitialized = true;
    Quagga.start();
    console.log("[Scanner] Inizializzato");
  });

  // ===== RILEVAZIONE BARCODE =====
  Quagga.onDetected(function(result) {
    // Debounce: evita scansioni multiple
    if (scanCooldown) return;

    const code = result.codeResult.code;

    // Validazione: EAN deve essere 8, 12 o 13 cifre
    if (!code || !/^\d{8,13}$/.test(code)) return;

    // Evita scansione doppia dello stesso codice
    if (code === lastScannedCode) return;
    lastScannedCode = code;
    scanCooldown = true;

    console.log("[Scanner] Barcode rilevato:", code);

    // STOP IMMEDIATO per evitare loop
    Quagga.stop();
    Quagga.offDetected();

    // Feedback visivo
    showToast("\u2705 Barcode: " + code);

    // Cerca il prodotto
    lookupBarcode(code);

    // Reset cooldown dopo 3 secondi
    setTimeout(function() {
      scanCooldown = false;
      lastScannedCode = null;
    }, 3000);
  });
}

// ===== STOP SCANNER =====
function stopScanner() {
  if (quaggaInitialized) {
    Quagga.stop();
    Quagga.offDetected();
  }
  hideManualInput();
}

// ===== SCANSIONE MANUALE (tasto cerchio bianco) =====
function captureBarcode() {
  if (scanCooldown) {
    showToast("Attendi... scansione in corso");
    return;
  }
  // Se Quagga è attivo, forza una "scansione" del frame corrente
  // Altrimenti mostra input manuale
  showManualInput();
}

// ===== INPUT MANUALE EAN =====
function showManualInput() {
  manualInputMode = true;
  let overlay = document.getElementById('manual-barcode-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'manual-barcode-overlay';
    overlay.className = 'manual-barcode';
    overlay.innerHTML = `
      <div style="font-size:18px;font-weight:700;color:white;margin-bottom:12px;">Inserisci codice EAN</div>
      <input type="text" id="manual-ean-input" placeholder="1234567890123" maxlength="13" inputmode="numeric" pattern="[0-9]*">
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
        <button onclick="submitManualEAN()" style="padding:10px 20px;border-radius:8px;background:var(--primary);color:white;border:none;font-weight:700;cursor:pointer;">Cerca</button>
        <button onclick="hideManualInput()" style="padding:10px 20px;border-radius:8px;background:rgba(255,255,255,0.2);color:white;border:none;font-weight:700;cursor:pointer;">Annulla</button>
      </div>
    `;
    document.querySelector('.scanner-container').appendChild(overlay);

    // Focus automatico
    setTimeout(function() {
      const input = document.getElementById('manual-ean-input');
      if (input) input.focus();
    }, 100);

    // Enter per inviare
    document.getElementById('manual-ean-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submitManualEAN();
    });
  }
  overlay.style.display = 'block';

  // Ferma la camera mentre l'utente digita
  if (quaggaInitialized) Quagga.pause();
}

function hideManualInput() {
  manualInputMode = false;
  const overlay = document.getElementById('manual-barcode-overlay');
  if (overlay) overlay.style.display = 'none';
  // Riprendi camera
  if (quaggaInitialized) Quagga.start();
}

function submitManualEAN() {
  const input = document.getElementById('manual-ean-input');
  const code = input.value.trim();

  if (!code || !/^\d{8,13}$/.test(code)) {
    showToast("\u26a0\ufe0f Inserisci un codice EAN valido (8-13 cifre)");
    input.style.borderColor = '#E85D5D';
    setTimeout(function() { input.style.borderColor = ''; }, 1000);
    return;
  }

  hideManualInput();
  showToast("\u2705 EAN: " + code);
  lookupBarcode(code);
}

// ===== RICERCA PRODOTTO (stub - integra con openfoodfacts.js) =====
function lookupBarcode(code) {
  // Mostra loading
  const apiLoading = document.getElementById('api-loading');
  if (apiLoading) apiLoading.style.display = 'block';

  // Se esiste la funzione fetchProductFromAPI in openfoodfacts.js, la usa
  if (typeof fetchProductFromAPI === 'function') {
    fetchProductFromAPI(code).then(function(product) {
      if (apiLoading) apiLoading.style.display = 'none';
      if (product) {
        showScanResult(product);
      } else {
        showScanResult({ name: 'Prodotto sconosciuto', ean: code, image: null });
      }
    }).catch(function(err) {
      if (apiLoading) apiLoading.style.display = 'none';
      showScanResult({ name: 'Prodotto sconosciuto', ean: code, image: null });
    });
  } else {
    // Fallback se openfoodfacts.js non è caricato
    setTimeout(function() {
      if (apiLoading) apiLoading.style.display = 'none';
      showScanResult({ name: 'Prodotto sconosciuto', ean: code, image: null });
    }, 500);
  }
}

// ===== MOSTRA RISULTATO SCAN =====
function showScanResult(product) {
  const resultModal = document.getElementById('scan-result');
  const titleEl = document.getElementById('result-title');
  const subEl = document.getElementById('result-sub');
  const imgEl = document.getElementById('result-img');
  const nameInput = document.getElementById('product-name-input');

  if (titleEl) titleEl.textContent = product.name || 'Prodotto';
  if (subEl) subEl.textContent = 'EAN: ' + (product.ean || '---');
  if (nameInput) nameInput.value = product.name || '';

  if (imgEl) {
    if (product.image) {
      imgEl.innerHTML = '<img src="' + product.image + '" style="width:100%;height:100%;object-fit:cover;">';
    } else {
      imgEl.innerHTML = '<span class="placeholder-text">&#129371;</span>';
    }
  }

  if (resultModal) resultModal.classList.add('show');
}

// ===== TORCIA =====
let torchOn = false;
function toggleTorch() {
  torchOn = !torchOn;
  const track = Quagga.CameraAccess.getActiveTrack();
  if (track && typeof track.applyConstraints === 'function') {
    track.applyConstraints({
      advanced: [{ torch: torchOn }]
    }).then(function() {
      showToast(torchOn ? "\ud83d\udd0d Torcia accesa" : "\ud83d\udd0d Torcia spenta");
    }).catch(function() {
      showToast("Torcia non supportata");
    });
  }
}

// ===== TOAST =====
function showToast(message) {
  // Se esiste la funzione globale showToast in app.js, usa quella
  if (typeof window.showToast === 'function' && window.showToast !== showToast) {
    window.showToast(message);
    return;
  }

  let toast = document.getElementById('scanner-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'scanner-toast';
    toast.style.cssText = 'position:fixed;top:20%;left:50%;transform:translate(-50%,-50%) scale(0.9);opacity:0;background:rgba(30,40,35,0.94);color:white;padding:14px 20px;border-radius:20px;font-size:14px;font-weight:600;z-index:300;transition:all 0.3s;backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.12);pointer-events:none;white-space:nowrap;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translate(-50%,-50%) scale(1)';

  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%,-50%) scale(0.9)';
  }, 2500);
}
