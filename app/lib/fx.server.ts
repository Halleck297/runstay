import { supabaseAdmin } from "~/lib/supabase.server";
import type { SupportedCurrency } from "~/lib/currency";
import { SUPPORTED_CURRENCIES } from "~/lib/currency";

type FxRatesMap = Record<SupportedCurrency, number>;

const DEFAULT_USD_PER_UNIT: FxRatesMap = {
  EUR: 1.08,
  USD: 1,
  GBP: 1.27,
  JPY: 0.0067,
  CAD: 0.74,
  CHF: 1.12,
  AUD: 0.65,
};
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FX_PROVIDER_URL = "https://api.frankfurter.app/latest";

function isValidRatesShape(value: unknown): value is Partial<Record<SupportedCurrency, number>> {
  if (!value || typeof value !== "object") return false;
  return SUPPORTED_CURRENCIES.every((currency) => {
    const v = (value as any)[currency];
    return typeof v === "number" && Number.isFinite(v) && v > 0;
  });
}

function hasAnyValidRate(value: unknown): value is Partial<Record<SupportedCurrency, number>> {
  if (!value || typeof value !== "object") return false;
  return SUPPORTED_CURRENCIES.some((currency) => {
    const v = (value as any)[currency];
    return typeof v === "number" && Number.isFinite(v) && v > 0;
  });
}

async function fetchFrankfurterUsdPerUnit(): Promise<FxRatesMap | null> {
  const targetCurrencies = SUPPORTED_CURRENCIES.filter((c) => c !== "USD").join(",");
  const url = `${FX_PROVIDER_URL}?from=USD&to=${encodeURIComponent(targetCurrencies)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      rates?: Record<string, number>;
      base?: string;
      amount?: number;
    };
    if (!payload?.rates || typeof payload.rates !== "object") return null;

    const next: FxRatesMap = { ...DEFAULT_USD_PER_UNIT, USD: 1 };

    for (const currency of SUPPORTED_CURRENCIES) {
      if (currency === "USD") {
        next.USD = 1;
        continue;
      }
      const targetPerUsd = payload.rates[currency];
      if (typeof targetPerUsd !== "number" || !Number.isFinite(targetPerUsd) || targetPerUsd <= 0) {
        return null;
      }
      // Provider returns "target currency per 1 USD".
      // We store "USD per 1 target currency".
      next[currency] = 1 / targetPerUsd;
    }

    return next;
  } catch {
    return null;
  }
}

export async function getLatestFxRates(): Promise<FxRatesMap> {
  const { data } = await (supabaseAdmin.from("fx_rates" as any) as any)
    .select("effective_at, rates")
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestRatesRaw = (data as any)?.rates;
  const latestEffectiveAt = (data as any)?.effective_at ? new Date((data as any).effective_at).getTime() : 0;
  const latestIsStale = !latestEffectiveAt || Date.now() - latestEffectiveAt > ONE_WEEK_MS;

  if (!latestIsStale && isValidRatesShape(latestRatesRaw)) {
    return latestRatesRaw as FxRatesMap;
  }

  // If stale (or missing), try to refresh from a no-key provider.
  const refreshed = await fetchFrankfurterUsdPerUnit();
  if (refreshed) {
    await (supabaseAdmin.from("fx_rates" as any) as any).insert({
      effective_at: new Date().toISOString(),
      rates: refreshed,
      source: "frankfurter",
    });
    return refreshed;
  }

  if (isValidRatesShape(latestRatesRaw)) {
    return latestRatesRaw as FxRatesMap;
  }

  if (hasAnyValidRate(latestRatesRaw)) {
    return { ...DEFAULT_USD_PER_UNIT, ...(latestRatesRaw as Partial<FxRatesMap>) };
  }

  return DEFAULT_USD_PER_UNIT;
}

export function buildConvertedPriceMap(
  amount: number | null | undefined,
  sourceCurrency: SupportedCurrency,
  rates: FxRatesMap
): Record<SupportedCurrency, number> | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) return null;

  const sourceToUsd = rates[sourceCurrency];
  if (!sourceToUsd || sourceToUsd <= 0) return null;

  const map = {} as Record<SupportedCurrency, number>;
  for (const target of SUPPORTED_CURRENCIES) {
    const usdToTarget = rates[target];
    const raw = (amount * sourceToUsd) / usdToTarget;
    map[target] = Math.ceil(raw);
  }
  return map;
}
