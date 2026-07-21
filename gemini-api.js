/**
 * Gemini API Module
 * Gestisce le chiamate all'API di Google Gemini per generare ricette anti-spreco
 */

var GeminiAPI = (function() {
  'use strict';

  // ⚠️ INSERISCI QUI LA TUA API KEY
  // Ottienila gratuitamente da: https://aistudio.google.com/app/apikey
  var API_KEY = '';
  var API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  /**
   * Imposta la API Key (può essere chiamata dall'app)
   */
  function setApiKey(key) {
    API_KEY = key;
  }

  /**
   * Genera ricette per un prodotto in scadenza
   * @param {string} productName - Nome del prodotto
   * @param {string} category - Categoria (dairy, meat, produce, pantry...)
   * @param {number} daysLeft - Giorni rimanenti prima della scadenza
   * @returns {Promise} - Array di ricette in formato JSON
   */
  function generateRecipes(productName, category, daysLeft) {
    return new Promise(function(resolve, reject) {
      if (!API_KEY) {
        reject(new Error('API Key non configurata. Vai in Impostazioni e inserisci la tua API Key di Gemini.'));
        return;
      }

      var prompt = buildPrompt(productName, category, daysLeft);

      fetch(API_URL + '?key=' + API_KEY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          }
        })
      })
      .then(function(response) {
        if (!response.ok) {
          return response.json().then(function(errData) {
            throw new Error(errData.error?.message || 'Errore HTTP ' + response.status);
          });
        }
        return response.json();
      })
      .then(function(data) {
        var text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('Risposta vuota da Gemini');
        }

        // Parse JSON dalla risposta
        var recipes;
        try {
          recipes = JSON.parse(text);
        } catch (e) {
          // Se il JSON non è pulito, prova a estrarlo
          var jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            recipes = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Formato risposta non valido');
          }
        }

        // Normalizza la risposta
        if (recipes.recipes) {
          recipes = recipes.recipes;
        }
        if (!Array.isArray(recipes)) {
          recipes = [recipes];
        }

        resolve(recipes);
      })
      .catch(function(error) {
        console.error('Errore Gemini:', error);
        reject(error);
      });
    });
  }

  /**
   * Costruisce il prompt per Gemini
   */
  function buildPrompt(productName, category, daysLeft) {
    var urgency = daysLeft <= 1 ? 'urgente' : (daysLeft <= 3 ? 'prossima' : 'imminente');
    var catNames = {
      dairy: 'latticini',
      meat: 'carne o pesce',
      produce: 'verdura o frutta',
      pantry: 'dispensa',
      beverages: 'bevande',
      frozen: 'surgelati',
      bakery: 'panetteria',
      sweets: 'dolci'
    };
    var catName = catNames[category] || 'alimenti';

    return `Sei un assistente culinario esperto in anti-spreco alimentare. 

Il prodotto "${productName}" (categoria: ${catName}) sta per scadere tra ${daysLeft} giorno/i. 

Genera ESATTAMENTE 3 ricette semplici e veloci per utilizzare questo prodotto prima che scada. Le ricette devono essere adatte a chi ha poco tempo e ingredienti base in casa.

Rispondi SOLO con un JSON valido nel seguente formato ESATTO (senza markdown, senza spiegazioni):

[
  {
    "title": "Titolo ricetta",
    "prepTime": "15 min",
    "difficulty": "Facile",
    "servings": 2,
    "ingredients": ["ingrediente 1", "ingrediente 2", "ingrediente 3"],
    "instructions": ["Passo 1", "Passo 2", "Passo 3"],
    "tips": "Suggerimento per conservare meglio"
  }
]

Regole:
- Usa ingredienti comuni che si trovano in una dispensa italiana media
- Tempo di preparazione massimo 30 minuti
- Le ricette devono essere realistiche e testate
- Il prodotto in scadenza deve essere l'ingrediente principale
- Scrivi in italiano`;
  }

  /**
   * Genera ricette di fallback se l'API fallisce
   */
  function getFallbackRecipes(productName) {
    return [
      {
        title: 'Pasta con ' + productName,
        prepTime: '15 min',
        difficulty: 'Facile',
        servings: 2,
        ingredients: [productName, 'Pasta', 'Olio EVO', 'Sale', 'Pepe'],
        instructions: [
          'Porta a bollore una pentola d'acqua salata.',
          'Cuoci la pasta seguendo i tempi indicati sulla confezione.',
          'Scola la pasta e condiscila con ' + productName + ' a pezzetti, olio EVO, sale e pepe.',
          'Servi immediatamente.'
        ],
        tips: 'Consuma il prodotto entro la data di scadenza indicata.'
      },
      {
        title: 'Frittata con ' + productName,
        prepTime: '10 min',
        difficulty: 'Facile',
        servings: 2,
        ingredients: [productName, 'Uova', 'Parmigiano', 'Olio', 'Sale'],
        instructions: [
          'Sbatti le uova in una ciotola con sale e parmigiano.',
          'Taglia ' + productName + ' a pezzetti e aggiungilo alle uova.',
          'Scalda l'olio in una padella e versa il composto.',
          'Cuoci a fuoco medio per 3-4 minuti per lato.'
        ],
        tips: 'La frittata si conserva in frigo per 1-2 giorni.'
      },
      {
        title: 'Insalata con ' + productName,
        prepTime: '5 min',
        difficulty: 'Facilissima',
        servings: 1,
        ingredients: [productName, 'Insalata', 'Pomodori', 'Olio EVO', 'Aceto'],
        instructions: [
          'Lava e asciuga l'insalata e i pomodori.',
          'Taglia ' + productName + ' a fette o cubetti.',
          'Mischia tutto in una ciotola.',
          'Condiscila con olio EVO, aceto e sale.'
        ],
        tips: 'Mangia subito per mantenere la freschezza.'
      }
    ];
  }

  // API pubblica
  return {
    setApiKey: setApiKey,
    generateRecipes: generateRecipes,
    getFallbackRecipes: getFallbackRecipes
  };
})();
