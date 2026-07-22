/**
 * Storage Module
 * Gestisce la persistenza dei dati con localStorage
 */

var Storage = (function() {
  'use strict';

  var PREFIX = 'scanEan_';

  /**
   * Salva i prodotti
   */
  function saveProducts(products) {
    try {
      localStorage.setItem(PREFIX + 'products', JSON.stringify(products));
      return true;
    } catch (e) {
      console.error('Errore salvataggio prodotti:', e);
      return false;
    }
  }

  /**
   * Carica i prodotti
   */
  function loadProducts() {
    try {
      var data = localStorage.getItem(PREFIX + 'products');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Errore caricamento prodotti:', e);
      return null;
    }
  }

  /**
   * Salva la lista della spesa
   */
  function saveShoppingList(list) {
    try {
      localStorage.setItem(PREFIX + 'shoppingList', JSON.stringify(list));
      return true;
    } catch (e) {
      console.error('Errore salvataggio lista:', e);
      return false;
    }
  }

  /**
   * Carica la lista della spesa
   */
  function loadShoppingList() {
    try {
      var data = localStorage.getItem(PREFIX + 'shoppingList');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Errore caricamento lista:', e);
      return null;
    }
  }

  /**
   * Salva le impostazioni
   */
  function saveSettings(settings) {
    try {
      localStorage.setItem(PREFIX + 'settings', JSON.stringify(settings));
      return true;
    } catch (e) {
      console.error('Errore salvataggio impostazioni:', e);
      return false;
    }
  }

  /**
   * Carica le impostazioni
   */
  function loadSettings() {
    try {
      var data = localStorage.getItem(PREFIX + 'settings');
      return data ? JSON.parse(data) : getDefaultSettings();
    } catch (e) {
      console.error('Errore caricamento impostazioni:', e);
      return getDefaultSettings();
    }
  }

  /**
   * Impostazioni di default
   */
  function getDefaultSettings() {
    return {
      alertDays: 3,
      notifications: true,
      darkMode: false,
      autoAddToShoppingList: true,
      language: 'it'
    };
  }

  /**
   * Salva un prodotto singolo
   */
  function addProduct(product) {
    var products = loadProducts() || [];
    products.unshift(product);
    return saveProducts(products);
  }

  /**
   * Rimuove un prodotto
   */
  function removeProduct(productId) {
    var products = loadProducts() || [];
    var newProducts = [];
    for (var i = 0; i < products.length; i++) {
      if (products[i].id !== productId) {
        newProducts.push(products[i]);
      }
    }
    return saveProducts(newProducts);
  }

  /**
   * Aggiorna un prodotto
   */
  function updateProduct(productId, updates) {
    var products = loadProducts() || [];
    for (var i = 0; i < products.length; i++) {
      if (products[i].id === productId) {
        for (var key in updates) {
          if (updates.hasOwnProperty(key)) {
            products[i][key] = updates[key];
          }
        }
        break;
      }
    }
    return saveProducts(products);
  }

  /**
   * Esporta tutti i dati
   */
  function exportData() {
    return {
      products: loadProducts() || [],
      shoppingList: loadShoppingList() || [],
      settings: loadSettings(),
      exportDate: new Date().toISOString()
    };
  }

  /**
   * Importa dati
   */
  function importData(data) {
    if (data.products) saveProducts(data.products);
    if (data.shoppingList) saveShoppingList(data.shoppingList);
    if (data.settings) saveSettings(data.settings);
    return true;
  }

  /**
   * Cancella tutti i dati
   */
  function clearAll() {
    try {
      localStorage.removeItem(PREFIX + 'products');
      localStorage.removeItem(PREFIX + 'shoppingList');
      localStorage.removeItem(PREFIX + 'settings');
      return true;
    } catch (e) {
      console.error('Errore cancellazione:', e);
      return false;
    }
  }

  /**
   * Verifica se localStorage e disponibile
   */
  function isAvailable() {
    try {
      var test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }


  /**
   * Salva le ricette per un prodotto
   */
  function saveRecipes(productId, recipes) {
    try {
      var key = PREFIX + 'recipes_' + productId;
      localStorage.setItem(key, JSON.stringify({
        recipes: recipes,
        savedAt: new Date().toISOString()
      }));
      return true;
    } catch (e) {
      console.error('Errore salvataggio ricette:', e);
      return false;
    }
  }

  /**
   * Carica le ricette per un prodotto
   */
  function loadRecipes(productId) {
    try {
      var key = PREFIX + 'recipes_' + productId;
      var data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Errore caricamento ricette:', e);
      return null;
    }
  }

  /**
   * Cancella le ricette per un prodotto
   */
  function deleteRecipes(productId) {
    try {
      var key = PREFIX + 'recipes_' + productId;
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Errore cancellazione ricette:', e);
      return false;
    }
  }

  /**
   * Cancella TUTTE le ricette orfane (prodotti non più esistenti)
   */
  function cleanupOrphanRecipes(existingProductIds) {
    try {
      var idSet = {};
      for (var i = 0; i < existingProductIds.length; i++) {
        idSet[existingProductIds[i]] = true;
      }

      var keysToRemove = [];
      for (var j = 0; j < localStorage.length; j++) {
        var key = localStorage.key(j);
        if (key && key.indexOf(PREFIX + 'recipes_') === 0) {
          var recipeProductId = parseInt(key.replace(PREFIX + 'recipes_', ''));
          if (!idSet[recipeProductId]) {
            keysToRemove.push(key);
          }
        }
      }

      for (var k = 0; k < keysToRemove.length; k++) {
        localStorage.removeItem(keysToRemove[k]);
      }

      return keysToRemove.length;
    } catch (e) {
      console.error('Errore cleanup ricette:', e);
      return 0;
    }
  }

  /**
   * Salva categorie personalizzate
   */
  function saveCustomCategories(categories) {
    try {
      localStorage.setItem(PREFIX + 'customCategories', JSON.stringify(categories));
      return true;
    } catch (e) {
      console.error('Errore salvataggio categorie:', e);
      return false;
    }
  }

  /**
   * Carica categorie personalizzate
   */
  function loadCustomCategories() {
    try {
      var data = localStorage.getItem(PREFIX + 'customCategories');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Errore caricamento categorie:', e);
      return {};
    }
  }

  // API pubblica
  return {
    saveProducts: saveProducts,
    loadProducts: loadProducts,
    saveShoppingList: saveShoppingList,
    loadShoppingList: loadShoppingList,
    saveSettings: saveSettings,
    loadSettings: loadSettings,
    addProduct: addProduct,
    removeProduct: removeProduct,
    updateProduct: updateProduct,
    exportData: exportData,
    importData: importData,
    clearAll: clearAll,
    isAvailable: isAvailable,
    getDefaultSettings: getDefaultSettings,
    saveRecipes: saveRecipes,
    loadRecipes: loadRecipes,
    deleteRecipes: deleteRecipes,
    cleanupOrphanRecipes: cleanupOrphanRecipes,
    saveCustomCategories: saveCustomCategories,
    loadCustomCategories: loadCustomCategories
  };
})();
