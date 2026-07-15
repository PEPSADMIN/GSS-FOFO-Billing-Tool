export interface LanguageOption {
  code: string;
  englishName: string;
  nativeName: string;
}

// English plus the 10 most widely spoken Indian languages.
export const LANGUAGES: LanguageOption[] = [
  { code: "en", englishName: "English", nativeName: "English" },
  { code: "hi", englishName: "Hindi", nativeName: "हिन्दी" },
  { code: "bn", englishName: "Bengali", nativeName: "বাংলা" },
  { code: "te", englishName: "Telugu", nativeName: "తెలుగు" },
  { code: "mr", englishName: "Marathi", nativeName: "मराठी" },
  { code: "ta", englishName: "Tamil", nativeName: "தமிழ்" },
  { code: "gu", englishName: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn", englishName: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "or", englishName: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { code: "ml", englishName: "Malayalam", nativeName: "മലയാളം" },
  { code: "pa", englishName: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
];

export const DEFAULT_LANGUAGE_CODE = "en";
