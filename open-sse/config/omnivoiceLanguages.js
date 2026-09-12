import { GOOGLE_TTS_LANGUAGES } from "./googleTtsLanguages.js";

// Languages accepted by the OmniVoice Space's `lang` dropdown, captured verbatim from
// GET {space}/gradio_api/info. Gradio validates the value against this enum, so a name
// that is not on the list is rejected upstream rather than ignored. "Auto" (the default)
// lets the model infer the language from the text.
export const OMNIVOICE_AUTO_LANGUAGE = "Auto";

export const OMNIVOICE_LANGUAGES = [
  "Abadi", "Abkhazian", "Abron", "Abua", "Adamawa Fulfulde", "Adyghe", "Afade", "Afrikaans", "Agwagwune",
  "Aja (Benin)", "Akebu", "Alago", "Albanian", "Algerian Arabic", "Algerian Saharan Arabic",
  "Ambo-Pasco Quechua", "Ambonese Malay", "Amdo Tibetan", "Amharic", "Anaang", "Angika",
  "Antankarana Malagasy", "Aragonese", "Arbëreshë Albanian", "Arequipa-La Unión Quechua", "Armenian",
  "Ashe", "Ashéninka Perené", "Askopan", "Assamese", "Asturian", "Atayal", "Awak", "Ayacucho Quechua",
  "Azerbaijani", "Baatonum", "Bacama", "Bade", "Bafia", "Bafut", "Bagirmi Fulfulde", "Bago-Kusuntu",
  "Baharna Arabic", "Bakoko", "Balanta-Ganja", "Balti", "Bamenyam", "Bamun", "Bangwinji", "Banjar",
  "Bankon", "Baoulé", "Bara Malagasy", "Barok", "Basa (Cameroon)", "Basa (Nigeria)", "Bashkir", "Basque",
  "Batak Mandailing", "Batanga", "Bateri", "Bats", "Bayot", "Bebele", "Belarusian", "Bengali", "Betawi",
  "Bhili", "Bhojpuri", "Bilur", "Bima", "Bodo", "Boghom", "Bokyi", "Bomu", "Bondei", "Borgu Fulfulde",
  "Bosnian", "Brahui", "Braj", "Breton", "Buduma", "Buginese", "Bukharic", "Bulgarian", "Bulu (Cameroon)",
  "Bundeli", "Bunun", "Bura-Pabir", "Burak", "Burmese", "Burushaski", "Cacaloxtepec Mixtec",
  "Cajatambo North Lima Quechua", "Cakfem-Mushere", "Cameroon Pidgin", "Campidanese Sardinian",
  "Cantonese", "Catalan", "Cebuano", "Cen", "Central Kurdish", "Central Nahuatl", "Central Pame",
  "Central Pashto", "Central Puebla Nahuatl", "Central Tarahumara", "Central Yupik",
  "Central-Eastern Niger Fulfulde", "Chadian Arabic", "Chichewa", "Chichicapan Zapotec", "Chiga",
  "Chimalapa Zoque", "Chimborazo Highland Quichua", "Chinese", "Chiquián Ancash Quechua",
  "Chitwania Tharu", "Chokwe", "Chuvash", "Cibak", "Coastal Konjo", "Copainalá Zoque", "Cornish",
  "Corongo Ancash Quechua", "Croatian", "Cross River Mbembe", "Cuyamecalco Mixtec", "Czech", "Dadiya",
  "Dagbani", "Dameli", "Danish", "Dargwa", "Dazaga", "Deccan", "Degema", "Dera (Nigeria)", "Dghwede",
  "Dhatki", "Dhivehi", "Dhofari Arabic", "Dijim-Bwilim", "Dogri", "Domaaki", "Dotyali", "Duala", "Dutch",
  "DũYa", "Dyula", "Eastern Balochi", "Eastern Bolivian Guaraní", "Eastern Egyptian Bedawi Arabic",
  "Eastern Krahn", "Eastern Mari", "Eastern Yiddish", "Ebrié", "Eggon", "Egyptian Arabic", "Ejagham",
  "Eleme", "Eloyi", "Embu", "English", "Erzya", "Esan", "Esperanto", "Estonian", "Eton (Cameroon)",
  "Ewondo", "Extremaduran", "Fang (Equatorial Guinea)", "Fanti", "Farefare", "Fe'fe'", "Filipino",
  "Filomena Mata-Coahuitlán Totonac", "Finnish", "Fipa", "French", "Fulah", "Galician", "Gambian Wolof",
  "Ganda", "Garhwali", "Gawar-Bati", "Gawri", "Gbagyi", "Gbari", "Geji", "Gen", "Georgian", "German",
  "Geser-Gorom", "Gheg Albanian", "Ghomálá'", "Gidar", "Glavda", "Goan Konkani", "Goaria", "Goemai",
  "Gola", "Greek", "Guarani", "Guduf-Gava", "Guerrero Amuzgo", "Gujarati", "Gujari", "Gulf Arabic",
  "Gurgula", "Gusii", "Gusilay", "Gweno", "Güilá Zapotec", "Hadothi", "Hahon", "Haitian", "Hakha Chin",
  "Hakö", "Halia", "Hausa", "Hawaiian", "Hazaragi", "Hebrew", "Hemba", "Herero", "Highland Konjo",
  "Hijazi Arabic", "Hindi", "Huarijio", "Huautla Mazatec", "Huaxcaleca Nahuatl", "Huba", "Huitepec Mixtec",
  "Hula", "Hungarian", "Hunjara-Kaina Ke", "Hwana", "Ibibio", "Icelandic", "Idakho-Isukha-Tiriki", "Idoma",
  "Igbo", "Igo", "Ikposo", "Ikwere", "Imbabura Highland Quichua", "Indonesian", "Indus Kohistani",
  "Interlingua (International Auxiliary Language Association)", "Inupiaq", "Irish", "Iron Ossetic",
  "Isekiri", "Isoko", "Italian", "Ito", "Itzá", "Ixtayutla Mixtec", "Izon", "Jambi Malay", "Japanese",
  "Jaqaru", "Jauja Wanca Quechua", "Jaunsari", "Javanese", "Jiba", "Jju", "Judeo-Moroccan Arabic",
  "Juxtlahuaca Mixtec", "Kabardian", "Kabras", "Kabuverdianu", "Kabyle", "Kachi Koli", "Kairak",
  "Kalabari", "Kalasha", "Kalenjin", "Kalkoti", "Kamba", "Kamo", "Kanauji", "Kanembu", "Kannada",
  "Karekare", "Kashmiri", "Kathoriya Tharu", "Kati", "Kazakh", "Keiyo", "Khams Tibetan", "Khana",
  "Khetrani", "Khmer", "Khowar", "Kinga", "Kinnauri", "Kinyarwanda", "Kirghiz", "Kirya-Konzəl",
  "Kochila Tharu", "Kohistani Shina", "Kohumono", "Kok Borok", "Kol (Papua New Guinea)", "Kom (Cameroon)",
  "Koma", "Konkani", "Konzo", "Korean", "Korwa", "Kota (India)", "Koti", "Kuanua", "Kuanyama",
  "Kui (India)", "Kulung (Nigeria)", "Kuot", "Kushi", "Kwambi", "Kwasio", "Lala-Roba", "Lamang", "Lao",
  "Larike-Wakasihu", "Lasi", "Latgalian", "Latvian", "Levantine Arabic", "Liana-Seti", "Liberia Kpelle",
  "Liberian English", "Libyan Arabic", "Ligurian", "Lijili", "Lingala", "Lithuanian", "Loarki", "Logooli",
  "Logudorese Sardinian", "Loja Highland Quichua", "Loloda", "Longuda", "Loxicha Zapotec", "Luba-Lulua",
  "Luo", "Lushai", "Luxembourgish", "Maasina Fulfulde", "Maba (Chad)", "Macedo-Romanian", "Macedonian",
  "Mada (Cameroon)", "Mafa", "Maithili", "Malay", "Malayalam", "Mali", "Malinaltepec Me'phaa", "Maltese",
  "Mandara", "Mandjak", "Manggarai", "Manipuri", "Mansoanka", "Manx", "Maori", "Marathi", "Marghi Central",
  "Marghi South", "Maria (India)", "Marwari (Pakistan)", "Masana", "Masikoro Malagasy", "Matsés",
  "Mazaltepec Zapotec", "Mazatlán Mazatec", "Mazatlán Mixe", "Mbe", "Mbo (Cameroon)", "Mbum", "Medumba",
  "Mekeo", "Meru", "Mesopotamian Arabic", "Mewari", "Min Nan Chinese", "Mingrelian", "Mitlatongo Mixtec",
  "Miya", "Mokpwe", "Moksha", "Mom Jango", "Mongolian", "Moroccan Arabic", "Motu", "Mpiemo", "Mpumpong",
  "Mundang", "Mungaka", "Musey", "Musgu", "Musi", "Naba", "Najdi Arabic", "Nalik", "Nawdm", "Ndonga",
  "Neapolitan", "Nepali", "Ngamo", "Ngas", "Ngiemboon", "Ngizim", "Ngomba", "Ngombale",
  "Nigerian Fulfulde", "Nigerian Pidgin", "Nimadi", "Nobiin", "North Mesopotamian Arabic",
  "North Moluccan Malay", "Northern Betsimisaraka Malagasy", "Northern Hindko", "Northern Kurdish",
  "Northern Pame", "Northern Pashto", "Northern Uzbek", "Northwest Gbaya", "Norwegian", "Norwegian Bokmål",
  "Norwegian Nynorsk", "Notsi", "Nyankpa", "Nyungwe", "Nzanyi", "Nüpode Huitoto", "Occitan", "Od", "Odia",
  "Odual", "Omani Arabic", "Orizaba Nahuatl", "Orma", "Ormuri", "Oromo", "Pahari-Potwari", "Paiwan",
  "Panjabi", "Papuan Malay", "Parkari Koli", "Pedi", "Pero", "Persian", "Petats", "Phalura", "Piemontese",
  "Piya-Kwonci", "Plateau Malagasy", "Polish", "Poqomam", "Portuguese", "Pulaar", "Pular", "Puno Quechua",
  "Pushto", "Pökoot", "Qaqet", "Quiotepec Chinantec", "Rana Tharu", "Rangi", "Rapoisi", "Ratahan",
  "Rayón Zoque", "Romanian", "Romansh", "Rombo", "Rotokas", "Rukai", "Russian", "Sacapulteco",
  "Saidi Arabic", "Sakalava Malagasy", "Sakizaya", "Saleman", "Samba Daka", "Samba Leko",
  "San Felipe Otlaltepec Popoloca", "San Francisco Del Mar Huave", "San Juan Atzingo Popoloca",
  "San Martín Itunyoso Triqui", "San Miguel El Grande Mixtec", "Sansi", "Sanskrit",
  "Santa Ana de Tusi Pasco Quechua", "Santa Catarina Albarradas Zapotec", "Santali",
  "Santiago del Estero Quichua", "Saposa", "Saraiki", "Sardinian", "Saya", "Sediq", "Serbian", "Seri",
  "Shina", "Shona", "Siar-Lak", "Sibe", "Sicilian", "Sihuas Ancash Quechua", "Sikkimese", "Sinaugoro",
  "Sindhi", "Sindhi Bhil", "Sinhala", "Sinicahua Mixtec", "Sipacapense", "Siwai", "Slovak", "Slovenian",
  "Solos", "Somali", "Soninke", "South Giziga", "South Ucayali Ashéninka",
  "Southeastern Nochixtlán Mixtec", "Southern Betsimisaraka Malagasy", "Southern Pashto",
  "Southern Pastaza Quechua", "Soyaltepec Mazatec", "Spanish", "Standard Arabic",
  "Standard Moroccan Tamazight", "Sudanese Arabic", "Sulka", "Svan", "Swahili", "Swedish", "Tae'",
  "Tahaggart Tamahaq", "Taita", "Tajik", "Tamil", "Tandroy-Mahafaly Malagasy", "Tangale",
  "Tanosy Malagasy", "Tarok", "Tatar", "Tedaga", "Telugu", "Tem", "Teop", "Tepeuxila Cuicatec",
  "Tepinapa Chinantec", "Tera", "Terei", "Termanu", "Tesaka Malagasy", "Tetelcingo Nahuatl",
  "Teutila Cuicatec", "Thai", "Tibetan", "Tidaá Mixtec", "Tidore", "Tigak", "Tigre", "Tigrinya",
  "Tilquiapan Zapotec", "Tinputz", "Tlacoapa Me'phaa", "Tlacoatzintepec Chinantec", "Tlingit", "Toki Pona",
  "Tomoip", "Tondano", "Tonsea", "Tooro", "Torau", "Torwali", "Tsimihety Malagasy", "Tsotso", "Tswana",
  "Tugen", "Tuki", "Tula", "Tulu", "Tunen", "Tungag", "Tunisian Arabic", "Tupuri", "Turkana", "Turkish",
  "Turkmen", "Tututepec Mixtec", "Twi", "Ubaghara", "Uighur", "Ukrainian", "Umbundu", "Upper Sorbian",
  "Urdu", "Ushojo", "Uzbek", "Vai", "Vietnamese", "Votic", "Võro", "Waci Gbe", "Wadiyara Koli", "Waja",
  "Wakhi", "Wanga", "Wapan", "Warji", "Welsh", "Wemale", "Western Frisian", "Western Highland Purepecha",
  "Western Juxtlahuaca Mixtec", "Western Maninkakan", "Western Mari", "Western Niger Fulfulde",
  "Western Panjabi", "Wolof", "Wuzlam", "Xanaguía Zapotec", "Xhosa", "Yace", "Yakut", "Yalahatan",
  "Yanahuanca Pasco Quechua", "Yangben", "Yaqui", "Yauyos Quechua", "Yekhee", "Yiddish", "Yidgha",
  "Yoruba", "Yutanduchi Mixtec", "Zacatlán-Ahuacatlán-Tepetzintla Nahuatl", "Zarma", "Zaza", "Zulu",
  "Ömie",
];

// Lowercased name -> canonical name, for case-insensitive matching.
const BY_LOWER_NAME = new Map(OMNIVOICE_LANGUAGES.map((name) => [name.toLowerCase(), name]));

// ISO-639-1 codes are what OpenAI-shaped clients send ("vi", "vi-VN"), while OmniVoice
// only speaks English language NAMES. GOOGLE_TTS_LANGUAGES already carries that
// code -> name table for the 60-odd common languages, so reuse it instead of a second copy.
const BY_CODE = new Map(
  GOOGLE_TTS_LANGUAGES
    .map(({ id, name }) => [id, BY_LOWER_NAME.get(name.toLowerCase())])
    .filter(([, name]) => name)
);

// Names OmniVoice spells differently from the ISO table or from common usage.
const EXTRA_ALIASES = {
  zh: "Chinese", "zh-cn": "Chinese", "zh-tw": "Chinese", cmn: "Chinese", mandarin: "Chinese",
  yue: "Yue Chinese", cantonese: "Yue Chinese",
  vn: "Vietnamese", "tieng viet": "Vietnamese",
  us: "English", uk: "English", gb: "English",
  pt: "Portuguese", "pt-br": "Portuguese", "pt-pt": "Portuguese",
};

/**
 * Normalize a caller-supplied language hint to a value the Space accepts.
 * Accepts an exact name ("Vietnamese"), an ISO code with or without region
 * ("vi", "vi-VN"), or nothing. Anything unrecognized falls back to "Auto"
 * rather than erroring: the language field is a hint, and OmniVoice detects
 * the language from the text on its own.
 */
export function resolveOmnivoiceLanguage(input) {
  const raw = String(input || "").trim();
  if (!raw || raw.toLowerCase() === "auto") return OMNIVOICE_AUTO_LANGUAGE;

  const lower = raw.toLowerCase();
  const exact = BY_LOWER_NAME.get(lower);
  if (exact) return exact;

  const alias = EXTRA_ALIASES[lower] || BY_CODE.get(lower);
  if (alias) return alias;

  // "vi-VN" / "vi_VN" / "en-US" -> try the bare code.
  const base = lower.split(/[-_]/)[0];
  return EXTRA_ALIASES[base] || BY_CODE.get(base) || OMNIVOICE_AUTO_LANGUAGE;
}
