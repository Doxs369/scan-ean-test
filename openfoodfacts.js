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
  /**
   * Rileva la categoria del prodotto
   * Analizza nome, brand, categorie, labels, ingredienti e keywords estese
   */
  function detectCategory(product) {
    var cats = (product.categories || []).join(' ').toLowerCase();
    var labels = (product.labels || []).join(' ').toLowerCase();
    var name = (product.name || '').toLowerCase();
    var brand = (product.brand || '').toLowerCase();
    var ingredients = (product.ingredients || '').toLowerCase();
    var allText = cats + ' ' + labels + ' ' + name + ' ' + brand + ' ' + ingredients;

    // ===== LATTICINI (DAIRY) =====
    var dairyKeywords = [
      // Italiano
      'latte', 'formaggio', 'yogurt', 'yoghurt', 'latticino', 'latticini',
      'mozzarella', 'parmigiano', 'ricotta', 'burro', 'panna', 'pannette',
      'pannarello', 'pannarello', 'pannarello', 'pannarello', 'pannarello',
      'caffè', 'caffe', 'coffee', 'coffee cream', 'coffee creamer',
      'latte condensato', 'latte in polvere', 'latte fresco', 'latte uht',
      'latte intero', 'latte scremato', 'latte parzialmente scremato',
      'latte di soia', 'latte di riso', 'latte di mandorla', 'latte di avena',
      'latte di cocco', 'latte vegetale', 'bevanda vegetale',
      'formaggio spalmabile', 'formaggio fresco', 'formaggio stagionato',
      'formaggio grattugiato', 'formaggio fuso', 'formaggio cremoso',
      'stracchino', 'mascarpone', 'gorgonzola', 'pecorino', 'grana',
      'scamorza', 'provola', 'caciocavallo', 'fontina', 'taleggio',
      'robiola', 'brie', 'camembert', 'emmental', 'edam', 'gouda',
      'feta', 'halloumi', 'yogurt greco', 'yogurt intero', 'yogurt magro',
      'yogurt bianco', 'yogurt alla frutta', 'kefir', 'fermentato',
      'gelato', 'sorbetto', 'semifreddo', 'crema', 'crema pasticcera',
      'crema chantilly', 'crema inglese', 'mascarpone', 'philadelphia',
      'philadelfia', 'philadelphia', 'spalmabile', 'spalmabili',
      'whipped cream', 'sour cream', 'double cream', 'single cream',
      'clotted cream', 'crème fraîche', 'crème fraiche',
      'butter', 'margarina', 'margarine', 'olio di burro',
      'dulce de leche', 'cajeta', 'confettura di latte',
      // Inglese
      'milk', 'cheese', 'dairy', 'cream', 'yogurt', 'yoghurt',
      'butter', 'margarine', 'ghee', 'kefir', 'quark',
      'cheddar', 'swiss cheese', 'cottage cheese', 'cream cheese',
      'sour cream', 'whipping cream', 'heavy cream', 'half and half',
      'evaporated milk', 'condensed milk', 'powdered milk', 'dry milk',
      'skim milk', 'whole milk', 'low fat milk', '2% milk', '1% milk',
      'soy milk', 'almond milk', 'oat milk', 'rice milk', 'coconut milk',
      'plant milk', 'plant-based milk', 'non-dairy milk',
      'ice cream', 'frozen yogurt', 'frozen custard',
      'whey', 'casein', 'lactose', 'lactose-free',
      'probiotic', 'probiotics', 'fermented milk',
      'fromage', 'lait', 'crème', 'beurre', 'yaourt',
      'queso', 'leche', 'crema', 'mantequilla', 'yogur',
      'käse', 'milch', 'sahne', 'butter', 'joghurt',
      // Ingredienti comuni latticini
      'latte intero', 'latte scremato', 'latte in polvere',
      'burro anidro', 'caseina', 'siero di latte', 'whey protein',
      'lattosio', 'lactose', 'fermenti lattici', 'starter culture'
    ];

    for (var d = 0; d < dairyKeywords.length; d++) {
      if (allText.indexOf(dairyKeywords[d]) !== -1) return 'dairy';
    }

    // ===== CARNE E PESCE (MEAT) =====
    var meatKeywords = [
      // Italiano
      'carne', 'pesce', 'pollo', 'salmone', 'tonno', 'prosciutto',
      'bresaola', 'wurstel', 'salsiccia', 'bistecca', 'hamburger',
      'manzo', 'maiale', 'agnello', 'vitello', 'tacchino', 'anatra',
      'coniglio', 'cervo', 'cinghiale', 'fagiano', 'quaglia',
      'salsiccia', 'salame', 'mortadella', 'bologna', 'cotechino',
      'zampone', 'pancetta', 'guanciale', 'lardo', 'speck',
      'jamón', 'jamon', 'chorizo', 'soppressa', 'nduja',
      'filetto', 'costata', 'costoletta', 'spiedino', 'spiedini',
      'hamburger', 'hamburgers', 'burger', 'cheeseburger',
      'hot dog', 'hotdog', 'wurstel', 'frankfurter', 'frankfurters',
      'cotoletta', 'scaloppina', 'brasato', 'stufato', 'ragù',
      'sugo di carne', 'brodo di carne', 'brodo di pollo',
      'brodo di manzo', 'dado', 'dadi', 'brodo granulare',
      'gambero', 'gamberi', 'gamberetto', 'gamberetti',
      'aragosta', 'astice', 'granchio', 'polpo', 'calamaro',
      'calamari', 'seppia', 'seppie', 'cozza', 'cozze',
      'vongola', 'vongole', 'ostrica', 'ostriche', 'capasanta',
      'sardina', 'sardine', 'acciuga', 'acciughe', 'alaccia',
      'sgombro', 'merluzzo', 'nasello', 'rombo', 'orata',
      'branzino', 'spigola', 'dentice', 'mormora', 'pagello',
      'triglia', 'scorfano', 'razza', 'squalo', 'pesce spada',
      'pesce azzurro', 'pesce fresco', 'pesce surgelato',
      'surimi', 'surimi', 'fish stick', 'fish sticks',
      'fish finger', 'fish fingers', 'bastoncini di pesce',
      'burger di pesce', 'burger di pollo', 'nugget', 'nuggets',
      'crocchetta', 'crocchette', 'polpetta', 'polpette',
      'polpettone', 'salsiccia', 'salsicce', 'salsiccia',
      'salsicciotto', 'salsicciotti', 'soppressata',
      // Inglese
      'meat', 'beef', 'pork', 'lamb', 'veal', 'turkey', 'duck',
      'chicken', 'fish', 'seafood', 'steak', 'fillet', 'fillet',
      'bacon', 'ham', 'sausage', 'salami', 'pepperoni',
      'meatball', 'meatballs', 'patty', 'patties',
      'ground beef', 'minced meat', 'mince', 'meatloaf',
      'roast beef', 'roast pork', 'roast chicken', 'roast lamb',
      'ribs', 'rib', 'chop', 'chops', 'tenderloin',
      'sirloin', 'rump', 'flank', 'brisket', 'shank',
      'oxtail', 'tripe', 'liver', 'kidney', 'heart',
      'shrimp', 'prawn', 'prawns', 'lobster', 'crab',
      'scallop', 'scallops', 'mussel', 'mussels', 'clam', 'clams',
      'oyster', 'oysters', 'octopus', 'squid', 'calamari',
      'anchovy', 'anchovies', 'sardine', 'sardines',
      'mackerel', 'cod', 'haddock', 'hake', 'plaice',
      'sole', 'turbot', 'halibut', 'tuna', 'tuna fish',
      'swordfish', 'marlin', 'mahi mahi', 'snapper',
      'grouper', 'barramundi', 'trout', 'salmon',
      'smoked salmon', 'gravlax', 'lox', 'caviar', 'roe',
      'surimi', 'fish cake', 'fish cakes', 'crab cake', 'crab cakes',
      'fish stick', 'fish sticks', 'fish finger', 'fish fingers',
      'chicken nugget', 'chicken nuggets', 'chicken tender',
      'chicken tenders', 'chicken wing', 'chicken wings',
      'drumstick', 'drumsticks', 'thigh', 'thighs', 'breast', 'breasts',
      'whole chicken', 'rotisserie chicken', 'roasted chicken',
      'fried chicken', 'bbq chicken', 'grilled chicken',
      'beef jerky', 'biltong', 'dried meat', 'cured meat',
      'charcuterie', 'deli meat', 'lunch meat', 'cold cuts',
      'pâté', 'pate', 'terrine', 'rillettes', 'foie gras',
      'viande', 'poisson', 'boeuf', 'porc', 'agneau', 'veau',
      'poulet', 'canard', 'dinde', 'lapin', 'gibier',
      'carne', 'pescado', 'pollo', 'pavo', 'pato', 'conejo',
      'fleisch', 'fisch', 'rind', 'schwein', 'lamm', 'kalb',
      'hähnchen', 'ente', 'truthahn', 'kaninchen',
      'vlees', 'vis', 'rundvlees', 'varkensvlees', 'lam',
      'kip', 'eend', 'kalkoen', 'konijn'
    ];

    for (var m = 0; m < meatKeywords.length; m++) {
      if (allText.indexOf(meatKeywords[m]) !== -1) return 'meat';
    }

    // ===== VERDURA E FRUTTA (PRODUCE) =====
    var produceKeywords = [
      // Italiano
      'verdura', 'frutta', 'frutto', 'ortaggio', 'ortaggi',
      'insalata', 'pomodoro', 'pomodori', 'spinaci', 'zucchina',
      'zucchine', 'melanzana', 'melanzane', 'carota', 'carote',
      'peperone', 'peperoni', 'peperoncino', 'peperoncini',
      'cipolla', 'cipolle', 'aglio', 'patata', 'patate',
      'finocchio', 'finocchi', 'cavolo', 'cavoli', 'broccoli',
      'cavolfiore', 'cavolini', 'cavolo nero', 'cavolo cappuccio',
      'lattuga', 'lattughe', 'rucola', 'indivia', 'radicchio',
      'scarola', 'catalogna', 'bietola', 'bietole', 'spinacio',
      'porro', 'porri', 'sedano', 'sedani', 'sedano rapa',
      'prezzemolo', 'basilico', 'rosmarino', 'salvia', 'menta',
      'timo', 'origano', 'dragoncello', 'erba cipollina',
      'zucca', 'zucche', 'zuccone', 'butternut', 'delica',
      'cetriolo', 'cetrioli', 'barbabietola', 'barbabietole',
      'rapa', 'rape', 'rapanelli', 'ravanello', 'ravanelli',
      'topinambur', 'carciofo', 'carciofi', 'asparago', 'asparagi',
      'fagiolino', 'fagiolini', 'taccole', 'pisello', 'piselli',
      'fava', 'fave', 'ceci', 'lenticchie', 'fagioli',
      'soia', 'edamame', 'tofu', 'tempeh', 'seitan',
      'fungo', 'funghi', 'champignon', 'porcino', 'porcini',
      'pleurotus', 'shiitake', 'maitake', 'tartufo', 'tartufi',
      'mela', 'mele', 'pera', 'pere', 'banana', 'banane',
      'arancia', 'arance', 'mandarino', 'mandarini', 'clementina',
      'clementine', 'pompelmo', 'pompelmi', 'limone', 'limoni',
      'lime', 'kiwi', 'kiwifruit', 'ananas', 'mango', 'manghi',
      'papaya', 'passion fruit', 'frutto della passione', 'maracuja',
      'litchi', 'lychee', 'rambutan', 'longan', 'durian',
      'cocco', 'noce di cocco', 'dattero', 'datteri', 'fico', 'fichi',
      'uva', 'uvetta', 'sultanina', 'prugna', 'prugne', 'albicocca',
      'albicocche', 'pesca', 'pesche', 'nettarina', 'nettarine',
      'ciliegia', 'ciliegie', 'amarena', 'amarene', 'fragola',
      'fragole', 'lampone', 'lamponi', 'mirtillo', 'mirtilli',
      'ribes', 'ribes nero', 'ribes rosso', 'mora', 'more',
      'mirtillo', 'mirtilli', 'cranberry', 'cranberries',
      'goji', 'acai', 'baobab', 'camu camu',
      'melone', 'meloni', 'anguria', 'cocomero', 'cocomeri',
      'papaia', 'guava', 'feijoa', 'jujube', 'carambola',
      'pitaya', 'dragon fruit', 'jackfruit', 'breadfruit',
      'avocado', 'avocado', 'oliva', 'olive',
      'pomodoro ciliegino', 'pomodorini', 'datterino', 'datterini',
      'san marzano', 'cuore di bue', 'costoluto', 'pachino',
      'basilico', 'prezzemolo', 'menta', 'rosmarino',
      'salvia', 'timo', 'origano', 'dragoncello',
      'erba cipollina', 'aneto', 'coriandolo', 'curry leaves',
      'kaffir lime', 'lemongrass', 'citronella',
      'alghe', 'alga', 'nori', 'wakame', 'kombu', 'dulse',
      'spirulina', 'chlorella', 'kelp', 'sea vegetable',
      // Inglese
      'vegetable', 'vegetables', 'fruit', 'fruits', 'produce',
      'greens', 'leafy greens', 'salad', 'salads',
      'tomato', 'tomatoes', 'spinach', 'zucchini', 'courgette',
      'eggplant', 'aubergine', 'carrot', 'carrots', 'pepper', 'peppers',
      'onion', 'onions', 'garlic', 'potato', 'potatoes',
      'fennel', 'cabbage', 'broccoli', 'cauliflower', 'brussels sprout',
      'brussels sprouts', 'kale', 'collard', 'collards',
      'lettuce', 'arugula', 'rocket', 'endive', 'radicchio',
      'escarole', 'chicory', 'beet', 'beets', 'beetroot', 'beetroots',
      'chard', 'swiss chard', 'leek', 'leeks', 'celery',
      'parsley', 'basil', 'rosemary', 'sage', 'mint',
      'thyme', 'oregano', 'tarragon', 'chive', 'chives',
      'dill', 'cilantro', 'coriander', 'lemongrass',
      'pumpkin', 'squash', 'butternut squash', 'acorn squash',
      'spaghetti squash', 'delicata', 'hubbard',
      'cucumber', 'cucumbers', 'pickle', 'pickles', 'gherkin',
      'turnip', 'turnips', 'rutabaga', 'swede', 'daikon',
      'radish', 'radishes', 'horseradish', 'wasabi',
      'jerusalem artichoke', 'sunchokes', 'artichoke', 'artichokes',
      'asparagus', 'green bean', 'green beans', 'snap pea', 'snap peas',
      'snow pea', 'snow peas', 'pea', 'peas', 'chickpea', 'chickpeas',
      'lentil', 'lentils', 'bean', 'beans', 'black bean', 'black beans',
      'kidney bean', 'kidney beans', 'pinto bean', 'pinto beans',
      'navy bean', 'navy beans', 'cannellini', 'borlotti',
      'soybean', 'soybeans', 'soy', 'edamame', 'tofu', 'tempeh',
      'mushroom', 'mushrooms', 'button mushroom', 'portobello',
      'oyster mushroom', 'oyster mushrooms', 'enoki', 'enokitake',
      'maitake', 'hen of the woods', 'morel', 'morels',
      'truffle', 'truffles', 'porcini', 'chanterelle', 'chanterelles',
      'apple', 'apples', 'pear', 'pears', 'banana', 'bananas',
      'orange', 'oranges', 'mandarin', 'mandarins', 'tangerine',
      'tangerines', 'clementine', 'clementines', 'satsuma',
      'grapefruit', 'grapefruits', 'lemon', 'lemons', 'lime', 'limes',
      'kiwi', 'kiwis', 'kiwifruit', 'pineapple', 'pineapples',
      'mango', 'mangoes', 'mangos', 'papaya', 'papayas',
      'passion fruit', 'passionfruit', 'passion fruits',
      'lychee', 'lychees', 'rambutan', 'rambutans', 'longan',
      'durian', 'durians', 'coconut', 'coconuts',
      'date', 'dates', 'fig', 'figs', 'grape', 'grapes',
      'raisin', 'raisins', 'sultana', 'sultanas', 'currant', 'currants',
      'plum', 'plums', 'prune', 'prunes', 'apricot', 'apricots',
      'peach', 'peaches', 'nectarine', 'nectarines',
      'cherry', 'cherries', 'sour cherry', 'sour cherries',
      'strawberry', 'strawberries', 'raspberry', 'raspberries',
      'blueberry', 'blueberries', 'blackberry', 'blackberries',
      'currant', 'currants', 'gooseberry', 'gooseberries',
      'cranberry', 'cranberries', 'goji berry', 'goji berries',
      'acai', 'baobab', 'camu camu',
      'melon', 'melons', 'watermelon', 'watermelons', 'cantaloupe',
      'honeydew', 'honeydew melon', 'galia', 'galia melon',
      'guava', 'guavas', 'feijoa', 'feijoas', 'jujube', 'jujubes',
      'star fruit', 'starfruit', 'carambola', 'carambolas',
      'dragon fruit', 'dragonfruit', 'pitaya', 'pitayas',
      'jackfruit', 'jackfruits', 'breadfruit', 'breadfruits',
      'avocado', 'avocados', 'olive', 'olives',
      'cherry tomato', 'cherry tomatoes', 'grape tomato', 'grape tomatoes',
      'roma tomato', 'roma tomatoes', 'beefsteak tomato',
      'heirloom tomato', 'heirloom tomatoes',
      'baby spinach', 'baby greens', 'microgreens', 'sprouts',
      'alfalfa', 'broccoli sprout', 'broccoli sprouts',
      'seaweed', 'nori', 'wakame', 'kombu', 'dulse', 'arame',
      'spirulina', 'chlorella', 'kelp', 'sea vegetable', 'sea vegetables',
      'legume', 'legumes', 'pulse', 'pulses',
      'légume', 'légumes', 'fruit', 'fruits',
      'verdura', 'verdure', 'frutta', 'frutti', 'ortaggio', 'ortaggi',
      'gemüse', 'obst', 'gemüse', 'obst',
      'groente', 'fruit', 'groenten', 'vruchten'
    ];

    for (var p = 0; p < produceKeywords.length; p++) {
      if (allText.indexOf(produceKeywords[p]) !== -1) return 'produce';
    }

    // ===== BEVANDE (BEVERAGES) =====
    var beverageKeywords = [
      // Italiano
      'bevanda', 'bevande', 'bibita', 'bibite', 'vino', 'vini',
      'acqua', 'acque', 'succo', 'succhi', 'birra', 'birre',
      'spumante', 'spumanti', 'liquore', 'liquori', 'cocktail',
      'aperitivo', 'aperitivi', 'digestivo', 'digestivi',
      'soda', 'gassata', 'gasata', 'naturale', 'minerale',
      'acqua minerale', 'acqua oligominerale', 'acqua leggermente frizzante',
      'acqua frizzante', 'acqua gassata', 'acqua tonica',
      'tonic', 'tonic water', 'soda water', 'club soda',
      'cola', 'pepsi', 'fanta', 'sprite', 'seven up', '7up',
      'aranciata', 'limonata', 'chinotto', 'cedrata',
      'energy drink', 'energy', 'red bull', 'monster', 'rockstar',
      'powerade', 'gatorade', 'isotonica', 'isotonic',
      'smoothie', 'smoothies', 'frullato', 'frullati',
      'shake', 'shakes', 'milkshake', 'milkshakes',
      'caffè', 'caffe', 'espresso', 'cappuccino', 'macchiato',
      'latte macchiato', 'americano', 'ristretto', 'lungo',
      'moka', 'caffè in grani', 'caffè macinato', 'caffè solubile',
      'nespresso', 'dolce gusto', 'lavazza', 'illy', 'kimbo',
      'tè', 'te', 'tea', 'tisana', 'tisane', 'infuso', 'infusi',
      'camomilla', 'menta', 'limone', 'frutti di bosco',
      'cioccolata calda', 'cioccolata', 'orzo', 'orzata',
      'ginseng', 'guaranà', 'guarana', 'mate', 'yerba mate',
      'kombucha', 'kefir drink', 'kefir da bere',
      'sake', 'soju', 'vodka', 'whisky', 'whiskey', 'rum',
      'gin', 'tequila', 'mezcal', 'brandy', 'cognac', 'armagnac',
      'grappa', 'sambuca', 'amaro', 'amari', 'limoncello',
      'marsala', 'porto', 'sherry', 'vermouth', 'vermut',
      'prosecco', 'champagne', 'franciacorta', 'lambrusco',
      'rosé', 'rose', 'bianco', 'rosso', 'bianco frizzante',
      'vino bianco', 'vino rosso', 'vino rosato', 'vino dolce',
      'vino secco', 'vino frizzante', 'vino spumante',
      'birra bionda', 'birra rossa', 'birra scura', 'birra artigianale',
      'birra ipa', 'birra lager', 'birra pils', 'birra weiss',
      'birra stout', 'birra porter', 'birra ale', 'birra belga',
      // Inglese
      'beverage', 'beverages', 'drink', 'drinks', 'wine', 'wines',
      'water', 'waters', 'juice', 'juices', 'beer', 'beers',
      'sparkling', 'liquor', 'liquors', 'spirit', 'spirits',
      'soft drink', 'soft drinks', 'fizzy drink', 'fizzy drinks',
      'carbonated', 'non-carbonated', 'still water',
      'mineral water', 'spring water', 'sparkling water',
      'tonic water', 'soda water', 'club soda', 'seltzer',
      'cola', 'pepsi', 'fanta', 'sprite', '7up', 'seven up',
      'orange soda', 'lemon soda', 'ginger ale', 'root beer',
      'energy drink', 'energy drinks', 'sports drink', 'sports drinks',
      'isotonic', 'electrolyte', 'electrolytes',
      'smoothie', 'smoothies', 'fruit smoothie', 'green smoothie',
      'shake', 'shakes', 'milkshake', 'milkshakes', 'protein shake',
      'coffee', 'coffees', 'espresso', 'cappuccino', 'latte',
      'americano', 'macchiato', 'mocha', 'flat white', 'cortado',
      'cold brew', 'iced coffee', 'frappuccino',
      'tea', 'teas', 'green tea', 'black tea', 'white tea',
      'oolong', 'pu-erh', 'herbal tea', 'chai', 'matcha',
      'chamomile', 'peppermint', 'peppermint tea', 'hibiscus',
      'hot chocolate', 'cocoa', 'drinking chocolate',
      'barley drink', 'barley coffee', 'chicory coffee',
      'kombucha', 'water kefir', 'ginger beer', 'ginger ale',
      'sake', 'soju', 'vodka', 'whisky', 'whiskey', 'rum',
      'gin', 'tequila', 'mezcal', 'brandy', 'cognac',
      'grappa', 'sambuca', 'amaro', 'limoncello',
      'port', 'sherry', 'vermouth', 'martini', 'negroni',
      'aperol', 'campari', 'prosecco', 'champagne',
      'white wine', 'red wine', 'rosé wine', 'rose wine',
      'sparkling wine', 'dessert wine', 'fortified wine',
      'pale ale', 'india pale ale', 'ipa', 'lager', 'pilsner',
      'pils', 'weiss', 'weizen', 'hefeweizen', 'stout', 'porter',
      'amber ale', 'brown ale', 'bitter', ' mild', 'barley wine',
      'cider', 'perry', 'mead', 'sangria', 'mulled wine',
      'boisson', 'boissons', 'vin', 'vins', 'eau', 'eaux',
      'jus', 'jus de', 'bière', 'bières', 'liqueur', 'liqueurs',
      'spiritueux', 'champagne', 'prosecco',
      'bebida', 'bebidas', 'vino', 'vinos', 'agua', 'aguas',
      'zumo', 'zumos', 'cerveza', 'cervezas', 'licor', 'licores',
      'getränk', 'getränke', 'wein', 'weine', 'wasser', 'wässer',
      'saft', 'säfte', 'bier', 'biere', 'likör', 'liköre',
      'drank', 'dranken', 'wijn', 'wijnen', 'water', 'waters',
      'sap', 'sappen', 'bier', 'bieren', 'likeur', 'likeuren'
    ];

    for (var b = 0; b < beverageKeywords.length; b++) {
      if (allText.indexOf(beverageKeywords[b]) !== -1) return 'beverages';
    }

    // ===== SURGELATI (FROZEN) =====
    var frozenKeywords = [
      'surgelato', 'surgelati', 'congelato', 'congelati', 'frozen',
      'gelato', 'gelati', 'sorbetto', 'sorbetti', 'semifreddo', 'semifreddi',
      'frozen yogurt', 'frozen custard', 'ice cream',
      'surghi', 'surgo', 'congelatore', 'freezer', 'deep freeze',
      'frozen pizza', 'frozen meal', 'frozen dinner', 'tv dinner',
      'frozen vegetable', 'frozen vegetables', 'frozen fruit', 'frozen fruits',
      'frozen fish', 'frozen meat', 'frozen chicken', 'frozen seafood',
      'frozen potato', 'frozen potatoes', 'frozen fry', 'frozen fries',
      'frozen pea', 'frozen peas', 'frozen bean', 'frozen beans',
      'frozen berry', 'frozen berries', 'frozen spinach',
      'frozen corn', 'frozen broccoli', 'frozen cauliflower',
      'frozen pea', 'frozen peas', 'frozen green bean',
      'frozen carrot', 'frozen carrots', 'frozen mixed vegetable',
      'frozen mixed vegetables', 'frozen stir fry',
      'frozen dumpling', 'frozen dumplings', 'frozen gyoza',
      'frozen spring roll', 'frozen spring rolls', 'frozen samosa',
      'frozen pastry', 'frozen pastries', 'frozen croissant',
      'frozen bread', 'frozen dough', 'frozen pie', 'frozen tart',
      'frozen cake', 'frozen dessert', 'frozen treat',
      'sur congelé', 'congelé', 'congelés', 'glace', 'glaces',
      'sorbet', 'sorbets', 'frozen', 'tiefgefroren', 'tiefkühl',
      'tiefgekühlt', 'tiefkühlkost', 'tiefkühlprodukt',
      'diepvries', 'diepgevroren', 'ingevroren', 'vrieskast'
    ];

    for (var f = 0; f < frozenKeywords.length; f++) {
      if (allText.indexOf(frozenKeywords[f]) !== -1) return 'frozen';
    }

    // ===== PANETTERIA (BAKERY) =====
    var bakeryKeywords = [
      'pane', 'pani', 'fette', 'fetta', 'biscotto', 'biscotti',
      'cracker', 'crackers', 'grissino', 'grissini', 'tarallo', 'taralli',
      'focaccia', 'focacce', 'ciabatta', 'ciabatte', 'baguette', 'baguettes',
      'bagel', 'bagels', 'brioche', 'brioches', 'cornetto', 'cornetti',
      'croissant', 'croissants', 'pain au chocolat', 'viennoiserie',
      'donut', 'donuts', 'ciambella', 'ciambelle', 'bombolone', 'bomboloni',
      'muffin', 'muffins', 'scone', 'scones', 'pancake', 'pancakes',
      'waffle', 'waffles', 'crespella', 'crespelle', 'crepe', 'crepes',
      'torta', 'torte', 'crostata', 'crostate', 'pasticceria', 'pasticcerie',
      'pasta sfoglia', 'pasta brisée', 'pasta frolla', 'sfoglia',
      'pizza', 'pizze', 'pizzetta', 'pizzette', 'focaccia', 'focacce',
      'piadina', 'piadine', 'tigella', 'tigelle', 'crescentina', 'crescentine',
      'gnocco', 'gnocchi', 'gnocco fritto', 'tigelle',
      'pagnotta', 'pagnotte', 'filone', 'filoni', 'ciabatta',
      'pane integrale', 'pane bianco', 'pane di segale', 'pane nero',
      'pane ai cereali', 'pane multicereali', 'pane di farro',
      'pane di kamut', 'pane senza glutine', 'pane gluten free',
      'fette biscottate', 'rusk', 'rusks', 'zwieback', 'melba toast',
      'cracker', 'crackers', 'grissino', 'grissini', 'tarallo', 'taralli',
      'pretzel', 'pretzels', 'breadstick', 'breadsticks',
      'croccantino', 'croccantini', 'crostino', 'crostini',
      'bruschetta', 'bruschette', 'crostini', 'crostino',
      'bread', 'breads', 'loaf', 'loaves', 'roll', 'rolls',
      'bun', 'buns', 'bagel', 'bagels', 'baguette', 'baguettes',
      'ciabatta', 'focaccia', 'sourdough', 'rye bread', 'whole wheat bread',
      'multigrain bread', 'white bread', 'brown bread',
      'pita', 'pitas', 'naan', 'flatbread', 'flatbreads',
      'tortilla', 'tortillas', 'wrap', 'wraps', 'lavash',
      'croissant', 'croissants', 'pain au chocolat', 'danish', 'danishes',
      'pastry', 'pastries', 'muffin', 'muffins', 'donut', 'donuts',
      'doughnut', 'doughnuts', 'scone', 'scones', 'biscuit', 'biscuits',
      'cookie', 'cookies', 'brownie', 'brownies', 'blondie', 'blondies',
      'cake', 'cakes', 'cupcake', 'cupcakes', 'layer cake', 'pound cake',
      'sponge cake', 'angel food cake', 'chiffon cake',
      'cheesecake', 'cheesecakes', 'tiramisu', 'tiramisù',
      'pie', 'pies', 'tart', 'tarts', 'quiche', 'quiches',
      'flan', 'flans', 'custard tart', 'fruit tart',
      'pizza', 'pizzas', 'calzone', 'calzones', 'stromboli',
      'bread', 'brot', 'brötchen', 'brötchen', 'baguette',
      'pain', 'pains', 'viennoiserie', 'pâtisserie',
      'pan', 'panes', 'bollería', 'bollo', 'bollos',
      'brood', 'broden', 'broodje', 'broodjes', 'stokbrood'
    ];

    for (var ba = 0; ba < bakeryKeywords.length; ba++) {
      if (allText.indexOf(bakeryKeywords[ba]) !== -1) return 'bakery';
    }

    // ===== DOLCI (SWEETS) =====
    var sweetsKeywords = [
      'dolce', 'dolci', 'cioccolato', 'cioccolata', 'cioccolatini',
      'caramella', 'caramelle', 'caramello', 'caramellato',
      'bonbon', 'bonbons', 'pralina', 'praline', 'truffle', 'truffles',
      'tartufo', 'tartufi', 'gianduiotto', 'gianduiotti',
      'bacio', 'baci', 'baci perugina', 'ferrero rocher',
      'nutella', 'crema spalmabile alle nocciole',
      'crema di nocciole', 'nocciolata', 'gianduja', 'gianduia',
      'cioccolato fondente', 'cioccolato al latte', 'cioccolato bianco',
      'tavoletta', 'tavolette', 'cioccolatino', 'cioccolatini',
      'caramella', 'caramelle', 'caramello', 'caramellato',
      'lecca lecca', 'lecca-lecca', 'lollipop', 'lollipops',
      'gomma da masticare', 'chewing gum', 'bubble gum',
      'caramella gommosa', 'caramelle gommose', 'gummy', 'gummies',
      'caramella dura', 'caramelle dure', 'hard candy',
      'caramella mou', 'caramelle mou', 'toffee', 'toffees',
      'fudge', 'fudges', 'nougat', 'nougats', 'torrone',
      'marzapane', 'marzapane', 'pasta di mandorle',
      'confetto', 'confetti', 'dragee', 'dragees',
      'caramella alla menta', 'mint candy', 'caramella alla frutta',
      'jelly bean', 'jelly beans', 'candy cane', 'candy canes',
      'marshmallow', 'marshmallows', 'meringa', 'meringhe',
      'macaron', 'macarons', 'macaroon', 'macaroons',
      'biscotto', 'biscotti', 'biscotto al cioccolato',
      'biscotto alla vaniglia', 'biscotto al burro',
      'frollino', 'frollini', 'biscotto secco', 'biscotti secchi',
      'wafer', 'wafers', 'wafer al cioccolato', 'wafer alla nocciola',
      'ferrero', 'kinder', 'kinder bueno', 'kinder surprise',
      'kinder egg', 'kinder cioccolato', 'kinder delice',
      'milka', 'lindt', 'lindor', 'godiva', 'guylian',
      'after eight', 'after eight', 'raffaello', 'raffaello',
      'ferrero collection', 'ferrero rocher', 'mon chéri',
      'sweet', 'sweets', 'candy', 'candies', 'chocolate', 'chocolates',
      'confectionery', 'confectionaries', 'sugar', 'sugary',
      'candy bar', 'candy bars', 'chocolate bar', 'chocolate bars',
      'truffle', 'truffles', 'praline', 'pralines', 'bonbon', 'bonbons',
      'gummy bear', 'gummy bears', 'gummy worm', 'gummy worms',
      'jelly baby', 'jelly babies', 'liquorice', 'licorice',
      'black jack', 'fruit salad', 'wine gum', 'wine gums',
      'peppermint', 'spearmint', 'eucalyptus', 'menthol',
      'caramel', 'caramels', 'butterscotch', 'fudge', 'fudges',
      'nougat', 'nougats', 'marzipan', 'marzipans',
      ' Turkish delight', 'lokum', 'halva', 'halvah',
      'pastry', 'pastries', 'danish', 'danishes', 'turnover', 'turnovers',
      'strudel', 'strudels', 'baklava', 'baklavas',
      'mochi', 'mochis', 'wagashi', 'wagashis',
      'confiserie', 'confiseries', 'chocolat', 'chocolats',
      'bonbon', 'bonbons', 'sucre', 'sucré', 'sucreries',
      'dulce', 'dulces', 'chocolate', 'chocolates', 'caramelo', 'caramelos',
      'süßigkeit', 'süßigkeiten', 'schokolade', 'schokoladen',
      'bonbon', 'bonbons', 'praline', 'pralinen', 'nougat',
      'snoep', 'snoepjes', 'snoepgoed', 'chocolade', 'chocolades',
      'bonbon', 'bonbons', 'praline', 'pralines'
    ];

    for (var s = 0; s < sweetsKeywords.length; s++) {
      if (allText.indexOf(sweetsKeywords[s]) !== -1) return 'sweets';
    }

    // Se non troviamo nulla, ritorna dispensa
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
