/**
 * ScanEan - App completa per gestione dispensa
 * Scanner barcode reale + Open Food Facts API + Fotocamera
 */

// ============================================================
// VARIABILI GLOBALI
// ============================================================
var products = [];
var shoppingList = [];
var currentFilter = 'all';
var nextId = 1;
var nextListId = 1;
var selectedProductId = null;
var settings = {};
var isScanning = false;

var categoryEmojis = {
  dairy: '&#129371;',
  meat: '&#129385;',
  produce: '&#129388;',
  pantry: '&#129387;',
  beverages: '&#129380;',
  frozen: '&#129482;',
  bakery: '&#127838;',
  sweets: '&#127852;'
};

var categoryNames = {
  dairy: 'Latticini',
  meat: 'Carne e Pesce',
  produce: 'Verdura e Frutta',
  pantry: 'Dispensa',
  beverages: 'Bevande',
  frozen: 'Surgelati',
  bakery: 'Panetteria',
  sweets: 'Dolci'
};

// ============================================================
// INIT
// ============================================================
function init() {
  // Carica impostazioni
  settings = Storage.loadSettings();

  // Carica dati salvati o usa demo
  var savedProducts = Storage.loadProducts();
  var savedList = Storage.loadShoppingList();

  if (savedProducts && savedProducts.length > 0) {
    products = savedProducts;
    nextId = getMaxId(products) + 1;
  } else {
    loadDemoProducts();
  }

  if (savedList && savedList.length > 0) {
    shoppingList = savedList;
    nextListId = getMaxId(shoppingList) + 1;
  } else {
    loadDemoShopping();
  }

  renderProducts();
  renderShoppingList();
  updateStats();

  // Inizializza moduli
  Camera.init('camera-video');
  BarcodeScanner.init('camera-video', 'camera-canvas', onBarcodeDetected);

  // Nascondi splash
  setTimeout(function() {
    var splash = document.getElementById('splash');
    if (splash) splash.classList.add('hidden');
  }, 1800);
}

function getMaxId(arr) {
  var max = 0;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].id > max) max = arr[i].id;
  }
  return max;
}

function loadDemoProducts() {
  var now = new Date();
  var demoData = [
    { name: 'Latte Intero', emoji: '&#129371;', category: 'dairy', expiryDays: 4, qty: 2, barcode: '8001234567890' },
    { name: 'Mozzarella', emoji: '&#129472;', category: 'dairy', expiryDays: 2, qty: 1 },
    { name: 'Pomodori', emoji: '&#127813;', category: 'produce', expiryDays: 3, qty: 5 },
    { name: 'Pasta Barilla', emoji: '&#127837;', category: 'pantry', expiryDays: 180, qty: 3, barcode: '8076800195057' },
    { name: 'Petto di Pollo', emoji: '&#127831;', category: 'meat', expiryDays: 1, qty: 1 },
    { name: 'Yogurt Greco', emoji: '&#129379;', category: 'dairy', expiryDays: 7, qty: 4 },
    { name: 'Pane Integrale', emoji: '&#127838;', category: 'bakery', expiryDays: 5, qty: 1 },
    { name: 'Uova Bio', emoji: '&#129370;', category: 'dairy', expiryDays: 15, qty: 6 },
    { name: 'Insalata', emoji: '&#129388;', category: 'produce', expiryDays: 3, qty: 2 },
    { name: 'Olio EVO', emoji: '&#129746;', category: 'pantry', expiryDays: 365, qty: 1 },
    { name: 'Miele', emoji: '&#127855;', category: 'pantry', expiryDays: 730, qty: 1 },
    { name: 'Salmone', emoji: '&#128031;', category: 'meat', expiryDays: -1, qty: 1 }
  ];

  for (var i = 0; i < demoData.length; i++) {
    var p = demoData[i];
    var expiry = new Date(now);
    expiry.setDate(expiry.getDate() + p.expiryDays);
    products.push({
      id: nextId++,
      name: p.name,
      emoji: p.emoji,
      category: p.category,
      expiryDate: expiry.toISOString().split('T')[0],
      qty: p.qty,
      barcode: p.barcode || null,
      imageUrl: null,
      addedAt: now.toISOString().split('T')[0]
    });
  }

  Storage.saveProducts(products);
}

function loadDemoShopping() {
  var demoData = [
    { name: 'Latte Intero', checked: false, reason: 'Scade tra 4 giorni' },
    { name: 'Pane Integrale', checked: false, reason: 'Consumato' },
    { name: 'Uova Bio', checked: true, reason: 'Consumato' },
    { name: 'Caffe', checked: false, reason: 'Aggiunto manualmente' },
    { name: 'Detersivo piatti', checked: false, reason: 'Aggiunto manualmente' }
  ];

  for (var i = 0; i < demoData.length; i++) {
    var s = demoData[i];
    shoppingList.push({
      id: nextListId++,
      name: s.name,
      checked: s.checked,
      reason: s.reason
    });
  }

  Storage.saveShoppingList(shoppingList);
}

// ============================================================
// NAVIGAZIONE
// ============================================================
function navigateTo(screen) {
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) {
    screens[i].classList.remove('active');
  }
  var navItems = document.querySelectorAll('.nav-item');
  for (var j = 0; j < navItems.length; j++) {
    navItems[j].classList.remove('active');
  }

  document.getElementById('screen-' + screen).classList.add('active');
  if (screen !== 'scanner') {
    document.getElementById('nav-' + screen).classList.add('active');
  }

  if (screen === 'list') {
    renderShoppingList();
  } else if (screen === 'pantry') {
    renderProducts();
    updateStats();
  }
}

// ============================================================
// SCANNER - FOTOCAMERA REALE + BARCODE
// ============================================================
function startScanner() {
  navigateTo('scanner');
  startCameraAndScan();
}

function startCameraAndScan() {
  isScanning = true;

  // Mostra UI scanner
  document.getElementById('scanner-frame').style.display = 'block';
  document.getElementById('scanner-hint').innerHTML =
    'Inquadra il codice a barre<br>Lo scanner lo rilevera automaticamente';
  document.getElementById('scanner-actions').style.display = 'flex';

  // Avvia fotocamera
  Camera.start()
    .then(function(info) {
      console.log('Fotocamera avviata', info);

      // Avvia scansione barcode automatica
      BarcodeScanner.start();

      // Aggiorna UI
      if (info.hasTorch) {
        showToast('Torcia disponibile');
      }
    })
    .catch(function(err) {
      console.error('Errore fotocamera:', err);
      showToast('Fotocamera non disponibile: ' + err.message);

      // Fallback: input manuale barcode
      showManualBarcodeInput();
    });
}

function stopScanner() {
  isScanning = false;
  BarcodeScanner.stop();
  Camera.stop();
  closeScanResult();
}

function showManualBarcodeInput() {
  // Nascondi frame scanner, mostra input manuale
  document.getElementById('scanner-frame').style.display = 'none';
  document.getElementById('scanner-hint').innerHTML =
    'Inserisci il codice EAN manualmente';

  // Crea input manuale
  var manualDiv = document.getElementById('manual-barcode-input');
  if (!manualDiv) {
    manualDiv = document.createElement('div');
    manualDiv.id = 'manual-barcode-input';
    manualDiv.className = 'manual-barcode';
    manualDiv.innerHTML =
      '<input type="text" id="manual-ean" placeholder="Inserisci EAN-13" maxlength="13">' +
      '<button onclick="processManualBarcode()">Cerca</button>';
    document.querySelector('.scanner-container').appendChild(manualDiv);
  }
  manualDiv.style.display = 'block';
}

function processManualBarcode() {
  var input = document.getElementById('manual-ean');
  var barcode = input ? input.value.trim() : '';

  if (!barcode || barcode.length < 8) {
    showToast('Inserisci un codice valido');
    return;
  }

  // Nascondi input manuale
  var manualDiv = document.getElementById('manual-barcode-input');
  if (manualDiv) manualDiv.style.display = 'none';

  processBarcode(barcode);
}

// Callback quando il barcode viene rilevato
function onBarcodeDetected(barcode) {
  if (!isScanning) return;

  console.log('Barcode rilevato:', barcode);
  showToast('Barcode rilevato: ' + barcode);

  // Ferma scansione temporaneamente
  BarcodeScanner.stop();

  // Processa il barcode
  processBarcode(barcode);
}

function processBarcode(barcode) {
  // Mostra loading
  document.getElementById('api-loading').style.display = 'block';

  // Chiama Open Food Facts
  OpenFoodFacts.search(barcode)
    .then(function(result) {
      document.getElementById('api-loading').style.display = 'none';

      if (result.found && result.product) {
        // Prodotto trovato!
        showProductFound(result.product);
      } else {
        // Prodotto non trovato
        showProductNotFound(barcode);
      }
    });
}

function showProductFound(product) {
  var category = OpenFoodFacts.detectCategory(product);
  var emoji = OpenFoodFacts.getCategoryEmoji(category);

  scannedProductData = {
    name: product.name,
    emoji: emoji,
    category: category,
    brand: product.brand,
    quantity: product.quantity,
    ingredients: product.ingredients,
    nutriscore: product.nutriscore,
    novaGroup: product.novaGroup,
    nutriments: product.nutriments,
    servingSize: product.servingSize,
    barcode: product.barcode
  };

  currentBarcode = product.barcode;
  currentImageUrl = product.imageUrl || product.imageFrontUrl || null;

  // Mostra risultato
  var resultImg = document.getElementById('result-img');
  var resultTitle = document.getElementById('result-title');
  var resultSub = document.getElementById('result-sub');
  var nameInput = document.getElementById('product-name-input');
  var expiryInput = document.getElementById('expiry-input');
  var qtyInput = document.getElementById('qty-input');
  var btnCamera = document.getElementById('btn-camera');
  var cameraPreview = document.getElementById('camera-preview');

  // Reset
  cameraPreview.classList.remove('show');
  cameraPreview.src = '';
  cameraPhotoData = null;

  // Immagine
  if (currentImageUrl) {
    resultImg.innerHTML = '<img src="' + currentImageUrl + '" alt="' + product.name + '" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<span class=placeholder-text>' + emoji + '</span>\'">';
    btnCamera.style.display = 'none';
  } else {
    resultImg.innerHTML = '<span class="placeholder-text">' + emoji + '</span>';
    btnCamera.style.display = 'block';
  }

  // Info
  resultTitle.textContent = product.name;
  var subText = 'EAN: ' + product.barcode;
  if (product.brand) subText += ' &bull; ' + product.brand;
  if (product.quantity) subText += ' &bull; ' + product.quantity;
  resultSub.innerHTML = subText;

  // Form
  nameInput.value = product.name;

  // Data scadenza default (30 giorni)
  var expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  expiryInput.value = expiry.toISOString().split('T')[0];
  qtyInput.value = '1';

  // Mostra pannello
  document.getElementById('scan-result').classList.add('show');

  // Salva in background
  Storage.saveProducts(products);
}

function showProductNotFound(barcode) {
  currentBarcode = barcode;
  currentImageUrl = null;

  scannedProductData = {
    name: 'Prodotto ' + barcode,
    emoji: '&#128230;',
    category: 'pantry',
    brand: '',
    barcode: barcode
  };

  var resultImg = document.getElementById('result-img');
  var resultTitle = document.getElementById('result-title');
  var resultSub = document.getElementById('result-sub');
  var nameInput = document.getElementById('product-name-input');
  var expiryInput = document.getElementById('expiry-input');
  var qtyInput = document.getElementById('qty-input');
  var btnCamera = document.getElementById('btn-camera');
  var cameraPreview = document.getElementById('camera-preview');

  cameraPreview.classList.remove('show');
  cameraPreview.src = '';
  cameraPhotoData = null;

  resultImg.innerHTML = '<span class="placeholder-text">&#128230;</span>';
  resultTitle.textContent = 'Prodotto non trovato';
  resultSub.innerHTML = 'EAN: ' + barcode + '<br>Inserisci i dati manualmente';

  nameInput.value = '';
  nameInput.placeholder = 'Inserisci il nome del prodotto...';

  var expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  expiryInput.value = expiry.toISOString().split('T')[0];
  qtyInput.value = '1';

  btnCamera.style.display = 'block';
  document.getElementById('scan-result').classList.add('show');
}

function closeScanResult() {
  document.getElementById('scan-result').classList.remove('show');
  scannedProductData = null;
  currentBarcode = null;
  currentImageUrl = null;
  cameraPhotoData = null;

  // Riavvia scansione se siamo ancora nello scanner
  if (isScanning && document.getElementById('screen-scanner').classList.contains('active')) {
    BarcodeScanner.start();
  }
}

// ============================================================
// FOTO CAMERA MANUALE
// ============================================================
function openCamera() {
  document.getElementById('camera-input').click();
}

function handleCameraPhoto(event) {
  var file = event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    cameraPhotoData = e.target.result;
    var preview = document.getElementById('camera-preview');
    preview.src = cameraPhotoData;
    preview.classList.add('show');

    var resultImg = document.getElementById('result-img');
    resultImg.innerHTML = '<img src="' + cameraPhotoData + '" alt="Foto prodotto">';

    showToast('&#128247; Foto aggiunta!');
  };
  reader.readAsDataURL(file);

  event.target.value = '';
}

// ============================================================
// AGGIUNGI PRODOTTO
// ============================================================
function addProduct() {
  if (!scannedProductData) return;

  var name = document.getElementById('product-name-input').value.trim();
  var expiry = document.getElementById('expiry-input').value;
  var qty = parseInt(document.getElementById('qty-input').value) || 1;

  if (!name) {
    showToast('&#9888;&#65039; Inserisci il nome del prodotto');
    return;
  }

  var finalImageUrl = cameraPhotoData || currentImageUrl || null;

  var newProduct = {
    id: nextId++,
    name: name,
    emoji: scannedProductData.emoji || '&#128230;',
    category: scannedProductData.category || 'pantry',
    expiryDate: expiry,
    qty: qty,
    barcode: currentBarcode,
    imageUrl: finalImageUrl,
    addedAt: new Date().toISOString().split('T')[0],
    brand: scannedProductData.brand || '',
    ingredients: scannedProductData.ingredients || '',
    nutriscore: scannedProductData.nutriscore || '',
    novaGroup: scannedProductData.novaGroup || ''
  };

  products.unshift(newProduct);
  Storage.saveProducts(products);

  closeScanResult();
  stopScanner();
  navigateTo('pantry');
  renderProducts();
  updateStats();
  showToast('&#9989; ' + name + ' aggiunto!');
}

// ============================================================
// PRODOTTI
// ============================================================
function getDaysUntilExpiry(expiryDate) {
  var today = new Date();
  today.setHours(0,0,0,0);
  var exp = new Date(expiryDate);
  exp.setHours(0,0,0,0);
  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}

function getStatusBadge(product) {
  var days = getDaysUntilExpiry(product.expiryDate);
  if (days < 0) return '<span class="expiry-badge danger">&#9940; Scaduto</span>';
  if (days === 0) return '<span class="expiry-badge danger">&#128308; Oggi</span>';
  if (days <= 3) return '<span class="expiry-badge warning">&#128993; ' + days + ' gg</span>';
  return '<span class="expiry-badge safe">&#128994; ' + days + ' gg</span>';
}

function renderProducts() {
  var list = document.getElementById('products-list');
  var filtered = [];
  for (var i = 0; i < products.length; i++) {
    filtered.push(products[i]);
  }

  if (currentFilter !== 'all') {
    if (currentFilter === 'expiring') {
      var temp = [];
      for (var k = 0; k < filtered.length; k++) {
        if (getDaysUntilExpiry(filtered[k].expiryDate) <= 3) {
          temp.push(filtered[k]);
        }
      }
      filtered = temp;
    } else {
      var temp2 = [];
      for (var m = 0; m < filtered.length; m++) {
        if (filtered[m].category === currentFilter) {
          temp2.push(filtered[m]);
        }
      }
      filtered = temp2;
    }
  }

  var searchTerm = document.getElementById('searchInput').value.toLowerCase();
  if (searchTerm) {
    var temp3 = [];
    for (var n = 0; n < filtered.length; n++) {
      if (filtered[n].name.toLowerCase().indexOf(searchTerm) !== -1) {
        temp3.push(filtered[n]);
      }
    }
    filtered = temp3;
  }

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#128230;</div><div class="empty-state-title">Nessun prodotto</div><div class="empty-state-desc">Usa lo scanner per aggiungere il tuo primo prodotto!</div></div>';
    return;
  }

  var html = '';
  for (var idx = 0; idx < filtered.length; idx++) {
    var p = filtered[idx];
    var imgHtml = p.imageUrl ? '<img src="' + p.imageUrl + '" alt="' + p.name + '" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'' + (p.emoji || '&#128230;') + '\'">' : (p.emoji || '&#128230;');
    html += '<div class="product-card" style="animation-delay:' + (idx * 0.03) + 's" onclick="openProductModal(' + p.id + ')">' +
      '<div class="product-img">' + imgHtml + '</div>' +
      '<div class="product-info">' +
        '<div class="product-name">' + p.name + '</div>' +
        '<div class="product-meta">' + getStatusBadge(p) + '<span>Scade: ' + formatDate(p.expiryDate) + '</span></div>' +
      '</div>' +
      '<div class="product-qty">' + p.qty + '</div>' +
    '</div>';
  }
  list.innerHTML = html;
}

function updateStats() {
  document.getElementById('stat-total').textContent = products.length;
  var warningCount = 0;
  var expiredCount = 0;
  for (var i = 0; i < products.length; i++) {
    var d = getDaysUntilExpiry(products[i].expiryDate);
    if (d >= 0 && d <= 3) warningCount++;
    if (d < 0) expiredCount++;
  }
  document.getElementById('stat-warning').textContent = warningCount;
  document.getElementById('stat-expired').textContent = expiredCount;
}

function filterProducts(category, chip) {
  currentFilter = category;
  var chips = document.querySelectorAll('.chip');
  for (var i = 0; i < chips.length; i++) {
    chips[i].classList.remove('active');
  }
  chip.classList.add('active');
  renderProducts();
}

// Search
document.getElementById('searchInput').addEventListener('input', function(e) {
  renderProducts();
});

// ============================================================
// MODAL PRODOTTO
// ============================================================
function openProductModal(id) {
  selectedProductId = id;
  var product = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === id) {
      product = products[i];
      break;
    }
  }
  if (!product) return;

  var days = getDaysUntilExpiry(product.expiryDate);
  var modalImg = document.getElementById('modal-img');

  if (product.imageUrl) {
    modalImg.innerHTML = '<img src="' + product.imageUrl + '" alt="' + product.name + '" onerror="this.style.display=\'none\';this.parentElement.textContent=\'' + (product.emoji || '&#128230;') + '\'">';
  } else {
    modalImg.textContent = product.emoji || '&#128230;';
  }

  document.getElementById('modal-title').textContent = product.name;
  document.getElementById('modal-sub').textContent = product.barcode ? 'EAN: ' + product.barcode : 'Prodotto manuale';
  document.getElementById('modal-badge').innerHTML = getStatusBadge(product);

  var catEmoji = categoryEmojis[product.category] || '&#128230;';
  var catName = categoryNames[product.category] || 'Altro';

  var detailsHtml =
    '<div class="detail-row"><span class="detail-label">Categoria</span><span class="detail-value">' + catEmoji + ' ' + catName + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Quantita</span><span class="detail-value">' + product.qty + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Data scadenza</span><span class="detail-value">' + formatDate(product.expiryDate) + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Giorni rimanenti</span><span class="detail-value">' + days + '</span></div>';

  if (product.brand) {
    detailsHtml += '<div class="detail-row"><span class="detail-label">Marca</span><span class="detail-value">' + product.brand + '</span></div>';
  }
  if (product.nutriscore) {
    detailsHtml += '<div class="detail-row"><span class="detail-label">Nutri-Score</span><span class="detail-value">' + product.nutriscore.toUpperCase() + '</span></div>';
  }
  if (product.ingredients) {
    detailsHtml += '<div class="detail-row"><span class="detail-label">Ingredienti</span><span class="detail-value" style="max-width:200px;white-space:normal;text-align:right;">' + product.ingredients.substring(0, 100) + '...</span></div>';
  }

  detailsHtml += '<div class="detail-row"><span class="detail-label">Aggiunto il</span><span class="detail-value">' + formatDate(product.addedAt) + '</span></div>';

  document.getElementById('modal-details').innerHTML = detailsHtml;
  document.getElementById('product-modal').classList.add('show');
}

function closeProductModal(e) {
  if (e.target === e.currentTarget) {
    document.getElementById('product-modal').classList.remove('show');
    selectedProductId = null;
  }
}

function deleteProduct() {
  if (selectedProductId === null) return;
  var p = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === selectedProductId) {
      p = products[i];
      break;
    }
  }
  var newProducts = [];
  for (var j = 0; j < products.length; j++) {
    if (products[j].id !== selectedProductId) {
      newProducts.push(products[j]);
    }
  }
  products = newProducts;
  Storage.saveProducts(products);
  document.getElementById('product-modal').classList.remove('show');
  renderProducts();
  updateStats();
  showToast('&#128465; ' + (p ? p.name : 'Prodotto') + ' rimosso');
  selectedProductId = null;
}

function consumeProduct() {
  if (selectedProductId === null) return;
  var p = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === selectedProductId) {
      p = products[i];
      break;
    }
  }
  if (p) {
    shoppingList.push({
      id: nextListId++,
      name: p.name,
      checked: false,
      reason: 'Consumato'
    });
    Storage.saveShoppingList(shoppingList);
  }
  document.getElementById('product-modal').classList.remove('show');
  showToast('&#128722; ' + (p ? p.name : 'Prodotto') + ' aggiunto alla lista spesa');
  selectedProductId = null;
}

// ============================================================
// LISTA DELLA SPESA
// ============================================================
function renderShoppingList() {
  var list = document.getElementById('shopping-list');
  var total = shoppingList.length;
  var checked = 0;
  for (var i = 0; i < shoppingList.length; i++) {
    if (shoppingList[i].checked) checked++;
  }
  var pct = total === 0 ? 0 : Math.round((checked / total) * 100);

  document.getElementById('progress-text').textContent = checked + '/' + total + ' completati';
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('progress-bar').style.width = pct + '%';

  if (total === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#128722;</div><div class="empty-state-title">Lista vuota</div><div class="empty-state-desc">I prodotti consumati o scaduti appariranno qui automaticamente.</div></div>';
    return;
  }

  var html = '';
  for (var idx = 0; idx < shoppingList.length; idx++) {
    var item = shoppingList[idx];
    html += '<div class="list-item" style="animation-delay:' + (idx * 0.03) + 's">' +
      '<div class="checkbox ' + (item.checked ? 'checked' : '') + '" onclick="toggleCheck(' + item.id + ')"></div>' +
      '<div style="flex:1">' +
        '<div class="list-item-text ' + (item.checked ? 'checked' : '') + '">' + item.name + '</div>' +
        '<div class="list-item-reason">&#129302; ' + item.reason + '</div>' +
      '</div>' +
    '</div>';
  }
  list.innerHTML = html;
}

function toggleCheck(id) {
  for (var i = 0; i < shoppingList.length; i++) {
    if (shoppingList[i].id === id) {
      shoppingList[i].checked = !shoppingList[i].checked;
      break;
    }
  }
  Storage.saveShoppingList(shoppingList);
  renderShoppingList();
}

function addListItem() {
  var input = document.getElementById('newItemInput');
  var name = input.value.trim();
  if (!name) return;
  shoppingList.push({
    id: nextListId++,
    name: name,
    checked: false,
    reason: 'Aggiunto manualmente'
  });
  input.value = '';
  Storage.saveShoppingList(shoppingList);
  renderShoppingList();
  showToast('&#9989; ' + name + ' aggiunto');
}

document.getElementById('newItemInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') addListItem();
});

// ============================================================
// UTILS
// ============================================================
function formatDate(dateStr) {
  var d = new Date(dateStr);
  var day = String(d.getDate()).padStart(2, '0');
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var year = d.getFullYear();
  return day + '/' + month + '/' + year;
}

function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.innerHTML = msg;
  toast.classList.add('show');
  setTimeout(function() {
    toast.classList.remove('show');
  }, 2500);
}

// ============================================================
// INIZIALIZZAZIONE
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
