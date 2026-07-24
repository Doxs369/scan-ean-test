/**
 * Recipes API Module - TheMealDB (gratuita, no API key)
 * Ricette in italiano tramite traduzione automatica
 */

var RecipesAPI = (function() {
  'use strict';

  var API_BASE = 'https://www.themealdb.com/api/json/v1/1';

  // Traduzioni categoria/area in italiano
  var categoryIT = {
    'Beef': 'Manzo', 'Chicken': 'Pollo', 'Dessert': 'Dolce', 'Lamb': 'Agnello',
    'Miscellaneous': 'Varie', 'Pasta': 'Pasta', 'Pork': 'Maiale', 'Seafood': 'Pesce',
    'Side': 'Contorno', 'Starter': 'Antipasto', 'Vegan': 'Vegano', 'Vegetarian': 'Vegetariano',
    'Breakfast': 'Colazione', 'Goat': 'Capra'
  };

  var areaIT = {
    'American': 'Americana', 'British': 'Britannica', 'Canadian': 'Canadese',
    'Chinese': 'Cinese', 'Croatian': 'Croata', 'Dutch': 'Olandese',
    'Egyptian': 'Egiziana', 'Filipino': 'Filippina', 'French': 'Francese',
    'Greek': 'Greca', 'Indian': 'Indiana', 'Irish': 'Irlandese',
    'Italian': 'Italiana', 'Jamaican': 'Giamaicana', 'Japanese': 'Giapponese',
    'Kenyan': 'Keniana', 'Malaysian': 'Malese', 'Mexican': 'Messicana',
    'Moroccan': 'Marocchina', 'Polish': 'Polacca', 'Portuguese': 'Portoghese',
    'Russian': 'Russa', 'Spanish': 'Spagnola', 'Thai': 'Thailandese',
    'Tunisian': 'Tunisina', 'Turkish': 'Turca', 'Unknown': 'Sconosciuta',
    'Vietnamese': 'Vietnamita'
  };

  function searchByIngredient(ingredient) {
    return new Promise(function(resolve, reject) {
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
          resolve([]);
        });
    });
  }

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

          // Traduci ingredienti comuni in italiano
          ingredients = ingredients.map(function(item) {
            return translateIngredient(item);
          });

          // Estrai istruzioni e traduci in italiano
          var instructions = [];
          if (meal.strInstructions) {
            var raw = meal.strInstructions
              .split(/\r?\n/)
              .map(function(s) { return s.trim(); })
              .filter(function(s) { return s.length > 5; });

            // Traduci ogni passaggio
            instructions = raw.map(function(step) {
              return translateStep(step);
            });
          }

          // Se la ricetta è italiana, usa il titolo originale, altrimenti traduci
          var title = meal.strMeal;
          var area = areaIT[meal.strArea] || meal.strArea;
          if (area !== 'Italiana') {
            title = translateTitle(title);
          }

          resolve({
            id: meal.idMeal,
            title: title,
            thumb: meal.strMealThumb,
            category: categoryIT[meal.strCategory] || meal.strCategory,
            area: area,
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

  // Traduce un passaggio di preparazione in italiano
  function translateStep(step) {
    var s = step.toLowerCase();
    var result = step;

    // Dizionario traduzioni azioni culinarie
    var dict = {
      'heat': 'Scalda', 'preheat': 'Preriscalda', 'cook': 'Cuoci',
      'stir': 'Mescola', 'mix': 'Mescola', 'blend': 'Frulla',
      'chop': 'Taglia', 'slice': 'Affetta', 'dice': 'Taglia a cubetti',
      'mince': 'Trita', 'grate': 'Grattugia', 'peel': 'Sbuccia',
      'boil': 'Fai bollire', 'simmer': 'Fai sobbollire', 'fry': 'Friggi',
      'saute': 'Soffriggi', 'bake': 'Inforna', 'roast': 'Arrosto',
      'grill': 'Griglia', 'steam': 'Cuoci a vapore', 'season': 'Condiscila',
      'add': 'Aggiungi', 'pour': 'Versa', 'drain': 'Scola',
      'serve': 'Servi', 'garnish': 'Guarnisci', 'let': 'Lascia',
      'set aside': 'Metti da parte', 'remove': 'Rimuovi',
      'place': 'Metti', 'put': 'Metti', 'spread': 'Stendi',
      'layer': 'Stratifica', 'fold': 'Piega', 'roll': 'Arrotola',
      'brush': 'Spennella', 'sprinkle': 'Spargi', 'cover': 'Copri',
      'uncover': 'Scopri', 'reduce': 'Riduci', 'increase': 'Aumenta',
      'turn': 'Gira', 'flip': 'Gira', 'check': 'Controlla',
      'test': 'Assaggia', 'taste': 'Assaggia', 'adjust': 'Regola',
      'refrigerate': 'Metti in frigo', 'freeze': 'Congela',
      'thaw': 'Scongela', 'marinate': 'Marina', 'rest': 'Lascia riposare'
    };

    // Traduzioni tempi
    var timeDict = {
      'minutes': 'minuti', 'minute': 'minuto', 'hours': 'ore',
      'hour': 'ora', 'seconds': 'secondi', 'second': 'secondo'
    };

    // Traduzioni utensili
    var toolDict = {
      'pan': 'padella', 'pot': 'pentola', 'bowl': 'ciotola',
      'knife': 'coltello', 'spoon': 'cucchiaio', 'fork': 'forchetta',
      'whisk': 'frusta', 'spatula': 'spatola', 'oven': 'forno',
      'stove': 'fornello', 'microwave': 'microonde', 'blender': 'frullatore',
      'grater': 'grattugia', 'colander': 'colino', 'plate': 'piatto',
      'dish': 'piatto', 'tray': 'teglia', 'sheet': 'teglia'
    };

    // Traduzioni stati
    var stateDict = {
      'hot': 'caldo', 'cold': 'freddo', 'warm': 'tiepido',
      'cool': 'fresco', 'room temperature': 'temperatura ambiente',
      'golden': 'dorato', 'brown': 'dorato', 'crispy': 'croccante',
      'tender': 'tenero', 'soft': 'morbido', 'hard': 'duro',
      'smooth': 'liscio', 'thick': 'denso', 'thin': 'liquido'
    };

    // Applica traduzioni
    for (var en in dict) {
      var regex = new RegExp('\\b' + en + '\\b', 'gi');
      result = result.replace(regex, dict[en]);
    }
    for (var t in timeDict) {
      var regexT = new RegExp('\\b' + t + '\\b', 'gi');
      result = result.replace(regexT, timeDict[t]);
    }
    for (var tool in toolDict) {
      var regexTool = new RegExp('\\b' + tool + '\\b', 'gi');
      result = result.replace(regexTool, toolDict[tool]);
    }
    for (var st in stateDict) {
      var regexSt = new RegExp('\\b' + st + '\\b', 'gi');
      result = result.replace(regexSt, stateDict[st]);
    }

    // Traduzioni frasi comuni
    result = result.replace(/in a /gi, 'in una ');
    result = result.replace(/on a /gi, 'su una ');
    result = result.replace(/with the /gi, 'con il ');
    result = result.replace(/until /gi, 'finché ');
    result = result.replace(/while /gi, 'mentre ');
    result = result.replace(/then /gi, 'poi ');
    result = result.replace(/and /gi, 'e ');
    result = result.replace(/or /gi, 'o ');

    // Prima lettera maiuscola
    result = result.charAt(0).toUpperCase() + result.slice(1);

    return result;
  }

  // Traduce il titolo della ricetta
  function translateTitle(title) {
    var t = title.toLowerCase();
    var dict = {
      'chicken': 'Pollo', 'beef': 'Manzo', 'pork': 'Maiale',
      'lamb': 'Agnello', 'fish': 'Pesce', 'salmon': 'Salmone',
      'tuna': 'Tonno', 'shrimp': 'Gamberi', 'prawn': 'Gamberetti',
      'pasta': 'Pasta', 'spaghetti': 'Spaghetti', 'lasagna': 'Lasagna',
      'risotto': 'Risotto', 'pizza': 'Pizza', 'soup': 'Zuppa',
      'salad': 'Insalata', 'sandwich': 'Panino', 'burger': 'Hamburger',
      'cake': 'Torta', 'pie': 'Torta', 'pudding': 'Budino',
      'curry': 'Curry', 'stew': 'Stufato', 'roast': 'Arrosto',
      'grilled': 'Grigliato', 'fried': 'Fritto', 'baked': 'Al forno',
      'stir-fry': 'Saltato', 'casserole': 'Casserole', 'sauce': 'Sugo',
      'with': 'con', 'and': 'e', 'or': 'o'
    };

    var result = title;
    for (var en in dict) {
      var regex = new RegExp('\\b' + en + '\\b', 'gi');
      result = result.replace(regex, dict[en]);
    }
    return result;
  }

  // Traduce ingredienti singoli
  function translateIngredient(item) {
    var i = item.toLowerCase();
    var dict = {
      'chicken': 'pollo', 'beef': 'manzo', 'pork': 'maiale',
      'lamb': 'agnello', 'fish': 'pesce', 'salmon': 'salmone',
      'tuna': 'tonno', 'shrimp': 'gamberi', 'prawns': 'gamberetti',
      'onion': 'cipolla', 'onions': 'cipolle', 'garlic': 'aglio',
      'tomato': 'pomodoro', 'tomatoes': 'pomodori', 'potato': 'patata',
      'potatoes': 'patate', 'carrot': 'carota', 'carrots': 'carote',
      'pepper': 'peperone', 'peppers': 'peperoni', 'mushroom': 'fungo',
      'mushrooms': 'funghi', 'spinach': 'spinaci', 'lettuce': 'lattuga',
      'cucumber': 'cetriolo', 'lemon': 'limone', 'lime': 'lime',
      'orange': 'arancia', 'apple': 'mela', 'banana': 'banana',
      'cheese': 'formaggio', 'milk': 'latte', 'butter': 'burro',
      'cream': 'panna', 'yogurt': 'yogurt', 'egg': 'uovo',
      'eggs': 'uova', 'flour': 'farina', 'sugar': 'zucchero',
      'salt': 'sale', 'pepper spice': 'pepe', 'oil': 'olio',
      'olive oil': 'olio d\'oliva', 'vinegar': 'aceto', 'honey': 'miele',
      'rice': 'riso', 'pasta': 'pasta', 'bread': 'pane',
      'noodles': 'noodles', 'spaghetti': 'spaghetti', 'basil': 'basilico',
      'parsley': 'prezzemolo', 'oregano': 'origano', 'thyme': 'timo',
      'rosemary': 'rosmarino', 'cilantro': 'coriandolo', 'ginger': 'zenzero',
      'cinnamon': 'cannella', 'nutmeg': 'noce moscata', 'cumin': 'cumino',
      'paprika': 'paprika', 'chili': 'peperoncino', 'soy sauce': 'salsa di soia',
      'wine': 'vino', 'stock': 'brodo', 'water': 'acqua',
      'juice': 'succo', 'sauce': 'sugo', 'paste': 'pasta',
      'coconut': 'cocco', 'nuts': 'noci', 'almonds': 'mandorle',
      'walnuts': 'noci', 'peanuts': 'arachidi', 'beans': 'fagioli',
      'lentils': 'lenticchie', 'chickpeas': 'ceci', 'corn': 'mais',
      'peas': 'piselli', 'broccoli': 'broccoli', 'cauliflower': 'cavolfiore',
      'cabbage': 'cavolo', 'eggplant': 'melanzana', 'zucchini': 'zucchina',
      'squash': 'zucca', 'avocado': 'avocado', 'grapes': 'uva'
    };

    var result = item;
    for (var en in dict) {
      var regex = new RegExp('\\b' + en + '\\b', 'gi');
      result = result.replace(regex, dict[en]);
    }
    return result;
  }

  function sanitizeIngredient(name) {
    if (!name) return '';

    var lower = name.toLowerCase();

    var stopWords = [
      'gr', 'kg', 'ml', 'l', 'pz', 'pezzi', 'pezzo',
      'fresco', 'fresca', 'freschi', 'fresche',
      'biologico', 'bio', 'naturale',
      'intero', 'intera', 'interi', 'intere',
      'a fette', 'a cubetti', 'in polvere', 'in scatola',
      'di marca', 'brand', 'qualità'
    ];

    var translations = {
      'pomodoro': 'tomato', 'pomodori': 'tomato',
      'mozzarella': 'mozzarella', 'parmigiano': 'parmesan',
      'basilico': 'basil', 'pollo': 'chicken',
      'manzo': 'beef', 'maiale': 'pork',
      'pesce': 'fish', 'salmone': 'salmon',
      'tonno': 'tuna', 'uova': 'egg', 'uovo': 'egg',
      'latte': 'milk', 'formaggio': 'cheese',
      'ricotta': 'ricotta', 'yogurt': 'yogurt',
      'burro': 'butter', 'pane': 'bread',
      'pasta': 'pasta', 'riso': 'rice',
      'patata': 'potato', 'patate': 'potato',
      'carota': 'carrot', 'carote': 'carrot',
      'cipolla': 'onion', 'cipolle': 'onion',
      'aglio': 'garlic', 'peperone': 'pepper',
      'peperoni': 'pepper', 'zucchina': 'zucchini',
      'zucchine': 'zucchini', 'melanzana': 'eggplant',
      'melanzane': 'eggplant', 'spinaci': 'spinach',
      'insalata': 'lettuce', 'limone': 'lemon',
      'arancia': 'orange', 'mela': 'apple',
      'banana': 'banana', 'fragola': 'strawberry',
      'fragole': 'strawberry', 'miele': 'honey',
      'olio': 'oil', 'aceto': 'vinegar',
      'sale': 'salt', 'pepe': 'pepper',
      'zucchero': 'sugar', 'farina': 'flour',
      'lievito': 'yeast', 'cioccolato': 'chocolate',
      'vino': 'wine', 'birra': 'beer',
      'succo': 'juice', 'acqua': 'water'
    };

    for (var itWord in translations) {
      if (lower.indexOf(itWord) !== -1) {
        return translations[itWord];
      }
    }

    var words = lower.split(/[\s\-]+/);
    for (var j = 0; j < words.length; j++) {
      var w = words[j].replace(/[^a-zàèéìòù]/g, '');
      if (w.length >= 3 && stopWords.indexOf(w) === -1) {
        return w;
      }
    }

    return '';
  }

  function getTodayKey() {
    var d = new Date();
    return 'scanEan_recipes_' + d.getFullYear() +
           String(d.getMonth()+1).padStart(2,'0') +
           String(d.getDate()).padStart(2,'0');
  }

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
