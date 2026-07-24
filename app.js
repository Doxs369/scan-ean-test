/**
 * ScanEan - App principale
 * Gestisce UI, navigazione, lista prodotti e lista spesa
 */

(function() {
  'use strict';

  // ===== STATO =====
  var products = [];
  var shoppingList = [];
  var settings = Storage.loadSettings();
  var nextId = 1;
  var currentFilter = 'all';
  var currentSort = 'expiry';
  var currentBarcode = null;
  var currentImageUrl = null;
  var cameraPhotoData = null;
  var scannedProductData = null;
  var selectedProductId = null;
  var isScanning = false;
  var searchQuery = '';

  // ===== INIZIALIZZAZIONE =====
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    loadData();
    renderProducts();
    renderShoppingList();
    updateStats();
    setupEventListeners();
    populateCategorySelect();
    setupCategorySelectListener();

    // Splash screen
    setTimeout(function() {
      document.getElementById('splash').classList.add('hidden');
    }, 1800);

    // Carica ricette del giorno
    loadDailyRecipesFromAPI();

    // Cleanup ricette orfane
    setTimeout(function() {
      cleanupOrphanRecipes();
    }, 3000);
  }

  function loadData() {
    var saved = Storage.loadProducts();
    if (saved) {
      products = saved;
      var maxId = 0;
      for (var i = 0; i < products.length; i++) {
        if (products[i].id > maxId) maxId = products[i].id;
      }
      nextId = maxId + 1;
    }

    var savedList = Storage.loadShoppingList();
    if (savedList) {
      shoppingList = savedList;
    }
  }

  function saveData() {
    Storage.saveProducts(products);
    Storage.saveShoppingList(shoppingList);
  }

  // ===== POPOLA SELECT CATEGORIE =====
  function populateCategorySelect() {
    var select = document.getElementById('category-select');
    if (!select) return;
    var categories = OpenFoodFacts.getAllCategories();
    var html = '';
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      html += '<option value="' + cat.id + '">' + cat.emoji + ' ' + cat.name + '</option>';
    }
    html += '<option value="__new__">+ Nuova categoria...</option>';
    select.innerHTML = html;
  }

  function setupCategorySelectListener() {
    var select = document.getElementById('category-select');
    var newGroup = document.getElementById('new-category-group');
    if (!select) return;
    select.addEventListener('change', function() {
      if (select.value === '__new__') {
        if (newGroup) newGroup.style.display = 'block';
      } else {
        if (newGroup) newGroup.style.display = 'none';
      }
    });
  }

  // ===== NAVIGAZIONE =====
  window.navigateTo = function(screen) {
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });

    if (screen === 'pantry') {
      document.getElementById('screen-pantry').classList.add('active');
      document.getElementById('nav-pantry').classList.add('active');
      renderProducts();
      updateStats();
    } else if (screen === 'list') {
      document.getElementById('screen-list').classList.add('active');
      document.getElementById('nav-list').classList.add('active');
      renderShoppingList();
    }
  };

  // ===== RENDER PRODOTTI =====
  function renderProducts() {
    var list = document.getElementById('products-list');
    var filtered = getFilteredProducts();

    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#129371;</div><div class="empty-state-title">Dispensa vuota</div><div class="empty-state-desc">Scansiona un prodotto per iniziare</div></div>';
      return;
    }

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var p = filtered[i];
      var days = getDaysUntilExpiry(p.expiry);
      var badgeClass = days < 0 ? 'danger' : (days <= settings.alertDays ? 'warning' : 'safe');
      var badgeText = days < 0 ? 'Scaduto' : (days === 0 ? 'Oggi' : days + ' gg');
      var imgHtml = p.photo ? '<img src="' + p.photo + '" alt="">' : p.emoji;

      html += '<div class="product-card" onclick="openProductModal(' + p.id + ')">' +
        '<div class="product-img">' + imgHtml + '</div>' +
        '<div class="product-info">' +
          '<div class="product-name">' + escapeHtml(p.name) + '</div>' +
          '<div class="product-meta">' +
            '<span class="expiry-badge ' + badgeClass + '">&#128197; ' + badgeText + '</span>' +
            '<span>' + OpenFoodFacts.getCategoryEmoji(p.category) + ' ' + OpenFoodFacts.getCategoryName(p.category) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="product-qty">' + (p.qty || 1) + '</div>' +
      '</div>';
    }
    list.innerHTML = html;
  }

  function getFilteredProducts() {
    var result = [];
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      if (searchQuery && p.name.toLowerCase().indexOf(searchQuery.toLowerCase()) === -1) continue;
      if (currentFilter === 'all') {
        result.push(p);
      } else if (currentFilter === 'expiring') {
        var days = getDaysUntilExpiry(p.expiry);
        if (days <= settings.alertDays && days >= 0) result.push(p);
      } else if (p.category === currentFilter) {
        result.push(p);
      }
    }
    return sortProducts(result);
  }

  function sortProducts(list) {
    var sorted = list.slice();
    if (currentSort === 'expiry') {
      sorted.sort(function(a, b) {
        var da = a.expiry ? new Date(a.expiry) : new Date('2099-01-01');
        var db = b.expiry ? new Date(b.expiry) : new Date('2099-01-01');
        return da - db;
      });
    } else if (currentSort === 'name') {
      sorted.sort(function(a, b) { return a.name.localeCompare(b.name); });
    } else if (currentSort === 'added') {
      sorted.sort(function(a, b) { return b.id - a.id; });
    } else if (currentSort === 'category') {
      sorted.sort(function(a, b) {
        var ca = a.category || 'zzzz';
        var cb = b.category || 'zzzz';
        if (ca !== cb) return ca.localeCompare(cb);
        var da = a.expiry ? new Date(a.expiry) : new Date('2099-01-01');
        var db = b.expiry ? new Date(b.expiry) : new Date('2099-01-01');
        return da - db;
      });
    }
    return sorted;
  }

  window.filterProducts = function(cat, el) {
    currentFilter = cat;
    document.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('active'); });
    if (el) el.classList.add('active');
    renderProducts();
  };

  window.setSort = function(sortType) {
    currentSort = sortType;
    document.querySelectorAll('.sort-option').forEach(function(s) { s.classList.remove('active'); });
    document.querySelectorAll('.sort-check').forEach(function(c) { c.classList.add('hidden'); });
    document.getElementById('sort-' + sortType).classList.add('active');
    document.getElementById('check-' + sortType).classList.remove('hidden');
    closeSortModalDirect();
    renderProducts();
  };

  // ===== STATS =====
  function updateStats() {
    var total = products.length;
    var warning = 0;
    var expired = 0;
    for (var i = 0; i < products.length; i++) {
      var days = getDaysUntilExpiry(products[i].expiry);
      if (days < 0) expired++;
      else if (days <= settings.alertDays) warning++;
    }
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-warning').textContent = warning;
    document.getElementById('stat-expired').textContent = expired;
  }

  function getDaysUntilExpiry(expiry) {
    if (!expiry) return 999;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var exp = new Date(expiry);
    exp.setHours(0, 0, 0, 0);
    return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
  }

  // ===== SCANNER =====
  window.startScanner = function() {
    navigateTo('scanner-placeholder');
    document.getElementById('screen-scanner').classList.add('active');
    isScanning = true;
    BarcodeScanner.start();
  };

  window.stopScanner = function() {
    isScanning = false;
    BarcodeScanner.stop();
    document.getElementById('screen-scanner').classList.remove('active');
  };

  window.captureBarcode = function() {
    if (BarcodeScanner.isReady()) {
      var frameData = BarcodeScanner.scanFrame();
      if (frameData) {
        showToast('&#128247; Frame catturato, analisi...');
        showToast('&#128270; Scansione in corso...');
      } else {
        showManualBarcodeAndPhotoInput();
      }
    } else {
      showManualBarcodeAndPhotoInput();
    }
  };

  function showManualBarcodeAndPhotoInput() {
    document.getElementById('manual-barcode-overlay').style.display = 'block';
    showToast('&#9888;&#65039; Scanner non pronto, inserisci manualmente');
  }

  window.processManualBarcode = function() {
    var ean = document.getElementById('manual-ean').value.trim();
    if (!ean || ean.length < 8) {
      showToast('&#9888;&#65039; Inserisci un codice valido');
      return;
    }
    document.getElementById('manual-barcode-overlay').style.display = 'none';
    processBarcode(ean);
  };

  window.openCameraForManualProduct = function() {
    document.getElementById('camera-input-manual').click();
  };

  window.handleManualProductPhoto = function(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      cameraPhotoData = e.target.result;
      showProductNotFound();
    };
    reader.readAsDataURL(file);
  };

  // ===== TORCIA =====
  window.toggleTorch = function() {
    Camera.toggleTorch()
      .then(function(on) {
        showToast(on ? '&#128294; Torcia ON' : '&#128294; Torcia OFF');
        setTimeout(function() {
          var toast = document.getElementById('toast');
          if (toast) toast.classList.remove('show');
        }, 1500);
      })
      .catch(function(err) {
        showToast('Torcia non supportata');
      });
  };

  // ===== API OPEN FOOD FACTS =====
  function processBarcode(barcode) {
    currentBarcode = barcode;
    document.getElementById('api-loading').style.display = 'block';

    OpenFoodFacts.search(barcode)
      .then(function(result) {
        document.getElementById('api-loading').style.display = 'none';
        if (result.found) {
          showProductFound(result.product);
        } else {
          showProductNotFound();
        }
      });
  }

  window.processBarcode = processBarcode;

  function showProductFound(product) {
    scannedProductData = product;
    var category = OpenFoodFacts.detectCategory(product);
    scannedProductData.category = category;

    document.getElementById('result-title').textContent = product.name || 'Prodotto trovato';
    document.getElementById('result-sub').textContent = 'EAN: ' + (product.barcode || '---');
    document.getElementById('product-name-input').value = product.name || '';

    var imgEl = document.getElementById('result-img');
    if (product.imageUrl) {
      imgEl.innerHTML = '<img src="' + product.imageUrl + '" alt="">';
      currentImageUrl = product.imageUrl;
    } else {
      imgEl.innerHTML = '<span class="placeholder-text">' + OpenFoodFacts.getCategoryEmoji(category) + '</span>';
      currentImageUrl = null;
    }

    document.getElementById('camera-preview').style.display = 'none';
    document.getElementById('camera-preview').classList.remove('show');
    cameraPhotoData = null;

    // FIX: imposta categoria nel select
    var categorySelect = document.getElementById('category-select');
    if (categorySelect) {
      populateCategorySelect();
      categorySelect.value = category;
    }
    var newGroup = document.getElementById('new-category-group');
    if (newGroup) newGroup.style.display = 'none';

    document.getElementById('scan-result').classList.add('show');
    document.getElementById('btn-camera').style.display = 'block';
  }

  function showProductNotFound() {
    scannedProductData = { name: '', category: 'pantry', barcode: currentBarcode || '' };
    document.getElementById('result-title').textContent = 'Prodotto non trovato';
    document.getElementById('result-sub').textContent = 'EAN: ' + (currentBarcode || '---');
    document.getElementById('product-name-input').value = '';
    document.getElementById('result-img').innerHTML = '<span class="placeholder-text">&#129371;</span>';
    document.getElementById('camera-preview').style.display = 'none';
    document.getElementById('camera-preview').classList.remove('show');
    cameraPhotoData = null;

    // FIX: default pantry
    var categorySelect = document.getElementById('category-select');
    if (categorySelect) {
      populateCategorySelect();
      categorySelect.value = 'pantry';
    }
    var newGroup = document.getElementById('new-category-group');
    if (newGroup) newGroup.style.display = 'none';

    document.getElementById('scan-result').classList.add('show');
    document.getElementById('btn-camera').style.display = 'block';
  }

  // ===== FOTO PRODOTTO =====
  window.openCamera = function() {
    document.getElementById('camera-input').click();
  };

  window.handleCameraPhoto = function(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      cameraPhotoData = e.target.result;
      var preview = document.getElementById('camera-preview');
      preview.src = cameraPhotoData;
      preview.style.display = 'block';
      preview.classList.add('show');
    };
    reader.readAsDataURL(file);
  };

  // ===== AGGIUNGI PRODOTTO =====
  window.addProduct = function() {
    if (!scannedProductData) return;

    var name = document.getElementById('product-name-input').value.trim();
    var expiry = document.getElementById('expiry-input').value;
    var qty = parseInt(document.getElementById('qty-input').value) || 1;
    var categorySelect = document.getElementById('category-select');
    var category = categorySelect ? categorySelect.value : (scannedProductData.category || 'pantry');

    // Gestione nuova categoria
    if (category === '__new__') {
      var newCatInput = document.getElementById('new-category-input');
      var newCatName = newCatInput ? newCatInput.value.trim() : '';
      if (newCatName) {
        var customKey = newCatName.toLowerCase();
        Storage.addCustomCategory(customKey, newCatName, 10);
        OpenFoodFacts.saveCustomCategories(Storage.loadCustomCategories());
        category = newCatName;
        populateCategorySelect();
        if (categorySelect) categorySelect.value = category;
      } else {
        category = 'pantry';
      }
    }

    if (!name) {
      showToast('&#9888;&#65039; Inserisci il nome del prodotto');
      return;
    }

    var newProduct = {
      id: nextId++,
      name: name,
      emoji: scannedProductData.emoji || OpenFoodFacts.getCategoryEmoji(category) || '&#128230;',
      category: category,
      expiry: expiry || null,
      qty: qty,
      barcode: scannedProductData.barcode || currentBarcode || null,
      photo: cameraPhotoData || currentImageUrl || null,
      addedAt: new Date().toISOString()
    };

    products.unshift(newProduct);
    saveData();
    renderProducts();
    updateStats();

    showToast('&#9989; ' + name + ' aggiunto!');
    closeScanResult();

    // Torna alla dispensa
    setTimeout(function() {
      stopScanner();
      navigateTo('pantry');
    }, 500);
  };

  window.closeScanResult = function() {
    stopExpiryScan();
    terminateExpiryOCR();
    document.getElementById('scan-result').classList.remove('show');
    scannedProductData = null;
    currentBarcode = null;
    currentImageUrl = null;
    cameraPhotoData = null;

    var newGroup = document.getElementById('new-category-group');
    if (newGroup) newGroup.style.display = 'none';

    if (isScanning && document.getElementById('screen-scanner').classList.contains('active')) {
      BarcodeScanner.start();
    }
  };

  // ===== SCANSIONE DATA SCADENZA =====
  window.scanExpiryDate = function() {
    var btn = document.getElementById('btn-scan-expiry');
    if (btn) btn.disabled = true;
    setExpiryButtonLoading(true);
    showToast('&#128247; Avvio scansione automatica...');

    var video = document.getElementById('expiry-camera-video');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('&#10060; Fotocamera non supportata');
      setExpiryButtonLoading(false);
      return;
    }

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    })
    .then(function(stream) {
      expiryCameraStream = stream;
      video.srcObject = stream;
      video.style.display = 'block';
      document.getElementById('expiry-camera-overlay').classList.add('active');

      loadTesseractJS().then(function() {
        return initExpiryOCR();
      }).then(function() {
        updateExpiryCameraStatus('Inquadra la data e attendi...');
        setTimeout(function() {
          startAutoCaptureLoop();
        }, 1000);
      }).catch(function(err) {
        console.error('Errore init OCR:', err);
        updateExpiryCameraStatus('Errore OCR. Scatta manualmente.');
        showManualCaptureButton();
        setExpiryButtonLoading(false);
      });
    })
    .catch(function(err) {
      console.error('Errore fotocamera data:', err);
      showToast('&#10060; Errore fotocamera: ' + err.message);
      setExpiryButtonLoading(false);
    });
  };

  // Variabili per scansione data
  var expiryCameraStream = null;
  var expiryTesseractWorker = null;
  var autoCaptureInterval = null;
  var autoCaptureCount = 0;
  var autoCaptureMax = 10;
  var autoCaptureFound = false;
  var detectedExpiryDate = null;
  var detectedExpiryConfidence = 0;
  var expiryCaptureCanvas = null;

  function loadTesseractJS() {
    return new Promise(function(resolve, reject) {
      if (window.Tesseract) { resolve(); return; }
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
      script.onload = function() { resolve(); };
      script.onerror = function() { reject(new Error('Tesseract.js non caricato')); };
      document.head.appendChild(script);
    });
  }

  function initExpiryOCR() {
    return new Promise(function(resolve, reject) {
      if (!window.Tesseract) { reject(new Error('Tesseract non disponibile')); return; }
      if (expiryTesseractWorker) { resolve(); return; }
      try {
        expiryTesseractWorker = window.Tesseract.createWorker('eng+ita');
        expiryTesseractWorker.load().then(function() {
          return expiryTesseractWorker.loadLanguage('eng+ita');
        }).then(function() {
          return expiryTesseractWorker.initialize('eng+ita');
        }).then(function() {
          resolve();
        }).catch(function(err) {
          reject(err);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function startAutoCaptureLoop() {
    autoCaptureCount = 0;
    autoCaptureFound = false;
    if (autoCaptureInterval) clearInterval(autoCaptureInterval);
    autoCaptureInterval = setInterval(function() {
      if (autoCaptureFound) { clearInterval(autoCaptureInterval); return; }
      autoCaptureCount++;
      doAutoCaptureAttempt();
      if (autoCaptureCount >= autoCaptureMax && !autoCaptureFound) {
        clearInterval(autoCaptureInterval);
        updateExpiryCameraStatus('Nessuna data trovata automaticamente');
        showManualCaptureButton();
        setExpiryButtonLoading(false);
      }
    }, 800);
  }

  function doAutoCaptureAttempt() {
    if (autoCaptureFound) return;
    var video = document.getElementById('expiry-camera-video');
    if (!video || video.readyState < 2) return;
    if (!expiryCaptureCanvas) {
      expiryCaptureCanvas = document.createElement('canvas');
    }
    expiryCaptureCanvas.width = video.videoWidth || 640;
    expiryCaptureCanvas.height = video.videoHeight || 480;
    var ctx = expiryCaptureCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    var frameData = expiryCaptureCanvas.toDataURL('image/jpeg', 0.8);
    processExpiryFrame(frameData);
  }

  function processExpiryFrame(frameData) {
    if (!expiryTesseractWorker || autoCaptureFound) return;
    expiryTesseractWorker.recognize(frameData)
      .then(function(result) {
        if (autoCaptureFound) return;
        var text = result.data.text;
        var parsed = parseExpiryDateFromText(text);
        if (parsed && parsed.confidence > 0.5) {
          autoCaptureFound = true;
          clearInterval(autoCaptureInterval);
          detectedExpiryDate = parsed.date;
          detectedExpiryConfidence = Math.round(parsed.confidence * 100);
          showExpiryConfirmModal(frameData, parsed.date, detectedExpiryConfidence);
          setExpiryButtonLoading(false);
        }
      })
      .catch(function(err) {
        console.error('OCR errore:', err);
      });
  }

  function parseExpiryDateFromText(text) {
    if (!text) return null;
    var patterns = [
      /(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/g,
      /(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{2})/g,
      /(\d{4})[\/\.\-](\d{2})[\/\.\-](\d{2})/g
    ];
    var bestMatch = null;
    var bestConf = 0;
    for (var p = 0; p < patterns.length; p++) {
      var matches = text.match(patterns[p]);
      if (matches) {
        for (var m = 0; m < matches.length; m++) {
          var parts = matches[m].split(/[\/\.\-]/);
          var d, conf = 0.7;
          if (parts[2].length === 4) {
            d = parts[2] + '-' + parts[1] + '-' + parts[0];
          } else if (parts[0].length === 4) {
            d = parts[0] + '-' + parts[1] + '-' + parts[2];
          } else {
            var yy = parseInt(parts[2]);
            var year = yy < 50 ? '20' + parts[2] : '19' + parts[2];
            d = year + '-' + parts[1] + '-' + parts[0];
            conf = 0.6;
          }
          var testDate = new Date(d);
          if (!isNaN(testDate.getTime()) && testDate.getFullYear() > 2020 && testDate.getFullYear() < 2040) {
            if (conf > bestConf) {
              bestConf = conf;
              bestMatch = d;
            }
          }
        }
      }
    }
    if (bestMatch) return { date: bestMatch, confidence: bestConf };
    return null;
  }

  function showManualCaptureButton() {
    updateExpiryCameraStatus('Scatta manualmente la foto');
  }

  function updateExpiryCameraStatus(msg) {
    var el = document.getElementById('expiry-camera-status');
    if (el) el.textContent = msg;
  }

  window.manualExpiryCapture = function() {
    var video = document.getElementById('expiry-camera-video');
    if (!video || video.readyState < 2) return;
    if (!expiryCaptureCanvas) {
      expiryCaptureCanvas = document.createElement('canvas');
    }
    expiryCaptureCanvas.width = video.videoWidth || 640;
    expiryCaptureCanvas.height = video.videoHeight || 480;
    var ctx = expiryCaptureCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    var frameData = expiryCaptureCanvas.toDataURL('image/jpeg', 0.9);

    document.getElementById('expiry-ocr-loading').classList.add('active');

    loadTesseractJS().then(function() {
      return initExpiryOCR();
    }).then(function() {
      return expiryTesseractWorker.recognize(frameData);
    }).then(function(result) {
      document.getElementById('expiry-ocr-loading').classList.remove('active');
      var text = result.data.text;
      var parsed = parseExpiryDateFromText(text);
      if (parsed) {
        detectedExpiryDate = parsed.date;
        detectedExpiryConfidence = Math.round(parsed.confidence * 100);
        showExpiryConfirmModal(frameData, parsed.date, detectedExpiryConfidence);
      } else {
        showToast('&#10060; Nessuna data rilevata. Prova a inquadrare meglio.');
      }
      setExpiryButtonLoading(false);
    }).catch(function(err) {
      document.getElementById('expiry-ocr-loading').classList.remove('active');
      console.error('Errore OCR manuale:', err);
      showToast('&#10060; Errore lettura data');
      setExpiryButtonLoading(false);
    });
  };

  window.closeExpiryCamera = function() {
    if (autoCaptureInterval) {
      clearInterval(autoCaptureInterval);
      autoCaptureInterval = null;
    }
    if (expiryCameraStream) {
      expiryCameraStream.getTracks().forEach(function(t) { t.stop(); });
      expiryCameraStream = null;
    }
    var video = document.getElementById('expiry-camera-video');
    if (video) {
      video.srcObject = null;
      video.style.display = 'none';
    }
    document.getElementById('expiry-camera-overlay').classList.remove('active');
    document.getElementById('expiry-ocr-loading').classList.remove('active');
    setExpiryButtonLoading(false);
  };

  function setExpiryButtonLoading(loading) {
    var btn = document.getElementById('btn-scan-expiry');
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-spinner"></span> Scansione in corso...';
      btn.classList.add('btn-loading');
    } else {
      btn.disabled = false;
      btn.innerHTML = '&#128247; Scansiona data scadenza';
      btn.classList.remove('btn-loading');
    }
  }

  function stopExpiryScan() {
    if (autoCaptureInterval) {
      clearInterval(autoCaptureInterval);
      autoCaptureInterval = null;
    }
    if (expiryCameraStream) {
      expiryCameraStream.getTracks().forEach(function(t) { t.stop(); });
      expiryCameraStream = null;
    }
    var video = document.getElementById('expiry-camera-video');
    if (video) {
      video.srcObject = null;
      video.style.display = 'none';
    }
    document.getElementById('expiry-camera-overlay').classList.remove('active');
    document.getElementById('expiry-ocr-loading').classList.remove('active');
  }

  function terminateExpiryOCR() {
    if (expiryTesseractWorker) {
      try {
        expiryTesseractWorker.terminate();
      } catch (e) {}
      expiryTesseractWorker = null;
    }
  }

  // ===== MODAL CONFERMA DATA =====
  function showExpiryConfirmModal(imageData, dateStr, confidence) {
    var imgEl = document.getElementById('expiry-preview-img');
    imgEl.innerHTML = '<img src="' + imageData + '" style="width:100%;height:100%;object-fit:cover;">';
    document.getElementById('expiry-detected-value').textContent = formatDateItalian(dateStr);
    document.getElementById('expiry-detected-confidence').textContent = 'Confidenza: ' + confidence + '%';
    document.getElementById('expiry-confirm-modal').classList.add('show');
  }

  window.closeExpiryConfirmModal = function(e) {
    if (e && e.target !== document.getElementById('expiry-confirm-modal')) return;
    document.getElementById('expiry-confirm-modal').classList.remove('show');
  };

  window.acceptDetectedExpiry = function() {
    if (detectedExpiryDate) {
      document.getElementById('expiry-input').value = detectedExpiryDate;
      showToast('&#9989; Data scadenza impostata: ' + formatDateItalian(detectedExpiryDate));
    }
    closeExpiryConfirmModal();
    closeExpiryCamera();
  };

  window.editDetectedExpiry = function() {
    closeExpiryConfirmModal();
    closeExpiryCamera();
    document.getElementById('expiry-input').focus();
  };

  window.rejectDetectedExpiry = function() {
    closeExpiryConfirmModal();
    closeExpiryCamera();
    showToast('Data ignorata');
    setExpiryButtonLoading(false);
  };

  function formatDateItalian(dateStr) {
    if (!dateStr) return '--/--/----';
    var parts = dateStr.split('-');
    if (parts.length === 3) {
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    }
    return dateStr;
  }

  // ===== MODAL PRODOTTO =====
  window.openProductModal = function(productId) {
    selectedProductId = productId;
    var product = null;
    for (var i = 0; i < products.length; i++) {
      if (products[i].id === productId) { product = products[i]; break; }
    }
    if (!product) return;

    var days = getDaysUntilExpiry(product.expiry);
    var badgeClass = days < 0 ? 'danger' : (days <= settings.alertDays ? 'warning' : 'safe');
    var badgeText = days < 0 ? 'Scaduto' : (days === 0 ? 'Oggi' : days + ' gg');
    var imgHtml = product.photo ? '<img src="' + product.photo + '" alt="">' : product.emoji;

    document.getElementById('modal-img').innerHTML = imgHtml;
    document.getElementById('modal-title').textContent = product.name;
    document.getElementById('modal-sub').textContent = 'EAN: ' + (product.barcode || '---');
    document.getElementById('modal-badge').innerHTML = '<span class="expiry-badge ' + badgeClass + '">&#128197; ' + badgeText + '</span>';

    var detailsHtml = '';
    detailsHtml += '<div class="detail-row"><span class="detail-label">Categoria</span><span class="detail-value">' + OpenFoodFacts.getCategoryEmoji(product.category) + ' ' + OpenFoodFacts.getCategoryName(product.category) + '</span></div>';
    detailsHtml += '<div class="detail-row"><span class="detail-label">Quantita</span><span class="detail-value">' + (product.qty || 1) + '</span></div>';
    if (product.expiry) {
      detailsHtml += '<div class="detail-row"><span class="detail-label">Scadenza</span><span class="detail-value">' + formatDateItalian(product.expiry) + '</span></div>';
    }
    document.getElementById('modal-details').innerHTML = detailsHtml;

    document.getElementById('product-modal').classList.add('show');
  };

  window.closeProductModal = function(e) {
    if (e && e.target !== document.getElementById('product-modal')) return;
    document.getElementById('product-modal').classList.remove('show');
  };

  window.showConsumeConfirm = function() {
    closeProductModal();
    var product = null;
    for (var i = 0; i < products.length; i++) {
      if (products[i].id === selectedProductId) { product = products[i]; break; }
    }
    if (!product) return;

    document.getElementById('confirm-icon').innerHTML = '&#128722;';
    document.getElementById('confirm-title').textContent = product.name;
    document.getElementById('confirm-desc').textContent = 'Il prodotto e stato consumato o e scaduto?';
    document.getElementById('confirm-btn-primary').textContent = '&#9989; Aggiungi alla lista spesa';
    document.getElementById('confirm-btn-danger').textContent = '&#128465; Rimuovi definitivamente';

    document.getElementById('confirm-btn-primary').onclick = function() {
      addToShoppingList(product.name, product.category, 'consumato');
      removeProduct(selectedProductId);
      closeConfirmModal();
    };
    document.getElementById('confirm-btn-danger').onclick = function() {
      removeProduct(selectedProductId);
      closeConfirmModal();
    };
    document.getElementById('confirm-btn-cancel').onclick = closeConfirmModal;

    document.getElementById('confirm-modal').classList.add('show');
  };

  window.showDeleteConfirm = function() {
    closeProductModal();
    var product = null;
    for (var i = 0; i < products.length; i++) {
      if (products[i].id === selectedProductId) { product = products[i]; break; }
    }
    if (!product) return;

    document.getElementById('confirm-icon').innerHTML = '&#128465;';
    document.getElementById('confirm-title').textContent = 'Elimina ' + product.name + '?';
    document.getElementById('confirm-desc').textContent = 'Questa azione non puo essere annullata.';
    document.getElementById('confirm-btn-primary').textContent = '&#9989; Conferma eliminazione';
    document.getElementById('confirm-btn-danger').style.display = 'none';

    document.getElementById('confirm-btn-primary').onclick = function() {
      removeProduct(selectedProductId);
      closeConfirmModal();
    };
    document.getElementById('confirm-btn-cancel').onclick = closeConfirmModal;

    document.getElementById('confirm-modal').classList.add('show');
  };

  function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('show');
    document.getElementById('confirm-btn-danger').style.display = '';
  }

  function removeProduct(productId) {
    var newProducts = [];
    for (var i = 0; i < products.length; i++) {
      if (products[i].id !== productId) newProducts.push(products[i]);
    }
    products = newProducts;
    saveData();
    renderProducts();
    updateStats();
    showToast('&#128465; Prodotto rimosso');
  }

  // ===== INFO PRODOTTO (API) =====
  window.openProductInfo = function() {
    closeProductModal();
    var product = null;
    for (var i = 0; i < products.length; i++) {
      if (products[i].id === selectedProductId) { product = products[i]; break; }
    }
    if (!product) return;

    document.getElementById('info-title').textContent = product.name;
    document.getElementById('info-sub').textContent = 'EAN: ' + (product.barcode || '---');
    var imgHtml = product.photo ? '<img src="' + product.photo + '" alt="">' : (product.emoji || '&#128230;');
    document.getElementById('info-img').innerHTML = imgHtml;

    var bodyHtml = '';
    bodyHtml += '<div class="info-section"><div class="info-section-title">&#128451; Categoria</div><div style="font-size:15px;font-weight:700;color:var(--text-primary);">' + OpenFoodFacts.getCategoryEmoji(product.category) + ' ' + OpenFoodFacts.getCategoryName(product.category) + '</div></div>';
    if (product.expiry) {
      bodyHtml += '<div class="info-section"><div class="info-section-title">&#128197; Data scadenza</div><div style="font-size:15px;font-weight:700;color:var(--text-primary);">' + formatDateItalian(product.expiry) + '</div></div>';
    }
    bodyHtml += '<div class="info-section"><div class="info-section-title">&#128203; Quantita</div><div style="font-size:15px;font-weight:700;color:var(--text-primary);">' + (product.qty || 1) + '</div></div>';
    bodyHtml += '<div class="info-section"><div class="info-section-title">&#128290; Barcode</div><div style="font-size:15px;font-weight:700;color:var(--text-primary);font-family:monospace;">' + (product.barcode || 'N/D') + '</div></div>';
    bodyHtml += '<div class="info-section"><div class="info-section-title">&#128336; Aggiunto il</div><div style="font-size:15px;font-weight:700;color:var(--text-primary);">' + (product.addedAt ? new Date(product.addedAt).toLocaleDateString('it-IT') : 'N/D') + '</div></div>';

    document.getElementById('info-body').innerHTML = bodyHtml;
    document.getElementById('info-modal').classList.add('show');
  };

  window.closeInfoModal = function(e) {
    if (e && e.target !== document.getElementById('info-modal')) return;
    document.getElementById('info-modal').classList.remove('show');
  };
  window.closeInfoModalDirect = function() {
    document.getElementById('info-modal').classList.remove('show');
  };

  // ===== LISTA SPESA =====
  function renderShoppingList() {
    var list = document.getElementById('shopping-list');
    var total = shoppingList.length;
    var completed = 0;
    for (var i = 0; i < shoppingList.length; i++) {
      if (shoppingList[i].checked) completed++;
    }
    var pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('progress-text').textContent = completed + '/' + total + ' completati';
    document.getElementById('progress-pct').textContent = pct + '%';
    document.getElementById('progress-bar').style.width = pct + '%';

    if (shoppingList.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#128221;</div><div class="empty-state-title">Lista vuota</div><div class="empty-state-desc">I prodotti in scadenza appariranno qui automaticamente</div></div>';
      return;
    }

    var html = '';
    for (var j = 0; j < shoppingList.length; j++) {
      var item = shoppingList[j];
      var checkedClass = item.checked ? 'checked' : '';
      var emoji = item.category ? OpenFoodFacts.getCategoryEmoji(item.category) : '&#128230;';
      html += '<div class="list-product-card ' + checkedClass + '" onclick="toggleListItem(' + item.id + ')">' +
        '<div class="list-product-img">' + emoji + '</div>' +
        '<div class="list-product-checkbox ' + checkedClass + '"></div>' +
        '<div class="list-product-info">' +
          '<div class="list-product-name">' + escapeHtml(item.name) + '</div>' +
          (item.reason ? '<div class="list-product-reason">' + item.reason + '</div>' : '') +
        '</div>' +
        '<button class="list-product-delete" onclick="event.stopPropagation(); deleteListItem(' + item.id + ')">&#128465;</button>' +
      '</div>';
    }
    list.innerHTML = html;
  }

  window.toggleListItem = function(itemId) {
    for (var i = 0; i < shoppingList.length; i++) {
      if (shoppingList[i].id === itemId) {
        shoppingList[i].checked = !shoppingList[i].checked;
        break;
      }
    }
    saveData();
    renderShoppingList();
    checkShoppingComplete();
  };

  window.deleteListItem = function(itemId) {
    var newList = [];
    for (var i = 0; i < shoppingList.length; i++) {
      if (shoppingList[i].id !== itemId) newList.push(shoppingList[i]);
    }
    shoppingList = newList;
    saveData();
    renderShoppingList();
  };

  function addToShoppingList(name, category, reason) {
    var nextListId = 1;
    for (var i = 0; i < shoppingList.length; i++) {
      if (shoppingList[i].id >= nextListId) nextListId = shoppingList[i].id + 1;
    }
    shoppingList.push({
      id: nextListId,
      name: name,
      category: category || 'pantry',
      reason: reason || '',
      checked: false,
      addedAt: new Date().toISOString()
    });
    saveData();
    renderShoppingList();
  }

  window.addListItem = function() {
    var input = document.getElementById('newItemInput');
    var name = input.value.trim();
    if (!name) return;
    addToShoppingList(name, 'pantry', 'aggiunto manualmente');
    input.value = '';
    document.getElementById('shopping-emoji-preview').textContent = '&#128722;';
    document.getElementById('shopping-emoji-preview-mobile').textContent = '&#128722;';
    document.getElementById('shopping-suggestions').style.display = 'none';
    renderShoppingList();
  };

  window.clearShoppingList = function() {
    var allChecked = true;
    for (var i = 0; i < shoppingList.length; i++) {
      if (!shoppingList[i].checked) { allChecked = false; break; }
    }
    if (allChecked && shoppingList.length > 0) {
      document.getElementById('shopping-complete-desc').textContent = 'Hai acquistato ' + shoppingList.length + ' prodotti';
      document.getElementById('shopping-complete-modal').classList.add('show');
    } else {
      if (confirm('Svuotare tutta la lista?')) {
        shoppingList = [];
        saveData();
        renderShoppingList();
      }
    }
  };

  window.confirmClearShoppingList = function() {
    shoppingList = [];
    saveData();
    renderShoppingList();
    closeShoppingCompleteModal();
  };

  window.closeShoppingCompleteModal = function() {
    document.getElementById('shopping-complete-modal').classList.remove('show');
  };

  function checkShoppingComplete() {
    if (shoppingList.length === 0) return;
    var allChecked = true;
    for (var i = 0; i < shoppingList.length; i++) {
      if (!shoppingList[i].checked) { allChecked = false; break; }
    }
    if (allChecked) {
      document.getElementById('shopping-complete-desc').textContent = 'Hai acquistato ' + shoppingList.length + ' prodotti';
      document.getElementById('shopping-complete-modal').classList.add('show');
    }
  }

  // ===== AUTOCOMPLETE LISTA SPESA =====
  window.handleShoppingInput = function() {
    var input = document.getElementById('newItemInput');
    var val = input.value.trim().toLowerCase();
    var suggestions = document.getElementById('shopping-suggestions');
    var previewDesk = document.getElementById('shopping-emoji-preview');
    var previewMob = document.getElementById('shopping-emoji-preview-mobile');

    if (!val) {
      suggestions.style.display = 'none';
      previewDesk.textContent = '&#128722;';
      previewMob.textContent = '&#128722;';
      return;
    }

    var matches = [];
    for (var i = 0; i < products.length; i++) {
      if (products[i].name.toLowerCase().indexOf(val) !== -1) {
        matches.push(products[i]);
        if (matches.length >= 5) break;
      }
    }

    if (matches.length > 0) {
      var html = '';
      for (var j = 0; j < matches.length; j++) {
        var p = matches[j];
        var img = p.photo ? '<img src="' + p.photo + '">' : p.emoji;
        html += '<div class="shopping-suggestion-item" onclick="selectSuggestion(' + p.id + ')">' +
          '<div class="shopping-suggestion-img">' + img + '</div>' +
          '<span>' + escapeHtml(p.name) + '</span>' +
        '</div>';
      }
      suggestions.innerHTML = html;
      suggestions.style.display = 'block';
    } else {
      suggestions.style.display = 'none';
    }

    var emoji = guessEmoji(val);
    previewDesk.textContent = emoji;
    previewMob.textContent = emoji;
  };

  window.selectSuggestion = function(productId) {
    var product = null;
    for (var i = 0; i < products.length; i++) {
      if (products[i].id === productId) { product = products[i]; break; }
    }
    if (!product) return;
    document.getElementById('newItemInput').value = product.name;
    document.getElementById('shopping-suggestions').style.display = 'none';
    document.getElementById('shopping-emoji-preview').textContent = product.emoji || '&#128230;';
    document.getElementById('shopping-emoji-preview-mobile').textContent = product.emoji || '&#128230;';
  };

  function guessEmoji(text) {
    var map = {
      'latte': '&#129371;', 'formaggio': '&#129371;', 'yogurt': '&#129371;',
      'carne': '&#129385;', 'pesce': '&#129385;', 'pollo': '&#129385;',
      'verdura': '&#129388;', 'frutta': '&#129388;', 'insalata': '&#129388;',
      'pane': '&#127838;', 'biscotto': '&#127838;', 'cracker': '&#127838;',
      'acqua': '&#129380;', 'vino': '&#129380;', 'birra': '&#129380;',
      'cioccolato': '&#127852;', 'dolce': '&#127852;', 'caramella': '&#127852;',
      'surgelato': '&#129482;', 'gelato': '&#129482;'
    };
    for (var key in map) {
      if (map.hasOwnProperty(key) && text.indexOf(key) !== -1) return map[key];
    }
    return '&#128722;';
  }

  // ===== RICERCA =====
  function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', function(e) {
      searchQuery = e.target.value;
      renderProducts();
    });
  }

  // ===== MODAL ORDINAMENTO =====
  window.openSortModal = function() {
    document.getElementById('sort-modal').classList.add('show');
  };
  window.closeSortModal = function(e) {
    if (e && e.target !== document.getElementById('sort-modal')) return;
    document.getElementById('sort-modal').classList.remove('show');
  };
  window.closeSortModalDirect = function() {
    document.getElementById('sort-modal').classList.remove('show');
  };

  // ===== RICETTE =====
  window.loadDailyRecipesFromAPI = function() {
    var container = document.getElementById('daily-recipes-container');
    container.innerHTML = '<div class="recipe-loading"><div class="spinner"></div>Caricamento ricette...</div>';

    RecipesAPI.getDailyRecipes()
      .then(function(recipes) {
        renderDailyRecipes(recipes);
      })
      .catch(function(err) {
        console.error('Errore ricette:', err);
        container.innerHTML = '<div class="recipe-error">&#9888;&#65039; Impossibile caricare le ricette. Riprova piu tardi.</div>';
      });
  };

  function renderDailyRecipes(recipes) {
    var container = document.getElementById('daily-recipes-container');
    if (!recipes || recipes.length === 0) {
      container.innerHTML = '<div class="recipe-error">&#128532; Nessuna ricetta disponibile al momento.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < recipes.length; i++) {
      var r = recipes[i];
      html += '<div class="recipe-card-mini" onclick="openRecipeDetail(' + i + ')">' +
        '<div class="recipe-card-mini-title">&#127860; ' + escapeHtml(r.title) + '</div>' +
        '<div class="recipe-card-mini-meta">' +
          '<span>&#9201; ' + (r.time || '30 min') + '</span>' +
          '<span>&#128101; ' + (r.servings || '2') + ' persone</span>' +
          '<span>&#127775; ' + (r.difficulty || 'Media') + '</span>' +
        '</div>' +
      '</div>';
    }
    container.innerHTML = html;
    window._dailyRecipes = recipes;
  }

  window.openRecipeDetail = function(index) {
    var recipes = window._dailyRecipes || [];
    if (!recipes[index]) return;
    var r = recipes[index];

    document.getElementById('recipe-detail-title').textContent = r.title;
    document.getElementById('recipe-detail-meta').innerHTML =
      '<span>&#9201; ' + (r.time || '30 min') + '</span>' +
      '<span>&#128101; ' + (r.servings || '2') + ' persone</span>' +
      '<span>&#127775; ' + (r.difficulty || 'Media') + '</span>';

    var bodyHtml = '';
    if (r.ingredients && r.ingredients.length > 0) {
      bodyHtml += '<div class="recipe-detail-section"><div class="recipe-detail-section-title">&#129379; Ingredienti</div><div class="recipe-ingredients-list">';
      for (var i = 0; i < r.ingredients.length; i++) {
        bodyHtml += '<span class="recipe-ingredient-tag">' + escapeHtml(r.ingredients[i]) + '</span>';
      }
      bodyHtml += '</div></div>';
    }
    if (r.steps && r.steps.length > 0) {
      bodyHtml += '<div class="recipe-detail-section"><div class="recipe-detail-section-title">&#128221; Preparazione</div><div class="recipe-steps-list">';
      for (var j = 0; j < r.steps.length; j++) {
        bodyHtml += '<div class="recipe-step"><div class="recipe-step-number">' + (j + 1) + '</div><div class="recipe-step-text">' + escapeHtml(r.steps[j]) + '</div></div>';
      }
      bodyHtml += '</div></div>';
    }
    if (r.tip) {
      bodyHtml += '<div class="recipe-detail-section"><div class="recipe-tip"><strong>&#128161; Consiglio:</strong> ' + escapeHtml(r.tip) + '</div></div>';
    }

    document.getElementById('recipe-detail-body').innerHTML = bodyHtml;
    document.getElementById('recipe-detail-modal').classList.add('show');
  };

  window.closeRecipeDetailModal = function(e) {
    if (e && e.target !== document.getElementById('recipe-detail-modal')) return;
    document.getElementById('recipe-detail-modal').classList.remove('show');
  };
  window.closeRecipeDetailModalDirect = function() {
    document.getElementById('recipe-detail-modal').classList.remove('show');
  };

  // ===== CLEANUP RICETTE ORFANE =====
  function cleanupOrphanRecipes() {
    var ids = [];
    for (var i = 0; i < products.length; i++) {
      ids.push(products[i].id);
    }
    var removed = Storage.cleanupOrphanRecipes(ids);
    if (removed > 0) {
      console.log('[Cleanup] Rimosse ' + removed + ' ricette orfane');
    }
  }

  // ===== EXPORT / IMPORT =====
  window.exportData = function() {
    var data = Storage.exportData();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'scanean_backup_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('&#128190; Dati esportati');
  };

  window.importData = function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        Storage.importData(data);
        loadData();
        renderProducts();
        renderShoppingList();
        updateStats();
        showToast('&#9989; Dati importati con successo');
      } catch (err) {
        showToast('&#10060; File non valido');
      }
    };
    reader.readAsText(file);
  };

  // ===== TOAST =====
  window.showToast = function(message) {
    var toast = document.getElementById('toast');
    toast.innerHTML = message;
    toast.classList.add('show');
    setTimeout(function() {
      toast.classList.remove('show');
    }, 2500);
  };

  // ===== UTILS =====
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== ESPOSIZIONE GLOBALE =====
  window.ScanEan = {
    products: function() { return products; },
    shoppingList: function() { return shoppingList; },
    settings: function() { return settings; },
    exportData: window.exportData,
    importData: window.importData
  };

})();
