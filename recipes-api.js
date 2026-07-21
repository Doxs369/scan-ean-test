/**
 * Recipes API Module - TheMealDB (gratuita, no API key)
 * Gestione ricette per prodotti in scadenza
 */

var RecipesAPI = (function() {
  'use strict';

  var API_BASE = 'https://www.themealdb.com/api/json/v1/1';

  /**
   * Cerca ricette per ingrediente
   * Ritorna array di ricette {id, title, thumb}
   */
  function searchByIngredient(ingredient) {
    return new Promise(function(resolve, reject) {
      // Pulisci ingrediente: rimuovi brand, quantità, prendi solo prima parola significativa
      var clean = sanitizeIngredient(ingredient);
      if (!clean) {
        resolve([]);
        return;
      }

      var url = API_BASE + '/filter.php?i=' + encodeURIComponent(clean);

      fetch(url)
        .then(function(response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function(data) {
          var meals = data.meals || [];
          var recipes = meals.map(function(m) {
            return {
              id: m.idMeal,
              title: m.strMeal,
              thumb: m.strMealThumb
            };
          });
          resolve(recipes);
        })
        .catch(function(error) {
          console.error('Errore TheMealDB:', error);
          resolve([]); // Fallback: nessuna ricetta, non crasha
        });
    });
  }

  /**
   * Ottiene dettaglio ricetta per ID
   */
  function getRecipeDetail(id) {
    return new Promise(function(resolve, reject) {
      var url = API_BASE + '/lookup.php?i=' + encodeURIComponent(id);

      fetch(url)
        .then(function(response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function(data) {
          var meal = (data.meals || [])[0];
          if (!meal) {
            resolve(null);
            return;
          }

          // Estrai ingredienti e misure
          var ingredients = [];
          for (var i = 1; i <= 20; i++) {
            var ing = meal['strIngredient' + i];
            var meas = meal['strMeasure' + i];
            if (ing && ing.trim()) {
              ingredients.push((meas ? meas.trim() + ' ' : '') + ing.trim());
            }
          }

          // Estrai istruzioni come array di passaggi
          var instructions = [];
          if (meal.strInstructions) {
            instructions = meal.strInstructions
              .split(/\r?\n/)
              .map(function(s) { return s.trim(); })
              .filter(function(s) { return s.length > 5; });
          }

          resolve({
            id: meal.idMeal,
            title: meal.strMeal,
            thumb: meal.strMealThumb,
            category: meal.strCategory,
            area: meal.strArea,
            instructions: instructions,
            ingredients: ingredients,
            youtube: meal.strYoutube || ''
          });
        })
        .catch(function(error) {
          console.error('Errore dettaglio ricetta:', error);
          resolve(null);
        });
    });
  }

  /**
   * Sanitizza nome prodotto per ingrediente API
   * Estrae la parola chiave più rilevante
   */
  function sanitizeIngredient(name) {
    if (!name) return '';

    var lower = name.toLowerCase();

    // Rimozione parole "inutili" (brand, quantità, packaging)
    var stopWords = [
      'gr', 'kg', 'ml', 'l', 'pz', 'pezzi', 'pezzo',
      'fresco', 'fresca', 'freschi', 'fresche',
      'biologico', 'bio', 'naturale', 'naturale',
      'intero', 'intera', 'interi', 'intere',
      'a fette', 'a cubetti', 'in polvere', 'in scatola',
      'di marca', 'brand', 'qualità'
    ];

    // Mappa italiano → inglese per TheMealDB (database internazionale)
    var translations = {
      'pomodoro': 'tomato',
      'pomodori': 'tomato',
      'mozzarella': 'mozzarella',
      'parmigiano': 'parmesan',
      'basilico': 'basil',
      'pollo': 'chicken',
      'manzo': 'beef',
      'maiale': 'pork',
      'pesce': 'fish',
      'salmone': 'salmon',
      'tonno': 'tuna',
      'uova': 'egg',
      'uovo': 'egg',
      'latte': 'milk',
      'formaggio': 'cheese',
      'ricotta': 'ricotta',
      'yogurt': 'yogurt',
      'burro': 'butter',
      'pane': 'bread',
      'pasta': 'pasta',
      'riso': 'rice',
      'patata': 'potato',
      'patate': 'potato',
      'carota': 'carrot',
      'carote': 'carrot',
      'cipolla': 'onion',
      'cipolle': 'onion',
      'aglio': 'garlic',
      'peperone': 'pepper',
      'peperoni': 'pepper',
      'zucchina': 'zucchini',
      'zucchine': 'zucchini',
      'melanzana': 'eggplant',
      'melanzane': 'eggplant',
      'spinaci': 'spinach',
      'insalata': 'lettuce',
      'limone': 'lemon',
      'arancia': 'orange',
      'mela': 'apple',
      'banana': 'banana',
      'fragola': 'strawberry',
      'fragole': 'strawberry',
      'miele': 'honey',
      'olio': 'oil',
      'aceto': 'vinegar',
      'sale': 'salt',
      'pepe': 'pepper',
      'zucchero': 'sugar',
      'farina': 'flour',
      'lievito': 'yeast',
      'cioccolato': 'chocolate',
      'vino': 'wine',
      'birra': 'beer',
      'succo': 'juice',
      'acqua': 'water'
    };

    // Prova traduzione diretta
    for (var itWord in translations) {
      if (lower.indexOf(itWord) !== -1) {
        return translations[itWord];
      }
    }

    // Altrimenti prendi prima parola significativa
    var words = lower.split(/[\s\-]+/);
    for (var j = 0; j < words.length; j++) {
      var w = words[j].replace(/[^a-zàèéìòù]/g, '');
      if (w.length >= 3 && stopWords.indexOf(w) === -1) {
        return w;
      }
    }

    return '';
  }

  /**
   * Ottiene la chiave per salvare ricette del giorno
   */
  function getTodayKey() {
    var d = new Date();
    return 'scanEan_recipes_' + d.getFullYear() + 
           String(d.getMonth()+1).padStart(2,'0') + 
           String(d.getDate()).padStart(2,'0');
  }

  /**
   * Salva ricette del giorno in localStorage
   */
  function saveDailyRecipes(recipesData) {
    try {
      var key = getTodayKey();
      localStorage.setItem(key, JSON.stringify({
        recipes: recipesData,
        savedAt: new Date().toISOString()
      }));
      return true;
    } catch (e) {
      console.error('Errore salvataggio ricette giornaliere:', e);
      return false;
    }
  }

  /**
   * Carica ricette del giorno
   */
  function loadDailyRecipes() {
    try {
      var key = getTodayKey();
      var data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Errore caricamento ricette giornaliere:', e);
      return null;
    }
  }

  /**
   * Pulisce ricette di giorni precedenti
   */
  function cleanupOldRecipes() {
    try {
      var todayKey = getTodayKey();
      var removed = 0;
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key && key.indexOf('scanEan_recipes_') === 0 && key !== todayKey) {
          localStorage.removeItem(key);
          removed++;
        }
      }
      return removed;
    } catch (e) {
      console.error('Errore cleanup ricette vecchie:', e);
      return 0;
    }
  }

  /**
   * Trova prodotti che scadono oggi
   */
  function getExpiringToday(products) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var result = [];
    for (var i = 0; i < products.length; i++) {
      var exp = new Date(products[i].expiryDate);
      exp.setHours(0, 0, 0, 0);
      if (exp.getTime() === today.getTime()) {
        result.push(products[i]);
      }
    }
    return result;
  }

  /**
   * Trova prodotti già scaduti (ieri o prima)
   */
  function getExpiredProducts(products) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var result = [];
    for (var i = 0; i < products.length; i++) {
      var exp = new Date(products[i].expiryDate);
      exp.setHours(0, 0, 0, 0);
      if (exp.getTime() < today.getTime()) {
        result.push(products[i]);
      }
    }
    return result;
  }

  // API pubblica
  return {
    searchByIngredient: searchByIngredient,
    getRecipeDetail: getRecipeDetail,
    saveDailyRecipes: saveDailyRecipes,
    loadDailyRecipes: loadDailyRecipes,
    cleanupOldRecipes: cleanupOldRecipes,
    getExpiringToday: getExpiringToday,
    getExpiredProducts: getExpiredProducts,
    getTodayKey: getTodayKey
  };
})();
