/**
 * Open Food Facts API Module
 * Gestisce tutte le chiamate all'API di Open Food Facts
 */

var OpenFoodFacts = (function() {
  'use strict';

  var API_BASE = 'https://world.openfoodfacts.org/api/v0/product/';
  var IMAGE_BASE = 'https://images.openfoodfacts.org/images/products/';

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
   * Rileva la categoria del prodotto
   */
  function detectCategory(product) {
    var cats = (product.categories || []).join(' ').toLowerCase();
    var labels = (product.labels || []).join(' ').toLowerCase();
    var name = (product.name || '').toLowerCase();
    var allText = cats + ' ' + labels + ' ' + name;

    if (allText.indexOf('latte') !== -1 || allText.indexOf('formaggio') !== -1 ||
        allText.indexOf('yogurt') !== -1 || allText.indexOf('latticino') !== -1 ||
        allText.indexOf('dairy') !== -1 || allText.indexOf('uovo') !== -1 ||
        allText.indexOf('mozzarella') !== -1 || allText.indexOf('parmigiano') !== -1 ||
        allText.indexOf('ricotta') !== -1 || allText.indexOf('burro') !== -1) {
      return 'dairy';
    }

    if (allText.indexOf('carne') !== -1 || allText.indexOf('pesce') !== -1 ||
        allText.indexOf('pollo') !== -1 || allText.indexOf('salmone') !== -1 ||
        allText.indexOf('meat') !== -1 || allText.indexOf('fish') !== -1 ||
        allText.indexOf('prosciutto') !== -1 || allText.indexOf('bresaola') !== -1 ||
        allText.indexOf('wurstel') !== -1 || allText.indexOf('salsiccia') !== -1) {
      return 'meat';
    }

    if (allText.indexOf('verdura') !== -1 || allText.indexOf('frutta') !== -1 ||
        allText.indexOf('insalata') !== -1 || allText.indexOf('pomodoro') !== -1 ||
        allText.indexOf('vegetable') !== -1 || allText.indexOf('fruit') !== -1 ||
        allText.indexOf('spinaci') !== -1 || allText.indexOf('zucchina') !== -1 ||
        allText.indexOf('melanzana') !== -1 || allText.indexOf('carota') !== -1) {
      return 'produce';
    }

    if (allText.indexOf('bevanda') !== -1 || allText.indexOf('bibita') !== -1 ||
        allText.indexOf('vino') !== -1 || allText.indexOf('beverage') !== -1 ||
        allText.indexOf('drink') !== -1 || allText.indexOf('acqua') !== -1 ||
        allText.indexOf('succo') !== -1 || allText.indexOf('birra') !== -1 ||
        allText.indexOf('spumante') !== -1 || allText.indexOf('liquore') !== -1) {
      return 'beverages';
    }

    if (allText.indexOf('surgelato') !== -1 || allText.indexOf('congelato') !== -1 ||
        allText.indexOf('frozen') !== -1 || allText.indexOf('gelato') !== -1 ||
        allText.indexOf('surghi') !== -1) {
      return 'frozen';
    }

    if (allText.indexOf('pane') !== -1 || allText.indexOf('biscotto') !== -1 ||
        allText.indexOf('cracker') !== -1 || allText.indexOf('fette') !== -1 ||
        allText.indexOf('bread') !== -1 || allText.indexOf('cookie') !== -1) {
      return 'bakery';
    }

    if (allText.indexOf('dolce') !== -1 || allText.indexOf('cioccolato') !== -1 ||
        allText.indexOf('caramella') !== -1 || allText.indexOf('sweet') !== -1 ||
        allText.indexOf('chocolate') !== -1 || allText.indexOf('candy') !== -1) {
      return 'sweets';
    }

    return 'pantry';
  }

  /**
   * Ottieni emoji per categoria
   */
  function getCategoryEmoji(category) {
    var emojis = {
      dairy: '&#129371;',
      meat: '&#129385;',
      produce: '&#129388;',
      pantry: '&#129387;',
      beverages: '&#129380;',
      frozen: '&#129482;',
      bakery: '&#127838;',
      sweets: '&#127852;'
    };
    return emojis[category] || '&#128230;';
  }

  /**
   * Ottieni nome italiano categoria
   */
  function getCategoryName(category) {
    var names = {
      dairy: 'Latticini',
      meat: 'Carne e Pesce',
      produce: 'Verdura e Frutta',
      pantry: 'Dispensa',
      beverages: 'Bevande',
      frozen: 'Surgelati',
      bakery: 'Panetteria',
      sweets: 'Dolci'
    };
    return names[category] || 'Altro';
  }

  // API pubblica
  return {
    search: searchProduct,
    detectCategory: detectCategory,
    getCategoryEmoji: getCategoryEmoji,
    getCategoryName: getCategoryName
  };
})();
