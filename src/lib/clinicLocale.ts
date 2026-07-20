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
  IN: "INR",
  US: "USD",
  GB: "GBP",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  OM: "OMR",
  BH: "BHD",
  KW: "KWD",
  KE: "KES",
  TZ: "TZS",
  UG: "UGX",
  RW: "RWF",
  ET: "ETB",
  GH: "GHS",
  NG: "NGN",
  ZA: "ZAR",
  EG: "EGP",
  AU: "AUD",
  NZ: "NZD",
  CA: "CAD",
  SG: "SGD",
  MY: "MYR",
  ID: "IDR",
  PH: "PHP",
  PK: "PKR",
  BD: "BDT",
  LK: "LKR",
  NP: "NPR",
  JP: "JPY",
  KR: "KRW",
  CN: "CNY",
  HK: "HKD",
  TH: "THB",
  VN: "VND",
  BR: "BRL",
  MX: "MXN",
  AR: "ARS",
  CL: "CLP",
  CO: "COP",
  PE: "PEN",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  IE: "EUR",
  PT: "EUR",
  BE: "EUR",
  AT: "EUR",
  FI: "EUR",
  GR: "EUR",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  TR: "TRY",
  IL: "ILS",
  RU: "RUB",
  UA: "UAH",
  MU: "MUR",
  MV: "MVR",
  FJ: "FJD",
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
