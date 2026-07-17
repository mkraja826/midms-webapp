export type CountryCurrencyOption = {
  countryCode: string;
  countryName: string;
  currencyCode: string;
};

export type ClinicPreferences = {
  countryCode: string;
  currencyCode: string;
  openingTime: string;
  closingTime: string;
};

const COUNTRY_CURRENCY: Record<string, string> = {
  AC: "SHP",
  AD: "EUR",
  AE: "AED",
  AF: "AFN",
  AG: "XCD",
  AI: "XCD",
  AL: "ALL",
  AM: "AMD",
  AO: "AOA",
  AR: "ARS",
  AS: "USD",
  AT: "EUR",
  AU: "AUD",
  AW: "AWG",
  AX: "EUR",
  AZ: "AZN",
  BA: "BAM",
  BB: "BBD",
  BD: "BDT",
  BE: "EUR",
  BF: "XOF",
  BG: "BGN",
  BH: "BHD",
  BI: "BIF",
  BJ: "XOF",
  BL: "EUR",
  BM: "BMD",
  BN: "BND",
  BO: "BOB",
  BQ: "USD",
  BR: "BRL",
  BS: "BSD",
  BT: "INR",
  BV: "NOK",
  BW: "BWP",
  BY: "BYN",
  BZ: "BZD",
  CA: "CAD",
  CC: "AUD",
  CD: "CDF",
  CF: "XAF",
  CG: "XAF",
  CH: "CHF",
  CI: "XOF",
  CK: "NZD",
  CL: "CLP",
  CM: "XAF",
  CN: "CNY",
  CO: "COP",
  CR: "CRC",
  CU: "CUP",
  CV: "CVE",
  CW: "XCG",
  CX: "AUD",
  CY: "EUR",
  CZ: "CZK",
  DE: "EUR",
  DG: "USD",
  DJ: "DJF",
  DK: "DKK",
  DM: "XCD",
  DO: "DOP",
  DZ: "DZD",
  EA: "EUR",
  EC: "USD",
  EE: "EUR",
  EG: "EGP",
  EH: "MAD",
  ER: "ERN",
  ES: "EUR",
  ET: "ETB",
  EU: "EUR",
  FI: "EUR",
  FJ: "FJD",
  FK: "FKP",
  FM: "USD",
  FO: "DKK",
  FR: "EUR",
  GA: "XAF",
  GB: "GBP",
  GD: "XCD",
  GE: "GEL",
  GF: "EUR",
  GG: "GBP",
  GH: "GHS",
  GI: "GIP",
  GL: "DKK",
  GM: "GMD",
  GN: "GNF",
  GP: "EUR",
  GQ: "XAF",
  GR: "EUR",
  GS: "GBP",
  GT: "GTQ",
  GU: "USD",
  GW: "XOF",
  GY: "GYD",
  HK: "HKD",
  HM: "AUD",
  HN: "HNL",
  HR: "EUR",
  HT: "HTG",
  HU: "HUF",
  IC: "EUR",
  ID: "IDR",
  IE: "EUR",
  IL: "ILS",
  IM: "GBP",
  IN: "INR",
  IO: "USD",
  IQ: "IQD",
  IR: "IRR",
  IS: "ISK",
  IT: "EUR",
  JE: "GBP",
  JM: "JMD",
  JO: "JOD",
  JP: "JPY",
  KE: "KES",
  KG: "KGS",
  KH: "KHR",
  KI: "AUD",
  KM: "KMF",
  KN: "XCD",
  KP: "KPW",
  KR: "KRW",
  KW: "KWD",
  KY: "KYD",
  KZ: "KZT",
  LA: "LAK",
  LB: "LBP",
  LC: "XCD",
  LI: "CHF",
  LK: "LKR",
  LR: "LRD",
  LS: "ZAR",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  LY: "LYD",
  MA: "MAD",
  MC: "EUR",
  MD: "MDL",
  ME: "EUR",
  MF: "EUR",
  MG: "MGA",
  MH: "USD",
  MK: "MKD",
  ML: "XOF",
  MM: "MMK",
  MN: "MNT",
  MO: "MOP",
  MP: "USD",
  MQ: "EUR",
  MR: "MRU",
  MS: "XCD",
  MT: "EUR",
  MU: "MUR",
  MV: "MVR",
  MW: "MWK",
  MX: "MXN",
  MY: "MYR",
  MZ: "MZN",
  NA: "ZAR",
  NC: "XPF",
  NE: "XOF",
  NF: "AUD",
  NG: "NGN",
  NI: "NIO",
  NL: "EUR",
  NO: "NOK",
  NP: "NPR",
  NR: "AUD",
  NU: "NZD",
  NZ: "NZD",
  OM: "OMR",
  PA: "PAB",
  PE: "PEN",
  PF: "XPF",
  PG: "PGK",
  PH: "PHP",
  PK: "PKR",
  PL: "PLN",
  PM: "EUR",
  PN: "NZD",
  PR: "USD",
  PS: "ILS",
  PT: "EUR",
  PW: "USD",
  PY: "PYG",
  QA: "QAR",
  RE: "EUR",
  RO: "RON",
  RS: "RSD",
  RU: "RUB",
  RW: "RWF",
  SA: "SAR",
  SB: "SBD",
  SC: "SCR",
  SD: "SDG",
  SE: "SEK",
  SG: "SGD",
  SH: "SHP",
  SI: "EUR",
  SJ: "NOK",
  SK: "EUR",
  SL: "SLE",
  SM: "EUR",
  SN: "XOF",
  SO: "SOS",
  SR: "SRD",
  SS: "SSP",
  ST: "STN",
  SV: "USD",
  SX: "XCG",
  SY: "SYP",
  SZ: "SZL",
  TA: "GBP",
  TC: "USD",
  TD: "XAF",
  TF: "EUR",
  TG: "XOF",
  TH: "THB",
  TJ: "TJS",
  TK: "NZD",
  TL: "USD",
  TM: "TMT",
  TN: "TND",
  TO: "TOP",
  TR: "TRY",
  TT: "TTD",
  TV: "AUD",
  TW: "TWD",
  TZ: "TZS",
  UA: "UAH",
  UG: "UGX",
  UM: "USD",
  US: "USD",
  UY: "UYU",
  UZ: "UZS",
  VA: "EUR",
  VC: "XCD",
  VE: "VES",
  VG: "USD",
  VI: "USD",
  VN: "VND",
  VU: "VUV",
  WF: "XPF",
  WS: "WST",
  XK: "EUR",
  YE: "YER",
  YT: "EUR",
  ZA: "ZAR",
  ZM: "ZMW",
  ZW: "USD"
};

function deviceLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en-IN";
  } catch {
    return "en-IN";
  }
}

function countryName(countryCode: string) {
  try {
    const DisplayNames = (Intl as unknown as {
      DisplayNames?: new (
        locales: string | string[],
        options: { type: "region" }
      ) => { of: (code: string) => string | undefined };
    }).DisplayNames;

    return DisplayNames
      ? new DisplayNames([deviceLocale(), "en"], { type: "region" }).of(countryCode) || countryCode
      : countryCode;
  } catch {
    return countryCode;
  }
}

export const COUNTRY_CURRENCY_OPTIONS: CountryCurrencyOption[] = Object.entries(
  COUNTRY_CURRENCY
)
  .map(([countryCode, currencyCode]) => ({
    countryCode,
    countryName: countryName(countryCode),
    currencyCode,
  }))
  .sort((left, right) => left.countryName.localeCompare(right.countryName));

const countryByCode = new Map(
  COUNTRY_CURRENCY_OPTIONS.map((option) => [option.countryCode, option])
);

export function detectDeviceCountryCode() {
  const parts = deviceLocale().replace(/_/g, "-").split("-");

  for (let index = parts.length - 1; index >= 1; index -= 1) {
    const part = parts[index].toUpperCase();
    if (/^[A-Z]{2}$/.test(part) && countryByCode.has(part)) return part;
  }

  return "IN";
}

export function getCountryCurrencyOption(countryCode?: string | null) {
  const normalized = (countryCode || "").trim().toUpperCase();
  return countryByCode.get(normalized) ?? countryByCode.get("IN")!;
}

export function getDefaultClinicPreferences(): ClinicPreferences {
  const option = getCountryCurrencyOption(detectDeviceCountryCode());

  return {
    countryCode: option.countryCode,
    currencyCode: option.currencyCode,
    openingTime: "09:00",
    closingTime: "21:00",
  };
}

export function cleanCountryCode(value?: string | null) {
  const normalized = (value || "").trim().toUpperCase();
  return countryByCode.has(normalized) ? normalized : "IN";
}

export function cleanCurrencyCode(value?: string | null, countryCode?: string | null) {
  const normalized = (value || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) return normalized;
  return getCountryCurrencyOption(cleanCountryCode(countryCode)).currencyCode;
}

export function normalizeClinicTime(value?: string | null, fallback = "09:00") {
  const raw = (value || "").trim().toUpperCase();
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);

  if (!match) return fallback;

  let hour = Number(match[1]);
  const minute = Number(match[2] || "0");
  const meridiem = match[3];

  if (minute < 0 || minute > 59) return fallback;

  if (meridiem) {
    if (hour < 1 || hour > 12) return fallback;
    if (meridiem === "AM" && hour === 12) hour = 0;
    if (meridiem === "PM" && hour !== 12) hour += 12;
  } else if (hour < 0 || hour > 23) {
    return fallback;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatClinicTime(value?: string | null) {
  const normalized = normalizeClinicTime(value, "09:00");
  const [hourText, minuteText] = normalized.split(":");
  const date = new Date(2000, 0, 1, Number(hourText), Number(minuteText));

  try {
    return new Intl.DateTimeFormat(deviceLocale(), {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return normalized;
  }
}

export function formatClinicMoney(
  value: number | string | null | undefined,
  currencyCode = "INR"
) {
  const amount = Number(value || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const currency = cleanCurrencyCode(currencyCode);

  try {
    return new Intl.NumberFormat(deviceLocale(), {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toLocaleString()}`;
  }
}
