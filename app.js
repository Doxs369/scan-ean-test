/**
 * ScanEan - App completa per gestione dispensa
 * Scanner barcode + Open Food Facts + TheMealDB ricette anti-spreco (IT)
 */

// ============================================================
// VARIABILI GLOBALI
// ============================================================
var products = [];
var shoppingList = [];
var currentFilter = 'all';
var currentSort = 'expiry';
var nextId = 1;
var nextListId = 1;
var selectedProductId = null;
var settings = {};
var isScanning = false;
var scannedProductData = null;
var currentBarcode = null;
var currentImageUrl = null;
var cameraPhotoData = null;
var currentRecipeProductId = null;
var dailyRecipes = null;

var categoryEmojis = {
  dairy: '&#129371;', meat: '&#129385;', produce: '&#129388;',
  pantry: '&#129387;', beverages: '&#129380;', frozen: '&#129482;',
  bakery: '&#127838;', sweets: '&#127852;'
};

var categoryNames = {
  dairy: 'Latticini', meat: 'Carne e Pesce', produce: 'Verdura e Frutta',
  pantry: 'Dispensa', beverages: 'Bevande', frozen: 'Surgelati',
  bakery: 'Panetteria', sweets: 'Dolci'
};

// ============================================================
// INIT
// ============================================================
function init() {
  settings = Storage.loadSettings();

  var savedProducts = Storage.loadProducts();
  var savedList = Storage.loadShoppingList();

  if (savedProducts && savedProducts.length > 0) {
    products = savedProducts;
    nextId = getMaxId(products) + 1;
  }

  if (savedList && savedList.length > 0) {
    shoppingList = savedList;
    nextListId = getMaxId(shoppingList) + 1;
  }

  runDailyCleanup();

  var savedDaily = RecipesAPI.loadDailyRecipes();
  if (savedDaily && savedDaily.recipes) {
    dailyRecipes = savedDaily.recipes;
  }

  renderProducts();
  renderShoppingList();
  updateStats();
  renderDailyRecipes();

  Camera.init('camera-video');
  BarcodeScanner.init('camera-video', 'camera-canvas', onBarcodeDetected);

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

// ============================================================
// PULIZIA GIORNALIERA
// ============================================================
function runDailyCleanup() {
  var today = new Date().toISOString().split('T')[0];
  var lastCleanup = localStorage.getItem('scanEan_lastCleanup');
  if (lastCleanup === today) return;

  var expired = RecipesAPI.getExpiredProducts(products);
  for (var i = 0; i < expired.length; i++) {
    var p = expired[i];
    var alreadyInList = false;
    for (var j = 0; j < shoppingList.length; j++) {
      if (shoppingList[j].name === p.name && shoppingList[j].reason === 'Scaduto') {
        alreadyInList = true;
        break;
      }
    }
    if (!alreadyInList) {
      shoppingList.push({ id: nextListId++, name: p.name, checked: false, reason: 'Scaduto' });
    }
    Storage.deleteRecipes(p.id);
  }

  if (expired.length > 0) {
    var newProducts = [];
    for (var k = 0; k < products.length; k++) {
      var isExpired = false;
      for (var m = 0; m < expired.length; m++) {
        if (products[k].id === expired[m].id) { isExpired = true; break; }
      }
      if (!isExpired) newProducts.push(products[k]);
    }
    products = newProducts;
    Storage.saveProducts(products);
    Storage.saveShoppingList(shoppingList);
  }

  RecipesAPI.cleanupOldRecipes();
  cleanupRecipes();
  localStorage.setItem('scanEan_lastCleanup', today);

  if (expired.length > 0) {
    showToast('&#9888;&#65039; ' + expired.length + ' prodotto/i scaduto/i spostato/i in lista spesa');
  }
}

// ============================================================
// RICETTE DEL GIORNO — SOLO PRODOTTO IN SCADENZA OGGI (IT)
// ============================================================
function loadDailyRecipesFromAPI() {
  var expiringToday = RecipesAPI.getExpiringToday(products);
  if (expiringToday.length === 0) {
    dailyRecipes = null;
    renderDailyRecipes();
    return;
  }

  if (dailyRecipes && dailyRecipes.productId === expiringToday[0].id) {
    renderDailyRecipes();
    return;
  }

  var product = expiringToday[0];
  showToast('&#127860; Cerco ricette per "' + product.name + '"...');

  RecipesAPI.searchByIngredient(product.name)
    .then(function(recipes) {
      if (recipes.length > 0) {
        dailyRecipes = {
          productName: product.name,
          productId: product.id,
          recipes: recipes.slice(0, 5)
        };
        RecipesAPI.saveDailyRecipes(dailyRecipes);
        renderDailyRecipes();
        showToast('&#9989; ' + recipes.length + ' ricette trovate per ' + product.name + '!');
      } else {
        dailyRecipes = { productName: product.name, productId: product.id, recipes: [], noResults: true };
        RecipesAPI.saveDailyRecipes(dailyRecipes);
        renderDailyRecipes();
        showToast('&#128533; Nessuna ricetta trovata per "' + product.name + '"');
      }
    });
}

function renderDailyRecipes() {
  var container = document.getElementById('daily-recipes-container');
  if (!container) return;

  var expiringToday = RecipesAPI.getExpiringToday(products);

  if (expiringToday.length === 0) {
    container.innerHTML =
      '<div class="recipe-card" style="opacity:0.7;">' +
        '<div class="recipe-header">' +
          '<div class="recipe-icon">&#128994;</div>' +
          '<div>' +
            '<div class="recipe-title">Nessun prodotto in scadenza oggi</div>' +
            '<div class="recipe-ingredients">Tutti i tuoi prodotti sono al sicuro!</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    return;
  }

  var product = expiringToday[0];
  var days = getDaysUntilExpiry(product.expiryDate);

  var headerHtml =
    '<div style="padding:0 16px;margin-bottom:12px;">' +
      '<div style="font-size:13px;color:var(--text-muted);font-weight:600;">' +
        '&#9200; Scade ' + (days === 0 ? 'OGGI' : 'tra ' + days + ' gg') + ': <strong style="color:var(--danger);">' + product.name + '</strong>' +
      '</div>' +
    '</div>';

  if (!dailyRecipes || dailyRecipes.productId !== product.id) {
    container.innerHTML = headerHtml +
      '<div class="recipe-card" style="cursor:pointer;" onclick="loadDailyRecipesFromAPI()">' +
        '<div class="recipe-header">' +
          '<div class="recipe-icon">&#127860;</div>' +
          '<div>' +
            '<div class="recipe-title">Trova ricette per "' + product.name + '"</div>' +
            '<div class="recipe-ingredients">Clicca per cercare su TheMealDB</div>' +
          '</div>' +
        '</div>' +
        '<span class="recipe-match">&#128269; Cerca ricette</span>' +
      '</div>';
    return;
  }

  if (dailyRecipes.noResults) {
    container.innerHTML = headerHtml +
      '<div class="recipe-card" style="opacity:0.7;">' +
        '<div class="recipe-header">' +
          '<div class="recipe-icon">&#128533;</div>' +
          '<div>' +
            '<div class="recipe-title">Nessuna ricetta trovata</div>' +
            '<div class="recipe-ingredients">Prova a cercare manualmente con altri ingredienti</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    return;
  }

  var html = headerHtml;
  for (var i = 0; i < dailyRecipes.recipes.length; i++) {
    var r = dailyRecipes.recipes[i];
    html +=
      '<div class="recipe-card" style="cursor:pointer;" onclick="openMealDBRecipe(' + r.id + ')">' +
        '<div class="recipe-header">' +
          '<div class="recipe-img-thumb">' +
            '<img src="' + r.thumb + '" alt="' + r.title + '" loading="lazy">' +
          '</div>' +
          '<div style="min-width:0;">' +
            '<div class="recipe-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + r.title + '</div>' +
            '<div class="recipe-ingredients">&#129379; Usa: ' + product.name + '</div>' +
          '</div>' +
        '</div>' +
        '<span class="recipe-match">&#128073; Tocca per la ricetta</span>' +
      '</div>';
  }
  container.innerHTML = html;
}

function openMealDBRecipe(recipeId) {
  showToast('&#9200; Carico dettaglio ricetta...');

  RecipesAPI.getRecipeDetail(recipeId)
    .then(function(recipe) {
      if (!recipe) {
        showToast('&#10060; Ricetta non trovata');
        return;
      }

      document.getElementById('recipe-detail-title').textContent = recipe.title;

      var metaHtml = '';
      if (recipe.category) metaHtml += '<span>&#127860; ' + recipe.category + '</span>';
      if (recipe.area) metaHtml += '<span>&#127758; ' + recipe.area + '</span>';
      document.getElementById('recipe-detail-meta').innerHTML = metaHtml;

      var bodyHtml = '';

      if (recipe.thumb) {
        bodyHtml += '<div style="margin-bottom:16px;">' +
          '<img src="' + recipe.thumb + '" style="width:100%;border-radius:12px;" alt="' + recipe.title + '">' +
          '</div>';
      }

      if (recipe.ingredients && recipe.ingredients.length > 0) {
        bodyHtml += '<div class="recipe-detail-section">' +
          '<div class="recipe-detail-section-title">&#129379; Ingredienti</div>' +
          '<div class="recipe-ingredients-list">';
        for (var i = 0; i < recipe.ingredients.length; i++) {
          bodyHtml += '<span class="recipe-ingredient-tag">' + recipe.ingredients[i] + '</span>';
        }
        bodyHtml += '</div></div>';
      }

      if (recipe.instructions && recipe.instructions.length > 0) {
        bodyHtml += '<div class="recipe-detail-section">' +
          '<div class="recipe-detail-section-title">&#128221; Preparazione</div>' +
          '<div class="recipe-steps-list">';
        for (var j = 0; j < recipe.instructions.length; j++) {
          bodyHtml += '<div class="recipe-step">' +
            '<div class="recipe-step-number">' + (j + 1) + '</div>' +
            '<div class="recipe-step-text">' + recipe.instructions[j] + '</div>' +
          '</div>';
        }
        bodyHtml += '</div></div>';
      }

      if (recipe.youtube) {
        bodyHtml += '<div class="recipe-detail-section">' +
          '<div class="recipe-detail-section-title">&#127909; Video</div>' +
          '<a href="' + recipe.youtube + '" target="_blank" style="color:var(--primary);font-weight:700;font-size:14px;">&#9654; Guarda su YouTube</a>' +
          '</div>';
      }

      document.getElementById('recipe-detail-body').innerHTML = bodyHtml;
      document.getElementById('recipe-detail-modal').classList.add('show');
    });
}

// ============================================================
// NAVIGAZIONE
// ============================================================
function navigateTo(screen) {
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
  var navItems = document.querySelectorAll('.nav-item');
  for (var j = 0; j < navItems.length; j++) navItems[j].classList.remove('active');

  document.getElementById('screen-' + screen).classList.add('active');
  if (screen !== 'scanner') {
    document.getElementById('nav-' + screen).classList.add('active');
  }

  if (screen === 'list') renderShoppingList();
  else if (screen === 'pantry') {
    renderProducts();
    updateStats();
    renderDailyRecipes();
  }
}

// ============================================================
// SCANNER + FOTO MANUALE (anche senza API)
// ============================================================
function startScanner() {
  navigateTo('scanner');
  startCameraAndScan();
}

function startCameraAndScan() {
  isScanning = true;
  document.getElementById('scanner-frame').style.display = 'block';
  document.getElementById('scanner-hint').innerHTML =
    'Inquadra il codice a barre<br>Lo scanner lo rilevera automaticamente';
  document.getElementById('scanner-actions').style.display = 'flex';

  Camera.start()
    .then(function(info) {
      console.log('Fotocamera avviata', info);
      BarcodeScanner.start();
      if (info.hasTorch) showToast('Torcia disponibile');
    })
    .catch(function(err) {
      console.error('Errore fotocamera:', err);
      showToast('Fotocamera non disponibile: ' + err.message);
      // Mostra subito input manuale + foto senza dipendere dalla camera
      showManualBarcodeAndPhotoInput();
    });
}

function stopScanner() {
  isScanning = false;
  BarcodeScanner.stop();
  Camera.stop();
  closeScanResult();
}

/**
 * NUOVO: Mostra input manuale barcode + foto prodotto
 * Funziona anche se la fotocamera non è disponibile
 */
function showManualBarcodeAndPhotoInput() {
  document.getElementById('scanner-frame').style.display = 'none';
  document.getElementById('scanner-hint').innerHTML =
    'Inserisci il codice manualmente o scatta una foto';

  var manualDiv = document.getElementById('manual-barcode-input');
  if (!manualDiv) {
    manualDiv = document.createElement('div');
    manualDiv.id = 'manual-barcode-input';
    manualDiv.className = 'manual-barcode';
    manualDiv.style.maxWidth = '320px';
    manualDiv.innerHTML =
      '<div style="margin-bottom:12px;">' +
        '<input type="text" id="manual-ean" placeholder="Codice EAN-13" maxlength="13" style="width:100%;margin-bottom:8px;">' +
        '<button onclick="processManualBarcode()" style="width:100%;">&#128270; Cerca prodotto</button>' +
      '</div>' +
      '<div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:12px;">' +
        '<div style="color:rgba(255,255,255,0.7);font-size:12px;margin-bottom:8px;">Oppure scatta una foto del prodotto</div>' +
        '<button onclick="openCameraForManualProduct()" style="width:100%;background:var(--accent);">&#128247; Scatta foto prodotto</button>' +
      '</div>';
    document.querySelector('.scanner-container').appendChild(manualDiv);
  }
  manualDiv.style.display = 'block';
}

function showManualBarcodeInput() {
  showManualBarcodeAndPhotoInput();
}

function processManualBarcode() {
  var input = document.getElementById('manual-ean');
  var barcode = input ? input.value.trim() : '';

  if (!barcode || barcode.length < 8) {
    showToast('Inserisci un codice valido');
    return;
  }

  var manualDiv = document.getElementById('manual-barcode-input');
  if (manualDiv) manualDiv.style.display = 'none';

  processBarcode(barcode);
}

/**
 * NUOVO: Apre fotocamera per foto prodotto manuale (senza barcode)
 */
function openCameraForManualProduct() {
  // Usa l'input file nascosto ma senza barcode
  document.getElementById('camera-input-manual').click();
}

/**
 * NUOVO: Gestisce foto prodotto manuale (senza API)
 */
function handleManualProductPhoto(event) {
  var file = event.target.files[0];
  if (!file) return;

  var processPhoto = function(dataUrl) {
    cameraPhotoData = dataUrl;

    // Prepara dati prodotto manuale
    scannedProductData = {
      name: '',
      emoji: '&#128230;',
      category: 'pantry',
      brand: '',
      barcode: null
    };
    currentBarcode = null;
    currentImageUrl = null;

    // Mostra risultato
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

    resultImg.innerHTML = '<img src="' + cameraPhotoData + '" alt="Foto prodotto">';
    resultTitle.textContent = 'Nuovo prodotto';
    resultSub.innerHTML = 'Foto manuale &bull; Inserisci i dati';

    nameInput.value = '';
    nameInput.placeholder = 'Inserisci il nome del prodotto...';

    var expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    expiryInput.value = expiry.toISOString().split('T')[0];
    qtyInput.value = '1';

    btnCamera.style.display = 'none';

    // Nascondi input manuale
    var manualDiv = document.getElementById('manual-barcode-input');
    if (manualDiv) manualDiv.style.display = 'none';

    document.getElementById('scan-result').classList.add('show');
    showToast('&#128247; Foto caricata! Inserisci il nome del prodotto');
  };

  if (file.size > 500 * 1024) {
    compressImage(file, 500, processPhoto);
  } else {
    var reader = new FileReader();
    reader.onload = function(e) { processPhoto(e.target.result); };
    reader.readAsDataURL(file);
  }

  event.target.value = '';
}

function onBarcodeDetected(barcode) {
  if (!isScanning) return;
  console.log('Barcode rilevato:', barcode);
  showToast('Barcode rilevato: ' + barcode);
  BarcodeScanner.stop();
  processBarcode(barcode);
}

function processBarcode(barcode) {
  document.getElementById('api-loading').style.display = 'block';

  OpenFoodFacts.search(barcode)
    .then(function(result) {
      document.getElementById('api-loading').style.display = 'none';
      if (result.found && result.product) {
        showProductFound(result.product);
      } else {
        showProductNotFound(barcode);
      }
    });
}

function showProductFound(product) {
  var category = OpenFoodFacts.detectCategory(product);
  var emoji = OpenFoodFacts.getCategoryEmoji(category);

  scannedProductData = {
    name: product.name, emoji: emoji, category: category,
    brand: product.brand, quantity: product.quantity,
    ingredients: product.ingredients, nutriscore: product.nutriscore,
    novaGroup: product.novaGroup, nutriments: product.nutriments,
    servingSize: product.servingSize, barcode: product.barcode
  };

  currentBarcode = product.barcode;
  currentImageUrl = product.imageUrl || product.imageFrontUrl || null;

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

  if (currentImageUrl) {
    resultImg.innerHTML = '<img src="' + currentImageUrl + '" alt="' + product.name + '" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<span class=placeholder-text>' + emoji + '</span>\'">';
    btnCamera.style.display = 'none';
  } else {
    resultImg.innerHTML = '<span class="placeholder-text">' + emoji + '</span>';
    btnCamera.style.display = 'block';
  }

  resultTitle.textContent = product.name;
  var subText = 'EAN: ' + product.barcode;
  if (product.brand) subText += ' &bull; ' + product.brand;
  if (product.quantity) subText += ' &bull; ' + product.quantity;
  resultSub.innerHTML = subText;

  nameInput.value = product.name;

  var expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  expiryInput.value = expiry.toISOString().split('T')[0];
  qtyInput.value = '1';

  document.getElementById('scan-result').classList.add('show');
  Storage.saveProducts(products);
}

function showProductNotFound(barcode) {
  currentBarcode = barcode;
  currentImageUrl = null;

  scannedProductData = {
    name: 'Prodotto ' + barcode, emoji: '&#128230;',
    category: 'pantry', brand: '', barcode: barcode
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
  resultSub.innerHTML = 'EAN: ' + barcode + '<br>Inserisci i dati manualmente o scatta una foto';

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
  stopExpiryScan();
  terminateExpiryOCR();
  document.getElementById('scan-result').classList.remove('show');
  scannedProductData = null;
  currentBarcode = null;
  currentImageUrl = null;
  cameraPhotoData = null;

  if (isScanning && document.getElementById('screen-scanner').classList.contains('active')) {
    BarcodeScanner.start();
  }
}

// ============================================================
// FOTO CAMERA
// ============================================================
function openCamera() {
  document.getElementById('camera-input').click();
}

function handleCameraPhoto(event) {
  var file = event.target.files[0];
  if (!file) return;

  var processPhoto = function(dataUrl) {
    cameraPhotoData = dataUrl;
    var preview = document.getElementById('camera-preview');
    preview.src = cameraPhotoData;
    preview.classList.add('show');
    var resultImg = document.getElementById('result-img');
    resultImg.innerHTML = '<img src="' + cameraPhotoData + '" alt="Foto prodotto">';
    showToast('&#128247; Foto aggiunta!');
  };

  if (file.size > 500 * 1024) {
    compressImage(file, 500, processPhoto);
  } else {
    var reader = new FileReader();
    reader.onload = function(e) { processPhoto(e.target.result); };
    reader.readAsDataURL(file);
  }

  event.target.value = '';
}

function compressImage(file, maxKB, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var scale = Math.min(1, 400 / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      var quality = 0.7;
      var dataUrl;
      do {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        quality -= 0.1;
      } while (dataUrl.length > maxKB * 1024 * 1.37 && quality > 0.2);
      callback(dataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
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
    novaGroup: scannedProductData.novaGroup || '',
    nutriments: scannedProductData.nutriments || {},
    servingSize: scannedProductData.servingSize || ''
  };

  products.unshift(newProduct);
  Storage.saveProducts(products);

  closeScanResult();
  stopScanner();
  navigateTo('pantry');
  renderProducts();
  updateStats();
  renderDailyRecipes();
  showToast('&#9989; ' + name + ' aggiunto!');
}

// ============================================================
// PRODOTTI + ORDINAMENTO
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

function sortProducts(list) {
  var sorted = [];
  for (var i = 0; i < list.length; i++) sorted.push(list[i]);

  sorted.sort(function(a, b) {
    if (currentSort === 'expiry') {
      var da = getDaysUntilExpiry(a.expiryDate);
      var db = getDaysUntilExpiry(b.expiryDate);
      return da - db;
    }
    if (currentSort === 'name') {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }
    if (currentSort === 'added') {
      return new Date(b.addedAt) - new Date(a.addedAt);
    }
    if (currentSort === 'category') {
      var catA = categoryNames[a.category] || 'Altro';
      var catB = categoryNames[b.category] || 'Altro';
      if (catA !== catB) return catA.localeCompare(catB);
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }
    return 0;
  });

  return sorted;
}

function renderProducts() {
  var list = document.getElementById('products-list');
  var filtered = [];
  for (var i = 0; i < products.length; i++) filtered.push(products[i]);

  if (currentFilter !== 'all') {
    if (currentFilter === 'expiring') {
      var temp = [];
      for (var k = 0; k < filtered.length; k++) {
        if (getDaysUntilExpiry(filtered[k].expiryDate) <= 3 && getDaysUntilExpiry(filtered[k].expiryDate) >= 0) {
          temp.push(filtered[k]);
        }
      }
      filtered = temp;
    } else if (currentFilter === 'expired') {
      var tempE = [];
      for (var e = 0; e < filtered.length; e++) {
        if (getDaysUntilExpiry(filtered[e].expiryDate) < 0) tempE.push(filtered[e]);
      }
      filtered = tempE;
    } else {
      var temp2 = [];
      for (var m = 0; m < filtered.length; m++) {
        if (filtered[m].category === currentFilter) temp2.push(filtered[m]);
      }
      filtered = temp2;
    }
  }

  var searchInput = document.getElementById('searchInput');
  var searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  if (searchTerm) {
    var temp3 = [];
    for (var n = 0; n < filtered.length; n++) {
      if (filtered[n].name.toLowerCase().indexOf(searchTerm) !== -1) temp3.push(filtered[n]);
    }
    filtered = temp3;
  }

  filtered = sortProducts(filtered);

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
  var statTotal = document.getElementById('stat-total');
  var statWarning = document.getElementById('stat-warning');
  var statExpired = document.getElementById('stat-expired');

  if (statTotal) statTotal.textContent = products.length;
  var warningCount = 0;
  var expiredCount = 0;
  for (var i = 0; i < products.length; i++) {
    var d = getDaysUntilExpiry(products[i].expiryDate);
    if (d >= 0 && d <= 3) warningCount++;
    if (d < 0) expiredCount++;
  }
  if (statWarning) statWarning.textContent = warningCount;
  if (statExpired) statExpired.textContent = expiredCount;

  updateStatCardsClickHandler();
}

function updateStatCardsClickHandler() {
  var statCards = document.querySelectorAll('.stat-card');
  if (statCards.length >= 3) {
    statCards[0].onclick = function() {
      currentFilter = 'all';
      resetChips();
      renderProducts();
      showToast('&#128230; Tutti i prodotti');
    };
    statCards[0].style.cursor = 'pointer';

    statCards[1].onclick = function() {
      currentFilter = 'expiring';
      resetChips();
      var chips = document.querySelectorAll('.chip');
      for (var i = 0; i < chips.length; i++) {
        if (chips[i].getAttribute('data-cat') === 'expiring') chips[i].classList.add('active');
      }
      renderProducts();
      showToast('&#9200; Prodotti in scadenza');
    };
    statCards[1].style.cursor = 'pointer';

    statCards[2].onclick = function() {
      currentFilter = 'expired';
      resetChips();
      renderProducts();
      showToast('&#9940; Prodotti scaduti');
    };
    statCards[2].style.cursor = 'pointer';
  }
}

function resetChips() {
  var chips = document.querySelectorAll('.chip');
  for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
}

function filterProducts(category, chip) {
  currentFilter = category;
  resetChips();
  chip.classList.add('active');
  renderProducts();
}

// ============================================================
// MODAL ORDINAMENTO
// ============================================================
function openSortModal() {
  // Aggiorna stato visivo
  var options = ['expiry', 'name', 'added', 'category'];
  for (var i = 0; i < options.length; i++) {
    var opt = document.getElementById('sort-' + options[i]);
    var check = document.getElementById('check-' + options[i]);
    if (opt && check) {
      if (currentSort === options[i]) {
        opt.classList.add('active');
        check.classList.remove('hidden');
      } else {
        opt.classList.remove('active');
        check.classList.add('hidden');
      }
    }
  }
  document.getElementById('sort-modal').classList.add('show');
}

function closeSortModal(e) {
  if (e.target === e.currentTarget) {
    document.getElementById('sort-modal').classList.remove('show');
  }
}

function closeSortModalDirect() {
  document.getElementById('sort-modal').classList.remove('show');
}

function setSort(criteria) {
  currentSort = criteria;
  renderProducts();
  closeSortModalDirect();

  var labels = {
    expiry: '&#9200; Ordinato per scadenza',
    name: '&#128218; Ordinato per nome',
    added: '&#128197; Ordinato per data inserimento',
    category: '&#128451; Ordinato per categoria'
  };
  showToast(labels[criteria] || 'Ordinamento aggiornato');
}

// ============================================================
// MODAL PRODOTTO + INFO (dettagli API)
// ============================================================
function openProductModal(id) {
  selectedProductId = id;
  var product = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === id) { product = products[i]; break; }
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

  detailsHtml += '<div class="detail-row"><span class="detail-label">Aggiunto il</span><span class="detail-value">' + formatDate(product.addedAt) + '</span></div>';

  document.getElementById('modal-details').innerHTML = detailsHtml;

  // Salva prodotto corrente per il tasto INFO
  window.currentModalProduct = product;

  document.getElementById('product-modal').classList.add('show');
}

function closeProductModal(e) {
  if (e.target === e.currentTarget) {
    document.getElementById('product-modal').classList.remove('show');
    selectedProductId = null;
    window.currentModalProduct = null;
  }
}

function deleteProduct() {
  if (selectedProductId === null) return;
  var p = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === selectedProductId) { p = products[i]; break; }
  }

  Storage.deleteRecipes(selectedProductId);

  var newProducts = [];
  for (var j = 0; j < products.length; j++) {
    if (products[j].id !== selectedProductId) newProducts.push(products[j]);
  }
  products = newProducts;
  Storage.saveProducts(products);
  document.getElementById('product-modal').classList.remove('show');
  renderProducts();
  updateStats();
  renderDailyRecipes();
  cleanupRecipes();
  showToast('&#128465; ' + (p ? p.name : 'Prodotto') + ' rimosso');
  selectedProductId = null;
  window.currentModalProduct = null;
}

function consumeProduct() {
  if (selectedProductId === null) return;
  var p = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === selectedProductId) { p = products[i]; break; }
  }
  if (p) {
    shoppingList.push({ id: nextListId++, name: p.name, checked: false, reason: 'Consumato' });
    Storage.saveShoppingList(shoppingList);
  }

  Storage.deleteRecipes(selectedProductId);

  var newProducts = [];
  for (var j = 0; j < products.length; j++) {
    if (products[j].id !== selectedProductId) newProducts.push(products[j]);
  }
  products = newProducts;
  Storage.saveProducts(products);

  document.getElementById('product-modal').classList.remove('show');
  renderProducts();
  updateStats();
  renderDailyRecipes();
  showToast('&#128722; ' + (p ? p.name : 'Prodotto') + ' consumato e aggiunto alla lista');
  selectedProductId = null;
  window.currentModalProduct = null;
}

/**
 * NUOVO: Apre modal INFO con tutti i dettagli API del prodotto
 */
function openProductInfo() {
  var product = window.currentModalProduct;
  if (!product) return;

  // Chiudi modal prodotto principale
  document.getElementById('product-modal').classList.remove('show');

  var infoImg = document.getElementById('info-img');
  if (product.imageUrl) {
    infoImg.innerHTML = '<img src="' + product.imageUrl + '" alt="' + product.name + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\';this.parentElement.textContent=\'' + (product.emoji || '&#128230;') + '\'">';
  } else {
    infoImg.textContent = product.emoji || '&#128230;';
  }

  document.getElementById('info-title').textContent = product.name;
  document.getElementById('info-sub').textContent = product.barcode ? 'EAN: ' + product.barcode : 'Prodotto inserito manualmente';

  var bodyHtml = '';

  // Immagini multiple se disponibili
  if (product.imageFrontUrl || product.imageIngredientsUrl || product.imageNutritionUrl) {
    bodyHtml += '<div class="info-section">' +
      '<div class="info-section-title">&#128247; Immagini</div>' +
      '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">';
    if (product.imageFrontUrl) {
      bodyHtml += '<img src="' + product.imageFrontUrl + '" style="width:100px;height:100px;object-fit:cover;border-radius:12px;flex-shrink:0;" alt="Fronte">';
    }
    if (product.imageIngredientsUrl) {
      bodyHtml += '<img src="' + product.imageIngredientsUrl + '" style="width:100px;height:100px;object-fit:cover;border-radius:12px;flex-shrink:0;" alt="Ingredienti">';
    }
    if (product.imageNutritionUrl) {
      bodyHtml += '<img src="' + product.imageNutritionUrl + '" style="width:100px;height:100px;object-fit:cover;border-radius:12px;flex-shrink:0;" alt="Nutrizione">';
    }
    bodyHtml += '</div></div>';
  }

  // Ingredienti
  if (product.ingredients) {
    bodyHtml += '<div class="info-section">' +
      '<div class="info-section-title">&#129379; Ingredienti</div>' +
      '<div style="font-size:14px;color:var(--text-primary);line-height:1.6;">' + product.ingredients + '</div>' +
      '</div>';
  }

  // Valori nutrizionali
  if (product.nutriments && Object.keys(product.nutriments).length > 0) {
    bodyHtml += '<div class="info-section">' +
      '<div class="info-section-title">&#127789; Valori Nutrizionali (per 100g)</div>' +
      '<div class="nutri-grid">';

    var nutriLabels = {
      energyKcal: 'Energia (kcal)', energyKj: 'Energia (kJ)',
      fat: 'Grassi', saturatedFat: 'Grassi saturi',
      carbohydrates: 'Carboidrati', sugars: 'Zuccheri',
      proteins: 'Proteine', salt: 'Sale', fiber: 'Fibre'
    };

    for (var key in product.nutriments) {
      var val = product.nutriments[key];
      if (val !== '' && val !== null && val !== undefined) {
        bodyHtml += '<div class="nutri-item">' +
          '<div class="nutri-label">' + (nutriLabels[key] || key) + '</div>' +
          '<div class="nutri-value">' + val + '</div>' +
          '</div>';
      }
    }
    bodyHtml += '</div></div>';
  }

  // Nutri-Score
  if (product.nutriscore) {
    var scoreColors = { a: '#038141', b: '#85BB2F', c: '#FECB02', d: '#EE8100', e: '#E63E11' };
    var scoreColor = scoreColors[product.nutriscore.toLowerCase()] || 'var(--text-muted)';
    bodyHtml += '<div class="info-section">' +
      '<div class="info-section-title">&#127941; Nutri-Score</div>' +
      '<div style="display:flex;gap:4px;">';
    var scores = ['A', 'B', 'C', 'D', 'E'];
    for (var s = 0; s < scores.length; s++) {
      var isActive = scores[s].toLowerCase() === product.nutriscore.toLowerCase();
      bodyHtml += '<div style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:white;' +
        (isActive ? 'background:' + scoreColor + ';transform:scale(1.15);box-shadow:0 2px 8px rgba(0,0,0,0.2);' : 'background:#ddd;opacity:0.5;') + '">' +
        scores[s] + '</div>';
    }
    bodyHtml += '</div></div>';
  }

  // Nova Group
  if (product.novaGroup) {
    var novaColors = { 1: '#00AA00', 2: '#FFCC00', 3: '#FF6600', 4: '#FF0000' };
    var novaColor = novaColors[product.novaGroup] || 'var(--text-muted)';
    var novaLabels = { 1: 'Alimenti non trasformati', 2: 'Ingredienti culinari', 3: 'Alimenti trasformati', 4: 'Prodotti ultra-trasformati' };
    bodyHtml += '<div class="info-section">' +
      '<div class="info-section-title">&#127919; Gruppo NOVA</div>' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div style="width:40px;height:40px;border-radius:50%;background:' + novaColor + ';color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;">' + product.novaGroup + '</div>' +
        '<div style="font-size:13px;color:var(--text-secondary);font-weight:600;">' + (novaLabels[product.novaGroup] || 'Gruppo ' + product.novaGroup) + '</div>' +
      '</div></div>';
  }

  // Porzione
  if (product.servingSize) {
    bodyHtml += '<div class="info-section">' +
      '<div class="info-section-title">&#129379; Porzione</div>' +
      '<div style="font-size:14px;color:var(--text-primary);font-weight:600;">' + product.servingSize + '</div>' +
      '</div>';
  }

  document.getElementById('info-body').innerHTML = bodyHtml;
  document.getElementById('info-modal').classList.add('show');
}

function closeInfoModal(e) {
  if (e.target === e.currentTarget) {
    document.getElementById('info-modal').classList.remove('show');
  }
}

function closeInfoModalDirect() {
  document.getElementById('info-modal').classList.remove('show');
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

  var progressText = document.getElementById('progress-text');
  var progressPct = document.getElementById('progress-pct');
  var progressBar = document.getElementById('progress-bar');

  if (progressText) progressText.textContent = checked + '/' + total + ' completati';
  if (progressPct) progressPct.textContent = pct + '%';
  if (progressBar) progressBar.style.width = pct + '%';

  if (total === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#128722;</div><div class="empty-state-title">Lista vuota</div><div class="empty-state-desc">I prodotti consumati o scaduti appariranno qui automaticamente.</div></div>';
    return;
  }

  var html = '';
  for (var idx = 0; idx < shoppingList.length; idx++) {
    var item = shoppingList[idx];
    var reasonEmoji = item.reason === 'Scaduto' ? '&#9940;' : (item.reason === 'Consumato' ? '&#9989;' : '&#129302;');
    html += '<div class="list-item" style="animation-delay:' + (idx * 0.03) + 's">' +
      '<div class="checkbox ' + (item.checked ? 'checked' : '') + '" onclick="toggleCheck(' + item.id + ')"></div>' +
      '<div style="flex:1">' +
        '<div class="list-item-text ' + (item.checked ? 'checked' : '') + '">' + item.name + '</div>' +
        '<div class="list-item-reason">' + reasonEmoji + ' ' + item.reason + '</div>' +
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
  shoppingList.push({ id: nextListId++, name: name, checked: false, reason: 'Aggiunto manualmente' });
  input.value = '';
  Storage.saveShoppingList(shoppingList);
  renderShoppingList();
  showToast('&#9989; ' + name + ' aggiunto');
}

// ============================================================
// RICETTE (LEGACY)
// ============================================================
function loadRecipesForProduct() {
  var recipeSection = document.getElementById('recipe-section');
  if (recipeSection) recipeSection.style.display = 'none';
}
function renderRecipes(recipes, product) {}
function openRecipeDetail(recipeIndex) {}

function closeRecipeDetailModal(e) {
  if (e.target === e.currentTarget) {
    document.getElementById('recipe-detail-modal').classList.remove('show');
    currentRecipeProductId = null;
  }
}

function closeRecipeDetailModalDirect() {
  document.getElementById('recipe-detail-modal').classList.remove('show');
  currentRecipeProductId = null;
}

function deleteProductRecipes(productId) {
  Storage.deleteRecipes(productId);
}

function cleanupRecipes() {
  var ids = [];
  for (var i = 0; i < products.length; i++) ids.push(products[i].id);
  var removed = Storage.cleanupOrphanRecipes(ids);
  if (removed > 0) console.log('Pulite ' + removed + ' ricette orfane');
}

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

function toggleTorch() {
  Camera.toggleTorch()
    .then(function(on) {
      showToast(on ? '&#128294; Torcia ON' : '&#128294; Torcia OFF');
    })
    .catch(function(err) {
      showToast('Torcia non supportata');
    });
}

function captureBarcode() {
  var frameData = BarcodeScanner.scanFrame();
  if (frameData) {
    showToast('&#128247; Frame catturato, analisi...');
  } else {
    showManualBarcodeAndPhotoInput();
  }
}
// ============================================================
// RILEVAMENTO DATA SCADENZA - SCANSIONE CONTINUA AVANZATA
// Tesseract.js + Puter.js fallback + preprocessing avanzato
// ============================================================
var expiryOCRWorker = null;
var detectedExpiryDate = null;
var detectedExpiryConfidence = 0;
var expiryPhotoData = null;
var expiryCameraStream = null;
var expiryScanInterval = null;
var isExpiryScanning = false;
var lastOCRTime = 0;
var ocrAttemptCount = 0;
var maxOCRAttempts = 30; // ~18 secondi di scansione

/**
 * Inizializza il worker Tesseract.js
 */
function initExpiryOCR() {
  if (expiryOCRWorker) return Promise.resolve();
  
  return new Promise(function(resolve, reject) {
    if (typeof Tesseract === 'undefined') {
      reject(new Error('Tesseract.js non caricato'));
      return;
    }
    
    Tesseract.createWorker('eng')
      .then(function(worker) {
        expiryOCRWorker = worker;
        console.log('Tesseract.js worker pronto');
        resolve();
      })
      .catch(function(err) {
        console.error('Errore inizializzazione Tesseract:', err);
        reject(err);
      });
  });
}

/**
 * Preprocessing avanzato dell'immagine per OCR
 * Applica: grayscale, contrast stretching, adaptive threshold, denoise
 */
function preprocessForOCR(sourceCanvas) {
  var w = sourceCanvas.width;
  var h = sourceCanvas.height;
  
  // Canvas temporaneo per processing
  var canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);
  
  var imgData = ctx.getImageData(0, 0, w, h);
  var data = imgData.data;
  var len = data.length;
  
  // Step 1: Grayscale
  for (var i = 0; i < len; i += 4) {
    var gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    data[i] = data[i+1] = data[i+2] = gray;
  }
  
  // Step 2: Contrast stretching (auto-level)
  var minVal = 255, maxVal = 0;
  for (var j = 0; j < len; j += 4) {
    if (data[j] < minVal) minVal = data[j];
    if (data[j] > maxVal) maxVal = data[j];
  }
  
  var range = maxVal - minVal;
  if (range < 1) range = 1;
  
  for (var k = 0; k < len; k += 4) {
    var stretched = ((data[k] - minVal) / range) * 255;
    data[k] = data[k+1] = data[k+2] = stretched;
  }
  
  // Step 3: Sharpen (unsharp mask semplificato)
  var tempData = new Uint8ClampedArray(data);
  var sharpened = new Uint8ClampedArray(data);
  
  for (var y = 1; y < h - 1; y++) {
    for (var x = 1; x < w - 1; x++) {
      var idx = (y * w + x) * 4;
      var center = tempData[idx];
      var neighbors = (
        tempData[((y-1) * w + (x-1)) * 4] +
        tempData[((y-1) * w + x) * 4] +
        tempData[((y-1) * w + (x+1)) * 4] +
        tempData[(y * w + (x-1)) * 4] +
        tempData[(y * w + (x+1)) * 4] +
        tempData[((y+1) * w + (x-1)) * 4] +
        tempData[((y+1) * w + x) * 4] +
        tempData[((y+1) * w + (x+1)) * 4]
      ) / 8;
      
      var sharpenedVal = center + (center - neighbors) * 1.5;
      sharpenedVal = Math.max(0, Math.min(255, sharpenedVal));
      sharpened[idx] = sharpened[idx+1] = sharpened[idx+2] = sharpenedVal;
    }
  }
  
  // Step 4: Adaptive threshold (soglia locale)
  var blockSize = 15;
  var c = 10;
  var integral = new Int32Array(w * h);
  
  // Calcola immagine integrale
  for (var y = 0; y < h; y++) {
    var sum = 0;
    for (var x = 0; x < w; x++) {
      sum += sharpened[(y * w + x) * 4];
      if (y === 0) {
        integral[y * w + x] = sum;
      } else {
        integral[y * w + x] = integral[(y-1) * w + x] + sum;
      }
    }
  }
  
  // Applica threshold adattivo
  for (var y = 0; y < h; y++) {
    var y1 = Math.max(0, y - Math.floor(blockSize/2));
    var y2 = Math.min(h - 1, y + Math.floor(blockSize/2));
    var rowCount = y2 - y1 + 1;
    
    for (var x = 0; x < w; x++) {
      var x1 = Math.max(0, x - Math.floor(blockSize/2));
      var x2 = Math.min(w - 1, x + Math.floor(blockSize/2));
      var colCount = x2 - x1 + 1;
      var count = rowCount * colCount;
      
      var sum = integral[y2 * w + x2];
      if (y1 > 0) sum -= integral[(y1-1) * w + x2];
      if (x1 > 0) sum -= integral[y2 * w + (x1-1)];
      if (y1 > 0 && x1 > 0) sum += integral[(y1-1) * w + (x1-1)];
      
      var threshold = (sum / count) - c;
      var idx = (y * w + x) * 4;
      var val = sharpened[idx] < threshold ? 0 : 255;
      data[idx] = data[idx+1] = data[idx+2] = val;
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Avvia la scansione continua della data
 */
function scanExpiryDate() {
  var btn = document.getElementById('btn-scan-expiry');
  var statusDiv = document.getElementById('expiry-scan-status');
  
  btn.disabled = true;
  statusDiv.style.display = 'block';
  
  showToast('&#128247; Avvio scansione data... Inquadra la data');
  
  var video = document.getElementById('expiry-camera-video');
  
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('&#10060; Fotocamera non supportata');
    btn.disabled = false;
    statusDiv.style.display = 'none';
    return;
  }
  
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  })
  .then(function(stream) {
    expiryCameraStream = stream;
    video.srcObject = stream;
    video.style.display = 'block';
    
    document.getElementById('expiry-camera-overlay').classList.add('active');
    
    btn.disabled = false;
    statusDiv.style.display = 'none';
    
    isExpiryScanning = true;
    ocrAttemptCount = 0;
    startContinuousExpiryScan();
  })
  .catch(function(err) {
    console.error('Errore fotocamera data:', err);
    showToast('&#10060; Errore fotocamera: ' + err.message);
    btn.disabled = false;
    statusDiv.style.display = 'none';
  });
}

/**
 * Avvia loop scansione continua
 */
function startContinuousExpiryScan() {
  if (!isExpiryScanning) return;
  
  initExpiryOCR()
    .then(function() {
      expiryScanInterval = setInterval(analyzeExpiryFrame, 500);
      showToast('&#128247; Inquadra la data... Rilevamento automatico');
    })
    .catch(function(err) {
      // Fallback a Puter.js se Tesseract non funziona
      if (typeof puter !== 'undefined') {
        showToast('&#128247; Uso OCR avanzato...');
        expiryScanInterval = setInterval(analyzeExpiryFramePuter, 800);
      } else {
        showToast('&#10060; OCR non disponibile');
        closeExpiryCamera();
      }
    });
}

/**
 * Analizza frame con Tesseract.js + preprocessing avanzato
 */
function analyzeExpiryFrame() {
  if (!isExpiryScanning) return;
  
  var now = Date.now();
  if (now - lastOCRTime < 400) return;
  lastOCRTime = now;
  
  ocrAttemptCount++;
  
  // Timeout dopo troppi tentativi
  if (ocrAttemptCount > maxOCRAttempts) {
    stopExpiryScan();
    showToast('&#128533; Data non rilevata, prova con piu luce o inserisci manualmente');
    closeExpiryCamera();
    return;
  }
  
  var video = document.getElementById('expiry-camera-video');
  if (!video || !video.videoWidth) return;
  
  var statusDiv = document.getElementById('expiry-camera-status');
  if (statusDiv) statusDiv.textContent = 'Tentativo ' + ocrAttemptCount + '/' + maxOCRAttempts;
  
  // Cattura frame
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Salva preview
  expiryPhotoData = canvas.toDataURL('image/jpeg', 0.9);
  
  // Ritaglia zona data (area centrale)
  var cropCanvas = document.createElement('canvas');
  var cropCtx = cropCanvas.getContext('2d');
  var cropX = canvas.width * 0.05;
  var cropY = canvas.height * 0.25;
  var cropW = canvas.width * 0.9;
  var cropH = canvas.height * 0.5;
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  
  // Preprocessing avanzato
  var processedCanvas = preprocessForOCR(cropCanvas);
  
  // Ridimensiona per OCR (Tesseract funziona meglio a 300 DPI ~)
  var finalCanvas = document.createElement('canvas');
  var finalCtx = finalCanvas.getContext('2d');
  var scale = 2;
  finalCanvas.width = processedCanvas.width * scale;
  finalCanvas.height = processedCanvas.height * scale;
  finalCtx.imageSmoothingEnabled = false;
  finalCtx.drawImage(processedCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
  
  var ocrImageData = finalCanvas.toDataURL('image/jpeg', 0.95);
  
  // OCR con Tesseract
  expiryOCRWorker.recognize(ocrImageData, {}, { 
    tessedit_char_whitelist: '0123456789/.-',
    psm: 6
  })
    .then(function(result) {
      if (!isExpiryScanning) return;
      
      var text = result.data.text.trim();
      var confidence = result.data.confidence || 0;
      
      console.log('OCR attempt', ocrAttemptCount, 'text:', text, 'conf:', confidence);
      
      if (statusDiv) statusDiv.textContent = 'Confidenza: ' + Math.round(confidence) + '%';
      
      var date = extractDateFromText(text);
      
      if (date && confidence > 30) {
        stopExpiryScan();
        closeExpiryCamera();
        detectedExpiryDate = date;
        detectedExpiryConfidence = confidence;
        showExpiryConfirmModal(expiryPhotoData, date, confidence);
      }
    })
    .catch(function(err) {
      console.error('Errore OCR frame:', err);
    });
}

/**
 * Fallback: Analizza frame con Puter.js (OCR AI gratuito)
 */
function analyzeExpiryFramePuter() {
  if (!isExpiryScanning || typeof puter === 'undefined') return;
  
  var now = Date.now();
  if (now - lastOCRTime < 700) return;
  lastOCRTime = now;
  
  ocrAttemptCount++;
  if (ocrAttemptCount > 20) {
    stopExpiryScan();
    showToast('&#128533; Data non rilevata con OCR AI');
    closeExpiryCamera();
    return;
  }
  
  var video = document.getElementById('expiry-camera-video');
  if (!video || !video.videoWidth) return;
  
  var statusDiv = document.getElementById('expiry-camera-status');
  if (statusDiv) statusDiv.textContent = 'OCR AI... ' + ocrAttemptCount + '/20';
  
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  expiryPhotoData = canvas.toDataURL('image/jpeg', 0.9);
  
  // Ritaglio zona data
  var cropCanvas = document.createElement('canvas');
  var cropCtx = cropCanvas.getContext('2d');
  var cropX = canvas.width * 0.05;
  var cropY = canvas.height * 0.25;
  var cropW = canvas.width * 0.9;
  var cropH = canvas.height * 0.5;
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  
  var imageData = cropCanvas.toDataURL('image/jpeg', 0.9);
  
  puter.ai.img2txt(imageData)
    .then(function(text) {
      if (!isExpiryScanning) return;
      
      console.log('Puter OCR text:', text);
      
      var date = extractDateFromText(text);
      
      if (date) {
        stopExpiryScan();
        closeExpiryCamera();
        detectedExpiryDate = date;
        detectedExpiryConfidence = 85; // Puter è generalmente accurato
        showExpiryConfirmModal(expiryPhotoData, date, 85);
      }
    })
    .catch(function(err) {
      console.error('Puter OCR error:', err);
    });
}

/**
 * Ferma la scansione
 */
function stopExpiryScan() {
  isExpiryScanning = false;
  if (expiryScanInterval) {
    clearInterval(expiryScanInterval);
    expiryScanInterval = null;
  }
}

/**
 * Chiude la fotocamera data
 */
function closeExpiryCamera() {
  stopExpiryScan();
  
  var overlay = document.getElementById('expiry-camera-overlay');
  var video = document.getElementById('expiry-camera-video');
  
  overlay.classList.remove('active');
  
  if (expiryCameraStream) {
    expiryCameraStream.getTracks().forEach(function(track) { track.stop(); });
    expiryCameraStream = null;
  }
  
  video.srcObject = null;
  video.style.display = 'none';
  
  document.getElementById('expiry-ocr-loading').classList.remove('active');
}

/**
 * Estrae data dal testo OCR
 */
function extractDateFromText(text) {
  if (!text) return null;
  
  var clean = text.replace(/\s+/g, ' ').trim();
  
  // Pattern migliorati per date su imballaggi
  var patterns = [
    // DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY
    { regex: /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/, format: 'DMY' },
    // YYYY/MM/DD o YYYY-MM-DD
    { regex: /(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/, format: 'YMD' },
    // DD/MM/YY o DD-MM-YY
    { regex: /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2})/, format: 'DMY_SHORT' },
    // Formati con parole: 15 AGO 2026, 15 AGOSTO 2026
    { regex: /(\d{1,2})\s+(GEN|FEB|MAR|APR|MAG|GIU|LUG|AGO|SET|OTT|NOV|DIC)[A-Z]*\s+(\d{4})/i, format: 'DMY_WORD' },
    // EXP 15/08/2026, SCAD 15-08-2026
    { regex: /(?:EXP|SCAD|SCADENZA|BB|BEST BEFORE|USE BY)[^\d]*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})/i, format: 'DMY' },
    // 20260815 (formato compatto)
    { regex: /[^\d](20\d{2})(\d{2})(\d{2})[^\d]/, format: 'YMD_COMPACT' }
  ];
  
  var monthNames = {
    'gen': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'mag': 5, 'giu': 6,
    'lug': 7, 'ago': 8, 'set': 9, 'ott': 10, 'nov': 11, 'dic': 12
  };
  
  for (var i = 0; i < patterns.length; i++) {
    var match = clean.match(patterns[i].regex);
    if (match) {
      var d, m, y;
      
      if (patterns[i].format === 'DMY' || patterns[i].format === 'DMY_SHORT') {
        d = parseInt(match[1], 10);
        m = parseInt(match[2], 10);
        y = parseInt(match[3], 10);
        if (patterns[i].format === 'DMY_SHORT') y += 2000;
      } else if (patterns[i].format === 'YMD') {
        y = parseInt(match[1], 10);
        m = parseInt(match[2], 10);
        d = parseInt(match[3], 10);
      } else if (patterns[i].format === 'YMD_COMPACT') {
        y = parseInt(match[1], 10);
        m = parseInt(match[2], 10);
        d = parseInt(match[3], 10);
      } else if (patterns[i].format === 'DMY_WORD') {
        d = parseInt(match[1], 10);
        var monthStr = match[2].toLowerCase().substring(0, 3);
        m = monthNames[monthStr] || 0;
        y = parseInt(match[3], 10);
      }
      
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2020 && y <= 2040) {
        var yy = String(y);
        var mm = String(m).padStart(2, '0');
        var dd = String(d).padStart(2, '0');
        return yy + '-' + mm + '-' + dd;
      }
    }
  }
  
  return null;
}

/**
 * Mostra modal conferma
 */
function showExpiryConfirmModal(previewUrl, dateStr, confidence) {
  var previewDiv = document.getElementById('expiry-preview-img');
  var valueDiv = document.getElementById('expiry-detected-value');
  var confDiv = document.getElementById('expiry-detected-confidence');
  
  previewDiv.innerHTML = '<img src="' + previewUrl + '" alt="Frame data scadenza">';
  
  var parts = dateStr.split('-');
  var displayDate = parts[2] + '/' + parts[1] + '/' + parts[0];
  valueDiv.textContent = displayDate;
  valueDiv.style.color = 'var(--primary)';
  confDiv.textContent = 'Confidenza: ' + Math.round(confidence) + '%';
  confDiv.style.display = 'block';
  
  document.getElementById('expiry-confirm-modal').classList.add('show');
}

/**
 * Chiude modal
 */
function closeExpiryConfirmModal(e) {
  if (e.target === e.currentTarget) {
    document.getElementById('expiry-confirm-modal').classList.remove('show');
    detectedExpiryDate = null;
    detectedExpiryConfidence = 0;
    expiryPhotoData = null;
  }
}

/**
 * Accetta data
 */
function acceptDetectedExpiry() {
  if (detectedExpiryDate) {
    document.getElementById('expiry-input').value = detectedExpiryDate;
    showToast('&#9989; Data scadenza inserita: ' + formatDate(detectedExpiryDate));
  }
  document.getElementById('expiry-confirm-modal').classList.remove('show');
  detectedExpiryDate = null;
  detectedExpiryConfidence = 0;
  expiryPhotoData = null;
}

/**
 * Modifica
 */
function editDetectedExpiry() {
  document.getElementById('expiry-confirm-modal').classList.remove('show');
  
  if (detectedExpiryDate) {
    document.getElementById('expiry-input').value = detectedExpiryDate;
  }
  
  setTimeout(function() {
    document.getElementById('expiry-input').focus();
    showToast('&#9998; Modifica la data e premi Aggiungi');
  }, 300);
  
  detectedExpiryDate = null;
  detectedExpiryConfidence = 0;
  expiryPhotoData = null;
}

/**
 * Ignora
 */
function rejectDetectedExpiry() {
  document.getElementById('expiry-confirm-modal').classList.remove('show');
  detectedExpiryDate = null;
  detectedExpiryConfidence = 0;
  expiryPhotoData = null;
  showToast('&#10060; Data ignorata, inseriscila manualmente');
}

/**
 * Termina worker
 */
function terminateExpiryOCR() {
  if (expiryOCRWorker) {
    expiryOCRWorker.terminate();
    expiryOCRWorker = null;
  }
}
// ============================================================
// RILEVAMENTO DATA SCADENZA - OCR.space API + fallback
// ============================================================
var detectedExpiryDate = null;
var detectedExpiryConfidence = 0;
var expiryPhotoData = null;
var expiryCameraStream = null;

// API key OCR.space - usa "helloworld" per test, poi registra su ocr.space per 25.000/mese
var OCR_SPACE_API_KEY = 'helloworld';

/**
 * Avvia fotocamera per scattare foto alla data
 */
function scanExpiryDate() {
  var btn = document.getElementById('btn-scan-expiry');
  var statusDiv = document.getElementById('expiry-scan-status');
  
  btn.disabled = true;
  statusDiv.style.display = 'block';
  
  showToast('&#128247; Avvio fotocamera per data...');
  
  var video = document.getElementById('expiry-camera-video');
  
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('&#10060; Fotocamera non supportata');
    btn.disabled = false;
    statusDiv.style.display = 'none';
    return;
  }
  
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  })
  .then(function(stream) {
    expiryCameraStream = stream;
    video.srcObject = stream;
    video.style.display = 'block';
    document.getElementById('expiry-camera-overlay').classList.add('active');
    btn.disabled = false;
    statusDiv.style.display = 'none';
  })
  .catch(function(err) {
    console.error('Errore fotocamera:', err);
    showToast('&#10060; Errore: ' + err.message);
    btn.disabled = false;
    statusDiv.style.display = 'none';
  });
}

/**
 * Cattura foto e analizza con OCR.space
 */
function captureExpiryPhoto() {
  var video = document.getElementById('expiry-camera-video');
  if (!video || !video.videoWidth) return;
  
  // Mostra loading
  document.getElementById('expiry-ocr-loading').classList.add('active');
  document.getElementById('expiry-camera-status').textContent = 'Analizzo...';
  
  // Cattura frame
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Salva preview
  expiryPhotoData = canvas.toDataURL('image/jpeg', 0.9);
  
  // Chiudi camera
  closeExpiryCamera();
  
  // Ritaglia zona data (area centrale dove c'è la cornice)
  var cropCanvas = document.createElement('canvas');
  var cropCtx = cropCanvas.getContext('2d');
  var cropX = canvas.width * 0.1;
  var cropY = canvas.height * 0.3;
  var cropW = canvas.width * 0.8;
  var cropH = canvas.height * 0.4;
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  
  // Converti a blob per upload
  cropCanvas.toBlob(function(blob) {
    // Chiama OCR.space API
    callOCRSpace(blob);
  }, 'image/jpeg', 0.95);
}

/**
 * Chiama OCR.space API
 */
function callOCRSpace(imageBlob) {
  var formData = new FormData();
  formData.append('file', imageBlob, 'expiry.jpg');
  formData.append('apikey', OCR_SPACE_API_KEY);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2'); // Engine 2 = più accurato per numeri
  
  fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData
  })
  .then(function(response) {
    return response.json();
  })
  .then(function(data) {
    document.getElementById('expiry-ocr-loading').classList.remove('active');
    
    console.log('OCR.space response:', data);
    
    if (data.IsErroredOnProcessing) {
      showToast('&#10060; Errore OCR: ' + (data.ErrorMessage || 'Sconosciuto'));
      // Prova con Tesseract locale come fallback
      fallbackTesseractOCR();
      return;
    }
    
    if (!data.ParsedResults || data.ParsedResults.length === 0) {
      showToast('&#128533; Nessun testo rilevato, riprova');
      return;
    }
    
    var text = data.ParsedResults[0].ParsedText || '';
    var confidence = data.ParsedResults[0].TextOverlay ? 
      (data.ParsedResults[0].TextOverlay.HasOverlay ? 80 : 50) : 50;
    
    console.log('OCR text:', text);
    
    var date = extractDateFromText(text);
    
    if (date) {
      detectedExpiryDate = date;
      detectedExpiryConfidence = confidence;
      showExpiryConfirmModal(expiryPhotoData, date, confidence);
    } else {
      showToast('&#128533; Data non trovata nel testo: \"' + text.substring(0, 50) + '\"');
      // Mostra comunque il modal con possibilità di riprovare
      showExpiryConfirmModal(expiryPhotoData, null, 0);
    }
  })
  .catch(function(err) {
    console.error('Errore OCR.space:', err);
    document.getElementById('expiry-ocr-loading').classList.remove('active');
    showToast('&#10060; Errore rete, provo OCR locale...');
    fallbackTesseractOCR();
  });
}

/**
 * Fallback con Tesseract.js locale
 */
function fallbackTesseractOCR() {
  if (typeof Tesseract === 'undefined') {
    showToast('&#10060; OCR non disponibile, inserisci manualmente');
    return;
  }
  
  showToast('&#128247; Uso OCR locale...');
  
  Tesseract.recognize(
    expiryPhotoData,
    'eng',
    { 
      tessedit_char_whitelist: '0123456789/.-',
      psm: 6
    }
  ).then(function(result) {
    var text = result.data.text.trim();
    var confidence = result.data.confidence || 0;
    
    console.log('Tesseract fallback:', text, confidence);
    
    var date = extractDateFromText(text);
    
    if (date && confidence > 30) {
      detectedExpiryDate = date;
      detectedExpiryConfidence = confidence;
      showExpiryConfirmModal(expiryPhotoData, date, confidence);
    } else {
      showToast('&#128533; Data non rilevata, inserisci manualmente');
    }
  }).catch(function(err) {
    console.error('Tesseract error:', err);
    showToast('&#10060; OCR fallito, inserisci manualmente');
  });
}

/**
 * Chiude la fotocamera data
 */
function closeExpiryCamera() {
  var overlay = document.getElementById('expiry-camera-overlay');
  var video = document.getElementById('expiry-camera-video');
  
  overlay.classList.remove('active');
  
  if (expiryCameraStream) {
    expiryCameraStream.getTracks().forEach(function(track) { track.stop(); });
    expiryCameraStream = null;
  }
  
  video.srcObject = null;
  video.style.display = 'none';
  
  document.getElementById('expiry-ocr-loading').classList.remove('active');
}

/**
 * Estrae data dal testo OCR
 */
function extractDateFromText(text) {
  if (!text) return null;
  
  var clean = text.replace(/\s+/g, ' ').trim();
  
  var patterns = [
    // DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY
    { regex: /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/, format: 'DMY' },
    // YYYY/MM/DD o YYYY-MM-DD
    { regex: /(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/, format: 'YMD' },
    // DD/MM/YY o DD-MM-YY
    { regex: /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2})/, format: 'DMY_SHORT' },
    // Formati con parole: 15 AGO 2026
    { regex: /(\d{1,2})\s+(GEN|FEB|MAR|APR|MAG|GIU|LUG|AGO|SET|OTT|NOV|DIC)[A-Z]*\s+(\d{4})/i, format: 'DMY_WORD' },
    // EXP 15/08/2026, SCAD 15-08-2026
    { regex: /(?:EXP|SCAD|SCADENZA|BB|BEST BEFORE|USE BY)[^\d]*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})/i, format: 'DMY' },
    // 20260815 (formato compatto)
    { regex: /[^\d](20\d{2})(\d{2})(\d{2})[^\d]/, format: 'YMD_COMPACT' }
  ];
  
  var monthNames = {
    'gen': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'mag': 5, 'giu': 6,
    'lug': 7, 'ago': 8, 'set': 9, 'ott': 10, 'nov': 11, 'dic': 12
  };
  
  for (var i = 0; i < patterns.length; i++) {
    var match = clean.match(patterns[i].regex);
    if (match) {
      var d, m, y;
      
      if (patterns[i].format === 'DMY' || patterns[i].format === 'DMY_SHORT') {
        d = parseInt(match[1], 10);
        m = parseInt(match[2], 10);
        y = parseInt(match[3], 10);
        if (patterns[i].format === 'DMY_SHORT') y += 2000;
      } else if (patterns[i].format === 'YMD') {
        y = parseInt(match[1], 10);
        m = parseInt(match[2], 10);
        d = parseInt(match[3], 10);
      } else if (patterns[i].format === 'YMD_COMPACT') {
        y = parseInt(match[1], 10);
        m = parseInt(match[2], 10);
        d = parseInt(match[3], 10);
      } else if (patterns[i].format === 'DMY_WORD') {
        d = parseInt(match[1], 10);
        var monthStr = match[2].toLowerCase().substring(0, 3);
        m = monthNames[monthStr] || 0;
        y = parseInt(match[3], 10);
      }
      
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2020 && y <= 2040) {
        var yy = String(y);
        var mm = String(m).padStart(2, '0');
        var dd = String(d).padStart(2, '0');
        return yy + '-' + mm + '-' + dd;
      }
    }
  }
  
  return null;
}

/**
 * Mostra modal conferma
 */
function showExpiryConfirmModal(previewUrl, dateStr, confidence) {
  var previewDiv = document.getElementById('expiry-preview-img');
  var valueDiv = document.getElementById('expiry-detected-value');
  var confDiv = document.getElementById('expiry-detected-confidence');
  
  previewDiv.innerHTML = '<img src="' + previewUrl + '" alt="Foto data scadenza">';
  
  if (dateStr) {
    var parts = dateStr.split('-');
    var displayDate = parts[2] + '/' + parts[1] + '/' + parts[0];
    valueDiv.textContent = displayDate;
    valueDiv.style.color = 'var(--primary)';
    confDiv.textContent = 'Confidenza: ' + Math.round(confidence) + '%';
    confDiv.style.display = 'block';
  } else {
    valueDiv.textContent = 'Data non rilevata';
    valueDiv.style.color = 'var(--danger)';
    confDiv.textContent = 'Prova a scattare di nuovo con più luce';
    confDiv.style.display = 'block';
  }
  
  document.getElementById('expiry-confirm-modal').classList.add('show');
}

/**
 * Chiude modal
 */
function closeExpiryConfirmModal(e) {
  if (e.target === e.currentTarget) {
    document.getElementById('expiry-confirm-modal').classList.remove('show');
    detectedExpiryDate = null;
    detectedExpiryConfidence = 0;
    expiryPhotoData = null;
  }
}

/**
 * Accetta data
 */
function acceptDetectedExpiry() {
  if (detectedExpiryDate) {
    document.getElementById('expiry-input').value = detectedExpiryDate;
    showToast('&#9989; Data scadenza inserita: ' + formatDate(detectedExpiryDate));
  }
  document.getElementById('expiry-confirm-modal').classList.remove('show');
  detectedExpiryDate = null;
  detectedExpiryConfidence = 0;
  expiryPhotoData = null;
}

/**
 * Modifica
 */
function editDetectedExpiry() {
  document.getElementById('expiry-confirm-modal').classList.remove('show');
  
  if (detectedExpiryDate) {
    document.getElementById('expiry-input').value = detectedExpiryDate;
  }
  
  setTimeout(function() {
    document.getElementById('expiry-input').focus();
    showToast('&#9998; Modifica la data e premi Aggiungi');
  }, 300);
  
  detectedExpiryDate = null;
  detectedExpiryConfidence = 0;
  expiryPhotoData = null;
}

/**
 * Ignora
 */
function rejectDetectedExpiry() {
  document.getElementById('expiry-confirm-modal').classList.remove('show');
  detectedExpiryDate = null;
  detectedExpiryConfidence = 0;
  expiryPhotoData = null;
  showToast('&#10060; Data ignorata, inseriscila manualmente');
}
// ============================================================
// INIZIALIZZAZIONE
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
