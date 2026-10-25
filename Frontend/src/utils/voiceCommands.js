/**
 * voiceCommands.js — Navigation keyword map + intent resolver
 *
 * Maps spoken phrases (in all 11 supported languages) to app routes.
 * resolveIntent(transcript, language) returns:
 *   { type: 'navigate', route, label }   — for navigation commands
 *   null                                  — if no match found
 *
 * Keywords are matched as substrings (case-insensitive) so partial phrases work.
 * e.g. "मंडी भाव दिखाओ" matches keyword "मंडी".
 */

// ── Navigation commands per language ─────────────────────────────────────────
// Structure: [ keyword, route, humanLabel ]
const NAV_COMMANDS = {
  en: [
    // ── Disease Detection Examples ──
    ['disease detection with tomato', '/predict?example=tomato', 'Disease Detection (Tomato)'],
    ['tomato disease',                '/predict?example=tomato', 'Disease Detection (Tomato)'],
    ['tomato blight',                 '/predict?example=tomato', 'Disease Detection (Tomato)'],
    ['tomato sample',                 '/predict?example=tomato', 'Disease Detection (Tomato)'],
    ['check tomato',                  '/predict?example=tomato', 'Disease Detection (Tomato)'],
    ['potato disease',                '/predict?example=potato', 'Disease Detection (Potato)'],
    ['potato blight',                 '/predict?example=potato', 'Disease Detection (Potato)'],
    ['potato sample',                 '/predict?example=potato', 'Disease Detection (Potato)'],
    ['check potato',                  '/predict?example=potato', 'Disease Detection (Potato)'],
    ['corn disease',                  '/predict?example=corn',   'Disease Detection (Corn)'],
    ['corn rust',                     '/predict?example=corn',   'Disease Detection (Corn)'],
    ['maize disease',                 '/predict?example=corn',   'Disease Detection (Corn)'],
    ['corn sample',                   '/predict?example=corn',   'Disease Detection (Corn)'],
    ['check corn',                    '/predict?example=corn',   'Disease Detection (Corn)'],
    ['pepper disease',                '/predict?example=pepper', 'Disease Detection (Pepper)'],
    ['healthy pepper',                '/predict?example=pepper', 'Disease Detection (Healthy Leaf)'],
    ['healthy leaf',                  '/predict?example=pepper', 'Disease Detection (Healthy Leaf)'],
    ['bell pepper',                   '/predict?example=pepper', 'Disease Detection (Pepper)'],
    
    // ── General Disease Detection ──
    ['disease detection',             '/predict',                'Disease Detection'],
    ['disease detector',              '/predict',                'Disease Detection'],
    ['detect disease',                '/predict',                'Disease Detection'],
    ['check disease',                 '/predict',                'Disease Detection'],
    ['crop disease',                  '/predict',                'Disease Detection'],
    ['plant disease',                 '/predict',                'Disease Detection'],
    ['leaf disease',                  '/predict',                'Disease Detection'],
    ['diagnose disease',              '/predict',                'Disease Detection'],
    ['diagnose crop',                 '/predict',                'Disease Detection'],
    ['diagnose plant',                '/predict',                'Disease Detection'],
    ['diagnose',                      '/predict',                'Disease Detection'],
    ['scan leaf',                     '/predict',                'Disease Detection'],
    ['scan crop',                     '/predict',                'Disease Detection'],
    ['check leaf',                    '/predict',                'Disease Detection'],
    ['check crop',                    '/predict',                'Disease Detection'],
    ['leaf check',                    '/predict',                'Disease Detection'],
    ['crop health',                   '/predict',                'Disease Detection'],
    ['disease',                       '/predict',                'Disease Detection'],
    ['predict',                       '/predict',                'Disease Detection'],
    ['leaf',                          '/predict',                'Disease Detection'],

    // ── Navigation Core ──
    ['dashboard',                     '/dashboard',                  'Dashboard'],
    ['home',                          '/',                           'Home'],
    ['crop recommend',                '/recommend',                  'Crop Recommendation'],
    ['crop suggestion',               '/recommend',                  'Crop Recommendation'],
    ['recommend',                     '/recommend',                  'Crop Recommendation'],
    ['fertilizer recommendation',     '/fertilizer-recommendation',  'Fertilizer Recommendation'],
    ['fertilizer',                    '/fertilizer-recommendation',  'Fertilizer Recommendation'],
    ['manure',                        '/fertilizer-recommendation',  'Fertilizer Recommendation'],
    ['soil health card',              '/fertilizer-recommendation',  'Fertilizer Recommendation'],
    ['yield prediction',              '/yield-prediction',           'Yield Prediction'],
    ['crop yield',                    '/yield-prediction',           'Yield Prediction'],
    ['yield',                         '/yield-prediction',           'Yield Prediction'],
    ['production',                    '/yield-prediction',           'Yield Prediction'],
    ['irrigation advisory',           '/tools/irrigation',           'Irrigation Advisory'],
    ['irrigation',                    '/tools/irrigation',           'Irrigation Advisory'],
    ['watering',                      '/tools/irrigation',           'Irrigation Advisory'],
    ['water',                         '/tools/irrigation',           'Irrigation Advisory'],
    ['mandi price',                   '/tools/mandi',                'Mandi Prices'],
    ['mandi rate',                    '/tools/mandi',                'Mandi Prices'],
    ['market price',                  '/tools/mandi',                'Mandi Prices'],
    ['mandi',                         '/tools/mandi',                'Mandi Prices'],
    ['price',                         '/tools/mandi',                'Mandi Prices'],
    ['bhav',                          '/tools/mandi',                'Mandi Prices'],
    ['government scheme',             '/tools/schemes',              'Scheme Eligibility'],
    ['scheme eligibility',            '/tools/schemes',              'Scheme Eligibility'],
    ['scheme',                        '/tools/schemes',              'Scheme Eligibility'],
    ['subsidy',                       '/tools/schemes',              'Scheme Eligibility'],
    ['crop calendar',                 '/tools/crop-calendar',        'Crop Calendar'],
    ['calendar',                      '/tools/crop-calendar',        'Crop Calendar'],
    ['history',                       '/history',                    'History'],
    ['past records',                  '/history',                    'History'],
    ['soil',                          '/history',                    'History'],
  ],

  hi: [
    // ── Hindi Disease Detection Examples ──
    ['टमाटर की बीमारी',                '/predict?example=tomato', 'रोग पहचान (टमाटर)'],
    ['टमाटर रोग',                      '/predict?example=tomato', 'रोग पहचान (टमाटर)'],
    ['टमाटर',                          '/predict?example=tomato', 'रोग पहचान (टमाटर)'],
    ['आलू की बीमारी',                  '/predict?example=potato', 'रोग पहचान (आलू)'],
    ['आलू रोग',                        '/predict?example=potato', 'रोग पहचान (आलू)'],
    ['आलू',                            '/predict?example=potato', 'रोग पहचान (आलू)'],
    ['मक्का की बीमारी',                '/predict?example=corn',   'रोग पहचान (मक्का)'],
    ['मक्का रोग',                      '/predict?example=corn',   'रोग पहचान (मक्का)'],
    ['मक्का',                          '/predict?example=corn',   'रोग पहचान (मक्का)'],
    ['स्वस्थ पत्ता',                   '/predict?example=pepper', 'रोग पहचान (स्वस्थ पत्ता)'],
    ['स्वस्थ पत्ती',                   '/predict?example=pepper', 'रोग पहचान (स्वस्थ पत्ता)'],
    ['शिमला मिर्च',                    '/predict?example=pepper', 'रोग पहचान (शिमला मिर्च)'],

    // ── Hindi General Disease Detection ──
    ['रोग पहचान',                      '/predict',                   'रोग पहचान'],
    ['फसल की बीमारी',                  '/predict',                   'रोग पहचान'],
    ['बीमारी जांच',                    '/predict',                   'रोग पहचान'],
    ['बीमारी चेक',                     '/predict',                   'रोग पहचान'],
    ['रोग चेक',                        '/predict',                   'रोग पहचान'],
    ['फसल जांच',                       '/predict',                   'रोग पहचान'],
    ['बीमारी बताओ',                    '/predict',                   'रोग पहचान'],
    ['पत्ती जांच',                     '/predict',                   'रोग पहचान'],
    ['पत्ते की बीमारी',                '/predict',                   'रोग पहचान'],
    ['बीमारी',                         '/predict',                   'रोग पहचान'],
    ['रोग',                            '/predict',                   'रोग पहचान'],
    ['पत्ती',                          '/predict',                   'रोग पहचान'],
    ['पत्ता',                          '/predict',                   'रोग पहचान'],

    // ── Hindi Navigation Core ──
    ['डैशबोर्ड',                        '/dashboard',                 'डैशबोर्ड'],
    ['घर',                             '/',                          'होम'],
    ['होम',                            '/',                          'होम'],
    ['फसल सिफारिश',                    '/recommend',                 'फसल सिफारिश'],
    ['फसल सुझाव',                      '/recommend',                 'फसल सिफारिश'],
    ['सिफारिश',                        '/recommend',                 'फसल सिफारिश'],
    ['खाद सिफारिश',                    '/fertilizer-recommendation', 'उर्वरक सिफारिश'],
    ['खाद की सलाह',                    '/fertilizer-recommendation', 'उर्वरक सिफारिश'],
    ['खाद',                            '/fertilizer-recommendation', 'उर्वरक सिफारिश'],
    ['उर्वरक',                         '/fertilizer-recommendation', 'उर्वरक सिफारिश'],
    ['पैदावार अनुमान',                 '/yield-prediction',          'उत्पादन अनुमान'],
    ['पैदावार',                        '/yield-prediction',          'उत्पादन अनुमान'],
    ['उत्पादन',                        '/yield-prediction',          'उत्पादन अनुमान'],
    ['सिंचाई सलाह',                    '/tools/irrigation',          'सिंचाई सलाह'],
    ['सिंचाई',                         '/tools/irrigation',          'सिंचाई सलाह'],
    ['पानी',                           '/tools/irrigation',          'सिंचाई सलाह'],
    ['मंडी भाव',                       '/tools/mandi',               'मंडी भाव'],
    ['मंडी',                           '/tools/mandi',               'मंडी भाव'],
    ['भाव',                            '/tools/mandi',               'मंडी भाव'],
    ['कीमत',                           '/tools/mandi',               'मंडी भाव'],
    ['योजना पात्रता',                  '/tools/schemes',             'योजना पात्रता'],
    ['सरकारी योजना',                   '/tools/schemes',             'योजना पात्रता'],
    ['योजना',                          '/tools/schemes',             'योजना पात्रता'],
    ['सब्सिडी',                        '/tools/schemes',             'योजना पात्रता'],
    ['फसल कैलेंडर',                    '/tools/crop-calendar',       'फसल कैलेंडर'],
    ['कैलेंडर',                        '/tools/crop-calendar',       'फसल कैलेंडर'],
    ['इतिहास',                         '/history',                   'इतिहास'],
    ['मिट्टी',                         '/history',                   'इतिहास'],
  ],

  bn: [
    ['রোগ',             '/predict',                   'রোগ শনাক্ত'],
    ['পাতা',            '/predict',                   'রোগ শনাক্ত'],
    ['ড্যাশবোর্ড',      '/dashboard',                 'ড্যাশবোর্ড'],
    ['ফসল সুপারিশ',     '/recommend',                 'ফসল সুপারিশ'],
    ['সার',             '/fertilizer-recommendation', 'সার সুপারিশ'],
    ['ফলন',             '/yield-prediction',          'ফলন পূর্বাভাস'],
    ['সেচ',             '/tools/irrigation',          'সেচ পরামর্শ'],
    ['মান্ডি',          '/tools/mandi',               'মান্ডি মূল্য'],
    ['বাজার মূল্য',     '/tools/mandi',               'মান্ডি মূল্য'],
    ['প্রকল্প',         '/tools/schemes',             'প্রকল্প যোগ্যতা'],
    ['ক্যালেন্ডার',     '/tools/crop-calendar',       'ফসল ক্যালেন্ডার'],
    ['ইতিহাস',          '/history',                   'ইতিহাস'],
  ],

  mr: [
    ['रोग',             '/predict',                   'रोग ओळख'],
    ['पान',             '/predict',                   'रोग ओळख'],
    ['डॅशबोर्ड',        '/dashboard',                 'डॅशबोर्ड'],
    ['पीक शिफारस',      '/recommend',                 'पीक शिफारस'],
    ['शिफारस',          '/recommend',                 'पीक शिफारस'],
    ['खत',              '/fertilizer-recommendation', 'खत शिफारस'],
    ['उत्पादन',         '/yield-prediction',          'उत्पादन अंदाज'],
    ['पाणी',            '/tools/irrigation',          'सिंचन सल्ला'],
    ['सिंचन',           '/tools/irrigation',          'सिंचन सल्ला'],
    ['मंडी',            '/tools/mandi',               'मंडी भाव'],
    ['बाजार भाव',       '/tools/mandi',               'मंडी भाव'],
    ['योजना',           '/tools/schemes',             'योजना पात्रता'],
    ['दिनदर्शिका',      '/tools/crop-calendar',       'पीक दिनदर्शिका'],
    ['इतिहास',          '/history',                   'इतिहास'],
  ],

  te: [
    ['వ్యాధి',          '/predict',                   'వ్యాధి గుర్తింపు'],
    ['ఆకు',             '/predict',                   'వ్యాధి గుర్తింపు'],
    ['డాష్‌బోర్డ్',     '/dashboard',                 'డాష్‌బోర్డ్'],
    ['పంట సిఫార్సు',    '/recommend',                 'పంట సిఫార్సు'],
    ['ఎరువు',           '/fertilizer-recommendation', 'ఎరువు సిఫార్సు'],
    ['దిగుబడి',         '/yield-prediction',          'దిగుబడి అంచనా'],
    ['నీటిపారుదల',      '/tools/irrigation',          'నీటిపారుదల సలహా'],
    ['మండి',            '/tools/mandi',               'మండి ధరలు'],
    ['ధర',              '/tools/mandi',               'మండి ధరలు'],
    ['పథకం',            '/tools/schemes',             'పథకాల అర్హత'],
    ['క్యాలెండర్',      '/tools/crop-calendar',       'పంట క్యాలెండర్'],
    ['చరిత్ర',          '/history',                   'చరిత్ర'],
  ],

  or: [
    ['ରୋଗ',             '/predict',                   'ରୋଗ ଚିହ୍ନଟ'],
    ['ପତ୍ର',            '/predict',                   'ରୋଗ ଚିହ୍ନଟ'],
    ['ଡ୍ୟାଶବୋର୍ଡ',     '/dashboard',                 'ଡ୍ୟାଶବୋର୍ଡ'],
    ['ଫସଲ ସୁପାରିଶ',    '/recommend',                 'ଫସଲ ସୁପାରିଶ'],
    ['ସାର',             '/fertilizer-recommendation', 'ସାର ସୁପାରିଶ'],
    ['ଅମଳ',             '/yield-prediction',          'ଅମଳ ଅନୁମାନ'],
    ['ଜଳସେଚନ',          '/tools/irrigation',          'ଜଳସେଚନ ପରାମର୍ଶ'],
    ['ମଣ୍ଡି',           '/tools/mandi',               'ମଣ୍ଡି ମୂଲ୍ୟ'],
    ['ଦର',              '/tools/mandi',               'ମଣ୍ଡି ମୂଲ୍ୟ'],
    ['ଯୋଜନା',           '/tools/schemes',             'ଯୋଜନା ଯୋଗ୍ୟତା'],
    ['କ୍ୟାଲେଣ୍ଡର',     '/tools/crop-calendar',       'ଫସଲ କ୍ୟାଲେଣ୍ଡର'],
    ['ଇତିହାସ',          '/history',                   'ଇତିହାସ'],
  ],

  ta: [
    ['நோய்',            '/predict',                   'நோய் கண்டறிதல்'],
    ['இலை',             '/predict',                   'நோய் கண்டறிதல்'],
    ['டாஷ்போர்டு',      '/dashboard',                 'டாஷ்போர்டு'],
    ['பயிர் பரிந்துரை', '/recommend',                 'பயிர் பரிந்துரை'],
    ['உரம்',            '/fertilizer-recommendation', 'உர பரிந்துரை'],
    ['மகசூல்',          '/yield-prediction',          'மகசூல் கணிப்பு'],
    ['நீர்பாசனம்',      '/tools/irrigation',          'நீர்பாசன ஆலோசனை'],
    ['மண்டி',           '/tools/mandi',               'மண்டி விலை'],
    ['விலை',            '/tools/mandi',               'மண்டி விலை'],
    ['திட்டம்',         '/tools/schemes',             'திட்ட தகுதி'],
    ['நாட்காட்டி',      '/tools/crop-calendar',       'பயிர் நாட்காட்டி'],
    ['வரலாறு',          '/history',                   'வரலாறு'],
  ],

  gu: [
    ['રોગ',             '/predict',                   'રોગ ઓળખ'],
    ['પાન',             '/predict',                   'રોગ ઓળખ'],
    ['ડેશબોર્ડ',        '/dashboard',                 'ડેશબોર્ડ'],
    ['પાક ભલામણ',       '/recommend',                 'પાક ભલામણ'],
    ['ખાતર',            '/fertilizer-recommendation', 'ખાતર ભલામણ'],
    ['ઉત્પાદન',         '/yield-prediction',          'ઉત્પાદન અનુમાન'],
    ['સિંચાઈ',          '/tools/irrigation',          'સિંચાઈ સલાહ'],
    ['પાણી',            '/tools/irrigation',          'સિંચાઈ સલાહ'],
    ['મંડી',            '/tools/mandi',               'મંડી ભાવ'],
    ['ભાવ',             '/tools/mandi',               'મંડી ભાવ'],
    ['યોજના',           '/tools/schemes',             'યોજના પાત્રતા'],
    ['કેલેન્ડર',        '/tools/crop-calendar',       'પાક કેલેન્ડર'],
    ['ઇતિહાસ',          '/history',                   'ઇતિહાસ'],
  ],

  kn: [
    ['ರೋಗ',             '/predict',                   'ರೋಗ ಪತ್ತೆ'],
    ['ಎಲೆ',             '/predict',                   'ರೋಗ ಪತ್ತೆ'],
    ['ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',   '/dashboard',                 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್'],
    ['ಬೆಳೆ ಶಿಫಾರಸು',    '/recommend',                 'ಬೆಳೆ ಶಿಫಾರಸು'],
    ['ಗೊಬ್ಬರ',          '/fertilizer-recommendation', 'ಗೊಬ್ಬರ ಶಿಫಾರಸು'],
    ['ಇಳುವರಿ',          '/yield-prediction',          'ಇಳುವರಿ ಅಂದಾಜು'],
    ['ನೀರಾವರಿ',         '/tools/irrigation',          'ನೀರಾವರಿ ಸಲಹೆ'],
    ['ಮಂಡಿ',            '/tools/mandi',               'ಮಂಡಿ ಬೆಲೆ'],
    ['ಬೆಲೆ',            '/tools/mandi',               'ಮಂಡಿ ಬೆಲೆ'],
    ['ಯೋಜನೆ',           '/tools/schemes',             'ಯೋಜನೆ ಅರ್ಹತೆ'],
    ['ಕ್ಯಾಲೆಂಡರ್',      '/tools/crop-calendar',       'ಬೆಳೆ ಕ್ಯಾಲೆಂಡರ್'],
    ['ಇತಿಹಾಸ',          '/history',                   'ಇತಿಹಾಸ'],
  ],

  ml: [
    ['രോഗം',            '/predict',                   'രോഗ നിർണ്ണയം'],
    ['ഇല',              '/predict',                   'രോഗ നിർണ്ണയം'],
    ['ഡാഷ്ബോർഡ്',       '/dashboard',                 'ഡാഷ്ബോർഡ്'],
    ['വിള ശുപാർശ',      '/recommend',                 'വിള ശുപാർശ'],
    ['വളം',             '/fertilizer-recommendation', 'വള ശുപാർശ'],
    ['വിളവ്',           '/yield-prediction',          'വിളവ് പ്രവചനം'],
    ['ജലസേചനം',        '/tools/irrigation',          'ജലസേചന ഉപദേശം'],
    ['മണ്ടി',           '/tools/mandi',               'മണ്ടി വില'],
    ['വില',             '/tools/mandi',               'മണ്ടി വില'],
    ['പദ്ധതി',          '/tools/schemes',             'പദ്ധതി യോഗ്യത'],
    ['കലണ്ടർ',          '/tools/crop-calendar',       'വിള കലണ്ടർ'],
    ['ചരിത്രം',         '/history',                   'ചരിത്രം'],
  ],

  pa: [
    ['ਬਿਮਾਰੀ',          '/predict',                   'ਰੋਗ ਪਛਾਣ'],
    ['ਪੱਤਾ',            '/predict',                   'ਰੋਗ ਪਛਾਣ'],
    ['ਡੈਸ਼ਬੋਰਡ',        '/dashboard',                 'ਡੈਸ਼ਬੋਰਡ'],
    ['ਫਸਲ ਸਿਫਾਰਸ਼',     '/recommend',                 'ਫਸਲ ਸਿਫਾਰਸ਼'],
    ['ਖਾਦ',             '/fertilizer-recommendation', 'ਖਾਦ ਸਿਫਾਰਸ਼'],
    ['ਉਪਜ',             '/yield-prediction',          'ਉਪਜ ਅਨੁਮਾਨ'],
    ['ਸਿੰਚਾਈ',          '/tools/irrigation',          'ਸਿੰਚਾਈ ਸਲਾਹ'],
    ['ਪਾਣੀ',            '/tools/irrigation',          'ਸਿੰਚਾਈ ਸਲਾਹ'],
    ['ਮੰਡੀ',            '/tools/mandi',               'ਮੰਡੀ ਭਾਅ'],
    ['ਭਾਅ',             '/tools/mandi',               'ਮੰਡੀ ਭਾਅ'],
    ['ਯੋਜਨਾ',           '/tools/schemes',             'ਯੋਜਨਾ ਯੋਗਤਾ'],
    ['ਕੈਲੰਡਰ',          '/tools/crop-calendar',       'ਫਸਲ ਕੈਲੰਡਰ'],
    ['ਇਤਿਹਾਸ',          '/history',                   'ਇਤਿਹਾਸ'],
  ],
};

/**
 * resolveIntent(transcript, language)
 * Returns:
 *   { type: 'navigate', route, label }  — navigation match
 *   null                                — no match
 *
 * Falls back to English commands if current-language map has no match,
 * since farmers sometimes mix English keywords regardless of UI language.
 */
export function resolveIntent(transcript, language) {
  if (!transcript) return null;
  const lower = transcript.toLowerCase().trim();

  const commands = NAV_COMMANDS[language] ?? NAV_COMMANDS['en'];

  // Try current language first
  for (const [keyword, route, label] of commands) {
    if (lower.includes(keyword.toLowerCase())) {
      return { type: 'navigate', route, label };
    }
  }

  // Always also try English keywords as fallback (Hinglish / code-mixing)
  if (language !== 'en') {
    for (const [keyword, route, label] of NAV_COMMANDS['en']) {
      if (lower.includes(keyword.toLowerCase())) {
        return { type: 'navigate', route, label };
      }
    }
  }

  return null;
}

export { NAV_COMMANDS };