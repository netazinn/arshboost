// 1. TEMEL KADEMELER İÇİN BAZ FİYATLAR (1 Win / Aşama 1)
export const TIER_BASE_PRICES: Record<string, number> = {
  iron: 3.22,
  bronze: 3.60,
  silver: 4.14,
  gold: 5.41,
  platinum: 7.35,
  diamond: 9.88,
  ascendant: 13.72,
};

// 2. YÜKSEK ELO İÇİN ÖZEL FİYATLAR (1 Win)
export const HIGH_ELO_PRICES: Record<string, number> = {
  immortal_1: 14.34,
  immortal_2: 17.66,
  immortal_3: 21.93,
  radiant: 37.88,
};

// 3. ÇARPANLAR (Multipliers)
const DIVISION_MULTIPLIER = 0.013; // Her alt küme artışında fiyata %1.3 eklenir
const DUO_MULTIPLIER = 1.50;       // Duo seçilirse fiyat %50 artar
const DISCOUNT_RATE = 0.20;        // Genel %20 indirim

export const SERVER_MULTIPLIERS: Record<string, number> = {
  'Europe': 1.0,
  'North America': 1.072,
  'Asia Pacific': 1.072,
  'Brazil': 1.072,
  'Latin America': 1.072,
};

// 4. TİP TANIMLAMALARI (Interfaces)
export interface WinBoostProps {
  tier: string;      // Örn: 'gold', 'immortal', 'radiant'
  division?: number; // 1, 2 veya 3 (Radiant için opsiyonel)
  wins: number;      // 1 ile 5 arası
}

export interface WinBoostOptions {
  server: string;           // Örn: 'Europe'
  isDuo?: boolean;          // Duo (Beraber Oynama) seçeneği
  priorityCompletion?: boolean; // +25%
  streamGames?: boolean;        // +20%
  soloOnlyQueue?: boolean;      // +60%
  premiumCoaching?: boolean;    // +25%
}

/**
 * ARSHBOOST WIN BOOST ANA HESAPLAMA MOTORU
 */
export function calculateWinBoostPrice(
  rank: WinBoostProps,
  options: WinBoostOptions
): { original: number; final: number } {
  let basePriceForOneWin = 0;
  const tier = rank.tier.toLowerCase();
  const div = rank.division || 1; // Division belirtilmemişse 1 kabul et

  // ADIM 1: 1 Win (Tek Galibiyet) İçin Baz Fiyatı Belirle
  if (tier === 'radiant') {
    basePriceForOneWin = HIGH_ELO_PRICES['radiant'];
  } else if (tier === 'immortal') {
    // Immortal liginde her kümenin kendi sabit fiyatı var
    const key = `immortal_${div}`;
    basePriceForOneWin = HIGH_ELO_PRICES[key] || HIGH_ELO_PRICES['immortal_1'];
  } else {
    // Normal liglerde (Demir - Yücelik) 1. küme fiyatı üzerinden %1.3'lük küme zammı eklenir
    const tierPrice = TIER_BASE_PRICES[tier] || 0;
    basePriceForOneWin = tierPrice * (1 + ((div - 1) * DIVISION_MULTIPLIER));
  }

  // ADIM 2: İstenen Maç Sayısı (Win Amount) ile Çarp
  let totalPrice = basePriceForOneWin * rank.wins;

  // ADIM 3: Sunucu (Server) Çarpanını Uygula
  const serverMult = SERVER_MULTIPLIERS[options.server] || 1.0;
  totalPrice *= serverMult;

  // ADIM 4: Ekstra Seçenekleri Uygula (Duo)
  if (options.isDuo) {
    totalPrice *= DUO_MULTIPLIER;
  }

  // ADIM 4b: Ekstra Toggle Seçeneklerini Uygula
  if (options.priorityCompletion) totalPrice *= 1.25;
  if (options.streamGames)        totalPrice *= 1.20;
  if (options.soloOnlyQueue)      totalPrice *= 1.60;
  if (options.premiumCoaching)    totalPrice *= 1.25;

  // ADIM 5: Final İndirimini Uygula
  const finalPrice = totalPrice * (1 - DISCOUNT_RATE);

  // Orijinal ve İndirimli fiyatı 2 ondalık haneye yuvarlayarak döndür
  return {
    original: Number(totalPrice.toFixed(2)),
    final: Number(finalPrice.toFixed(2)),
  };
}
