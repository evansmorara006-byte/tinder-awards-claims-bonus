import { getExampleNumber, parsePhoneNumberFromString } from "libphonenumber-js/mobile";
import examples from "libphonenumber-js/mobile/examples";
import { Metadata } from "libphonenumber-js/mobile";
import type { CountryCode } from "libphonenumber-js";

export const COUNTRY_LIST = [
  { name: "Afghanistan", iso: "AF", dial: "93" },
  { name: "Åland Islands", iso: "AX", dial: "358" },
  { name: "Albania", iso: "AL", dial: "355" },
  { name: "Algeria", iso: "DZ", dial: "213" },
  { name: "American Samoa", iso: "AS", dial: "1" },
  { name: "Andorra", iso: "AD", dial: "376" },
  { name: "Angola", iso: "AO", dial: "244" },
  { name: "Anguilla", iso: "AI", dial: "1" },
  { name: "Antigua & Barbuda", iso: "AG", dial: "1" },
  { name: "Argentina", iso: "AR", dial: "54" },
  { name: "Armenia", iso: "AM", dial: "374" },
  { name: "Aruba", iso: "AW", dial: "297" },
  { name: "Ascension Island", iso: "AC", dial: "247" },
  { name: "Australia", iso: "AU", dial: "61" },
  { name: "Austria", iso: "AT", dial: "43" },
  { name: "Azerbaijan", iso: "AZ", dial: "994" },
  { name: "Bahamas", iso: "BS", dial: "1" },
  { name: "Bahrain", iso: "BH", dial: "973" },
  { name: "Bangladesh", iso: "BD", dial: "880" },
  { name: "Barbados", iso: "BB", dial: "1" },
  { name: "Belarus", iso: "BY", dial: "375" },
  { name: "Belgium", iso: "BE", dial: "32" },
  { name: "Belize", iso: "BZ", dial: "501" },
  { name: "Benin", iso: "BJ", dial: "229" },
  { name: "Bermuda", iso: "BM", dial: "1" },
  { name: "Bhutan", iso: "BT", dial: "975" },
  { name: "Bolivia", iso: "BO", dial: "591" },
  { name: "Bosnia & Herzegovina", iso: "BA", dial: "387" },
  { name: "Botswana", iso: "BW", dial: "267" },
  { name: "Brazil", iso: "BR", dial: "55" },
  { name: "British Indian Ocean Territory", iso: "IO", dial: "246" },
  { name: "British Virgin Islands", iso: "VG", dial: "1" },
  { name: "Brunei", iso: "BN", dial: "673" },
  { name: "Bulgaria", iso: "BG", dial: "359" },
  { name: "Burkina Faso", iso: "BF", dial: "226" },
  { name: "Burundi", iso: "BI", dial: "257" },
  { name: "Cambodia", iso: "KH", dial: "855" },
  { name: "Cameroon", iso: "CM", dial: "237" },
  { name: "Canada", iso: "CA", dial: "1" },
  { name: "Cape Verde", iso: "CV", dial: "238" },
  { name: "Caribbean Netherlands", iso: "BQ", dial: "599" },
  { name: "Cayman Islands", iso: "KY", dial: "1" },
  { name: "Central African Republic", iso: "CF", dial: "236" },
  { name: "Chad", iso: "TD", dial: "235" },
  { name: "Chile", iso: "CL", dial: "56" },
  { name: "China", iso: "CN", dial: "86" },
  { name: "Christmas Island", iso: "CX", dial: "61" },
  { name: "Cocos (Keeling) Islands", iso: "CC", dial: "61" },
  { name: "Colombia", iso: "CO", dial: "57" },
  { name: "Comoros", iso: "KM", dial: "269" },
  { name: "Congo", iso: "CG", dial: "242" },
  { name: "Cook Islands", iso: "CK", dial: "682" },
  { name: "Costa Rica", iso: "CR", dial: "506" },
  { name: "Croatia", iso: "HR", dial: "385" },
  { name: "Cuba", iso: "CU", dial: "53" },
  { name: "Curaçao", iso: "CW", dial: "599" },
  { name: "Cyprus", iso: "CY", dial: "357" },
  { name: "Czechia", iso: "CZ", dial: "420" },
  { name: "Denmark", iso: "DK", dial: "45" },
  { name: "Djibouti", iso: "DJ", dial: "253" },
  { name: "Dominica", iso: "DM", dial: "1" },
  { name: "Dominican Republic", iso: "DO", dial: "1" },
  { name: "DR Congo", iso: "CD", dial: "243" },
  { name: "Ecuador", iso: "EC", dial: "593" },
  { name: "Egypt", iso: "EG", dial: "20" },
  { name: "El Salvador", iso: "SV", dial: "503" },
  { name: "Equatorial Guinea", iso: "GQ", dial: "240" },
  { name: "Eritrea", iso: "ER", dial: "291" },
  { name: "Estonia", iso: "EE", dial: "372" },
  { name: "Eswatini", iso: "SZ", dial: "268" },
  { name: "Ethiopia", iso: "ET", dial: "251" },
  { name: "Falkland Islands", iso: "FK", dial: "500" },
  { name: "Faroe Islands", iso: "FO", dial: "298" },
  { name: "Fiji", iso: "FJ", dial: "679" },
  { name: "Finland", iso: "FI", dial: "358" },
  { name: "France", iso: "FR", dial: "33" },
  { name: "French Guiana", iso: "GF", dial: "594" },
  { name: "French Polynesia", iso: "PF", dial: "689" },
  { name: "Gabon", iso: "GA", dial: "241" },
  { name: "Gambia", iso: "GM", dial: "220" },
  { name: "Georgia", iso: "GE", dial: "995" },
  { name: "Germany", iso: "DE", dial: "49" },
  { name: "Ghana", iso: "GH", dial: "233" },
  { name: "Gibraltar", iso: "GI", dial: "350" },
  { name: "Greece", iso: "GR", dial: "30" },
  { name: "Greenland", iso: "GL", dial: "299" },
  { name: "Grenada", iso: "GD", dial: "1" },
  { name: "Guadeloupe", iso: "GP", dial: "590" },
  { name: "Guam", iso: "GU", dial: "1" },
  { name: "Guatemala", iso: "GT", dial: "502" },
  { name: "Guernsey", iso: "GG", dial: "44" },
  { name: "Guinea", iso: "GN", dial: "224" },
  { name: "Guinea-Bissau", iso: "GW", dial: "245" },
  { name: "Guyana", iso: "GY", dial: "592" },
  { name: "Haiti", iso: "HT", dial: "509" },
  { name: "Honduras", iso: "HN", dial: "504" },
  { name: "Hong Kong", iso: "HK", dial: "852" },
  { name: "Hungary", iso: "HU", dial: "36" },
  { name: "Iceland", iso: "IS", dial: "354" },
  { name: "India", iso: "IN", dial: "91" },
  { name: "Indonesia", iso: "ID", dial: "62" },
  { name: "Iran", iso: "IR", dial: "98" },
  { name: "Iraq", iso: "IQ", dial: "964" },
  { name: "Ireland", iso: "IE", dial: "353" },
  { name: "Isle of Man", iso: "IM", dial: "44" },
  { name: "Israel", iso: "IL", dial: "972" },
  { name: "Italy", iso: "IT", dial: "39" },
  { name: "Ivory Coast", iso: "CI", dial: "225" },
  { name: "Jamaica", iso: "JM", dial: "1" },
  { name: "Japan", iso: "JP", dial: "81" },
  { name: "Jersey", iso: "JE", dial: "44" },
  { name: "Jordan", iso: "JO", dial: "962" },
  { name: "Kazakhstan", iso: "KZ", dial: "7" },
  { name: "Kenya", iso: "KE", dial: "254" },
  { name: "Kiribati", iso: "KI", dial: "686" },
  { name: "Kosovo", iso: "XK", dial: "383" },
  { name: "Kuwait", iso: "KW", dial: "965" },
  { name: "Kyrgyzstan", iso: "KG", dial: "996" },
  { name: "Laos", iso: "LA", dial: "856" },
  { name: "Latvia", iso: "LV", dial: "371" },
  { name: "Lebanon", iso: "LB", dial: "961" },
  { name: "Lesotho", iso: "LS", dial: "266" },
  { name: "Liberia", iso: "LR", dial: "231" },
  { name: "Libya", iso: "LY", dial: "218" },
  { name: "Liechtenstein", iso: "LI", dial: "423" },
  { name: "Lithuania", iso: "LT", dial: "370" },
  { name: "Luxembourg", iso: "LU", dial: "352" },
  { name: "Macao", iso: "MO", dial: "853" },
  { name: "Madagascar", iso: "MG", dial: "261" },
  { name: "Malawi", iso: "MW", dial: "265" },
  { name: "Malaysia", iso: "MY", dial: "60" },
  { name: "Maldives", iso: "MV", dial: "960" },
  { name: "Mali", iso: "ML", dial: "223" },
  { name: "Malta", iso: "MT", dial: "356" },
  { name: "Marshall Islands", iso: "MH", dial: "692" },
  { name: "Martinique", iso: "MQ", dial: "596" },
  { name: "Mauritania", iso: "MR", dial: "222" },
  { name: "Mauritius", iso: "MU", dial: "230" },
  { name: "Mayotte", iso: "YT", dial: "262" },
  { name: "Mexico", iso: "MX", dial: "52" },
  { name: "Micronesia", iso: "FM", dial: "691" },
  { name: "Moldova", iso: "MD", dial: "373" },
  { name: "Monaco", iso: "MC", dial: "377" },
  { name: "Mongolia", iso: "MN", dial: "976" },
  { name: "Montenegro", iso: "ME", dial: "382" },
  { name: "Montserrat", iso: "MS", dial: "1" },
  { name: "Morocco", iso: "MA", dial: "212" },
  { name: "Mozambique", iso: "MZ", dial: "258" },
  { name: "Myanmar", iso: "MM", dial: "95" },
  { name: "Namibia", iso: "NA", dial: "264" },
  { name: "Nauru", iso: "NR", dial: "674" },
  { name: "Nepal", iso: "NP", dial: "977" },
  { name: "Netherlands", iso: "NL", dial: "31" },
  { name: "New Caledonia", iso: "NC", dial: "687" },
  { name: "New Zealand", iso: "NZ", dial: "64" },
  { name: "Nicaragua", iso: "NI", dial: "505" },
  { name: "Niger", iso: "NE", dial: "227" },
  { name: "Nigeria", iso: "NG", dial: "234" },
  { name: "Niue", iso: "NU", dial: "683" },
  { name: "Norfolk Island", iso: "NF", dial: "672" },
  { name: "North Korea", iso: "KP", dial: "850" },
  { name: "North Macedonia", iso: "MK", dial: "389" },
  { name: "Northern Mariana Islands", iso: "MP", dial: "1" },
  { name: "Norway", iso: "NO", dial: "47" },
  { name: "Oman", iso: "OM", dial: "968" },
  { name: "Pakistan", iso: "PK", dial: "92" },
  { name: "Palau", iso: "PW", dial: "680" },
  { name: "Palestine", iso: "PS", dial: "970" },
  { name: "Panama", iso: "PA", dial: "507" },
  { name: "Papua New Guinea", iso: "PG", dial: "675" },
  { name: "Paraguay", iso: "PY", dial: "595" },
  { name: "Peru", iso: "PE", dial: "51" },
  { name: "Philippines", iso: "PH", dial: "63" },
  { name: "Poland", iso: "PL", dial: "48" },
  { name: "Portugal", iso: "PT", dial: "351" },
  { name: "Puerto Rico", iso: "PR", dial: "1" },
  { name: "Qatar", iso: "QA", dial: "974" },
  { name: "Réunion", iso: "RE", dial: "262" },
  { name: "Romania", iso: "RO", dial: "40" },
  { name: "Russia", iso: "RU", dial: "7" },
  { name: "Rwanda", iso: "RW", dial: "250" },
  { name: "Samoa", iso: "WS", dial: "685" },
  { name: "San Marino", iso: "SM", dial: "378" },
  { name: "São Tomé & Príncipe", iso: "ST", dial: "239" },
  { name: "Saudi Arabia", iso: "SA", dial: "966" },
  { name: "Senegal", iso: "SN", dial: "221" },
  { name: "Serbia", iso: "RS", dial: "381" },
  { name: "Seychelles", iso: "SC", dial: "248" },
  { name: "Sierra Leone", iso: "SL", dial: "232" },
  { name: "Singapore", iso: "SG", dial: "65" },
  { name: "Sint Maarten", iso: "SX", dial: "1" },
  { name: "Slovakia", iso: "SK", dial: "421" },
  { name: "Slovenia", iso: "SI", dial: "386" },
  { name: "Solomon Islands", iso: "SB", dial: "677" },
  { name: "Somalia", iso: "SO", dial: "252" },
  { name: "South Africa", iso: "ZA", dial: "27" },
  { name: "South Korea", iso: "KR", dial: "82" },
  { name: "South Sudan", iso: "SS", dial: "211" },
  { name: "Spain", iso: "ES", dial: "34" },
  { name: "Sri Lanka", iso: "LK", dial: "94" },
  { name: "St. Barthélemy", iso: "BL", dial: "590" },
  { name: "St. Helena", iso: "SH", dial: "290" },
  { name: "St. Kitts & Nevis", iso: "KN", dial: "1" },
  { name: "St. Lucia", iso: "LC", dial: "1" },
  { name: "St. Martin", iso: "MF", dial: "590" },
  { name: "St. Pierre & Miquelon", iso: "PM", dial: "508" },
  { name: "St. Vincent & Grenadines", iso: "VC", dial: "1" },
  { name: "Sudan", iso: "SD", dial: "249" },
  { name: "Suriname", iso: "SR", dial: "597" },
  { name: "Svalbard & Jan Mayen", iso: "SJ", dial: "47" },
  { name: "Sweden", iso: "SE", dial: "46" },
  { name: "Switzerland", iso: "CH", dial: "41" },
  { name: "Syria", iso: "SY", dial: "963" },
  { name: "Taiwan", iso: "TW", dial: "886" },
  { name: "Tajikistan", iso: "TJ", dial: "992" },
  { name: "Tanzania", iso: "TZ", dial: "255" },
  { name: "Thailand", iso: "TH", dial: "66" },
  { name: "Timor-Leste", iso: "TL", dial: "670" },
  { name: "Togo", iso: "TG", dial: "228" },
  { name: "Tokelau", iso: "TK", dial: "690" },
  { name: "Tonga", iso: "TO", dial: "676" },
  { name: "Trinidad & Tobago", iso: "TT", dial: "1" },
  { name: "Tristan da Cunha", iso: "TA", dial: "290" },
  { name: "Tunisia", iso: "TN", dial: "216" },
  { name: "Turkey", iso: "TR", dial: "90" },
  { name: "Turkmenistan", iso: "TM", dial: "993" },
  { name: "Turks & Caicos Islands", iso: "TC", dial: "1" },
  { name: "Tuvalu", iso: "TV", dial: "688" },
  { name: "U.S. Virgin Islands", iso: "VI", dial: "1" },
  { name: "Uganda", iso: "UG", dial: "256" },
  { name: "Ukraine", iso: "UA", dial: "380" },
  { name: "United Arab Emirates", iso: "AE", dial: "971" },
  { name: "United Kingdom", iso: "GB", dial: "44" },
  { name: "United States", iso: "US", dial: "1" },
  { name: "Uruguay", iso: "UY", dial: "598" },
  { name: "Uzbekistan", iso: "UZ", dial: "998" },
  { name: "Vanuatu", iso: "VU", dial: "678" },
  { name: "Vatican City", iso: "VA", dial: "39" },
  { name: "Venezuela", iso: "VE", dial: "58" },
  { name: "Vietnam", iso: "VN", dial: "84" },
  { name: "Wallis & Futuna", iso: "WF", dial: "681" },
  { name: "Western Sahara", iso: "EH", dial: "212" },
  { name: "Yemen", iso: "YE", dial: "967" },
  { name: "Zambia", iso: "ZM", dial: "260" },
  { name: "Zimbabwe", iso: "ZW", dial: "263" },
] as const;

export const COUNTRIES = COUNTRY_LIST.map((country) => country.name);

export type CountryName = (typeof COUNTRY_LIST)[number]["name"];

const BY_NAME = new Map(COUNTRY_LIST.map((country) => [country.name, country]));

export function isCountry(value: string): value is CountryName {
  return BY_NAME.has(value);
}

export function countryIso(country: string): CountryCode | "" {
  const row = BY_NAME.get(country as CountryName);
  return row ? (row.iso as CountryCode) : "";
}

export function dialCode(country: string) {
  return BY_NAME.get(country as CountryName)?.dial ?? "";
}

const maxLocalCache = new Map<string, number>();
const trunkCache = new Map<string, string>();

function numberingPlan(iso: CountryCode) {
  const meta = new Metadata();
  meta.selectNumberingPlan(iso);
  return meta.numberingPlan;
}

function trunkPrefix(iso: CountryCode) {
  const cached = trunkCache.get(iso);
  if (cached !== undefined) return cached;
  let trunk = "";
  try {
    trunk = numberingPlan(iso).nationalPrefix() || "";
  } catch {
    trunk = "";
  }
  trunkCache.set(iso, trunk);
  return trunk;
}

function maxLocalDigits(country: string) {
  const cached = maxLocalCache.get(country);
  if (cached) return cached;
  const iso = countryIso(country);
  let max = 15;
  if (iso) {
    try {
      const lengths = numberingPlan(iso).possibleLengths() ?? [];
      const trunk = trunkPrefix(iso).length;
      if (lengths.length) max = Math.min(15, Math.max(...lengths) + trunk);
    } catch {
      max = 15;
    }
  }
  maxLocalCache.set(country, max);
  return max;
}

function isMobile(parsed: ReturnType<typeof parsePhoneNumberFromString>, dial: string) {
  if (!parsed || !parsed.isValid() || parsed.countryCallingCode !== dial) return false;
  const type = parsed.getType();
  return type === "MOBILE" || type === "FIXED_LINE_OR_MOBILE";
}

/** Country code plus a real mobile number. The national trunk (0 in Kenya) is allowed, so 011… and 07… both work. */
export function isExactPhone(phone: string, country: string) {
  const dial = dialCode(country);
  const iso = countryIso(country);
  const digits = phone.replace(/\D/g, "");
  if (!dial || !iso || !digits.startsWith(dial)) return false;
  const national = digits.slice(dial.length);
  const trunk = trunkPrefix(iso);
  const forms = new Set<string>([national]);
  if (trunk && national.startsWith(trunk)) forms.add(national.slice(trunk.length));
  for (const nsn of forms) {
    if (!nsn) continue;
    if (isMobile(parsePhoneNumberFromString(nsn, iso), dial)) return true;
    if (isMobile(parsePhoneNumberFromString(`+${dial}${nsn}`, iso), dial)) return true;
  }
  return false;
}

export function localPhoneDigits(raw: string, country: string) {
  const dial = dialCode(country);
  let digits = raw.replace(/\D/g, "");
  const max = maxLocalDigits(country);
  if (dial && digits.startsWith(dial)) {
    const rest = digits.slice(dial.length);
    if (isExactPhone(dial + rest, country) || digits.length > max) digits = rest;
  }
  return digits.slice(0, max);
}

export function phonePlaceholder(country: string) {
  const iso = countryIso(country);
  if (!iso) return "700000000";
  const example = getExampleNumber(iso, examples);
  if (!example) return "700000000";
  const national = example.formatNational().replace(/\D/g, "");
  return national || example.nationalNumber || "700000000";
}

export function phoneLengthMessage(country: string) {
  const dial = dialCode(country);
  if (!dial) return "Enter a mobile number from that country.";
  return `Enter a real ${country} mobile number. It must match a mobile network in ${country}, after +${dial}. A leading 0 is allowed. Not fewer or more digits.`;
}

export function withDialCode(phone: string, country: string, previousCountry = "") {
  const dial = dialCode(country);
  if (!dial) return phone;
  const previous = dialCode(previousCountry);
  let local = phone;
  if (previous && phone.startsWith(`+${previous}`)) {
    local = phone.slice(`+${previous}`.length);
  } else if (phone.startsWith(`+${dial}`)) {
    local = phone.slice(`+${dial}`.length);
  }
  return `+${dial}${local.replace(/\D/g, "")}`;
}
