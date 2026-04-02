import React, { useMemo, useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';

// Backend API configuration
// For development: http://127.0.0.1:8000
// For mobile (same WiFi): http://YOUR_LOCAL_IP:8000 (e.g., http://192.168.1.5:8000)
// For production: Use your deployed backend URL
// Run configure_backend.py to automatically set this
const API_BASE = import.meta.env.VITE_BACKEND_BASE_URL || 'http://172.20.10.2:8000';

const REQUEST_TIMEOUT_MS = 9000;
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const GEO_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REVERSE_GEO_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const inFlight = new Map();

function storageAvailable() {
  try {
    return typeof window !== 'undefined' && window.localStorage;
  } catch (_) {
    return false;
  }
}

function cacheKey(prefix, key) {
  return `sca_${prefix}_${key}`;
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function readCache(key, ttlMs) {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== 'number') return null;
    if (ttlMs && Date.now() - parsed.ts > ttlMs) return null;
    return parsed.value ?? null;
  } catch (_) {
    return null;
  }
}

function writeCache(key, value) {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
  } catch (_) {
    // Ignore storage errors (quota, private mode).
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  if (!response.ok) {
    const error = new Error('http');
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function withDedupe(key, fetcher) {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = fetcher().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

const translations = {
  en: {
    appTitle: 'Smart Crop Advisor',
    tagline: 'ML-driven crop decisions with live weather intelligence.',
    home: 'Advisory',
    history: 'History',
    about: 'About',
    contact: 'Contact',
    aboutTitle: 'About Smart Crop Advisor',
    aboutBody:
      'Smart Crop Advisor helps farmers make data-informed crop decisions using weather intelligence and ML recommendations.',
    aboutPoint1: 'Live weather-driven crop suitability insights.',
    aboutPoint2: 'Top-3 recommendations with model comparison.',
    aboutPoint3: 'Offline history for quick reference.',
    contactTitle: 'Contact',
    contactBody: 'Reach us for support, partnerships, or feedback.',
    contactEmail: 'Email',
    contactPhone: 'Phone',
    contactAddress: 'Address',
    contactHours: 'Hours',
    language: 'Language',
    location: 'Location',
    manualLocation: 'Enter location',
    autoDetect: 'Auto-detect location',
    fetchWeather: 'Fetch weather',
    fetchDetails: 'Fetch details',
    weatherSnapshot: 'Weather snapshot',
    advisory: 'Farming advisory',
    soilInputs: 'Soil inputs',
    nitrogen: 'Nitrogen (N)',
    phosphorus: 'Phosphorus (P)',
    potassium: 'Potassium (K)',
    ph: 'Soil pH',
    season: 'Season',
    unavailableCrops: 'Unavailable crops (comma separated)',
    uploadImage: 'Upload crop/soil image (optional)',
    getRecommendation: 'Get recommendation',
    bestCrop: 'Best crop',
    confidence: 'Confidence',
    updated: 'Updated',
    chosenModel: 'Chosen model',
    alternatives: 'Top alternatives',
    yieldPotential: 'Yield potential',
    marketDemand: 'Market demand',
    whyRecommended: 'Why recommended',
    modelComparison: 'Model comparison',
    riskAlerts: 'Risk alerts',
    resilientCrops: 'Resilient crops',
    irrigationAdvice: 'Irrigation advice',
    fertilizerAdjustments: 'Fertilizer adjustments',
    substituteCrops: 'Substitute crops',
    cropManagement: 'Crop management',
    sowingMethod: 'Sowing method',
    irrigationSchedule: 'Irrigation schedule',
    fertilizerPlan: 'Fertilizer plan',
    pestControl: 'Pest control',
    harvestTime: 'Harvest time',
    noHistory: 'No saved recommendations yet.',
    historySubtitle: 'Tap a record to view details.',
    clearHistory: 'Clear history',
    apiError: 'Unable to fetch recommendation. Check the backend.',
    weatherError: 'Unable to fetch weather. Try again.',
    missingFields: 'Enter a location or auto-detect first.',
    savedOffline: 'Saved for offline access.',
    locationDetected: 'Location detected.',
    weatherLoaded: 'Weather updated.',
  },
  hi: {
    appTitle: 'स्मार्ट क्रॉप एडवाइजर',
    tagline: 'लाइव मौसम के साथ फसल सिफारिशें।',
    home: 'सलाह',
    history: 'इतिहास',
    about: 'जानकारी',
    contact: 'संपर्क',
    aboutTitle: 'स्मार्ट क्रॉप एडवाइजर के बारे में',
    aboutBody:
      'स्मार्ट क्रॉप एडवाइजर मौसम और ML के आधार पर फसल सिफारिशों में मदद करता है।',
    aboutPoint1: 'लाइव मौसम पर आधारित फसल सुझाव।',
    aboutPoint2: 'शीर्ष 3 सिफारिशें और मॉडल तुलना।',
    aboutPoint3: 'ऑफलाइन इतिहास संग्रह।',
    contactTitle: 'संपर्क',
    contactBody: 'सहायता, साझेदारी या प्रतिक्रिया के लिए संपर्क करें।',
    contactEmail: 'ईमेल',
    contactPhone: 'फोन',
    contactAddress: 'पता',
    contactHours: 'समय',
    language: 'भाषा',
    location: 'स्थान',
    manualLocation: 'स्थान दर्ज करें',
    autoDetect: 'स्वचालित स्थान',
    fetchWeather: 'मौसम देखें',
    fetchDetails: 'विवरण प्राप्त करें',
    weatherSnapshot: 'मौसम सारांश',
    advisory: 'खेती सलाह',
    soilInputs: 'मिट्टी के मान',
    nitrogen: 'नाइट्रोजन (N)',
    phosphorus: 'फॉस्फोरस (P)',
    potassium: 'पोटैशियम (K)',
    ph: 'मिट्टी pH',
    season: 'मौसम',
    unavailableCrops: 'उपलब्ध नहीं फसलें (कॉमा से)',
    uploadImage: 'फसल/मिट्टी चित्र (वैकल्पिक)',
    getRecommendation: 'सिफारिश प्राप्त करें',
    bestCrop: 'सर्वोत्तम फसल',
    confidence: 'विश्वास स्तर',
    updated: 'अपडेट',
    chosenModel: 'चयनित मॉडल',
    alternatives: 'वैकल्पिक फसलें',
    yieldPotential: 'उत्पादन क्षमता',
    marketDemand: 'बाजार मांग',
    whyRecommended: 'क्यों चुनी गई',
    modelComparison: 'मॉडल तुलना',
    riskAlerts: 'जोखिम चेतावनी',
    resilientCrops: 'सहनशील फसलें',
    irrigationAdvice: 'सिंचाई सलाह',
    fertilizerAdjustments: 'उर्वरक समायोजन',
    substituteCrops: 'विकल्प फसलें',
    cropManagement: 'फसल प्रबंधन',
    sowingMethod: 'बुवाई विधि',
    irrigationSchedule: 'सिंचाई समय',
    fertilizerPlan: 'उर्वरक योजना',
    pestControl: 'कीट नियंत्रण',
    harvestTime: 'कटाई समय',
    noHistory: 'कोई रिकॉर्ड नहीं मिला।',
    historySubtitle: 'विवरण देखने के लिए रिकॉर्ड चुनें।',
    clearHistory: 'इतिहास हटाएं',
    apiError: 'सिफारिश नहीं मिली। बैकएंड जांचें।',
    weatherError: 'मौसम नहीं मिला। फिर कोशिश करें।',
    missingFields: 'पहले स्थान दर्ज करें या स्वचालित चुनें।',
    savedOffline: 'ऑफलाइन सेव हो गया।',
    locationDetected: 'स्थान मिल गया।',
    weatherLoaded: 'मौसम अपडेट हुआ।',
  },
  ta: {
    appTitle: 'ஸ்மார்ட் பயிர் ஆலோசகர்',
    tagline: 'நேரடி வானிலையுடன் பயிர் பரிந்துரைகள்.',
    home: 'ஆலோசனை',
    history: 'வரலாறு',
    about: 'பற்றி',
    contact: 'தொடர்பு',
    aboutTitle: 'ஸ்மார்ட் பயிர் ஆலோசகர் பற்றி',
    aboutBody:
      'மழை/வானிலை மற்றும் ML அடிப்படையில் பயிர் தேர்விற்கு உதவுகிறது.',
    aboutPoint1: 'லைவ் வானிலை அடிப்படையிலான பரிந்துரைகள்.',
    aboutPoint2: 'சிறந்த 3 பரிந்துரைகள் மற்றும் மாடல் ஒப்பீடு.',
    aboutPoint3: 'ஆஃப்லைன் வரலாறு சேமிப்பு.',
    contactTitle: 'தொடர்பு',
    contactBody: 'உதவி, கூட்டாண்மை அல்லது கருத்துக்கு தொடர்பு கொள்ளவும்.',
    contactEmail: 'மின்னஞ்சல்',
    contactPhone: 'தொலைபேசி',
    contactAddress: 'முகவரி',
    contactHours: 'நேரம்',
    language: 'மொழி',
    location: 'இடம்',
    manualLocation: 'இடத்தை உள்ளிடவும்',
    autoDetect: 'இடத்தை தானாக கண்டறி',
    fetchWeather: 'வானிலை பெறு',
    fetchDetails: 'விவரங்கள் பெற',
    weatherSnapshot: 'வானிலை சுருக்கம்',
    advisory: 'விவசாய ஆலோசனை',
    soilInputs: 'மண் அளவுகள்',
    nitrogen: 'நைட்ரஜன் (N)',
    phosphorus: 'பாஸ்பரஸ் (P)',
    potassium: 'பொட்டாசியம் (K)',
    ph: 'மண் pH',
    season: 'பருவம்',
    unavailableCrops: 'கிடைக்காத பயிர்கள் (கமாவால்)',
    uploadImage: 'பயிர்/மண் படம் (விருப்பம்)',
    getRecommendation: 'பரிந்துரை பெற',
    bestCrop: 'சிறந்த பயிர்',
    confidence: 'நம்பகத்தன்மை',
    updated: 'புதுப்பிப்பு',
    chosenModel: 'தேர்ந்த மாதிரி',
    alternatives: 'மாற்றுப் பயிர்கள்',
    yieldPotential: 'உற்பத்தி திறன்',
    marketDemand: 'சந்தை தேவை',
    whyRecommended: 'ஏன் பரிந்துரை',
    modelComparison: 'மாதிரி ஒப்பீடு',
    riskAlerts: 'அபாய எச்சரிக்கைகள்',
    resilientCrops: 'தாங்கும் பயிர்கள்',
    irrigationAdvice: 'பாசன ஆலோசனை',
    fertilizerAdjustments: 'உர மாற்றங்கள்',
    substituteCrops: 'மாற்றுப் பயிர்கள்',
    cropManagement: 'பயிர் மேலாண்மை',
    sowingMethod: 'விதைப்புமுறை',
    irrigationSchedule: 'பாசன அட்டவணை',
    fertilizerPlan: 'உர திட்டம்',
    pestControl: 'பூச்சி கட்டுப்பாடு',
    harvestTime: 'அறுவடை நேரம்',
    noHistory: 'இதுவரை பதிவுகள் இல்லை.',
    historySubtitle: 'விவரங்கள் காண பதிவைத் தேர்வு செய்யவும்.',
    clearHistory: 'வரலாறு நீக்கு',
    apiError: 'பரிந்துரை பெற முடியவில்லை. பின்தளத்தை சரிபார்க்கவும்.',
    weatherError: 'வானிலை பெற முடியவில்லை. மீண்டும் முயற்சி செய்யவும்.',
    missingFields: 'முதலில் இடத்தை உள்ளிடவும் அல்லது தானாக கண்டறியவும்.',
    savedOffline: 'ஆஃப்லைனுக்கு சேமிக்கப்பட்டது.',
    locationDetected: 'இடம் கண்டறியப்பட்டது.',
    weatherLoaded: 'வானிலை புதுப்பிக்கப்பட்டது.',
  },
  te: {
    appTitle: 'స్మార్ట్ పంట సలహాదారు',
    tagline: 'ప్రస్తుత వాతావరణంతో పంట సిఫార్సులు.',
    home: 'సలహా',
    history: 'చరిత్ర',
    about: 'గురించి',
    contact: 'సంప్రదింపు',
    aboutTitle: 'స్మార్ట్ క్రాప్ అడ్వైజర్ గురించి',
    aboutBody:
      'వాతావరణం మరియు ML ఆధారంగా పంట ఎంపికకు సహాయం చేస్తుంది.',
    aboutPoint1: 'లైవ్ వాతావరణ ఆధారిత సూచనలు.',
    aboutPoint2: 'టాప్ 3 సిఫార్సులు, మోడల్ పోలిక.',
    aboutPoint3: 'ఆఫ్‌లైన్ చరిత్ర నిల్వ.',
    contactTitle: 'సంప్రదింపు',
    contactBody: 'సహాయం, భాగస్వామ్యం లేదా అభిప్రాయం కోసం సంప్రదించండి.',
    contactEmail: 'ఇమెయిల్',
    contactPhone: 'ఫోన్',
    contactAddress: 'చిరునామా',
    contactHours: 'సమయం',
    language: 'భాష',
    location: 'స్థానం',
    manualLocation: 'స్థానం నమోదు చేయండి',
    autoDetect: 'స్థానాన్ని ఆటో గుర్తించు',
    fetchWeather: 'వాతావరణాన్ని పొందు',
    fetchDetails: 'వివరాలు పొందండి',
    weatherSnapshot: 'వాతావరణ సారాంశం',
    advisory: 'వ్యవసాయ సలహా',
    soilInputs: 'మట్టి విలువలు',
    nitrogen: 'నైట్రోజన్ (N)',
    phosphorus: 'ఫాస్ఫరస్ (P)',
    potassium: 'పొటాషియం (K)',
    ph: 'మట్టి pH',
    season: 'సీజన్',
    unavailableCrops: 'అందుబాటులో లేని పంటలు (కామాతో)',
    uploadImage: 'పంట/మట్టి చిత్రం (ఐచ్చికం)',
    getRecommendation: 'సిఫార్సు పొందండి',
    bestCrop: 'ఉత్తమ పంట',
    confidence: 'నమ్మకం',
    updated: 'అప్డేట్',
    chosenModel: 'ఎంచుకున్న మోడల్',
    alternatives: 'ప్రత్యామ్నాయ పంటలు',
    yieldPotential: 'ఉత్పత్తి సామర్థ్యం',
    marketDemand: 'మార్కెట్ డిమాండ్',
    whyRecommended: 'ఎందుకు సిఫార్సు',
    modelComparison: 'మోడల్ పోలిక',
    riskAlerts: 'ప్రమాద హెచ్చరికలు',
    resilientCrops: 'తట్టుకునే పంటలు',
    irrigationAdvice: 'పారుదల సలహా',
    fertilizerAdjustments: 'ఎరువు మార్పులు',
    substituteCrops: 'ప్రత్యామ్నాయ పంటలు',
    cropManagement: 'పంట నిర్వహణ',
    sowingMethod: 'విత్తే పద్ధతి',
    irrigationSchedule: 'పారుదల షెడ్యూల్',
    fertilizerPlan: 'ఎరువు ప్రణాళిక',
    pestControl: 'పురుగు నియంత్రణ',
    harvestTime: 'కోత సమయం',
    noHistory: 'ఇప్పటి వరకు రికార్డులు లేవు.',
    historySubtitle: 'వివరాలు చూడటానికి రికార్డు ఎంచుకోండి.',
    clearHistory: 'చరిత్ర తొలగించు',
    apiError: 'సిఫార్సు పొందలేకపోయాం. బ్యాక్ ఎండ్‌ను తనిఖీ చేయండి.',
    weatherError: 'వాతావరణం పొందలేకపోయాం. మళ్లీ ప్రయత్నించండి.',
    missingFields: 'ముందుగా స్థానం నమోదు చేయండి లేదా ఆటో గుర్తించండి.',
    savedOffline: 'ఆఫ్‌లైన్ కోసం సేవ్ అయింది.',
    locationDetected: 'స్థానం గుర్తించబడింది.',
    weatherLoaded: 'వాతావరణం అప్డేట్ అయింది.',
  },
  ml: {
    appTitle: 'സ്മാർട്ട് ക്രോപ്പ് അഡ്വൈസർ',
    tagline: 'തത്സമയ കാലാവസ്ഥയോടൊപ്പം വിള ശുപാർശകൾ.',
    home: 'അഡ്വൈസ്',
    history: 'ചരിത്രം',
    about: 'കുറിച്ച്',
    contact: 'ബന്ധപ്പെടുക',
    aboutTitle: 'സ്മാർട്ട് ക്രോപ്പ് അഡ്വൈസർ കുറിച്ച്',
    aboutBody:
      'കാലാവസ്ഥയും ML-വും അടിസ്ഥാനമാക്കി വിള തിരഞ്ഞെടുക്കാൻ സഹായിക്കുന്നു.',
    aboutPoint1: 'ലൈവ് കാലാവസ്ഥ അടിസ്ഥാനത്തിലുള്ള നിർദേശങ്ങൾ.',
    aboutPoint2: 'ടോപ്പ് 3 ശുപാർശകളും മോഡൽ താരതമ്യവും.',
    aboutPoint3: 'ഓഫ്‌ലൈനായി ചരിത്രം സംരക്ഷണം.',
    contactTitle: 'ബന്ധപ്പെടുക',
    contactBody: 'സഹായം, പങ്കാളിത്തം, അഭിപ്രായങ്ങൾക്കായി ബന്ധപ്പെടുക.',
    contactEmail: 'ഇമെയിൽ',
    contactPhone: 'ഫോൺ',
    contactAddress: 'വിലാസം',
    contactHours: 'സമയം',
    language: 'ഭാഷ',
    location: 'സ്ഥലം',
    manualLocation: 'സ്ഥലം നൽകുക',
    autoDetect: 'സ്ഥലം സ്വയം കണ്ടെത്തുക',
    fetchWeather: 'കാലാവസ്ഥ ലഭിക്കുക',
    fetchDetails: 'വിവരങ്ങൾ ലഭിക്കുക',
    weatherSnapshot: 'കാലാവസ്ഥ സംഗ്രഹം',
    advisory: 'കൃഷി ഉപദേശം',
    soilInputs: 'മണ്ണ് മൂല്യങ്ങൾ',
    nitrogen: 'നൈട്രജൻ (N)',
    phosphorus: 'ഫോസ്ഫറസ് (P)',
    potassium: 'പോട്ടാഷ്യം (K)',
    ph: 'മണ്ണ് pH',
    season: 'സീസൺ',
    unavailableCrops: 'ലഭ്യമല്ലാത്ത വിളകൾ (കോമയിലൂടെ)',
    uploadImage: 'വിള/മണ്ണ് ചിത്രം (ഐച്ഛികം)',
    getRecommendation: 'ശുപാർശ നേടുക',
    bestCrop: 'മികച്ച വിള',
    confidence: 'വിശ്വാസനില',
    updated: 'അപ്ഡേറ്റ്',
    chosenModel: 'തിരഞ്ഞ മോഡൽ',
    alternatives: 'മാറ്റം വിളകൾ',
    yieldPotential: 'ഉൽപ്പാദന ശേഷി',
    marketDemand: 'വിപണി ആവശ്യകത',
    whyRecommended: 'എന്തുകൊണ്ട് ശുപാർശ',
    modelComparison: 'മോഡൽ താരതമ്യം',
    riskAlerts: 'അപകട മുന്നറിയിപ്പുകൾ',
    resilientCrops: 'താങ്ങുള്ള വിളകൾ',
    irrigationAdvice: 'ജലസേചന ഉപദേശം',
    fertilizerAdjustments: 'വളം മാറ്റങ്ങൾ',
    substituteCrops: 'മാറ്റം വിളകൾ',
    cropManagement: 'വിള മാനേജ്മെന്റ്',
    sowingMethod: 'വിത്തിടൽ രീതി',
    irrigationSchedule: 'ജലസേചന ഷെഡ്യൂൾ',
    fertilizerPlan: 'വളം പദ്ധതി',
    pestControl: 'കീട നിയന്ത്രണം',
    harvestTime: 'കൊയ്ത്ത് സമയം',
    noHistory: 'ഇതുവരെ റെക്കോർഡുകൾ ഇല്ല.',
    historySubtitle: 'വിവരങ്ങൾ കാണാൻ റെക്കോർഡ് തെരഞ്ഞെടുക്കുക.',
    clearHistory: 'ചരിത്രം മായ്ക്കുക',
    apiError: 'ശുപാർശ ലഭ്യമല്ല. ബാക്ക്‌എൻഡ് പരിശോധിക്കുക.',
    weatherError: 'കാലാവസ്ഥ ലഭ്യമല്ല. വീണ്ടും ശ്രമിക്കുക.',
    missingFields: 'മുമ്പ് സ്ഥലം നൽകുക അല്ലെങ്കിൽ സ്വയം കണ്ടെത്തുക.',
    savedOffline: 'ഓഫ്‌ലൈനായി സംരക്ഷിച്ചു.',
    locationDetected: 'സ്ഥലം കണ്ടെത്തി.',
    weatherLoaded: 'കാലാവസ്ഥ അപ്ഡേറ്റ് ചെയ്തു.',
  },
  kn: {
    appTitle: 'ಸ್ಮಾರ್ಟ್ ಕ್ರಾಪ್ ಸಲಹೆಗಾರ',
    tagline: 'ಲೈವ್ ಹವಾಮಾನದೊಂದಿಗೆ ಬೆಳೆಯ ಶಿಫಾರಸುಗಳು.',
    home: 'ಸಲಹೆ',
    history: 'ಇತಿಹಾಸ',
    about: 'ಬಗ್ಗೆ',
    contact: 'ಸಂಪರ್ಕ',
    aboutTitle: 'ಸ್ಮಾರ್ಟ್ ಕ್ರಾಪ್ ಸಲಹೆಗಾರ ಬಗ್ಗೆ',
    aboutBody:
      'ಹವಾಮಾನ ಮತ್ತು ML ಆಧಾರಿತವಾಗಿ ಬೆಳೆಯ ಆಯ್ಕೆಗಾಗಿ ಸಹಾಯ ಮಾಡುತ್ತದೆ.',
    aboutPoint1: 'ಲೈವ್ ಹವಾಮಾನ ಆಧಾರಿತ ಸಲಹೆಗಳು.',
    aboutPoint2: 'ಟಾಪ್ 3 ಶಿಫಾರಸುಗಳು ಮತ್ತು ಮಾದರಿ ಹೋಲಿಕೆ.',
    aboutPoint3: 'ಆಫ್‌ಲೈನ್ ಇತಿಹಾಸ ಸಂಗ್ರಹ.',
    contactTitle: 'ಸಂಪರ್ಕ',
    contactBody: 'ಸಹಾಯ, ಭಾಗಸ್ಫರ್ತಿ ಅಥವಾ ಪ್ರತಿಕ್ರಿಯೆಗಾಗಿ ಸಂಪರ್ಕಿಸಿ.',
    contactEmail: 'ಇಮೇಲ್',
    contactPhone: 'ಫೋನ್',
    contactAddress: 'ವಿಳಾಸ',
    contactHours: 'ಸಮಯ',
    language: 'ಭಾಷೆ',
    location: 'ಸ್ಥಳ',
    manualLocation: 'ಸ್ಥಳವನ್ನು ನಮೂದಿಸಿ',
    autoDetect: 'ಸ್ಥಳವನ್ನು ಸ್ವಯಂ ಪತ್ತೆಹಚ್ಚಿ',
    fetchWeather: 'ಹವಾಮಾನ ಪಡೆಯಿರಿ',
    fetchDetails: 'ವಿವರಗಳನ್ನು ಪಡೆಯಿರಿ',
    weatherSnapshot: 'ಹವಾಮಾನ ಸಾರಾಂಶ',
    advisory: 'ಕೃಷಿ ಸಲಹೆ',
    soilInputs: 'ಮಣ್ಣಿನ ಮೌಲ್ಯಗಳು',
    nitrogen: 'ನೈಟ್ರೋಜನ್ (N)',
    phosphorus: 'ಫಾಸ್ಫರಸ್ (P)',
    potassium: 'ಪೊಟ್ಯಾಸಿಯಮ್ (K)',
    ph: 'ಮಣ್ಣಿನ pH',
    season: 'ಋತು',
    unavailableCrops: 'ಲಭ್ಯವಿಲ್ಲದ ಬೆಳೆಗಳು (ಕಾಮಾಗಳಿಂದ)',
    uploadImage: 'ಬೆಳೆ/ಮಣ್ಣಿನ ಚಿತ್ರ (ಐಚ್ಛಿಕ)',
    getRecommendation: 'ಶಿಫಾರಸು ಪಡೆಯಿರಿ',
    bestCrop: 'ಉತ್ತಮ ಬೆಳೆ',
    confidence: 'ನಂಬಿಕೆ',
    updated: 'ನವೀಕರಿಸಲಾಗಿದೆ',
    chosenModel: 'ಆಯ್ದ ಮಾದರಿ',
    alternatives: 'ಪರ್ಯಾಯ ಬೆಳೆಗಳು',
    yieldPotential: 'ಉತ್ಪಾದನಾ ಸಾಮರ್ಥ್ಯ',
    marketDemand: 'ಮಾರುಕಟ್ಟೆ ಬೇಡಿಕೆ',
    whyRecommended: 'ಏಕೆ ಶಿಫಾರಸು',
    modelComparison: 'ಮಾದರಿ ಹೋಲಿಕೆ',
    riskAlerts: 'ಅಪಾಯ ಎಚ್ಚರಿಕೆಗಳು',
    resilientCrops: 'ತಾಳುವ ಬೆಳೆಗಳು',
    irrigationAdvice: 'ನೀರಾವರಿ ಸಲಹೆ',
    fertilizerAdjustments: 'ಸಾರ ಬದಲಾವಣೆಗಳು',
    substituteCrops: 'ಪರ್ಯಾಯ ಬೆಳೆಗಳು',
    cropManagement: 'ಬೆಳೆ ನಿರ್ವಹಣೆ',
    sowingMethod: 'ಬಿತ್ತುವ ವಿಧಾನ',
    irrigationSchedule: 'ನೀರಾವರಿ ವೇಳಾಪಟ್ಟಿ',
    fertilizerPlan: 'ಸಾರ ಯೋಜನೆ',
    pestControl: 'ಕೀಟ ನಿಯಂತ್ರಣ',
    harvestTime: 'ಕಟಾವಿನ ಸಮಯ',
    noHistory: 'ಇನ್ನೂ ದಾಖಲೆಗಳಿಲ್ಲ.',
    historySubtitle: 'ವಿವರಗಳಿಗಾಗಿ ದಾಖಲೆ ಆಯ್ಕೆಮಾಡಿ.',
    clearHistory: 'ಇತಿಹಾಸ ತೆರವು',
    apiError: 'ಶಿಫಾರಸು ಪಡೆಯಲಾಗಲಿಲ್ಲ. ಬ್ಯಾಕ್ ಎಂಡ್ ಪರಿಶೀಲಿಸಿ.',
    weatherError: 'ಹವಾಮಾನ ಪಡೆಯಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    missingFields: 'ಮೊದಲು ಸ್ಥಳವನ್ನು ನಮೂದಿಸಿ ಅಥವಾ ಸ್ವಯಂ ಪತ್ತೆಹಚ್ಚಿ.',
    savedOffline: 'ಆಫ್‌ಲೈನ್‌ಗೆ ಉಳಿಸಲಾಗಿದೆ.',
    locationDetected: 'ಸ್ಥಳ ಪತ್ತೆಯಾಯಿತು.',
    weatherLoaded: 'ಹವಾಮಾನ ನವೀಕರಿಸಲಾಗಿದೆ.',
  },
};

const languageOptions = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'HI' },
  { code: 'ta', label: 'TA' },
  { code: 'te', label: 'TE' },
  { code: 'ml', label: 'ML' },
  { code: 'kn', label: 'KN' },
];
const localeMap = {
  en: 'en-US',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  kn: 'kn-IN',
};

const emptyWeather = {
  temperature: 0,
  humidity: 0,
  rainfall: 0,
  condition: 'Unknown',
  forecast: [],
};

function weatherCodeLabel(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 49) return 'Foggy';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function buildAdvisory(data) {
  if (data.temperature >= 38) {
    return 'Heat stress likely. Irrigate early, mulch beds, avoid midday sprays.';
  }
  if (data.rainfall >= 20) {
    return 'Heavy rain trend. Keep drainage clear and protect waterlogging-sensitive crops.';
  }
  if (data.humidity >= 85) {
    return 'High humidity. Scout fungal diseases and improve field aeration.';
  }
  return 'Weather stable. Continue routine irrigation and nutrient schedule.';
}

function asciiOnly(value) {
  return value
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .trim();
}

async function reverseGeocode(lat, lon) {
  const latKey = Number(lat).toFixed(3);
  const lonKey = Number(lon).toFixed(3);
  const cacheId = cacheKey('revgeo', `${latKey}_${lonKey}`);
  const cached = readCache(cacheId, REVERSE_GEO_CACHE_TTL_MS);
  if (cached) return cached;

  return withDedupe(cacheId, async () => {
    console.log(`Reverse geocoding: ${lat}, ${lon}`);

    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}` +
        '&format=jsonv2&addressdetails=1&accept-language=en';
      const json = await fetchJsonWithTimeout(url, {}, 8000);

      const address = json.address || {};
      const parts = [
        address.city || address.town || address.village,
        address.state,
        address.country,
      ]
        .filter(Boolean)
        .map((part) => asciiOnly(String(part)))
        .filter(Boolean);

      if (parts.length) {
        const locationName = parts.join(', ');
        console.log('Location name:', locationName);
        writeCache(cacheId, locationName);
        return locationName;
      }

      const fallbackName = asciiOnly(String(json.display_name || ''));
      if (fallbackName) writeCache(cacheId, fallbackName);
      return fallbackName;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return '';
    }
  });
}

async function geocodeLocation(name) {
  const normalizedName = normalizeKey(name);
  const cacheId = cacheKey('geo', normalizedName);
  const cached = readCache(cacheId, GEO_CACHE_TTL_MS);
  if (cached) return cached;

  return withDedupe(cacheId, async () => {
    console.log(`Geocoding location: ${name}`);

    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        name,
      )}&count=1&language=en&format=json`;
      const json = await fetchJsonWithTimeout(url, {}, 8000);

      if (!json.results || json.results.length === 0) {
        console.error('Location not found:', name);
        throw new Error('Location not found');
      }

      const first = json.results[0];
      console.log('Geocoded location:', first);
      const result = {
        latitude: first.latitude,
        longitude: first.longitude,
        name: first.name || name,
      };
      writeCache(cacheId, result);
      return result;
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  });
}

async function fetchWeather(lat, lon) {
  const latKey = Number(lat).toFixed(2);
  const lonKey = Number(lon).toFixed(2);
  const cacheId = cacheKey('weather', `${latKey}_${lonKey}`);
  const cached = readCache(cacheId, WEATHER_CACHE_TTL_MS);
  if (cached) return cached;

  return withDedupe(cacheId, async () => {
    console.log(`Fetching weather for coordinates: ${lat}, ${lon}`);

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code' +
      '&forecast_days=7&timezone=auto';

    try {
      const json = await fetchJsonWithTimeout(url, {}, 9000);
      console.log('Weather data received:', json);

      const current = json.current;
      const daily = json.daily;

      const forecast = daily.time.map((date, index) => ({
        date,
        minTemp: daily.temperature_2m_min[index],
        maxTemp: daily.temperature_2m_max[index],
        rainfall: daily.precipitation_sum[index],
        summary: weatherCodeLabel(daily.weather_code[index]),
      }));

      const weatherData = {
        temperature: Number(current.temperature_2m) || 25.0,
        humidity: Number(current.relative_humidity_2m) || 60.0,
        rainfall: Number(current.precipitation) || 0.0,
        condition: weatherCodeLabel(Number(current.weather_code)),
        forecast,
      };

      console.log('Processed weather data:', weatherData);
      writeCache(cacheId, weatherData);
      return weatherData;
    } catch (error) {
      console.error('Error fetching weather:', error);
      throw error;
    }
  });
}

function loadHistory() {
  const raw = localStorage.getItem('history_records_v1');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

function persistHistory(records) {
  localStorage.setItem('history_records_v1', JSON.stringify(records));
}

function nextHistoryId() {
  const raw = localStorage.getItem('history_records_next_id');
  const nextId = raw ? Number(raw) + 1 : 1;
  localStorage.setItem('history_records_next_id', String(nextId));
  return nextId;
}

function formatDate(value, locale) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function ResultCard({ data, location, locale, t }) {
  if (!data) {
    return (
      <div className="empty-state">
        <p>{t('historySubtitle')}</p>
      </div>
    );
  }

  const locationLabel = asciiOnly(String(location || '')) || 'Unknown location';

  return (
    <div className="result-stack">
      <div className="result-hero">
        <div>
          <div className="hero-label">{t('bestCrop')}</div>
          <div className="hero-value">{data.best_crop}</div>
        </div>
        <div className="hero-metric">
          <span>{t('confidence')}</span>
          <strong>{data.best_confidence.toFixed(2)}%</strong>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table meta-table">
          <tbody>
            <tr>
              <th>{t('updated')}</th>
              <td>{formatDate(data.timestamp, locale)}</td>
            </tr>
            <tr>
              <th>{t('location')}</th>
              <td>{locationLabel}</td>
            </tr>
            <tr>
              <th>{t('chosenModel')}</th>
              <td>{data.chosen_model}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="card">
        <h3>{t('alternatives')}</h3>
        <div className="chip-grid">
          {data.top_recommendations.map((item) => (
            <div className="chip" key={`${item.crop}-${item.confidence}`}>
              <span>{item.crop}</span>
              <strong>{item.confidence.toFixed(1)}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>{t('yieldPotential')}</h3>
        <p>{data.expected_yield_potential}</p>
      </section>

      <section className="card">
        <h3>{t('marketDemand')}</h3>
        <p>{data.market_demand}</p>
      </section>

      <section className="card">
        <h3>{t('whyRecommended')}</h3>
        <ul className="bullet-list">
          {data.explanation.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>{t('modelComparison')}</h3>
        <div className="table-wrap">
          <table className="table model-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Crop</th>
                <th className="num">{t('confidence')}</th>
              </tr>
            </thead>
            <tbody>
              {data.model_predictions.map((item) => (
                <tr key={`${item.model}-${item.crop}`}>
                  <td>{item.model}</td>
                  <td>{item.crop}</td>
                  <td className="num">{item.confidence.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>{t('riskAlerts')}</h3>
        <ul className="bullet-list">
          {data.climate_alerts.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>{t('resilientCrops')}</h3>
        <div className="chip-grid">
          {data.resilient_crops.map((item) => (
            <div className="chip" key={item}>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>{t('irrigationAdvice')}</h3>
        <ul className="bullet-list">
          {data.irrigation_advice.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>{t('fertilizerAdjustments')}</h3>
        <ul className="bullet-list">
          {data.fertilizer_adjustments.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>{t('substituteCrops')}</h3>
        <div className="chip-grid">
          {data.alternatives_if_unavailable.map((item) => (
            <div className="chip" key={item}>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>{t('cropManagement')}</h3>
        <div className="table-wrap">
          <table className="table">
            <tbody>
              <tr>
                <th>{t('sowingMethod')}</th>
                <td>{data.guidance.sowing_method}</td>
              </tr>
              <tr>
                <th>{t('irrigationSchedule')}</th>
                <td>{data.guidance.irrigation_schedule}</td>
              </tr>
              <tr>
                <th>{t('fertilizerPlan')}</th>
                <td>{data.guidance.fertilizer_plan}</td>
              </tr>
              <tr>
                <th>{t('pestControl')}</th>
                <td>{data.guidance.pest_control}</td>
              </tr>
              <tr>
                <th>{t('harvestTime')}</th>
                <td>{data.guidance.harvest_time}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Mock recommendation (used when backend is unreachable on static hosting) ─────
const CROP_PROFILES = [
  {
    name: 'Rice',
    minHumidity: 70,
    maxTemp: 42,
    minRain: 5,
    yield: 'High (4–6 t/ha under adequate irrigation)',
    market: 'Consistently high domestic & export demand.',
    explanation: [
      'Soil N level suits transplanted paddy.',
      'Current humidity favours vegetative growth.',
      'Temperature within optimal range for grain filling.',
    ],
    sowing: 'Transplanting in puddle field; direct-seeded dry or wet method.',
    irrigation: 'Maintain 2–5 cm standing water during vegetative phase; alternate wet & dry at maturity.',
    fertilizer: 'Basal: 60 kg N, 30 kg P₂O₅, 30 kg K₂O/ha. Top-dress N at tillering & panicle initiation.',
    pest: 'Monitor for stem borer and leaf folder; apply neem-based or chlorpyrifos spray if threshold crossed.',
    harvest: '110–140 days from transplanting; harvest when 80% grains are straw-coloured.',
  },
  {
    name: 'Maize',
    minHumidity: 40,
    maxTemp: 38,
    minRain: 0,
    yield: 'Moderate–High (5–8 t/ha with hybrid seeds)',
    market: 'Strong demand from poultry feed & starch industries.',
    explanation: [
      'Warm temperature accelerates germination.',
      'Moderate humidity reduces fungal risk.',
      'Low rainfall suits rainfed upland maize.',
    ],
    sowing: 'Ridge-and-furrow sowing; seed rate 20–25 kg/ha; spacing 60 × 20 cm.',
    irrigation: '6–8 irrigations; critical at knee-high, tasselling, and grain fill stages.',
    fertilizer: '120:60:40 kg N:P:K/ha; split N into 3 doses.',
    pest: 'Scout for fall armyworm weekly; use pheromone traps and emamectin benzoate at early infestation.',
    harvest: '90–110 days; harvest when moisture < 25% for fresh ear or < 14% for dry grain.',
  },
  {
    name: 'Cotton',
    minHumidity: 30,
    maxTemp: 43,
    minRain: 0,
    yield: 'Moderate (1.5–2.5 t/ha lint)',
    market: 'Textile industry demand remains robust.',
    explanation: [
      'High temperature suits boll development.',
      'Low humidity reduces boll rot risk.',
      'Sandy-loam soil indicated by pH/NPK profile.',
    ],
    sowing: 'Ridge sowing with Bt hybrid seeds; spacing 90 × 45 cm.',
    irrigation: 'Drip preferred; critical at square formation, flowering, and boll filling.',
    fertilizer: '120:60:60 kg N:P:K/ha + 2 foliar sprays of 19:19:19 at boll set.',
    pest: 'Monitor for bollworm complex; use pheromone traps; spray Spinosad or Indoxacarb if needed.',
    harvest: '160–180 days; pick open bolls every 10–15 days to maintain quality.',
  },
  {
    name: 'Wheat',
    minHumidity: 40,
    maxTemp: 28,
    minRain: 0,
    yield: 'High (4–6 t/ha irrigated)',
    market: 'Stable government MSP and open market demand.',
    explanation: [
      'Cool temperature suits grain filling.',
      'Lower rainfall reduces leaf rust incidence.',
      'Soil P availability supports root development.',
    ],
    sowing: 'Line sowing 22 cm apart; seed rate 100–125 kg/ha; optimum sowing Oct–Nov.',
    irrigation: '5–6 irrigations; critical at crown-root initiation, tillering, jointing, and grain fill.',
    fertilizer: '120:60:40 kg N:P:K/ha; half N + full P & K at sowing; remaining N in splits.',
    pest: 'Watch for aphids and yellow rust; apply propiconazole at first rust appearance.',
    harvest: '120–150 days; harvest when grain moisture ≈ 12–14%.',
  },
];

function selectCrops(payload) {
  const { temperature, humidity, rainfall } = payload;
  const all = [...CROP_PROFILES];
  const scored = all.map((c) => {
    let score = 50;
    if (temperature <= c.maxTemp) score += 20;
    if (humidity >= c.minHumidity) score += 20;
    if (rainfall >= c.minRain) score += 10;
    return { ...c, score: score + Math.random() * 5 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function buildMockRecommendation(payload) {
  const ranked = selectCrops(payload);
  const best = ranked[0];
  const now = new Date().toISOString();
  const models = ['RandomForest', 'GradientBoost', 'SVM'];

  return {
    best_crop: best.name,
    best_confidence: best.score,
    timestamp: now,
    chosen_model: 'RandomForest',
    top_recommendations: ranked.slice(0, 3).map((c) => ({
      crop: c.name,
      confidence: c.score,
    })),
    expected_yield_potential: best.yield,
    market_demand: best.market,
    explanation: best.explanation,
    model_predictions: models.map((m, i) => ({
      model: m,
      crop: ranked[i % ranked.length].name,
      confidence: ranked[i % ranked.length].score * (0.9 + Math.random() * 0.1),
    })),
    climate_alerts:
      payload.temperature >= 38
        ? ['Heat stress risk — irrigate early morning.', 'Mulch field to conserve soil moisture.']
        : payload.rainfall >= 20
          ? ['Waterlogging risk — clear field drains.', 'Delay fertilizer application until soil drains.']
          : ['No major climate alerts for current conditions.'],
    resilient_crops: ranked.slice(1, 4).map((c) => c.name),
    irrigation_advice: [
      best.irrigation,
      'Install soil moisture sensors for precision scheduling.',
    ],
    fertilizer_adjustments: [
      best.fertilizer,
      'Adjust based on current soil test NPK readings.',
    ],
    alternatives_if_unavailable: ranked.slice(1, 4).map((c) => c.name),
    guidance: {
      sowing_method: best.sowing,
      irrigation_schedule: best.irrigation,
      fertilizer_plan: best.fertilizer,
      pest_control: best.pest,
      harvest_time: best.harvest,
    },
  };
}
// ──────────────────────────────────────────────────────────────────────────────

export default function App() {

  const [lang, setLang] = useState('en');
  const [tab, setTab] = useState('home');
  const [locationText, setLocationText] = useState('');
  const [coords, setCoords] = useState({ latitude: null, longitude: null });
  const [unavailable, setUnavailable] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageName, setImageName] = useState('');
  const [weather, setWeather] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [history, setHistory] = useState(loadHistory());
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailsBusy, setDetailsBusy] = useState(false);

  const t = useMemo(() => {
    return (key) => translations[lang][key] || key;
  }, [lang]);

  const locale = localeMap[lang] || 'en-US';
  const isHome = tab === 'home';
  const isHistory = tab === 'history';
  const isAbout = tab === 'about';
  const isContact = tab === 'contact';

  const advisoryText = useMemo(() => {
    if (!weather) return '';
    return buildAdvisory(weather);
  }, [weather]);

  async function handleFetchDetails() {
    setDetailsBusy(true);
    setMessage('');

    try {
      let { latitude, longitude } = coords;
      let detectedLocation = false;

      // Try Capacitor Geolocation first (better for mobile)
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        try {
          // Check permissions first
          const permission = await Geolocation.checkPermissions();
          
          if (permission.location === 'denied') {
            // Request permission
            const requested = await Geolocation.requestPermissions();
            if (requested.location === 'denied') {
              throw new Error('Location permission denied');
            }
          }
          
          // Get current position
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          });
          
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
          setCoords({ latitude: lat, longitude: lon });
          setLocationText(fallback);
          latitude = lat;
          longitude = lon;
          detectedLocation = true;

          // Kick off reverse geocoding without blocking weather fetch
          reverseGeocode(lat, lon)
            .then((name) => {
              if (name) {
                setLocationText(name);
              }
            })
            .catch((err) => {
              console.warn('Reverse geocoding failed:', err);
            });
        } catch (err) {
          console.warn('Capacitor geolocation failed:', err);
          // fallback to browser geolocation
        }
      }
      
      // Fallback to browser geolocation API
      if (!detectedLocation && navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0
            });
          });
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
          setCoords({ latitude: lat, longitude: lon });
          setLocationText(fallback);
          latitude = lat;
          longitude = lon;
          detectedLocation = true;

          reverseGeocode(lat, lon)
            .then((name) => {
              if (name) {
                setLocationText(name);
              }
            })
            .catch((err) => {
              console.warn('Reverse geocoding failed:', err);
            });
        } catch (err) {
          console.warn('Browser geolocation failed:', err);
          // fallback to manual input
        }
      }

      // If still no location, try manual location input
      if (latitude == null || longitude == null) {
        const manual = locationText.trim();
        if (!manual) {
          throw new Error('missing');
        }
        const geo = await geocodeLocation(manual);
        latitude = geo.latitude;
        longitude = geo.longitude;
        setCoords({ latitude, longitude });
        setLocationText(geo.name || manual);
      }

      // Fetch weather data
      const data = await fetchWeather(latitude, longitude);
      setWeather(data);
      setMessage(detectedLocation ? t('locationDetected') : t('weatherLoaded'));
    } catch (error) {
      console.error('Fetch details error:', error);
      if (error.message === 'missing') {
        setMessage(t('missingFields'));
      } else if (error.message === 'Location permission denied') {
        setMessage('Location permission denied. Please enable location in settings.');
      } else {
        setMessage(t('weatherError'));
      }
    } finally {
      setDetailsBusy(false);
    }
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setImageBase64('');
      setImageName('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const base64 = String(result).split(',')[1] || '';
      setImageBase64(base64);
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      let { latitude, longitude } = coords;
      if (latitude == null || longitude == null) {
        if (!locationText.trim()) {
          throw new Error('missing');
        }
        const geo = await geocodeLocation(locationText.trim());
        latitude = geo.latitude;
        longitude = geo.longitude;
        setCoords({ latitude, longitude });
        setLocationText(geo.name || locationText.trim());
      }

      const weatherData = weather || (await fetchWeather(latitude, longitude));
      setWeather(weatherData || emptyWeather);

      const payload = {
        latitude,
        longitude,
        location_name: locationText.trim() || 'Unknown location',
        temperature: Number(weatherData.temperature || 0),
        humidity: Number(weatherData.humidity || 0),
        rainfall: Number(weatherData.rainfall || 0),
        N: 0,
        P: 0,
        K: 0,
        ph: 0,
        season: 'Kharif',
        image_base64: imageBase64 || null,
        image_path: imageName || null,
        unavailable_crops: unavailable
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      };

      let data;
      try {
        const response = await fetch(`${API_BASE}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('api');
        data = await response.json();
      } catch (_networkErr) {
        // Backend unreachable (static hosting / offline) — use mock result
        data = buildMockRecommendation(payload);
      }

      setRecommendation(data);

      const record = {
        id: nextHistoryId(),
        timestamp: data.timestamp,
        location_name: payload.location_name,
        input_payload: payload,
        recommendation_payload: data,
      };

      const next = [record, ...history].slice(0, 100);
      setHistory(next);
      persistHistory(next);
      setSelectedHistory(record);
      setMessage(t('savedOffline'));
    } catch (error) {
      if (error.message === 'missing') {
        setMessage(t('missingFields'));
      } else {
        setMessage(t('apiError'));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSelectHistory(record) {
    setSelectedHistory(record);
    setMobileHistoryOpen(true);
    // Do NOT touch `recommendation` here — that belongs to the Advisory page only.
    // Selecting a history record only updates `selectedHistory` (history-page state).
  }

  function clearHistory() {
    setHistory([]);
    setSelectedHistory(null);
    persistHistory([]);
    localStorage.removeItem('history_records_next_id');
  }

  // Home always shows the current recommendation result
  const homeResult = recommendation;
  const homeLocation = locationText || 'Unknown';

  // History always shows the clicked history record
  const historyResult = selectedHistory?.recommendation_payload ?? null;
  const historyLocation = selectedHistory?.location_name ?? '';

  const contactDetails = [
    { label: t('contactEmail'), value: 'support@smartcropadvisor.com' },
    { label: t('contactPhone'), value: '+91 90000 12345' },
    { label: t('contactAddress'), value: 'Coimbatore, Tamil Nadu, India' },
    { label: t('contactHours'), value: 'Mon–Sat 09:00–18:00' },
  ];

  return (
    <>
      {/* ── Mobile drawer overlay ── */}
      {menuOpen && (
        <div
          className="mob-overlay"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile slide-in drawer ── */}
      <nav className={`mob-drawer ${menuOpen ? 'mob-drawer--open' : ''}`} aria-label="Mobile navigation">
        <div className="mob-drawer-header">
          <div className="brand" style={{ flex: 1 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{t('appTitle')}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t('tagline')}</div>
            </div>
          </div>
          <button
            type="button"
            className="mob-close-btn"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >✕</button>
        </div>

        <div className="mob-drawer-nav">
          {[
            { key: 'home',    icon: '🌿', label: t('home')    },
            { key: 'history', icon: '📋', label: t('history') },
            { key: 'about',   icon: 'ℹ️',  label: t('about')   },
            { key: 'contact', icon: '📞', label: t('contact') },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              className={`mob-nav-item ${tab === key ? 'mob-nav-item--active' : ''}`}
              onClick={() => { setTab(key); setMenuOpen(false); }}
            >
              <span className="mob-nav-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="mob-drawer-footer">
          <div className="mob-lang-row">
            <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{t('language')}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              style={{ marginLeft: 'auto', borderRadius: 6, padding: '6px 10px', border: '1px solid var(--border)', fontWeight: 600 }}
            >
              {languageOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </nav>

      <header className="app-header">
        <div className="header-main">
          {/* Hamburger menu — top-left globally */}
          <button
            type="button"
            className="app-burger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <span /><span /><span />
          </button>

          <div className="brand">
            <div>
              <h1>{t('appTitle')}</h1>
              <p>{t('tagline')}</p>
            </div>
          </div>
          {/* Desktop nav tabs — hidden on mobile */}
          <div className="nav-tabs">
            <button
              type="button"
              className={isHome ? 'active' : ''}
              onClick={() => setTab('home')}
            >
              {t('home')}
            </button>
            <button
              type="button"
              className={isHistory ? 'active' : ''}
              onClick={() => setTab('history')}
            >
              {t('history')}
            </button>
          </div>
        </div>
        {isHistory ? (
          <div className="header-history">
            <div>
              <h2>{t('history')}</h2>
              <p>{t('historySubtitle')}</p>
            </div>
            <button type="button" className="secondary" onClick={clearHistory}>
              {t('clearHistory')}
            </button>
          </div>
        ) : null}
      </header>

      {message ? (
        <div className="toast">
          <div className="toast-inner">
            <span>{message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => setMessage('')}
              aria-label="Close message"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {isHome ? (
        <div className="layout">
          <section className="panel form-panel">
            <form onSubmit={handleSubmit} className="form-stack">

              {/* ── Location card ── */}
              <div className="card">
                <h2 className="card-section-title">{t('location')}</h2>
                <div className="form-field">
                  <label htmlFor="location-input" className="field-label">{t('manualLocation')}</label>
                  <input
                    id="location-input"
                    type="text"
                    value={locationText}
                    onChange={(event) => setLocationText(event.target.value)}
                    placeholder="City, district, state"
                  />
                </div>
                <button
                  type="button"
                  className="secondary fetch-btn"
                  onClick={handleFetchDetails}
                  disabled={detailsBusy}
                >
                  {detailsBusy ? '…' : t('fetchDetails')}
                </button>
              </div>

              {/* ── Crop preferences card ── */}
              <div className="card">
                <h2 className="card-section-title">{t('soilInputs')}</h2>
                <div className="form-field">
                  <label htmlFor="unavailable-input" className="field-label">{t('unavailableCrops')}</label>
                  <input
                    id="unavailable-input"
                    type="text"
                    value={unavailable}
                    onChange={(event) => setUnavailable(event.target.value)}
                    placeholder="rice, wheat"
                  />
                </div>
                <div className="form-field upload">
                  <label htmlFor="image-upload" className="field-label">{t('uploadImage')}</label>
                  <input id="image-upload" type="file" accept="image/*" onChange={handleImageChange} />
                </div>
                {imageName ? <div className="file-pill">📎 {imageName}</div> : null}
              </div>

              <button type="submit" className="primary" disabled={loading}>
                {loading ? '…' : t('getRecommendation')}
              </button>
            </form>
          </section>

          <aside className="panel info-panel">
            <section className="card highlight">
              <h2 className="card-section-title">{t('weatherSnapshot')}</h2>
              {weather ? (
                <>
                  {/* ── Mobile: stat-card grid ── */}
                  <div className="weather-stats">
                    <div className="weather-stat">
                      <div className="weather-stat-label">Temp</div>
                      <div className="weather-stat-value">{weather.temperature.toFixed(1)}°C</div>
                    </div>
                    <div className="weather-stat">
                      <div className="weather-stat-label">Humidity</div>
                      <div className="weather-stat-value">{weather.humidity.toFixed(0)}%</div>
                    </div>
                    <div className="weather-stat">
                      <div className="weather-stat-label">Rainfall</div>
                      <div className="weather-stat-value">{weather.rainfall.toFixed(1)} mm</div>
                    </div>
                    <div className="weather-stat condition">
                      <div className="weather-stat-label">Condition</div>
                      <div className="weather-stat-value" style={{fontSize:'16px'}}>{weather.condition}</div>
                    </div>
                  </div>
                  {/* ── Desktop: classic table ── */}
                  <div className="table-wrap weather-table-wrap">
                    <table className="table">
                      <tbody>
                        <tr><th>Temp</th><td>{weather.temperature.toFixed(1)}°C</td></tr>
                        <tr><th>Humidity</th><td>{weather.humidity.toFixed(0)}%</td></tr>
                        <tr><th>Rainfall</th><td>{weather.rainfall.toFixed(1)} mm</td></tr>
                        <tr><th>Condition</th><td>{weather.condition}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p>No weather data yet.</p>
              )}
              {weather?.forecast?.length ? (
                <>
                  {/* ── Desktop forecast table ── */}
                  <div className="table-wrap">
                    <table className="table forecast-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Min / Max</th>
                          <th>Summary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weather.forecast.map((day, index) => (
                          <tr key={`${day.date}-${index}`} style={{ animationDelay: `${index * 60}ms` }}>
                            <td>{day.date}</td>
                            <td>{day.minTemp.toFixed(0)}° / {day.maxTemp.toFixed(0)}°</td>
                            <td>{day.summary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* ── Mobile forecast cards ── */}
                  <div className="forecast-cards">
                    {weather.forecast.map((day, index) => (
                      <div className="forecast-card" key={`${day.date}-${index}`} style={{ animationDelay: `${index * 50}ms` }}>
                        <span className="forecast-card-date">{day.date}</span>
                        <span className="forecast-card-temp">{day.minTemp.toFixed(0)}° / {day.maxTemp.toFixed(0)}°</span>
                        <span className="forecast-card-summary">{day.summary}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </section>

            <section className="card">
              <h2 className="card-section-title">{t('advisory')}</h2>
              <p>{advisoryText || 'Fetch weather to get advisory insights.'}</p>
            </section>

            <section className="card result-card">
              <h2 className="card-section-title">{t('bestCrop')}</h2>
              <ResultCard
                data={homeResult}
                location={homeLocation}
                locale={locale}
                t={t}
              />
            </section>
          </aside>
        </div>
      ) : isHistory ? (
        <div className="layout history-layout">
          <section className="panel history-panel">
            {history.length === 0 ? (
              <div className="empty-state">{t('noHistory')}</div>
            ) : (
              <>
                {/* ── Desktop: classic table ── */}
                <div className="table-wrap history-table-wrap">
                  <table className="table history-table">
                    <thead>
                      <tr>
                        <th>{t('bestCrop')}</th>
                        <th>{t('location')}</th>
                        <th>{t('updated')}</th>
                        <th className="num">{t('confidence')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item, index) => (
                        <tr
                          key={item.id || index}
                          className={selectedHistory?.id === item.id ? 'active' : ''}
                          onClick={() => handleSelectHistory(item)}
                          style={{ animationDelay: `${index * 40}ms` }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleSelectHistory(item);
                            }
                          }}
                        >
                          <td>{item.recommendation_payload.best_crop}</td>
                          <td>{asciiOnly(String(item.location_name || '')) || 'Unknown location'}</td>
                          <td>{formatDate(item.timestamp, locale)}</td>
                          <td className="num">{item.recommendation_payload.best_confidence.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Mobile: card list ── */}
                <div className="history-cards">
                  {history.map((item, index) => (
                    <React.Fragment key={item.id || index}>
                      <div
                        className={`history-card ${selectedHistory?.id === item.id ? 'active' : ''}`}
                        onClick={() => {
                          if (selectedHistory?.id === item.id) {
                            setMobileHistoryOpen((o) => !o);
                          } else {
                            handleSelectHistory(item);
                          }
                        }}
                        style={{ animationDelay: `${index * 40}ms` }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleSelectHistory(item);
                          }
                        }}
                      >
                        <div className="history-card-top">
                          <span className="history-card-crop">{item.recommendation_payload.best_crop}</span>
                          <span className="history-card-conf">{item.recommendation_payload.best_confidence.toFixed(1)}%</span>
                        </div>
                        <div className="history-card-meta">
                          <span>📍 {asciiOnly(String(item.location_name || '')) || 'Unknown'}</span>
                          <span>🕒 {formatDate(item.timestamp, locale)}</span>
                        </div>
                      </div>
                      {/* Inline detail expander for mobile */}
                      {selectedHistory?.id === item.id && mobileHistoryOpen ? (
                        <div className="history-detail-mobile" key={`detail-${item.id}`}>
                          <section className="card result-card">
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                              <h2 style={{margin:0}}>{historyResult ? historyResult.best_crop : t('history')}</h2>
                              <button
                                type="button"
                                className="secondary"
                                style={{padding:'6px 12px',fontSize:'12px',width:'auto'}}
                                onClick={() => setMobileHistoryOpen(false)}
                              >✕</button>
                            </div>
                            <ResultCard
                              data={historyResult}
                              location={historyLocation}
                              locale={locale}
                              t={t}
                            />
                          </section>
                        </div>
                      ) : null}
                    </React.Fragment>
                  ))}
                </div>
              </>
            )}
          </section>
          {/* Desktop aside panel */}
          <aside className="panel info-panel history-aside-desktop">
            <section className="card result-card">
              <h2 className="card-section-title">
                {historyResult ? historyResult.best_crop : t('history')}
              </h2>
              <ResultCard
                data={historyResult}
                location={historyLocation}
                locale={locale}
                t={t}
              />
            </section>
          </aside>
        </div>
      ) : isAbout ? (
        <div className="layout single">
          <section className="panel">
            <section className="card">
              <h2 className="card-section-title">{t('aboutTitle')}</h2>
              <p>{t('aboutBody')}</p>
            </section>
            <section className="card">
              <ul className="bullet-list">
                <li>{t('aboutPoint1')}</li>
                <li>{t('aboutPoint2')}</li>
                <li>{t('aboutPoint3')}</li>
              </ul>
            </section>
          </section>
        </div>
      ) : (
        <div className="layout single">
          <section className="panel">
            <section className="card">
              <h2>{t('contactTitle')}</h2>
              <p>{t('contactBody')}</p>
            </section>
            <section className="card">
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {contactDetails.map((item) => (
                      <tr key={item.label}>
                        <th>{item.label}</th>
                        <td>{item.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        </div>
      )}
    </>
  );
}
