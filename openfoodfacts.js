/**
 * Open Food Facts API Module
 * Gestisce tutte le chiamate all'API di Open Food Facts
 */

var OpenFoodFacts = (function() {
  'use strict';

  var API_BASE = 'https://world.openfoodfacts.org/api/v0/product/';
  var IMAGE_BASE = 'https://images.openfoodfacts.org/images/products/';
  var CUSTOM_CAT_KEY = 'scanEan_customCategories';

  var builtInCategories = {
    dairy: { name: 'Latticini', emoji: '&#129371;' },
    meat: { name: 'Carne e Pesce', emoji: '&#129385;' },
    produce: { name: 'Verdura e Frutta', emoji: '&#129388;' },
    pantry: { name: 'Dispensa', emoji: '&#129387;' },
    beverages: { name: 'Bevande', emoji: '&#129380;' },
    frozen: { name: 'Surgelati', emoji: '&#129482;' },
    bakery: { name: 'Panetteria', emoji: '&#127838;' },
    sweets: { name: 'Dolci', emoji: '&#127852;' }
  };

  var categoryKeywords = {
    dairy: [
      { word: 'latte', score: 3 }, { word: 'formaggio', score: 3 },
      { word: 'yogurt', score: 3 }, { word: 'latticino', score: 3 },
      { word: 'dairy', score: 3 }, { word: 'uovo', score: 2 },
      { word: 'mozzarella', score: 3 }, { word: 'parmigiano', score: 3 },
      { word: 'ricotta', score: 3 }, { word: 'burro', score: 2 },
      { word: 'mascarpone', score: 3 }, { word: 'kefir', score: 3 },
      { word: 'cream', score: 2 }, { word: 'panna', score: 2 },
      { word: 'philadelphia', score: 3 }, { word: 'grana', score: 3 }
    ],
    meat: [
      { word: 'carne', score: 3 }, { word: 'pesce', score: 3 },
      { word: 'pollo', score: 3 }, { word: 'salmone', score: 3 },
      { word: 'meat', score: 3 }, { word: 'fish', score: 3 },
      { word: 'prosciutto', score: 3 }, { word: 'bresaola', score: 3 },
      { word: 'wurstel', score: 3 }, { word: 'salsiccia', score: 3 },
      { word: 'bacon', score: 3 }, { word: 'ham', score: 3 },
      { word: 'beef', score: 3 }, { word: 'pork', score: 3 },
      { word: 'chicken', score: 3 }, { word: 'tuna', score: 3 },
      { word: 'shrimp', score: 3 }, { word: 'steak', score: 3 },
      { word: 'sardine', score: 3 }, { word: 'merluzzo', score: 3 }
    ],
    produce: [
      { word: 'verdura', score: 3 }, { word: 'frutta', score: 3 },
      { word: 'insalata', score: 3 }, { word: 'pomodoro', score: 3 },
      { word: 'vegetable', score: 3 }, { word: 'fruit', score: 3 },
      { word: 'spinaci', score: 3 }, { word: 'zucchina', score: 3 },
      { word: 'melanzana', score: 3 }, { word: 'carota', score: 3 },
      { word: 'lettuce', score: 3 }, { word: 'apple', score: 3 },
      { word: 'banana', score: 3 }, { word: 'orange', score: 3 },
      { word: 'onion', score: 3 }, { word: 'garlic', score: 3 },
      { word: 'potato', score: 3 }, { word: 'pepper', score: 3 },
      { word: 'mushroom', score: 3 }, { word: 'broccoli', score: 3 },
      { word: 'asparagi', score: 3 }, { word: 'cavolfiore', score: 3 }
    ],
    beverages: [
      { word: 'bevanda', score: 3 }, { word: 'bibita', score: 3 },
      { word: 'vino', score: 3 }, { word: 'beverage', score: 3 },
      { word: 'drink', score: 3 }, { word: 'acqua', score: 3 },
      { word: 'succo', score: 3 }, { word: 'birra', score: 3 },
      { word: 'spumante', score: 3 }, { word: 'liquore', score: 3 },
      { word: 'wine', score: 3 }, { word: 'beer', score: 3 },
      { word: 'juice', score: 3 }, { word: 'soda', score: 3 },
      { word: 'coffee', score: 3 }, { word: 'tea', score: 3 },
      { word: 'milk', score: 2 }, { word: 'caffe', score: 3 },
      { word: 'the', score: 3 }, { word: 'tisana', score: 3 }
    ],
    frozen: [
      { word: 'surgelato', score: 3 }, { word: 'congelato', score: 3 },
      { word: 'frozen', score: 3 }, { word: 'gelato', score: 3 },
      { word: 'surghi', score: 3 }, { word: 'ice cream', score: 3 },
      { word: 'surgh', score: 3 }
    ],
    bakery: [
      { word: 'pane', score: 3 }, { word: 'biscotto', score: 3 },
      { word: 'cracker', score: 3 }, { word: 'fette', score: 2 },
      { word: 'bread', score: 3 }, { word: 'cookie', score: 3 },
      { word: 'toast', score: 3 }, { word: 'croissant', score: 3 },
      { word: 'brioche', score: 3 }, { word: 'ciabatta', score: 3 },
      { word: 'focaccia', score: 3 }, { word: 'baguette', score: 3 }
    ],
    sweets: [
      { word: 'dolce', score: 3 }, { word: 'cioccolato', score: 3 },
      { word: 'caramella', score: 3 }, { word: 'sweet', score: 3 },
      { word: 'chocolate', score: 3 }, { word: 'candy', score: 3 },
      { word: 'biscotti', score: 2 }, { word: 'cake', score: 3 },
      { word: 'torta', score: 3 }, { word: 'miele', score: 2 },
      { word: 'nutella', score: 3 }, { word: 'marmellata', score: 2 }
    ]
  };

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
   * Rileva la categoria del prodotto con sistema a punteggio
   */
  function detectCategory(product) {
    var cats = (product.categories || []).join(' ').toLowerCase();
    var labels = (product.labels || []).join(' ').toLowerCase();
    var name = (product.name || '').toLowerCase();
    var allText = cats + ' ' + labels + ' ' + name;

    var scores = {
      dairy: 0, meat: 0, produce: 0, pantry: 0,
      beverages: 0, frozen: 0, bakery: 0, sweets: 0
    };

    // Built-in scoring
    for (var cat in categoryKeywords) {
      if (!categoryKeywords.hasOwnProperty(cat)) continue;
      var list = categoryKeywords[cat];
      for (var i = 0; i < list.length; i++) {
        if (allText.indexOf(list[i].word) !== -1) {
          scores[cat] += list[i].score;
        }
      }
    }

    // Custom categories scoring
    var customCats = loadCustomCategories();
    for (var j = 0; j < customCats.length; j++) {
      var cc = customCats[j];
      if (allText.indexOf(cc.keyword.toLowerCase()) !== -1) {
        if (scores[cc.category] === undefined) scores[cc.category] = 0;
        scores[cc.category] += (cc.priority || 1);
      }
    }

    // Trova categoria con punteggio massimo
    var bestCat = 'pantry';
    var bestScore = 0;
    for (var c in scores) {
      if (scores[c] > bestScore) {
        bestScore = scores[c];
        bestCat = c;
      }
    }

    return bestCat;
  }

  /**
   * Carica categorie custom da localStorage
   */
  function loadCustomCategories() {
    try {
      var data = localStorage.getItem(CUSTOM_CAT_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Salva categorie custom in localStorage
   */
  function saveCustomCategories(cats) {
    try {
      localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(cats));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Restituisce tutte le categorie (built-in + custom)
   */
  function getAllCategories() {
    var result = [];
    for (var id in builtInCategories) {
      if (builtInCategories.hasOwnProperty(id)) {
        result.push({
          id: id,
          name: builtInCategories[id].name,
          emoji: builtInCategories[id].emoji
        });
      }
    }

    var custom = loadCustomCategories();
    var seen = {};
    for (var i = 0; i < result.length; i++) {
      seen[result[i].id] = true;
    }

    for (var j = 0; j < custom.length; j++) {
      var catId = custom[j].category;
      if (!seen[catId]) {
        seen[catId] = true;
        result.push({
          id: catId,
          name: catId.charAt(0).toUpperCase() + catId.slice(1),
          emoji: '&#128230;'
        });
      }
    }

    return result;
  }

  /**
   * Ottieni emoji per categoria
   */
  function getCategoryEmoji(category) {
    if (builtInCategories[category]) {
      return builtInCategories[category].emoji;
    }
    return '&#128230;';
  }

  /**
   * Ottieni nome italiano categoria
   */
  function getCategoryName(category) {
    if (builtInCategories[category]) {
      return builtInCategories[category].name;
    }
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  // API pubblica
  return {
    search: searchProduct,
    detectCategory: detectCategory,
    getCategoryEmoji: getCategoryEmoji,
    getCategoryName: getCategoryName,
    getAllCategories: getAllCategories,
    loadCustomCategories: loadCustomCategories,
    saveCustomCategories: saveCustomCategories
  };
})();
