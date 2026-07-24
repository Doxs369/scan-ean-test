/**
 * Barcode Scanner Module - ZXing + QuaggaJS fallback
 * Scansiona barcode EAN-13 in tempo reale dalla fotocamera
 */

var BarcodeScanner = (function() {
  'use strict';

  var videoElement = null;
  var canvasElement = null;
  var canvasContext = null;
  var scanInterval = null;
  var isScanning = false;
  var lastScanTime = 0;
  var scanCooldown = 2000; // ms tra una scansione e l'altra
  var onBarcodeDetected = null;
  var zxingLoaded = false;
  var quaggaLoaded = false;

  // ZXing reader
  var codeReader = null;

  /**
   * Inizializza lo scanner
   */
  function init(videoId, canvasId, onDetected) {
    videoElement = document.getElementById(videoId);
    canvasElement = document.getElementById(canvasId);
    if (canvasElement) {
      canvasContext = canvasElement.getContext('2d');
    }
    onBarcodeDetected = onDetected;

    // Prova a caricare ZXing
    loadZXing().then(function() {
      console.log('ZXing caricato con successo');
    }).catch(function() {
      console.log('ZXing non disponibile, usero QuaggaJS');
      loadQuagga();
    });
  }

  /**
   * Carica ZXing dalla CDN
   */
  function loadZXing() {
    return new Promise(function(resolve, reject) {
      if (typeof ZXing !== 'undefined') {
        zxingLoaded = true;
        codeReader = new ZXing.BrowserMultiFormatReader();
        resolve();
        return;
      }

      var script = document.createElement('script');
      script.src = 'https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js';
      script.onload = function() {
        zxingLoaded = true;
        codeReader = new ZXing.BrowserMultiFormatReader();
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Carica QuaggaJS dalla CDN (fallback)
   */
  function loadQuagga() {
    return new Promise(function(resolve, reject) {
      if (typeof Quagga !== 'undefined') {
        quaggaLoaded = true;
        resolve();
        return;
      }

      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js';
      script.onload = function() {
        quaggaLoaded = true;
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Avvia la scansione continua
   */
  function startScanning() {
    if (isScanning) return;
    isScanning = true;

    if (zxingLoaded && codeReader) {
      startZXingScan();
    } else if (quaggaLoaded) {
      startQuaggaScan();
    } else {
      // Fallback: scansione manuale con frame capture
      startManualScan();
    }
  }

  /**
   * Ferma la scansione
   */
  function stopScanning() {
    isScanning = false;

    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }

    if (codeReader) {
      codeReader.reset();
    }

    if (quaggaLoaded && typeof Quagga !== 'undefined') {
      Quagga.stop();
    }
  }

  /**
   * Scansione con ZXing (piu affidabile)
   */
  function startZXingScan() {
    if (!videoElement || !codeReader) return;

    // ZXing ha un metodo diretto per scansionare dal video
    codeReader.decodeFromVideoDevice(undefined, videoElement.id, function(result, error) {
      if (!isScanning) return;

      if (result && result.getText()) {
        var barcode = result.getText();
        var now = Date.now();
        if (now - lastScanTime > scanCooldown) {
          lastScanTime = now;
          if (onBarcodeDetected) {
            onBarcodeDetected(barcode);
          }
        }
      }
    });
  }

  /**
   * Scansione con QuaggaJS (fallback)
   */
  function startQuaggaScan() {
    if (!videoElement) return;

    Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: videoElement,
        constraints: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        }
      },
      locator: {
        patchSize: 'medium',
        halfSample: true
      },
      numOfWorkers: 2,
      frequency: 10,
      decoder: {
        readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader']
      },
      locate: true
    }, function(err) {
      if (err) {
        console.error('Errore Quagga:', err);
        startManualScan();
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected(function(result) {
      if (!isScanning) return;

      var code = result.codeResult.code;
      var now = Date.now();
      if (now - lastScanTime > scanCooldown) {
        lastScanTime = now;
        if (onBarcodeDetected) {
          onBarcodeDetected(code);
        }
      }
    });
  }

  /**
   * Scansione manuale (capture frame + analisi)
   * Usato quando nessuna libreria e disponibile
   */
  function startManualScan() {
    if (!videoElement || !canvasElement || !canvasContext) return;

    scanInterval = setInterval(function() {
      if (!isScanning || !videoElement.videoWidth) return;

      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;
      canvasContext.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

      // Estrai pixel data e cerca pattern barcode (semplificato)
      // Per ora usiamo un approccio: se l'utente preme il pulsante, catturiamo
    }, 500);
  }

  /**
   * Scansiona un singolo frame (per pulsante manuale)
   */
  function scanSingleFrame() {
    if (!videoElement || !canvasElement || !canvasContext) return null;

    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;
    canvasContext.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    // Prova ZXing sul frame
    if (zxingLoaded && codeReader) {
      var imageData = canvasContext.getImageData(0, 0, canvasElement.width, canvasElement.height);
      // ZXing non supporta direttamente ImageData in questa versione
      // Usiamo il canvas come source
      return canvasElement.toDataURL('image/png');
    }

    return null;
  }

  /**
   * Verifica se un codice e valido EAN-13
   */
  function isValidEAN13(code) {
    if (!code || code.length !== 13) return false;
    if (!/^\d{13}$/.test(code)) return false;

    // Calcola checksum EAN-13
    var sum = 0;
    for (var i = 0; i < 12; i++) {
      var digit = parseInt(code.charAt(i));
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    var checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(code.charAt(12));
  }

  /**
   * Verifica se un codice e valido EAN-8
   */
  function isValidEAN8(code) {
    if (!code || code.length !== 8) return false;
    if (!/^\d{8}$/.test(code)) return false;

    var sum = 0;
    for (var i = 0; i < 7; i++) {
      var digit = parseInt(code.charAt(i));
      sum += (i % 2 === 0) ? digit * 3 : digit;
    }
    var checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(code.charAt(7));
  }

  /**
   * Valida un barcode (EAN-13 o EAN-8)
   */
  function validateBarcode(code) {
    return isValidEAN13(code) || isValidEAN8(code);
  }

  /**
   * Cattura un frame dalla camera come DataURL per OCR
   */
  function captureFrameForOCR() {
    if (!videoElement || !videoElement.videoWidth) return null;

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    // Riduci risoluzione per velocita OCR
    var scale = 0.5;
    canvas.width = videoElement.videoWidth * scale;
    canvas.height = videoElement.videoHeight * scale;
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.8);
  }

  /**
   * Verifica se la scansione e attiva
   */
  function isScanningActive() {
    return isScanning;
  }

  // API pubblica
  return {
    init: init,
    start: startScanning,
    stop: stopScanning,
    scanFrame: scanSingleFrame,
    validate: validateBarcode,
    isValidEAN13: isValidEAN13,
    isValidEAN8: isValidEAN8,
    isReady: function() { return zxingLoaded || quaggaLoaded; },
    captureFrameForOCR: captureFrameForOCR,
    isScanningActive: isScanningActive
  };
})();
