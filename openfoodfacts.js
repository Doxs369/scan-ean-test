/**
 * Open Food Facts API Module
 * Gestisce tutte le chiamate all'API di Open Food Facts
 */

var OpenFoodFacts = (function() {
  'use strict';

  var API_BASE = 'https://world.openfoodfacts.org/api/v0/product/';
  var IMAGE_BASE = 'https://images.openfoodfacts.org/images/products/';

  /**
   * Categorie predefinite con emoji
   */
  var defaultCategories = {
    dairy:     { name: 'Latticini',     emoji: '&#129371;' },
    meat:      { name: 'Carne e Pesce', emoji: '&#129385;' },
    produce:   { name: 'Verdura e Frutta', emoji: '&#129388;' },
    pantry:    { name: 'Dispensa',      emoji: '&#129387;' },
    beverages: { name: 'Bevande',       emoji: '&#129380;' },
    frozen:    { name: 'Surgelati',     emoji: '&#129482;' },
    bakery:    { name: 'Panetteria',    emoji: '&#127838;' },
    sweets:    { name: 'Dolci',         emoji: '&#127852;' },
    fridge:    { name: 'Frigorifero',   emoji: '&#129379;' },
    condiments:{ name: 'Condimenti',    emoji: '&#129474;' }
  };

  /**
   * Carica categorie personalizzate dal localStorage
   */
  function loadCustomCategories() {
    try {
      var data = localStorage.getItem('scanEan_customCategories');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Salva categorie personalizzate
   */
  function saveCustomCategories(cats) {
    try {
      localStorage.setItem('scanEan_customCategories', JSON.stringify(cats));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Ottieni tutte le categorie (predefinite + personalizzate)
   */
  function getAllCategories() {
    var custom = loadCustomCategories();
    var all = {};
    for (var key in defaultCategories) {
      all[key] = defaultCategories[key];
    }
    for (var key2 in custom) {
      all[key2] = custom[key2];
    }
    return all;
  }

  /**
   * Aggiungi categoria personalizzata
   */
  function addCustomCategory(key, name, emoji) {
    var custom = loadCustomCategories();
    custom[key] = { name: name, emoji: emoji };
    saveCustomCategories(custom);
    return true;
  }

  /**
   * Rimuovi categoria personalizzata
   */
  function removeCustomCategory(key) {
    var custom = loadCustomCategories();
    delete custom[key];
    saveCustomCategories(custom);
    return true;
  }

  /**
   * Cerca un prodotto per barcode
   */
  function searchProduct(barcode) {
    return new Promise(function(resolve, reject) {
      var url = API_BASE + encodeURIComponent(barcode) + '.json';

      fetch(url)
        .then(function(response) {
          if (!response.ok) {
            throw new Error('HTTP ' + response.status);
          }
          return response.json();
        })
        .then(function(data) {
          if (data.status === 1 && data.product) {
            var product = parseProduct(data.product, barcode);
            resolve({
              found: true,
              product: product
            });
          } else {
            resolve({
              found: false,
              error: 'Prodotto non trovato'
            });
          }
        })
        .catch(function(error) {
          console.error('Errore Open Food Facts:', error);
          resolve({
            found: false,
            error: error.message || 'Errore di rete'
          });
        });
    });
  }

  /**
   * Parsing del prodotto dall'API
   */
  function parseProduct(apiProduct, barcode) {
    var product = {
      barcode: barcode,
      name: '',
      brand: '',
      quantity: '',
      categories: [],
      ingredients: '',
      nutriscore: '',
      novaGroup: '',
      imageUrl: null,
      imageFrontUrl: null,
      imageIngredientsUrl: null,
      imageNutritionUrl: null,
      stores: [],
      countries: [],
      labels: [],
      allergens: [],
      traces: [],
      additives: [],
      nutriments: {},
      servingSize: '',
      packaging: '',
      manufacturingPlaces: '',
      origins: ''
    };

    // Nome prodotto
    product.name = apiProduct.product_name
      || apiProduct.product_name_it
      || apiProduct.product_name_en
      || 'Prodotto sconosciuto';

    // Brand
    product.brand = apiProduct.brands || '';

    // Quantita
    product.quantity = apiProduct.quantity || '';

    // Categorie
    if (apiProduct.categories) {
      product.categories = apiProduct.categories.split(',').map(function(c) {
        return c.trim();
      });
    }

    // Ingredienti
    product.ingredients = apiProduct.ingredients_text_it
      || apiProduct.ingredients_text
      || '';

    // Nutri-Score
    product.nutriscore = apiProduct.nutriscore_grade || '';

    // Nova Group
    product.novaGroup = apiProduct.nova_group || '';

    // Immagini
    product.imageUrl = apiProduct.image_url || null;
    product.imageFrontUrl = apiProduct.image_front_url || null;
    product.imageIngredientsUrl = apiProduct.image_ingredients_url || null;
    product.imageNutritionUrl = apiProduct.image_nutrition_url || null;

    // Se l'image_url non c'e, costruisci l'URL dalle immagini
    if (!product.imageUrl && apiProduct.images) {
      var frontImg = apiProduct.images['front'] || apiProduct.images['front_it'];
      if (frontImg && frontImg.display) {
        product.imageUrl = frontImg.display.url;
      }
    }

    // Negozi
    if (apiProduct.stores) {
      product.stores = apiProduct.stores.split(',').map(function(s) {
        return s.trim();
      });
    }

    // Paesi
    if (apiProduct.countries) {
      product.countries = apiProduct.countries.split(',').map(function(c) {
        return c.trim();
      });
    }

    // Etichette
    if (apiProduct.labels) {
      product.labels = apiProduct.labels.split(',').map(function(l) {
        return l.trim();
      });
    }

    // Allergeni
    if (apiProduct.allergens) {
      product.allergens = apiProduct.allergens.split(',').map(function(a) {
        return a.trim().replace('en:', '').replace('it:', '');
      });
    }

    // Tracce
    if (apiProduct.traces) {
      product.traces = apiProduct.traces.split(',').map(function(t) {
        return t.trim().replace('en:', '').replace('it:', '');
      });
    }

    // Additivi
    if (apiProduct.additives_tags) {
      product.additives = apiProduct.additives_tags.map(function(a) {
        return a.replace('en:', '').replace('it:', '');
      });
    }

    // Nutrienti
    if (apiProduct.nutriments) {
      var n = apiProduct.nutriments;
      product.nutriments = {
        energyKcal: n['energy-kcal_100g'] || n['energy-kcal'] || '',
        energyKj: n['energy-kj_100g'] || n['energy-kj'] || '',
        fat: n.fat_100g || n.fat || '',
        saturatedFat: n['saturated-fat_100g'] || n['saturated-fat'] || '',
        carbohydrates: n.carbohydrates_100g || n.carbohydrates || '',
        sugars: n.sugars_100g || n.sugars || '',
        proteins: n.proteins_100g || n.proteins || '',
        salt: n.salt_100g || n.salt || '',
        fiber: n.fiber_100g || n.fiber || ''
      };
    }

    // Porzione
    product.servingSize = apiProduct.serving_size || '';

    // Packaging
    product.packaging = apiProduct.packaging || '';

    // Luoghi di produzione
    product.manufacturingPlaces = apiProduct.manufacturing_places || '';

    // Origini ingredienti
    product.origins = apiProduct.origins || apiProduct.origins_it || '';

    return product;
  }

  /**
   * Rileva la categoria del prodotto con keyword estese
   */
  function detectCategory(product) {
    var cats = (product.categories || []).join(' ').toLowerCase();
    var labels = (product.labels || []).join(' ').toLowerCase();
    var name = (product.name || '').toLowerCase();
    var brand = (product.brand || '').toLowerCase();
    var ingredients = (product.ingredients || '').toLowerCase();
    var allText = cats + ' ' + labels + ' ' + name + ' ' + brand + ' ' + ingredients;

    // === LATTICINI (priorita alta) ===
    var dairyKeywords = [
      'latte', 'formaggio', 'yogurt', 'yoghurt', 'latticino', 'lattiero',
      'dairy', 'mozzarella', 'parmigiano', 'ricotta', 'burro', 'panna',
      'mascarpone', 'pecorino', 'grana', 'gorgonzola', 'fontina',
      'stracchino', 'caciotta', 'fiocchi di latte', 'kefir',
      'cream cheese', 'cheddar', 'brie', 'camembert', 'feta',
      'uovo', 'uova', 'egg', 'eggs', 'mayonnaise', 'maionese'
    ];
    for (var d = 0; d < dairyKeywords.length; d++) {
      if (allText.indexOf(dairyKeywords[d]) !== -1) return 'dairy';
    }

    // === CARNE E PESCE ===
    var meatKeywords = [
      'carne', 'pesce', 'pollo', 'salmone', 'tonno', 'meat', 'fish',
      'prosciutto', 'bresaola', 'wurstel', 'salsiccia', 'bacon',
      'hamburger', 'salsicce', 'filetto', 'bistecca', 'costoletta',
      'agnello', 'maiale', 'manzo', 'vitello', 'tacchino', 'anatra',
      'gamberi', 'gamberetti', 'calamari', 'polpo', 'sarde',
      'merluzzo', 'orata', 'branzino', 'spigola', 'aragosta',
      'mortadella', 'salame', 'speck', 'pancetta', 'cotechino',
      'sushi', 'sashimi', 'surimi'
    ];
    for (var m = 0; m < meatKeywords.length; m++) {
      if (allText.indexOf(meatKeywords[m]) !== -1) return 'meat';
    }

    // === VERDURA E FRUTTA ===
    var produceKeywords = [
      'verdura', 'frutta', 'insalata', 'pomodoro', 'vegetable', 'fruit',
      'spinaci', 'zucchina', 'melanzana', 'carota', 'patata', 'patate',
      'cipolla', 'aglio', 'peperone', 'peperoni', 'broccoli', 'cavolfiore',
      'cavolo', 'lattuga', 'radicchio', 'rucola', 'basilico', 'prezzemolo',
      'sedano', 'finocchio', 'porro', 'asparago', 'carciofo', 'fagiolino',
      'pisello', 'mais', 'zucca', 'barbabietola', 'rapa', 'topinambur',
      'mela', 'pera', 'arancia', 'limone', 'banana', 'fragola', 'mirtillo',
      'lampone', 'ciliegia', 'pesca', 'albicocca', 'prugna', 'uva', 'kiwi',
      'ananas', 'mango', 'papaya', 'melone', 'anguria', 'fico', 'dattero',
      'avocado', 'pomodori', 'oliva', 'olive'
    ];
    for (var p = 0; p < produceKeywords.length; p++) {
      if (allText.indexOf(produceKeywords[p]) !== -1) return 'produce';
    }

    // === SURGELATI ===
    var frozenKeywords = [
      'surgelato', 'congelato', 'frozen', 'gelato', 'surghi',
      'congelare', 'freezer', 'ghiaccio', 'ice cream'
    ];
    for (var f = 0; f < frozenKeywords.length; f++) {
      if (allText.indexOf(frozenKeywords[f]) !== -1) return 'frozen';
    }

    // === BEVANDE ===
    var beverageKeywords = [
      'bevanda', 'bibita', 'vino', 'beverage', 'drink', 'acqua',
      'succo', 'birra', 'spumante', 'liquore', 'whisky', 'whiskey',
      'vodka', 'rum', 'gin', 'tequila', 'cocktail', 'aperitivo',
      'digestivo', 'soda', 'cola', 'fanta', 'sprite', 'tonica',
      'limonata', 'aranciata', 'the', 'tea', 'caffe', 'coffee',
      'cappuccino', 'espresso', 'latte macchiato', 'cioccolata calda',
      'smoothie', 'frullato', 'shake', 'energy drink', 'isotonica',
      'spremuta', 'nettare', 'nectar'
    ];
    for (var b = 0; b < beverageKeywords.length; b++) {
      if (allText.indexOf(beverageKeywords[b]) !== -1) return 'beverages';
    }

    // === PANETTERIA ===
    var bakeryKeywords = [
      'pane', 'biscotto', 'cracker', 'fette', 'bread', 'cookie',
      'croissant', 'brioche', 'cornetto', 'ciabatta', 'focaccia',
      'baguette', 'panino', 'toast', 'fette biscottate', 'grissino',
      'tarallo', 'scone', 'muffin', 'donut', 'ciambella', 'bagel',
      'pita', 'tortilla', 'wrap', 'piadina', 'focaccina', 'schiacciata'
    ];
    for (var ba = 0; ba < bakeryKeywords.length; ba++) {
      if (allText.indexOf(bakeryKeywords[ba]) !== -1) return 'bakery';
    }

    // === DOLCI ===
    var sweetsKeywords = [
      'dolce', 'cioccolato', 'caramella', 'sweet', 'chocolate', 'candy',
      'torta', 'crostata', 'mousse', 'budino', 'gelatina', 'marshmallow',
      'nougat', 'torrone', 'pralina', 'truffle', 'tartufo', 'bonbon',
      'caramello', 'toffee', 'licorice', 'liquorizia', 'marzapane',
      'pastry', 'pasticceria', 'cannolo', 'cassata', 'tiramisu',
      'panna cotta', ' semifreddo', 'crostatina', 'meringa'
    ];
    for (var sw = 0; sw < sweetsKeywords.length; sw++) {
      if (allText.indexOf(sweetsKeywords[sw]) !== -1) return 'sweets';
    }

    // === CONDIMENTI ===
    var condimentKeywords = [
      'olio', 'aceto', 'sale', 'pepe', 'zucchero', 'miele', 'senape',
      'ketchup', 'maionese', 'salsa', 'sugo', 'condimento', 'spezia',
      'spezie', 'erba aromatica', 'basilico secco', 'origano',
      'ketchup', 'mostarda', 'tabasco', 'sriracha', 'soia',
      'worcestershire', 'barbecue', 'bbq', 'marinata', 'rub',
      'olio d'oliva', 'olio extravergine', 'aceto balsamico',
      'sale marino', 'pepe nero', 'pepe bianco', 'pepe rosa',
      'zucchero di canna', 'zucchero a velo', 'miele millefiori'
    ];
    for (var c = 0; c < condimentKeywords.length; c++) {
      if (allText.indexOf(condimentKeywords[c]) !== -1) return 'condiments';
    }

    // === FRIGORIFERO (prodotti che vanno in frigo ma non sono latticini) ===
    var fridgeKeywords = [
      'refrigerato', 'tenere in frigo', 'conservare in frigorifero',
      'keep refrigerated', 'refrigerate', 'fresh', 'fresco',
      'pronto', 'ready meal', 'piatto pronto', 'insalata in busta',
      'sottovuoto fresco', 'affettato', 'affettati', 'hummus',
      'guacamole', 'salsa fresca', 'pesto fresco', 'pasta fresca',
      'pizza fresca', 'impasto fresco'
    ];
    for (var fr = 0; fr < fridgeKeywords.length; fr++) {
      if (allText.indexOf(fridgeKeywords[fr]) !== -1) return 'fridge';
    }

    // Default: dispensa
    return 'pantry';
  }

  /**
   * Ottieni emoji per categoria
   */
  function getCategoryEmoji(category) {
    var all = getAllCategories();
    if (all[category]) return all[category].emoji;
    return '&#128230;';
  }

  /**
   * Ottieni nome italiano categoria
   */
  function getCategoryName(category) {
    var all = getAllCategories();
    if (all[category]) return all[category].name;
    return 'Altro';
  }

  /**
   * Verifica se una categoria esiste
   */
  function categoryExists(key) {
    var all = getAllCategories();
    return !!all[key];
  }

  // API pubblica
  return {
    search: searchProduct,
    detectCategory: detectCategory,
    getCategoryEmoji: getCategoryEmoji,
    getCategoryName: getCategoryName,
    getAllCategories: getAllCategories,
    addCustomCategory: addCustomCategory,
    removeCustomCategory: removeCustomCategory,
    categoryExists: categoryExists,
    defaultCategories: defaultCategories
  };
})();