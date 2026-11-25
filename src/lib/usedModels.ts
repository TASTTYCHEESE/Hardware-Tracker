// Used prices by manufacturer and model (0.9.7). Every part in the used-price guide, the listing
// checker and the "Sell my build" calculator comes from here.
//
//  - Graphics cards: every chip in the benchmark list, in each board partner's versions (ASUS ROG
//    Strix, MSI Gaming X Trio, Sapphire Nitro+...). Premium versions keep a bit more of their value.
//  - Processors: every benchmarked model plus their F / KF / non-X variants.
//  - RAM, SSDs, motherboards, power supplies and cases: real models with their typical price new
//    today (USD before tax, November 2026, from US shops; discontinued ones at their last usual
//    price), and the share of that a used one is worth.
// Prices are estimates for private sales in good condition. Brand premiums are smaller used than new.

import { CPUS, GPUS, usedRange, type BenchItem } from './bench';

export type PartKind = 'gpu' | 'cpu' | 'ram' | 'ssd' | 'board' | 'psu' | 'case';

export interface UsedModel {
  id: string;
  kind: PartKind;
  /** brand */
  maker: string;
  /** chip, product line, chipset or size: the second level of the picker */
  group: string;
  /** full product name */
  name: string;
  /** what tells it apart inside its group (shown in the last picker) */
  short: string;
  /** GPUs / CPUs: the benchmark entry it is priced from */
  bench?: BenchItem;
  /** GPUs: partner premium on the chip's value (0.08 = +8%) */
  premium?: number;
  /** other parts: typical price new today, USD before tax */
  newUsd?: number;
  /** other parts: share of the new price a used one is worth */
  factor?: number;
  /** RAM: scales with the latest recorded DDR5 price */
  ddr5?: boolean;
  /** detail line (interface, wattage, size...) */
  info?: string;
}

const mk = (m: Omit<UsedModel, 'id'>): UsedModel => ({ ...m, id: `${m.kind}|${m.name}` });

// ---- Extra benchmark entries: variants that aren't in the Benchmarks tab -----------------
// Same chip or a close relative of a benchmarked one; scores on the same scale.
const GPU_EXTRA: BenchItem[] = [
  { name: 'GeForce RTX 5060 Ti 8 GB', maker: 'Nvidia', year: 2025, score: 43, msrp: 379, vram: 8 },
  { name: 'Radeon RX 9060 XT 8 GB', maker: 'AMD', year: 2025, score: 41, msrp: 299, vram: 8 },
  { name: 'GeForce RTX 4060 Ti 16 GB', maker: 'Nvidia', year: 2023, score: 38, msrp: 499, vram: 16 },
  { name: 'Radeon RX 6700', maker: 'AMD', year: 2022, score: 33, msrp: 369, vram: 10 },
  { name: 'GeForce RTX 3060 8 GB', maker: 'Nvidia', year: 2022, score: 23, msrp: 329, vram: 8 },
  { name: 'GeForce RTX 2060 12 GB', maker: 'Nvidia', year: 2021, score: 22, msrp: 299, vram: 12 },
  { name: 'Arc A580', maker: 'Intel', year: 2023, score: 24, msrp: 179, vram: 8 },
  { name: 'Arc A380', maker: 'Intel', year: 2022, score: 10, msrp: 139, vram: 6 },
  { name: 'GeForce RTX 3050 6 GB', maker: 'Nvidia', year: 2024, score: 13, msrp: 169, vram: 6 },
  { name: 'Radeon RX 6400', maker: 'AMD', year: 2022, score: 8, msrp: 159, vram: 4 },
  { name: 'Radeon RX 570', maker: 'AMD', year: 2017, score: 11, msrp: 169, vram: 4 },
  { name: 'GeForce GTX 1060 3 GB', maker: 'Nvidia', year: 2016, score: 11, msrp: 199, vram: 3 },
  { name: 'GeForce GTX 1050', maker: 'Nvidia', year: 2016, score: 5, msrp: 109, vram: 2 },
];

const CPU_EXTRA: BenchItem[] = [
  // AMD AM5
  { name: 'Ryzen 9 7900X3D', maker: 'AMD', year: 2023, score: 84, msrp: 599, cores: 12, threads: 24 },
  { name: 'Ryzen 9 7900X', maker: 'AMD', year: 2022, score: 79, msrp: 549, cores: 12, threads: 24 },
  { name: 'Ryzen 9 7900', maker: 'AMD', year: 2023, score: 77, msrp: 429, cores: 12, threads: 24 },
  { name: 'Ryzen 7 7700', maker: 'AMD', year: 2023, score: 77, msrp: 329, cores: 8, threads: 16 },
  { name: 'Ryzen 5 9600', maker: 'AMD', year: 2025, score: 79, msrp: 249, cores: 6, threads: 12 },
  { name: 'Ryzen 5 7500F', maker: 'AMD', year: 2023, score: 73, msrp: 179, cores: 6, threads: 12 },
  { name: 'Ryzen 7 8700G', maker: 'AMD', year: 2024, score: 68, msrp: 329, cores: 8, threads: 16 },
  { name: 'Ryzen 5 8600G', maker: 'AMD', year: 2024, score: 66, msrp: 229, cores: 6, threads: 12 },
  { name: 'Ryzen 5 8500G', maker: 'AMD', year: 2024, score: 58, msrp: 179, cores: 6, threads: 12 },
  { name: 'Ryzen 5 8400F', maker: 'AMD', year: 2024, score: 62, msrp: 169, cores: 6, threads: 12 },
  // AMD AM4
  { name: 'Ryzen 5 5600X3D', maker: 'AMD', year: 2023, score: 68, msrp: 229, cores: 6, threads: 12 },
  { name: 'Ryzen 7 5700', maker: 'AMD', year: 2023, score: 57, msrp: 199, cores: 8, threads: 16 },
  { name: 'Ryzen 7 5700G', maker: 'AMD', year: 2021, score: 55, msrp: 359, cores: 8, threads: 16 },
  { name: 'Ryzen 5 5600G', maker: 'AMD', year: 2021, score: 53, msrp: 259, cores: 6, threads: 12 },
  { name: 'Ryzen 5 5500GT', maker: 'AMD', year: 2024, score: 50, msrp: 125, cores: 6, threads: 12 },
  { name: 'Ryzen 9 3900X', maker: 'AMD', year: 2019, score: 48, msrp: 499, cores: 12, threads: 24 },
  { name: 'Ryzen 9 3950X', maker: 'AMD', year: 2019, score: 48, msrp: 749, cores: 16, threads: 32 },
  { name: 'Ryzen 5 3600X', maker: 'AMD', year: 2019, score: 45, msrp: 249, cores: 6, threads: 12 },
  { name: 'Ryzen 3 3300X', maker: 'AMD', year: 2020, score: 42, msrp: 120, cores: 4, threads: 8 },
  { name: 'Ryzen 7 2700X', maker: 'AMD', year: 2018, score: 38, msrp: 329, cores: 8, threads: 16 },
  { name: 'Ryzen 5 3400G', maker: 'AMD', year: 2019, score: 33, msrp: 149, cores: 4, threads: 8 },
  { name: 'Ryzen 7 1700', maker: 'AMD', year: 2017, score: 32, msrp: 329, cores: 8, threads: 16 },
  // Intel
  { name: 'Core i9-14900KF', maker: 'Intel', year: 2023, score: 84, msrp: 564, cores: 24, threads: 32 },
  { name: 'Core i9-14900KS', maker: 'Intel', year: 2024, score: 86, msrp: 689, cores: 24, threads: 32 },
  { name: 'Core i7-14700KF', maker: 'Intel', year: 2023, score: 82, msrp: 384, cores: 20, threads: 28 },
  { name: 'Core i7-14700F', maker: 'Intel', year: 2024, score: 78, msrp: 359, cores: 20, threads: 28 },
  { name: 'Core i5-14600KF', maker: 'Intel', year: 2023, score: 80, msrp: 294, cores: 14, threads: 20 },
  { name: 'Core i5-14400', maker: 'Intel', year: 2024, score: 67, msrp: 221, cores: 10, threads: 16 },
  { name: 'Core i3-14100F', maker: 'Intel', year: 2024, score: 55, msrp: 109, cores: 4, threads: 8 },
  { name: 'Core i9-13900KF', maker: 'Intel', year: 2022, score: 82, msrp: 564, cores: 24, threads: 32 },
  { name: 'Core i7-13700KF', maker: 'Intel', year: 2022, score: 79, msrp: 384, cores: 16, threads: 24 },
  { name: 'Core i7-13700F', maker: 'Intel', year: 2023, score: 75, msrp: 359, cores: 16, threads: 24 },
  { name: 'Core i5-13600KF', maker: 'Intel', year: 2022, score: 77, msrp: 294, cores: 14, threads: 20 },
  { name: 'Core i5-13400', maker: 'Intel', year: 2023, score: 66, msrp: 221, cores: 10, threads: 16 },
  { name: 'Core i3-13100F', maker: 'Intel', year: 2023, score: 54, msrp: 109, cores: 4, threads: 8 },
  { name: 'Core i9-12900KF', maker: 'Intel', year: 2021, score: 74, msrp: 564, cores: 16, threads: 24 },
  { name: 'Core i7-12700KF', maker: 'Intel', year: 2021, score: 71, msrp: 384, cores: 12, threads: 20 },
  { name: 'Core i7-12700F', maker: 'Intel', year: 2022, score: 68, msrp: 314, cores: 12, threads: 20 },
  { name: 'Core i5-12600KF', maker: 'Intel', year: 2021, score: 68, msrp: 264, cores: 10, threads: 16 },
  { name: 'Core i5-12400', maker: 'Intel', year: 2022, score: 63, msrp: 192, cores: 6, threads: 12 },
  { name: 'Core i3-12100F', maker: 'Intel', year: 2022, score: 52, msrp: 97, cores: 4, threads: 8 },
  { name: 'Core Ultra 9 285', maker: 'Intel', year: 2025, score: 79, msrp: 549, cores: 24, threads: 24 },
  { name: 'Core Ultra 7 265KF', maker: 'Intel', year: 2024, score: 80, msrp: 379, cores: 20, threads: 20 },
  { name: 'Core Ultra 7 265', maker: 'Intel', year: 2025, score: 77, msrp: 384, cores: 20, threads: 20 },
  { name: 'Core Ultra 5 245KF', maker: 'Intel', year: 2024, score: 75, msrp: 294, cores: 14, threads: 14 },
  { name: 'Core Ultra 5 225F', maker: 'Intel', year: 2025, score: 68, msrp: 221, cores: 10, threads: 10 },
  { name: 'Core i7-11700K', maker: 'Intel', year: 2021, score: 56, msrp: 399, cores: 8, threads: 16 },
  { name: 'Core i5-11400', maker: 'Intel', year: 2021, score: 50, msrp: 182, cores: 6, threads: 12 },
  { name: 'Core i7-10700', maker: 'Intel', year: 2020, score: 50, msrp: 323, cores: 8, threads: 16 },
  { name: 'Core i5-10400', maker: 'Intel', year: 2020, score: 45, msrp: 182, cores: 6, threads: 12 },
  { name: 'Core i3-10100F', maker: 'Intel', year: 2020, score: 37, msrp: 79, cores: 4, threads: 8 },
  { name: 'Core i9-9900KF', maker: 'Intel', year: 2019, score: 50, msrp: 463, cores: 8, threads: 16 },
  { name: 'Core i5-9600K', maker: 'Intel', year: 2018, score: 42, msrp: 262, cores: 6, threads: 6 },
  { name: 'Core i7-8700', maker: 'Intel', year: 2017, score: 42, msrp: 303, cores: 6, threads: 12 },
  { name: 'Core i5-8400', maker: 'Intel', year: 2017, score: 36, msrp: 182, cores: 6, threads: 6 },
];

export const ALL_GPUS: BenchItem[] = [...GPUS, ...GPU_EXTRA].sort((a, b) => b.score - a.score);
export const ALL_CPUS: BenchItem[] = [...CPUS, ...CPU_EXTRA].sort((a, b) => b.score - a.score);

// ---- Graphics cards: board partners ---------------------------------------------------
type Rule = (b: BenchItem) => boolean;
const any: Rule = () => true;
const and = (...rs: Rule[]): Rule => (b) => rs.every((r) => r(b));
const from = (y: number): Rule => (b) => b.year >= y;
const until = (y: number): Rule => (b) => b.year <= y;
const minPrice = (p: number): Rule => (b) => (b.msrp ?? 0) >= p;
const maxPrice = (p: number): Rule => (b) => (b.msrp ?? 0) <= p;
const has = (re: RegExp): Rule => (b) => re.test(b.name);
const not = (r: Rule): Rule => (b) => !r(b);
const rtx50 = has(/RTX 50/);

/** Founders Edition / reference cards that Nvidia sold itself. */
const NV_FE = new Set([
  'GeForce RTX 5090', 'GeForce RTX 5080', 'GeForce RTX 5070',
  'GeForce RTX 4090', 'GeForce RTX 4080 SUPER', 'GeForce RTX 4080', 'GeForce RTX 4070 SUPER', 'GeForce RTX 4070', 'GeForce RTX 4060 Ti',
  'GeForce RTX 3090 Ti', 'GeForce RTX 3090', 'GeForce RTX 3080 Ti', 'GeForce RTX 3080', 'GeForce RTX 3070 Ti', 'GeForce RTX 3070', 'GeForce RTX 3060 Ti',
  'GeForce RTX 2080 Ti', 'GeForce RTX 2080 SUPER', 'GeForce RTX 2080', 'GeForce RTX 2070 SUPER', 'GeForce RTX 2070', 'GeForce RTX 2060 SUPER', 'GeForce RTX 2060',
  'GeForce GTX 1080 Ti', 'GeForce GTX 1080', 'GeForce GTX 1070 Ti', 'GeForce GTX 1070', 'GeForce GTX 1060 6 GB', 'GeForce GTX 980 Ti', 'GeForce GTX 980', 'GeForce GTX 970',
]);
/** AMD's own "Made by AMD" reference cards. */
const AMD_REF = has(/RX (7900|7800|7700|7600|6950|6900|6800|6750|6700 XT|6650|6600|5700|5600|Vega)|Radeon VII/);

// [maker, product line, premium, which chips it exists for]
const NV_LINES: [string, string, number, Rule][] = [
  ['ASUS', 'ROG Astral', 0.18, and(rtx50, minPrice(749))],
  ['ASUS', 'ROG Strix', 0.13, and(not(rtx50), minPrice(149))],
  ['ASUS', 'TUF Gaming', 0.06, from(2020)],
  ['ASUS', 'Prime', 0.02, from(2024)],
  ['ASUS', 'Dual', 0, and(maxPrice(599), from(2018))],
  ['ASUS', 'Phoenix', -0.03, maxPrice(249)],
  ['MSI', 'Suprim X', 0.12, and(from(2020), minPrice(399))],
  ['MSI', 'Vanguard', 0.1, and(rtx50, minPrice(749))],
  ['MSI', 'Gaming Trio', 0.07, and(from(2018), minPrice(399))],
  ['MSI', 'Gaming X', 0.05, maxPrice(399)],
  ['MSI', 'Ventus 3X', 0, and(from(2019), minPrice(399))],
  ['MSI', 'Ventus 2X', -0.01, and(from(2019), maxPrice(599))],
  ['MSI', 'Shadow 2X', -0.02, and(rtx50, maxPrice(549))],
  ['MSI', 'Armor', -0.01, until(2019)],
  ['Gigabyte', 'Aorus Master', 0.12, minPrice(499)],
  ['Gigabyte', 'Aorus Elite', 0.08, and(from(2023), minPrice(399))],
  ['Gigabyte', 'Aero OC', 0.05, and(from(2023), minPrice(299))],
  ['Gigabyte', 'Gaming OC', 0.04, any],
  ['Gigabyte', 'Eagle OC', 0.01, from(2020)],
  ['Gigabyte', 'Windforce', 0, any],
  ['Zotac', 'AMP Extreme', 0.07, minPrice(499)],
  ['Zotac', 'AMP', 0.03, any],
  ['Zotac', 'Trinity', 0, and(from(2020), minPrice(499))],
  ['Zotac', 'Twin Edge', -0.02, and(from(2020), maxPrice(599))],
  ['Zotac', 'Solid', -0.01, rtx50],
  ['PNY', 'XLR8 Gaming', 0.01, from(2019)],
  ['PNY', 'Verto', -0.02, from(2021)],
  ['Palit', 'GameRock', 0.05, minPrice(399)],
  ['Palit', 'GamingPro', 0.01, any],
  ['Palit', 'Dual / StormX', -0.03, maxPrice(429)],
  ['Palit', 'JetStream', 0, until(2019)],
  ['Gainward', 'Phantom', 0.04, minPrice(399)],
  ['Gainward', 'Ghost', -0.02, any],
  ['Inno3D', 'iChill X3', 0.04, minPrice(399)],
  ['Inno3D', 'Twin X2', -0.02, maxPrice(599)],
  ['EVGA', 'FTW3 Ultra', 0.06, and(from(2020), until(2022), minPrice(399))],
  ['EVGA', 'XC3', 0, and(from(2020), until(2022))],
  ['EVGA', 'FTW', 0.04, until(2019)],
  ['EVGA', 'XC / SC', -0.01, until(2019)],
  ['Colorful', 'iGame Vulcan', 0.08, and(from(2020), minPrice(499))],
  ['Colorful', 'iGame Ultra', 0.02, from(2020)],
  ['Colorful', 'Battle-AX', -0.04, any],
  ['KFA2 / Galax', 'HOF', 0.12, and(from(2018), minPrice(599))],
  ['KFA2 / Galax', 'EX Gamer / SG', 0, any],
];
const AMD_LINES: [string, string, number, Rule][] = [
  ['Sapphire', 'Nitro+', 0.08, minPrice(249)],
  ['Sapphire', 'Pulse', 0, any],
  ['Sapphire', 'Pure', 0.02, from(2023)],
  ['PowerColor', 'Red Devil', 0.08, minPrice(349)],
  ['PowerColor', 'Hellhound', 0.02, from(2022)],
  ['PowerColor', 'Fighter', -0.02, from(2021)],
  ['PowerColor', 'Reaper', -0.03, from(2025)],
  ['XFX', 'Merc 310 / 319', 0.04, and(from(2020), minPrice(449))],
  ['XFX', 'Speedster Swft', 0, from(2021)],
  ['XFX', 'Speedster Qick', 0.01, from(2021)],
  ['XFX', 'Thicc', 0, and(from(2019), until(2020))],
  ['ASUS', 'ROG Strix', 0.12, minPrice(199)],
  ['ASUS', 'TUF Gaming', 0.05, from(2020)],
  ['ASUS', 'Prime', 0.01, from(2025)],
  ['ASUS', 'Dual', -0.01, maxPrice(499)],
  ['Gigabyte', 'Aorus Elite', 0.06, and(from(2022), minPrice(449))],
  ['Gigabyte', 'Gaming OC', 0.03, any],
  ['Gigabyte', 'Eagle', 0, from(2020)],
  ['MSI', 'Gaming X Trio', 0.06, and(from(2020), until(2023), minPrice(449))],
  ['MSI', 'Gaming X / Mech', 0, until(2023)],
  ['ASRock', 'Taichi', 0.08, and(from(2022), minPrice(549))],
  ['ASRock', 'Phantom Gaming', 0.03, from(2020)],
  ['ASRock', 'Steel Legend', 0.02, from(2022)],
  ['ASRock', 'Challenger', -0.02, from(2020)],
];
const INTEL_LINES: [string, string, number, Rule][] = [
  ['Intel', 'Limited Edition', 0, has(/A770|A750|B580/)],
  ['ASRock', 'Steel Legend', 0.02, any],
  ['ASRock', 'Challenger', -0.01, any],
  ['Sparkle', 'Titan', 0.02, any],
  ['Sparkle', 'Orc / Elf', -0.02, any],
  ['Acer', 'Predator BiFrost', 0.03, has(/A770|A750|B580/)],
  ['Acer', 'Nitro', 0, has(/B5/)],
  ['Gunnir', 'Photon', 0, any],
  ['Maxsun', 'iCraft / Milestone', -0.01, has(/B5/)],
  ['Onix', 'Lumi', 0, has(/B580/)],
];

const chipBrand = (b: BenchItem) => (b.maker === 'Nvidia' ? 'NVIDIA' : b.maker);

function gpuModels(): UsedModel[] {
  const out: UsedModel[] = [];
  for (const b of ALL_GPUS) {
    const base = { kind: 'gpu' as const, group: b.name, bench: b, info: `${b.vram ? `${b.vram} GB · ` : ''}${b.year}` };
    out.push(mk({ ...base, maker: 'Any brand', name: `${b.name} (any brand)`, short: 'Any brand / not sure', premium: 0 }));
    if (b.maker === 'Nvidia' && NV_FE.has(b.name))
      out.push(mk({ ...base, maker: 'NVIDIA', name: `NVIDIA ${b.name} ${b.year >= 2016 ? 'Founders Edition' : 'reference'}`, short: b.year >= 2016 ? 'Founders Edition' : 'Reference', premium: 0.02 }));
    if (b.maker === 'AMD' && AMD_REF(b)) out.push(mk({ ...base, maker: 'AMD', name: `AMD ${b.name} (Made by AMD)`, short: 'Made by AMD (reference)', premium: -0.01 }));
    const lines = b.maker === 'Nvidia' ? NV_LINES : b.maker === 'AMD' ? AMD_LINES : INTEL_LINES;
    for (const [maker, line, premium, ok] of lines) {
      if (!ok(b)) continue;
      if (maker === 'Intel' && b.maker !== 'Intel') continue;
      out.push(mk({ ...base, maker, name: `${maker} ${line} ${b.name}`, short: line, premium }));
    }
  }
  return out;
}

// ---- Processors ------------------------------------------------------------------------
function cpuSeries(n: string): string {
  if (/Ryzen \d 9\d{3}/.test(n)) return 'Ryzen 9000 (AM5)';
  if (/Ryzen \d 8\d{3}/.test(n)) return 'Ryzen 8000G (AM5)';
  if (/Ryzen \d 7\d{3}/.test(n)) return 'Ryzen 7000 (AM5)';
  if (/Ryzen \d 5\d{3}/.test(n)) return 'Ryzen 5000 (AM4)';
  if (/Ryzen \d [1-3]\d{3}/.test(n)) return 'Ryzen 1000-3000 (AM4)';
  if (/Ultra/.test(n)) return 'Core Ultra 200S (LGA 1851)';
  if (/-14\d{3}/.test(n)) return 'Core 14th gen (LGA 1700)';
  if (/-13\d{3}/.test(n)) return 'Core 13th gen (LGA 1700)';
  if (/-12\d{3}/.test(n)) return 'Core 12th gen (LGA 1700)';
  if (/-1[01]\d{3}/.test(n)) return 'Core 10th-11th gen (LGA 1200)';
  return 'Core 7th-9th gen (LGA 1151)';
}
function cpuModels(): UsedModel[] {
  return ALL_CPUS.map((b) =>
    mk({
      kind: 'cpu',
      maker: b.maker,
      group: cpuSeries(b.name),
      name: `${b.maker} ${b.name}`,
      short: b.name,
      bench: b,
      info: `${b.cores} cores / ${b.threads} threads · ${b.year}`,
    }),
  );
}

// ---- RAM ---------------------------------------------------------------------------------
// [kit label, type, typical price new today (USD) for an ordinary brand]
type Kit = [string, 'DDR5' | 'DDR4' | 'SO5' | 'SO4', number];
const KITS: Kit[] = [
  ['16GB (2x8GB) DDR5-5600 CL40', 'DDR5', 230],
  ['32GB (2x16GB) DDR5-5200 CL40', 'DDR5', 390],
  ['32GB (2x16GB) DDR5-5600 CL36', 'DDR5', 410],
  ['32GB (2x16GB) DDR5-6000 CL36', 'DDR5', 440],
  ['32GB (2x16GB) DDR5-6000 CL30', 'DDR5', 480],
  ['32GB (2x16GB) DDR5-6400 CL32', 'DDR5', 495],
  ['32GB (2x16GB) DDR5-7200 CL34', 'DDR5', 560],
  ['48GB (2x24GB) DDR5-6000 CL30', 'DDR5', 700],
  ['48GB (2x24GB) DDR5-8000 CL38', 'DDR5', 950],
  ['64GB (2x32GB) DDR5-5600 CL40', 'DDR5', 1250],
  ['64GB (2x32GB) DDR5-6000 CL36', 'DDR5', 1360],
  ['64GB (2x32GB) DDR5-6000 CL30', 'DDR5', 1420],
  ['64GB (2x32GB) DDR5-6400 CL32', 'DDR5', 1480],
  ['96GB (2x48GB) DDR5-6000 CL30', 'DDR5', 1900],
  ['96GB (2x48GB) DDR5-6400 CL32', 'DDR5', 1980],
  ['16GB (2x8GB) DDR4-3200 CL16', 'DDR4', 120],
  ['16GB (2x8GB) DDR4-3600 CL18', 'DDR4', 130],
  ['32GB (2x16GB) DDR4-3200 CL16', 'DDR4', 220],
  ['32GB (2x16GB) DDR4-3600 CL18', 'DDR4', 240],
  ['32GB (2x16GB) DDR4-3600 CL16', 'DDR4', 255],
  ['64GB (2x32GB) DDR4-3200 CL16', 'DDR4', 430],
  ['64GB (2x32GB) DDR4-3600 CL18', 'DDR4', 450],
  ['16GB (1x16GB) DDR5-5600 SO-DIMM', 'SO5', 200],
  ['32GB (2x16GB) DDR5-5600 SO-DIMM', 'SO5', 400],
  ['32GB (1x32GB) DDR5-5600 SO-DIMM', 'SO5', 600],
  ['64GB (2x32GB) DDR5-5600 SO-DIMM', 'SO5', 1200],
  ['16GB (1x16GB) DDR4-3200 SO-DIMM', 'SO4', 105],
  ['32GB (2x16GB) DDR4-3200 SO-DIMM', 'SO4', 210],
];
const speed = (k: Kit) => +(k[0].match(/DDR\d-(\d+)/)?.[1] ?? 0);
// [maker, line, type, premium, which kits]
const RAM_LINES: [string, string, Kit[1], number, (k: Kit) => boolean][] = [
  ['Corsair', 'Vengeance', 'DDR5', 0.02, (k) => speed(k) <= 7200],
  ['Corsair', 'Vengeance RGB', 'DDR5', 0.07, (k) => speed(k) >= 5600],
  ['Corsair', 'Dominator Titanium', 'DDR5', 0.18, (k) => speed(k) >= 6000],
  ['Corsair', 'Vengeance LPX', 'DDR4', 0, () => true],
  ['Corsair', 'Vengeance RGB Pro', 'DDR4', 0.06, () => true],
  ['Corsair', 'Vengeance SO-DIMM', 'SO5', 0.02, () => true],
  ['Corsair', 'Vengeance SO-DIMM', 'SO4', 0.02, () => true],
  ['G.Skill', 'Flare X5', 'DDR5', 0, (k) => speed(k) <= 6000],
  ['G.Skill', 'Ripjaws S5', 'DDR5', 0, (k) => speed(k) <= 6400],
  ['G.Skill', 'Ripjaws M5 RGB', 'DDR5', 0.04, (k) => speed(k) >= 6000 && speed(k) <= 6400],
  ['G.Skill', 'Trident Z5 RGB', 'DDR5', 0.09, (k) => speed(k) >= 6000],
  ['G.Skill', 'Trident Z5 Neo RGB', 'DDR5', 0.09, (k) => speed(k) >= 6000 && speed(k) <= 6400],
  ['G.Skill', 'Trident Z5 Royal', 'DDR5', 0.2, (k) => speed(k) >= 6400],
  ['G.Skill', 'Ripjaws V', 'DDR4', 0, () => true],
  ['G.Skill', 'Trident Z Neo', 'DDR4', 0.08, () => true],
  ['G.Skill', 'Trident Z RGB', 'DDR4', 0.07, () => true],
  ['G.Skill', 'Ripjaws SO-DIMM', 'SO5', 0, () => true],
  ['G.Skill', 'Ripjaws SO-DIMM', 'SO4', 0, () => true],
  ['Kingston', 'Fury Beast', 'DDR5', 0, (k) => speed(k) <= 6400],
  ['Kingston', 'Fury Beast RGB', 'DDR5', 0.05, (k) => speed(k) >= 5600 && speed(k) <= 6400],
  ['Kingston', 'Fury Renegade', 'DDR5', 0.1, (k) => speed(k) >= 6000],
  ['Kingston', 'ValueRAM', 'DDR5', -0.06, (k) => speed(k) <= 5600],
  ['Kingston', 'Fury Beast', 'DDR4', 0, () => true],
  ['Kingston', 'Fury Renegade', 'DDR4', 0.06, () => true],
  ['Kingston', 'ValueRAM', 'DDR4', -0.06, (k) => speed(k) <= 3200],
  ['Kingston', 'Fury Impact', 'SO5', 0.02, () => true],
  ['Kingston', 'Fury Impact', 'SO4', 0.02, () => true],
  ['Crucial', 'Crucial DDR5', 'DDR5', -0.05, (k) => speed(k) <= 5600],
  ['Crucial', 'Crucial Pro', 'DDR5', -0.02, (k) => speed(k) <= 6400],
  ['Crucial', 'Crucial Pro', 'DDR4', -0.02, (k) => speed(k) <= 3200],
  ['Crucial', 'Ballistix', 'DDR4', 0, () => true],
  ['Crucial', 'Crucial SO-DIMM', 'SO5', -0.04, () => true],
  ['Crucial', 'Crucial SO-DIMM', 'SO4', -0.04, () => true],
  ['TeamGroup', 'T-Force Delta RGB', 'DDR5', 0.03, (k) => speed(k) >= 5600],
  ['TeamGroup', 'T-Force Vulcan', 'DDR5', -0.03, (k) => speed(k) <= 6400],
  ['TeamGroup', 'T-Create Expert', 'DDR5', 0, (k) => speed(k) >= 6000],
  ['TeamGroup', 'T-Force Vulcan Z', 'DDR4', -0.04, () => true],
  ['TeamGroup', 'T-Force Delta RGB', 'DDR4', 0.02, () => true],
  ['Patriot', 'Viper Venom', 'DDR5', -0.02, (k) => speed(k) >= 5600],
  ['Patriot', 'Viper Venom RGB', 'DDR5', 0.02, (k) => speed(k) >= 6000],
  ['Patriot', 'Viper Steel', 'DDR4', -0.02, () => true],
  ['Patriot', 'Viper 4 Blackout', 'DDR4', -0.03, () => true],
  ['ADATA XPG', 'Lancer Blade', 'DDR5', -0.02, (k) => speed(k) >= 5600 && speed(k) <= 6400],
  ['ADATA XPG', 'Lancer RGB', 'DDR5', 0.03, (k) => speed(k) >= 6000],
  ['ADATA XPG', 'Spectrix D35G', 'DDR4', 0.01, () => true],
  ['Lexar', 'Ares RGB', 'DDR5', -0.02, (k) => speed(k) >= 6000 && speed(k) <= 6400],
  ['Lexar', 'Thor', 'DDR5', -0.04, (k) => speed(k) <= 6000],
  ['Lexar', 'Ares', 'DDR4', -0.03, () => true],
  ['Silicon Power', 'XPower Zenith', 'DDR5', -0.05, (k) => speed(k) <= 6000],
  ['Samsung', 'Samsung (OEM)', 'SO5', -0.06, () => true],
  ['Samsung', 'Samsung (OEM)', 'SO4', -0.06, () => true],
  ['SK hynix', 'SK hynix (OEM)', 'SO5', -0.06, () => true],
];
const RAM_TYPE: Record<Kit[1], string> = { DDR5: 'DDR5', DDR4: 'DDR4', SO5: 'DDR5 laptop (SO-DIMM)', SO4: 'DDR4 laptop (SO-DIMM)' };

function ramModels(): UsedModel[] {
  const out: UsedModel[] = [];
  for (const [maker, line, type, premium, ok] of RAM_LINES) {
    for (const k of KITS) {
      if (k[1] !== type || !ok(k)) continue;
      const kit = type.startsWith('SO') ? k[0].replace(' SO-DIMM', '') : k[0];
      out.push(
        mk({
          kind: 'ram',
          maker,
          group: `${line} (${RAM_TYPE[type]})`,
          name: `${maker === line.split(' ')[0] ? '' : `${maker} `}${line} ${k[0]}`.trim(),
          short: kit,
          newUsd: Math.round(k[2] * (1 + premium)),
          factor: type === 'DDR5' || type === 'SO5' ? 0.75 : 0.65,
          ddr5: type === 'DDR5' || type === 'SO5',
          info: RAM_TYPE[type],
        }),
      );
    }
  }
  // no brand / not sure
  for (const k of KITS)
    out.push(mk({ kind: 'ram', maker: 'Other / not sure', group: RAM_TYPE[k[1]], name: `${k[0]} (any brand)`, short: k[0], newUsd: Math.round(k[2] * 0.97), factor: k[1] === 'DDR5' || k[1] === 'SO5' ? 0.72 : 0.62, ddr5: k[1] === 'DDR5' || k[1] === 'SO5', info: RAM_TYPE[k[1]] }));
  return out;
}

// ---- SSDs ----------------------------------------------------------------------------------
// tier: [label, typical price new for 2 TB, used share]
const TIERS = {
  g5top: ['NVMe PCIe 5.0, high-end', 380, 0.6],
  g5: ['NVMe PCIe 5.0', 300, 0.6],
  g4top: ['NVMe PCIe 4.0, high-end', 260, 0.6],
  g4: ['NVMe PCIe 4.0', 225, 0.55],
  g4value: ['NVMe PCIe 4.0, budget', 185, 0.55],
  g3: ['NVMe PCIe 3.0', 160, 0.5],
  sata: ['SATA 2.5"', 170, 0.5],
} as const;
type Tier = keyof typeof TIERS;
const CAP: Record<string, number> = { '500 GB': 0.36, '1 TB': 0.56, '2 TB': 1, '4 TB': 1.95, '8 TB': 4.3 };
const C = (...tb: number[]) => tb.map((t) => (t < 1 ? '500 GB' : `${t} TB`));
const SSDS: [string, string, Tier, string[]][] = [
  ['Samsung', '9100 Pro', 'g5top', C(1, 2, 4, 8)],
  ['Samsung', '990 Pro', 'g4top', C(1, 2, 4)],
  ['Samsung', '990 Evo Plus', 'g4', C(1, 2, 4)],
  ['Samsung', '990 Evo', 'g4value', C(1, 2)],
  ['Samsung', '980 Pro', 'g4top', C(0.5, 1, 2)],
  ['Samsung', '980', 'g3', C(0.5, 1)],
  ['Samsung', '970 Evo Plus', 'g3', C(0.5, 1, 2)],
  ['Samsung', '870 Evo', 'sata', C(0.5, 1, 2, 4)],
  ['Samsung', '860 Evo', 'sata', C(0.5, 1)],
  ['WD', 'Black SN8100', 'g5top', C(1, 2, 4)],
  ['WD', 'Black SN850X', 'g4top', C(1, 2, 4, 8)],
  ['WD', 'Black SN7100', 'g4', C(0.5, 1, 2, 4)],
  ['WD', 'Black SN770', 'g4value', C(0.5, 1, 2)],
  ['WD', 'Blue SN5000', 'g4value', C(0.5, 1, 2, 4)],
  ['WD', 'Blue SN580', 'g4value', C(0.5, 1, 2)],
  ['WD', 'Blue SN570', 'g3', C(0.5, 1, 2)],
  ['WD', 'Blue SA510', 'sata', C(0.5, 1, 2)],
  ['Crucial', 'T710', 'g5top', C(1, 2, 4)],
  ['Crucial', 'T705', 'g5top', C(1, 2, 4)],
  ['Crucial', 'T700', 'g5', C(1, 2, 4)],
  ['Crucial', 'T500', 'g4', C(0.5, 1, 2)],
  ['Crucial', 'P5 Plus', 'g4', C(0.5, 1, 2)],
  ['Crucial', 'P3 Plus', 'g4value', C(0.5, 1, 2, 4)],
  ['Crucial', 'P310', 'g4value', C(0.5, 1, 2)],
  ['Crucial', 'P3', 'g3', C(0.5, 1, 2, 4)],
  ['Crucial', 'MX500', 'sata', C(0.5, 1, 2, 4)],
  ['Kingston', 'Fury Renegade G5', 'g5', C(1, 2, 4)],
  ['Kingston', 'Fury Renegade', 'g4top', C(0.5, 1, 2, 4)],
  ['Kingston', 'KC3000', 'g4', C(0.5, 1, 2, 4)],
  ['Kingston', 'NV3', 'g4value', C(0.5, 1, 2, 4)],
  ['Kingston', 'NV2', 'g4value', C(0.5, 1, 2)],
  ['Kingston', 'A400', 'sata', C(0.5, 1)],
  ['SK hynix', 'Platinum P51', 'g5top', C(1, 2)],
  ['SK hynix', 'Platinum P41', 'g4top', C(0.5, 1, 2)],
  ['SK hynix', 'Gold P31', 'g3', C(0.5, 1, 2)],
  ['Solidigm', 'P44 Pro', 'g4top', C(0.5, 1, 2)],
  ['Solidigm', 'P41 Plus', 'g4value', C(0.5, 1, 2)],
  ['Corsair', 'MP700 Pro', 'g5', C(1, 2, 4)],
  ['Corsair', 'MP600 Pro LPX', 'g4top', C(0.5, 1, 2, 4)],
  ['Corsair', 'MP600 Elite', 'g4', C(1, 2)],
  ['Corsair', 'MP600 Core XT', 'g4value', C(1, 2, 4)],
  ['Seagate', 'FireCuda 540', 'g5', C(1, 2)],
  ['Seagate', 'FireCuda 530', 'g4top', C(0.5, 1, 2, 4)],
  ['TeamGroup', 'T-Force Cardea Z540', 'g5', C(1, 2, 4)],
  ['TeamGroup', 'MP44', 'g4value', C(1, 2, 4)],
  ['TeamGroup', 'MP33', 'g3', C(0.5, 1, 2)],
  ['Lexar', 'NM790', 'g4', C(1, 2, 4)],
  ['Lexar', 'NM620', 'g3', C(0.5, 1, 2)],
  ['Sabrent', 'Rocket 5', 'g5', C(1, 2, 4)],
  ['Sabrent', 'Rocket 4 Plus', 'g4top', C(1, 2, 4)],
  ['Sabrent', 'Rocket Q4', 'g4value', C(1, 2, 4)],
  ['ADATA', 'XPG Gammix S70 Blade', 'g4top', C(1, 2, 4)],
  ['ADATA', 'Legend 960 Max', 'g4', C(1, 2, 4)],
  ['ADATA', 'Legend 900', 'g4value', C(0.5, 1, 2)],
  ['Inland', 'Performance Plus', 'g4', C(1, 2, 4)],
  ['Patriot', 'Viper VP4300 Lite', 'g4value', C(1, 2, 4)],
  ['Kioxia', 'Exceria Plus G3', 'g4value', C(1, 2)],
];
function ssdPrice(tier: Tier, cap: string) {
  return Math.max(45, Math.round(TIERS[tier][1] * CAP[cap]));
}
function ssdModels(): UsedModel[] {
  const out: UsedModel[] = [];
  for (const [maker, line, tier, caps] of SSDS) {
    // well-known names keep a little more value
    const brand = /990 Pro|SN850X|9100 Pro|SN8100|T705/.test(line) ? 1.06 : 1;
    for (const cap of caps)
      out.push(mk({ kind: 'ssd', maker, group: line, name: `${maker} ${line} ${cap}`, short: cap, newUsd: Math.round(ssdPrice(tier, cap) * brand), factor: TIERS[tier][2], info: TIERS[tier][0] }));
  }
  for (const tier of Object.keys(TIERS) as Tier[])
    for (const cap of ['500 GB', '1 TB', '2 TB', '4 TB'])
      out.push(mk({ kind: 'ssd', maker: 'Other / not sure', group: TIERS[tier][0], name: `${TIERS[tier][0]} SSD ${cap} (any brand)`, short: cap, newUsd: Math.round(ssdPrice(tier, cap) * 0.95), factor: TIERS[tier][2] - 0.05, info: TIERS[tier][0] }));
  return out;
}

// ---- Motherboards ------------------------------------------------------------------------
// [maker, model, chipset, typical price new (or last usual price if discontinued)]
const BOARDS: [string, string, string, number][] = [
  // AMD AM5
  ['ASUS', 'ROG Crosshair X870E Hero', 'X870E', 700], ['ASUS', 'ROG Strix X870E-E Gaming WiFi', 'X870E', 500], ['ASUS', 'ProArt X870E-Creator WiFi', 'X870E', 480], ['ASUS', 'TUF Gaming X870E-Plus WiFi7', 'X870E', 330],
  ['MSI', 'MEG X870E Godlike', 'X870E', 1100], ['MSI', 'MPG X870E Carbon WiFi', 'X870E', 500], ['MSI', 'MAG X870E Tomahawk WiFi', 'X870E', 350], ['MSI', 'MPG X870E Edge Ti WiFi', 'X870E', 400],
  ['Gigabyte', 'X870E Aorus Master', 'X870E', 500], ['Gigabyte', 'X870E Aorus Pro', 'X870E', 380], ['Gigabyte', 'X870E Aorus Elite WiFi7', 'X870E', 330],
  ['ASRock', 'X870E Taichi', 'X870E', 450], ['ASRock', 'X870E Taichi Lite', 'X870E', 380], ['ASRock', 'X870E Nova WiFi', 'X870E', 330],
  ['ASUS', 'ROG Strix X870-F Gaming WiFi', 'X870', 380], ['ASUS', 'ROG Strix X870-A Gaming WiFi', 'X870', 350], ['ASUS', 'ROG Strix X870-I Gaming WiFi', 'X870', 450], ['ASUS', 'TUF Gaming X870-Plus WiFi', 'X870', 260], ['ASUS', 'Prime X870-P WiFi', 'X870', 230],
  ['MSI', 'MAG X870 Tomahawk WiFi', 'X870', 290], ['MSI', 'PRO X870-P WiFi', 'X870', 220],
  ['Gigabyte', 'X870 Aorus Elite WiFi7', 'X870', 270], ['Gigabyte', 'X870 Gaming X WiFi7', 'X870', 230], ['Gigabyte', 'X870 Eagle WiFi7', 'X870', 220],
  ['ASRock', 'X870 Steel Legend WiFi', 'X870', 250], ['ASRock', 'X870 Pro RS WiFi', 'X870', 210], ['ASRock', 'X870 Riptide WiFi', 'X870', 230],
  ['ASUS', 'ROG Strix B850-F Gaming WiFi', 'B850', 280], ['ASUS', 'ROG Strix B850-A Gaming WiFi', 'B850', 260], ['ASUS', 'ROG Strix B850-I Gaming WiFi', 'B850', 300], ['ASUS', 'TUF Gaming B850-Plus WiFi', 'B850', 220], ['ASUS', 'TUF Gaming B850M-Plus WiFi', 'B850', 200], ['ASUS', 'Prime B850-Plus WiFi', 'B850', 190], ['ASUS', 'Prime B850M-A WiFi', 'B850', 160],
  ['MSI', 'MPG B850 Edge Ti WiFi', 'B850', 270], ['MSI', 'MAG B850 Tomahawk Max WiFi', 'B850', 230], ['MSI', 'MAG B850M Mortar WiFi', 'B850', 210], ['MSI', 'PRO B850-P WiFi', 'B850', 180], ['MSI', 'PRO B850M-A WiFi', 'B850', 150],
  ['Gigabyte', 'B850 Aorus Elite WiFi7', 'B850', 230], ['Gigabyte', 'B850 Gaming X WiFi6E', 'B850', 190], ['Gigabyte', 'B850 Eagle WiFi6E', 'B850', 170], ['Gigabyte', 'B850M Aorus Elite WiFi6E', 'B850', 190], ['Gigabyte', 'B850M DS3H', 'B850', 130],
  ['ASRock', 'B850 Steel Legend WiFi', 'B850', 210], ['ASRock', 'B850 Pro RS WiFi', 'B850', 180], ['ASRock', 'B850M Pro RS WiFi', 'B850', 150], ['ASRock', 'B850I Lightning WiFi', 'B850', 210], ['ASRock', 'B850M-X', 'B850', 115],
  ['ASUS', 'ROG Strix B650E-E Gaming WiFi', 'B650E', 300], ['ASUS', 'ROG Strix B650E-F Gaming WiFi', 'B650E', 250], ['ASUS', 'ROG Strix B650E-I Gaming WiFi', 'B650E', 300], ['MSI', 'MPG B650 Carbon WiFi', 'B650', 260], ['Gigabyte', 'B650E Aorus Master', 'B650E', 330], ['ASRock', 'B650E Taichi', 'B650E', 340], ['ASRock', 'B650E PG Riptide WiFi', 'B650E', 210], ['NZXT', 'N7 B650E', 'B650E', 280],
  ['ASUS', 'ROG Strix B650-A Gaming WiFi', 'B650', 220], ['ASUS', 'TUF Gaming B650-Plus WiFi', 'B650', 190], ['ASUS', 'TUF Gaming B650M-Plus WiFi', 'B650', 170], ['ASUS', 'Prime B650-Plus', 'B650', 150], ['ASUS', 'Prime B650M-A AX', 'B650', 150],
  ['MSI', 'MAG B650 Tomahawk WiFi', 'B650', 200], ['MSI', 'MPG B650 Edge WiFi', 'B650', 230], ['MSI', 'MAG B650M Mortar WiFi', 'B650', 180], ['MSI', 'PRO B650-P WiFi', 'B650', 160], ['MSI', 'PRO B650-S WiFi', 'B650', 150], ['MSI', 'PRO B650M-A WiFi', 'B650', 140],
  ['Gigabyte', 'B650 Aorus Pro AX', 'B650', 230], ['Gigabyte', 'B650 Aorus Elite AX', 'B650', 190], ['Gigabyte', 'B650 Gaming X AX', 'B650', 160], ['Gigabyte', 'B650 Eagle AX', 'B650', 150], ['Gigabyte', 'B650M Aorus Elite AX', 'B650', 160], ['Gigabyte', 'B650M DS3H', 'B650', 120],
  ['ASRock', 'B650 Steel Legend WiFi', 'B650', 190], ['ASRock', 'B650 Pro RS', 'B650', 150], ['ASRock', 'B650M Pro RS WiFi', 'B650', 140], ['ASRock', 'B650M PG Lightning', 'B650', 130], ['ASRock', 'B650M-HDV/M.2', 'B650', 110], ['ASRock', 'B650I Lightning WiFi', 'B650', 180],
  ['ASUS', 'Prime A620M-A', 'A620', 100], ['ASUS', 'TUF Gaming A620M-Plus WiFi', 'A620', 120], ['MSI', 'PRO A620M-E', 'A620', 80], ['Gigabyte', 'A620M Gaming X AX', 'A620', 110], ['Gigabyte', 'A620M S2H', 'A620', 80], ['ASRock', 'A620M-HDV/M.2+', 'A620', 85], ['ASRock', 'A620I Lightning WiFi', 'A620', 130],
  // AMD AM4
  ['ASUS', 'ROG Crosshair VIII Hero', 'X570', 380], ['ASUS', 'ROG Strix X570-E Gaming', 'X570', 330], ['ASUS', 'TUF Gaming X570-Plus WiFi', 'X570', 200], ['ASUS', 'Prime X570-Pro', 'X570', 220],
  ['MSI', 'MEG X570 Unify', 'X570', 300], ['MSI', 'MAG X570S Tomahawk Max WiFi', 'X570', 220], ['MSI', 'MPG X570 Gaming Plus', 'X570', 170],
  ['Gigabyte', 'X570 Aorus Master', 'X570', 360], ['Gigabyte', 'X570S Aorus Elite AX', 'X570', 230], ['Gigabyte', 'X570 Aorus Elite', 'X570', 200], ['Gigabyte', 'X570 Gaming X', 'X570', 170],
  ['ASRock', 'X570 Taichi', 'X570', 300], ['ASRock', 'X570 Steel Legend', 'X570', 190], ['ASRock', 'X570 Phantom Gaming 4', 'X570', 150],
  ['ASUS', 'ROG Strix B550-F Gaming WiFi II', 'B550', 190], ['ASUS', 'ROG Strix B550-A Gaming', 'B550', 180], ['ASUS', 'ROG Strix B550-I Gaming', 'B550', 210], ['ASUS', 'TUF Gaming B550-Plus WiFi II', 'B550', 160], ['ASUS', 'TUF Gaming B550M-Plus WiFi II', 'B550', 150], ['ASUS', 'Prime B550-Plus', 'B550', 130], ['ASUS', 'Prime B550M-A WiFi II', 'B550', 120],
  ['MSI', 'MAG B550 Tomahawk', 'B550', 160], ['MSI', 'MPG B550 Gaming Edge WiFi', 'B550', 170], ['MSI', 'MPG B550 Gaming Plus', 'B550', 140], ['MSI', 'MAG B550M Mortar WiFi', 'B550', 160], ['MSI', 'B550-A Pro', 'B550', 130],
  ['Gigabyte', 'B550 Aorus Pro AC', 'B550', 170], ['Gigabyte', 'B550 Aorus Elite V2', 'B550', 150], ['Gigabyte', 'B550 Gaming X V2', 'B550', 120], ['Gigabyte', 'B550M Aorus Elite', 'B550', 120], ['Gigabyte', 'B550M DS3H', 'B550', 100],
  ['ASRock', 'B550 Taichi', 'B550', 300], ['ASRock', 'B550 Steel Legend', 'B550', 150], ['ASRock', 'B550 PG Riptide', 'B550', 130], ['ASRock', 'B550 Phantom Gaming 4', 'B550', 110], ['ASRock', 'B550M Steel Legend', 'B550', 130], ['ASRock', 'B550M Pro4', 'B550', 105], ['ASRock', 'B550M-HDV', 'B550', 85],
  ['ASUS', 'Prime A520M-A II', 'A520', 80], ['MSI', 'A520M-A Pro', 'A520', 70], ['Gigabyte', 'A520M DS3H', 'A520', 75], ['Gigabyte', 'A520M S2H', 'A520', 70], ['ASRock', 'A520M-HDV', 'A520', 65],
  ['ASUS', 'ROG Crosshair VII Hero', 'X470', 250], ['MSI', 'X470 Gaming Plus Max', 'X470', 130], ['ASUS', 'ROG Strix B450-F Gaming', 'B450', 130], ['ASUS', 'TUF Gaming B450-Plus II', 'B450', 110], ['MSI', 'B450 Tomahawk Max', 'B450', 110], ['MSI', 'B450M Mortar Max', 'B450', 100], ['Gigabyte', 'B450 Aorus Elite V2', 'B450', 105], ['Gigabyte', 'B450M DS3H', 'B450', 75], ['ASRock', 'B450M Pro4', 'B450', 80], ['Biostar', 'B550MH', 'B550', 75],
  // Intel LGA 1851
  ['ASUS', 'ROG Maximus Z890 Hero', 'Z890', 700], ['ASUS', 'ROG Strix Z890-E Gaming WiFi', 'Z890', 500], ['ASUS', 'ROG Strix Z890-F Gaming WiFi', 'Z890', 450], ['ASUS', 'ROG Strix Z890-A Gaming WiFi', 'Z890', 400], ['ASUS', 'ROG Strix Z890-I Gaming WiFi', 'Z890', 450], ['ASUS', 'TUF Gaming Z890-Plus WiFi', 'Z890', 300], ['ASUS', 'Prime Z890-P WiFi', 'Z890', 250],
  ['MSI', 'MEG Z890 Ace', 'Z890', 700], ['MSI', 'MPG Z890 Carbon WiFi', 'Z890', 500], ['MSI', 'MPG Z890 Edge Ti WiFi', 'Z890', 400], ['MSI', 'MAG Z890 Tomahawk WiFi', 'Z890', 330], ['MSI', 'PRO Z890-P WiFi', 'Z890', 240],
  ['Gigabyte', 'Z890 Aorus Master', 'Z890', 500], ['Gigabyte', 'Z890 Aorus Elite WiFi7', 'Z890', 300], ['Gigabyte', 'Z890 Gaming X WiFi7', 'Z890', 260], ['Gigabyte', 'Z890 Eagle WiFi7', 'Z890', 240],
  ['ASRock', 'Z890 Taichi', 'Z890', 500], ['ASRock', 'Z890 Nova WiFi', 'Z890', 330], ['ASRock', 'Z890 Steel Legend WiFi', 'Z890', 280], ['ASRock', 'Z890 Pro RS WiFi', 'Z890', 230],
  ['ASUS', 'ROG Strix B860-F Gaming WiFi', 'B860', 270], ['ASUS', 'ROG Strix B860-A Gaming WiFi', 'B860', 250], ['ASUS', 'TUF Gaming B860-Plus WiFi', 'B860', 210], ['ASUS', 'Prime B860-Plus WiFi', 'B860', 180], ['ASUS', 'Prime B860M-A WiFi', 'B860', 150],
  ['MSI', 'MAG B860 Tomahawk WiFi', 'B860', 210], ['MSI', 'PRO B860-P WiFi', 'B860', 160], ['MSI', 'PRO B860M-A WiFi', 'B860', 150],
  ['Gigabyte', 'B860 Aorus Elite WiFi7', 'B860', 220], ['Gigabyte', 'B860 Gaming X WiFi6E', 'B860', 180], ['Gigabyte', 'B860M Aorus Elite WiFi6E', 'B860', 180], ['Gigabyte', 'B860M DS3H', 'B860', 130],
  ['ASRock', 'B860 Steel Legend WiFi', 'B860', 190], ['ASRock', 'B860 Lightning WiFi', 'B860', 170], ['ASRock', 'B860M Pro RS WiFi', 'B860', 140],
  // Intel LGA 1700
  ['ASUS', 'ROG Maximus Z790 Hero', 'Z790', 630], ['ASUS', 'ROG Strix Z790-E Gaming WiFi II', 'Z790', 450], ['ASUS', 'ROG Strix Z790-F Gaming WiFi II', 'Z790', 380], ['ASUS', 'ROG Strix Z790-A Gaming WiFi II', 'Z790', 330], ['ASUS', 'ROG Strix Z790-I Gaming WiFi', 'Z790', 400], ['ASUS', 'TUF Gaming Z790-Plus WiFi', 'Z790', 240], ['ASUS', 'Prime Z790-P WiFi', 'Z790', 200],
  ['MSI', 'MEG Z790 Ace', 'Z790', 600], ['MSI', 'MPG Z790 Carbon WiFi II', 'Z790', 400], ['MSI', 'MPG Z790 Edge WiFi', 'Z790', 330], ['MSI', 'MAG Z790 Tomahawk WiFi', 'Z790', 250], ['MSI', 'PRO Z790-A Max WiFi', 'Z790', 230], ['MSI', 'PRO Z790-P WiFi', 'Z790', 200],
  ['Gigabyte', 'Z790 Aorus Master', 'Z790', 480], ['Gigabyte', 'Z790 Aorus Elite X WiFi7', 'Z790', 280], ['Gigabyte', 'Z790 Aorus Elite AX', 'Z790', 250], ['Gigabyte', 'Z790 Gaming X AX', 'Z790', 210], ['Gigabyte', 'Z790 Eagle AX', 'Z790', 200], ['Gigabyte', 'Z790 UD AX', 'Z790', 190],
  ['ASRock', 'Z790 Taichi', 'Z790', 450], ['ASRock', 'Z790 Steel Legend WiFi', 'Z790', 230], ['ASRock', 'Z790 Riptide WiFi', 'Z790', 220], ['ASRock', 'Z790 Pro RS', 'Z790', 190], ['ASRock', 'Z790 PG Lightning', 'Z790', 170], ['NZXT', 'N7 Z790', 'Z790', 280],
  ['ASUS', 'ROG Strix B760-F Gaming WiFi', 'B760', 230], ['ASUS', 'ROG Strix B760-A Gaming WiFi', 'B760', 210], ['ASUS', 'ROG Strix B760-I Gaming WiFi', 'B760', 220], ['ASUS', 'TUF Gaming B760-Plus WiFi', 'B760', 180], ['ASUS', 'TUF Gaming B760M-Plus WiFi II', 'B760', 170], ['ASUS', 'Prime B760-Plus', 'B760', 140], ['ASUS', 'Prime B760M-A WiFi', 'B760', 130],
  ['MSI', 'MAG B760 Tomahawk WiFi', 'B760', 190], ['MSI', 'MAG B760M Mortar WiFi', 'B760', 180], ['MSI', 'PRO B760-P WiFi', 'B760', 150], ['MSI', 'PRO B760M-A WiFi', 'B760', 140], ['MSI', 'PRO B760M-E', 'B760', 100],
  ['Gigabyte', 'B760 Aorus Elite AX', 'B760', 180], ['Gigabyte', 'B760 Gaming X AX', 'B760', 160], ['Gigabyte', 'B760M Aorus Elite AX', 'B760', 160], ['Gigabyte', 'B760M DS3H AX', 'B760', 130], ['Gigabyte', 'B760M DS3H', 'B760', 110],
  ['ASRock', 'B760 Pro RS', 'B760', 140], ['ASRock', 'B760M Steel Legend WiFi', 'B760', 160], ['ASRock', 'B760M Pro RS', 'B760', 125], ['ASRock', 'B760I Lightning WiFi', 'B760', 160], ['ASRock', 'B760M-HDV/M.2', 'B760', 95],
  ['ASUS', 'ROG Maximus Z690 Hero', 'Z690', 600], ['ASUS', 'ROG Strix Z690-F Gaming WiFi', 'Z690', 330], ['ASUS', 'ROG Strix Z690-A Gaming WiFi D4', 'Z690', 300], ['ASUS', 'TUF Gaming Z690-Plus WiFi D4', 'Z690', 250], ['ASUS', 'Prime Z690-P', 'Z690', 200],
  ['MSI', 'MPG Z690 Carbon WiFi', 'Z690', 400], ['MSI', 'MAG Z690 Tomahawk WiFi', 'Z690', 280], ['MSI', 'PRO Z690-A', 'Z690', 200],
  ['Gigabyte', 'Z690 Aorus Elite AX', 'Z690', 270], ['Gigabyte', 'Z690 Gaming X DDR4', 'Z690', 200], ['Gigabyte', 'Z690 UD', 'Z690', 190], ['ASRock', 'Z690 Taichi', 'Z690', 450], ['ASRock', 'Z690 Steel Legend', 'Z690', 230], ['ASRock', 'Z690 Pro RS', 'Z690', 190],
  ['ASUS', 'ROG Strix B660-A Gaming WiFi D4', 'B660', 200], ['ASUS', 'TUF Gaming B660-Plus WiFi D4', 'B660', 170], ['ASUS', 'Prime B660M-A D4', 'B660', 130],
  ['MSI', 'MAG B660 Tomahawk WiFi DDR4', 'B660', 180], ['MSI', 'MAG B660M Mortar WiFi DDR4', 'B660', 170], ['MSI', 'PRO B660M-A DDR4', 'B660', 140],
  ['Gigabyte', 'B660 Aorus Master DDR4', 'B660', 230], ['Gigabyte', 'B660 Gaming X DDR4', 'B660', 150], ['Gigabyte', 'B660M DS3H DDR4', 'B660', 110], ['ASRock', 'B660 Steel Legend', 'B660', 160], ['ASRock', 'B660M Steel Legend', 'B660', 150], ['ASRock', 'B660M Pro RS', 'B660', 120],
  ['ASUS', 'Prime H610M-E', 'H610', 90], ['MSI', 'PRO H610M-G', 'H610', 85], ['Gigabyte', 'H610M S2H', 'H610', 85], ['ASRock', 'H610M-HDV', 'H610', 80],
  // Intel LGA 1200 / 1151
  ['ASUS', 'ROG Strix Z590-E Gaming WiFi', 'Z590', 350], ['ASUS', 'TUF Gaming Z590-Plus WiFi', 'Z590', 220], ['MSI', 'MAG Z590 Tomahawk WiFi', 'Z590', 250], ['Gigabyte', 'Z590 Aorus Elite AX', 'Z590', 250], ['ASRock', 'Z590 Steel Legend', 'Z590', 220],
  ['ASUS', 'TUF Gaming B560M-Plus WiFi', 'B560', 150], ['ASUS', 'Prime B560M-A', 'B560', 110], ['MSI', 'MAG B560 Tomahawk WiFi', 'B560', 180], ['MSI', 'B560M Pro-VDH WiFi', 'B560', 120], ['Gigabyte', 'B560M Aorus Pro AX', 'B560', 150], ['Gigabyte', 'B560M DS3H', 'B560', 100], ['ASRock', 'B560M Pro4', 'B560', 100],
  ['ASUS', 'ROG Strix Z490-E Gaming', 'Z490', 300], ['MSI', 'MPG Z490 Gaming Edge WiFi', 'Z490', 200], ['Gigabyte', 'Z490 Aorus Elite AC', 'Z490', 200], ['ASRock', 'Z490 Steel Legend', 'Z490', 180],
  ['ASUS', 'ROG Strix Z390-E Gaming', 'Z390', 250], ['MSI', 'MPG Z390 Gaming Pro Carbon', 'Z390', 220], ['Gigabyte', 'Z390 Aorus Pro WiFi', 'Z390', 200], ['ASRock', 'Z390 Phantom Gaming 4', 'Z390', 140], ['Gigabyte', 'B365M DS3H', 'B365', 90], ['MSI', 'B360M Mortar', 'B360', 100],
];
const SOCKET: Record<string, [string, number]> = {
  X870E: ['AMD AM5', 0.6], X870: ['AMD AM5', 0.6], B850: ['AMD AM5', 0.6], B650E: ['AMD AM5', 0.6], B650: ['AMD AM5', 0.6], A620: ['AMD AM5', 0.55],
  X570: ['AMD AM4', 0.5], B550: ['AMD AM4', 0.5], A520: ['AMD AM4', 0.45], X470: ['AMD AM4', 0.4], B450: ['AMD AM4', 0.4],
  Z890: ['Intel LGA 1851', 0.55], B860: ['Intel LGA 1851', 0.55],
  Z790: ['Intel LGA 1700', 0.5], B760: ['Intel LGA 1700', 0.5], Z690: ['Intel LGA 1700', 0.45], B660: ['Intel LGA 1700', 0.45], H610: ['Intel LGA 1700', 0.45],
  Z590: ['Intel LGA 1200', 0.4], B560: ['Intel LGA 1200', 0.4], Z490: ['Intel LGA 1200', 0.38],
  Z390: ['Intel LGA 1151', 0.35], B365: ['Intel LGA 1151', 0.35], B360: ['Intel LGA 1151', 0.35],
};
function boardModels(): UsedModel[] {
  const out = BOARDS.map(([maker, model, chip, usd]) =>
    mk({ kind: 'board', maker, group: `${chip} (${SOCKET[chip][0]})`, name: `${maker} ${model}`, short: model, newUsd: usd, factor: SOCKET[chip][1], info: `${SOCKET[chip][0]}, ${chip}${/(^|\W)(B\d{3}M|A\d{3}M|H\d{3}M|\d{3}M)|-M|mATX/.test(model) ? ' · Micro-ATX' : /-I\b|I Lightning|-I /.test(model) ? ' · Mini-ITX' : ''}` }),
  );
  // typical board per chipset, brand unknown
  const seen = new Set<string>();
  for (const [, , chip] of BOARDS) {
    if (seen.has(chip)) continue;
    seen.add(chip);
    const prices = BOARDS.filter((b) => b[2] === chip).map((b) => b[3]).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    out.push(mk({ kind: 'board', maker: 'Other / not sure', group: `${chip} (${SOCKET[chip][0]})`, name: `${chip} board (any brand)`, short: `Typical ${chip} board`, newUsd: median, factor: SOCKET[chip][1] - 0.05, info: SOCKET[chip][0] }));
  }
  return out;
}

// ---- Power supplies ----------------------------------------------------------------------
// [maker, series, product name ({w} = watts), watts list, rating, typical price for each wattage, older series]
type Psu = [string, string, string, number[], string, number[], boolean?];
const PSUS: Psu[] = [
  ['Corsair', 'RMx', 'RM{w}x', [750, 850, 1000, 1200], 'Gold', [120, 140, 190, 230]],
  ['Corsair', 'RMx Shift', 'RM{w}x Shift', [850, 1000, 1200], 'Gold', [150, 200, 240]],
  ['Corsair', 'RMe', 'RM{w}e', [650, 750, 850, 1000], 'Gold', [85, 100, 115, 160]],
  ['Corsair', 'HXi', 'HX{w}i', [1000, 1200, 1500], 'Platinum', [260, 290, 360]],
  ['Corsair', 'AXi', 'AX{w}i', [1600], 'Titanium', [600]],
  ['Corsair', 'SF (SFX)', 'SF{w}', [750, 1000], 'Platinum', [190, 230]],
  ['Corsair', 'CX', 'CX{w}', [550, 650, 750], 'Bronze', [60, 70, 85]],
  ['Corsair', 'CX-M', 'CX{w}M', [650, 750], 'Bronze', [75, 90]],
  ['Seasonic', 'Focus GX', 'Focus GX-{w}', [650, 750, 850, 1000], 'Gold', [100, 120, 140, 180]],
  ['Seasonic', 'Vertex GX', 'Vertex GX-{w}', [850, 1000, 1200], 'Gold', [160, 200, 250]],
  ['Seasonic', 'Prime TX', 'Prime TX-{w}', [1000, 1300, 1600], 'Titanium', [330, 400, 520]],
  ['Seasonic', 'Core GX', 'Core GX-{w}', [650, 750, 850], 'Gold', [90, 100, 115]],
  ['Seasonic', 'G12 GC', 'G12 GC-{w}', [650, 750, 850], 'Gold', [75, 85, 100]],
  ['Seasonic', 'S12III', 'S12III {w}', [550, 650], 'Bronze', [55, 60], true],
  ['be quiet!', 'Pure Power 12 M', 'Pure Power 12 M {w}W', [650, 750, 850, 1000], 'Gold', [100, 110, 130, 170]],
  ['be quiet!', 'Straight Power 12', 'Straight Power 12 {w}W', [850, 1000, 1200], 'Platinum', [180, 230, 280]],
  ['be quiet!', 'Dark Power 13', 'Dark Power 13 {w}W', [850, 1000], 'Titanium', [240, 280]],
  ['be quiet!', 'Dark Power Pro 13', 'Dark Power Pro 13 {w}W', [1600], 'Titanium', [500]],
  ['be quiet!', 'System Power 10', 'System Power 10 {w}W', [650, 750], 'Bronze', [65, 75]],
  ['MSI', 'MAG A-GL PCIE5', 'MAG A{w}GL PCIE5', [650, 750, 850, 1000], 'Gold', [80, 90, 110, 140]],
  ['MSI', 'MAG A-BN', 'MAG A{w}BN', [550, 650], 'Bronze', [50, 55]],
  ['MSI', 'MPG A-G PCIE5', 'MPG A{w}G PCIE5', [850, 1000], 'Gold', [140, 170]],
  ['MSI', 'MEG Ai-P', 'MEG Ai{w}P PCIE5', [1300], 'Platinum', [300]],
  ['MSI', 'MEG Ai-T', 'MEG Ai{w}T PCIE5', [1600], 'Titanium', [500]],
  ['Thermaltake', 'Toughpower GF3', 'Toughpower GF3 {w}W', [850, 1000, 1200], 'Gold', [120, 150, 200]],
  ['Thermaltake', 'Toughpower GF A3', 'Toughpower GF A3 {w}W', [750, 850, 1050], 'Gold', [85, 100, 140]],
  ['Thermaltake', 'Smart BX1', 'Smart BX1 {w}W', [550, 650], 'Bronze', [50, 60]],
  ['Thermaltake', 'Smart', 'Smart {w}W', [500, 600], 'White', [40, 45]],
  ['Cooler Master', 'MWE Gold V2', 'MWE Gold {w} V2', [650, 750, 850], 'Gold', [75, 85, 100]],
  ['Cooler Master', 'MWE Bronze V2', 'MWE Bronze {w} V2', [550, 650], 'Bronze', [50, 60]],
  ['Cooler Master', 'GX III Gold', 'GX III Gold {w}', [750, 850], 'Gold', [100, 110]],
  ['Cooler Master', 'V SFX Gold', 'V{w} SFX Gold', [750, 850], 'Gold', [140, 150]],
  ['NZXT', 'C Gold', 'C{w} Gold', [650, 750, 850, 1000, 1200], 'Gold', [90, 100, 120, 150, 180]],
  ['NZXT', 'C Platinum', 'C{w} Platinum', [1500], 'Platinum', [300]],
  ['EVGA', 'SuperNOVA G6', 'SuperNOVA {w} G6', [650, 750, 850, 1000], 'Gold', [90, 100, 120, 170], true],
  ['EVGA', 'SuperNOVA GT', 'SuperNOVA {w} GT', [750, 850], 'Gold', [95, 110], true],
  ['EVGA', 'SuperNOVA G2', 'SuperNOVA {w} G2', [750, 1300], 'Gold', [110, 220], true],
  ['EVGA', 'BR', '{w} BR', [600], 'Bronze', [55], true],
  ['EVGA', 'BQ', '{w} BQ', [750], 'Bronze', [70], true],
  ['ASUS', 'ROG Thor P2', 'ROG Thor {w}P2', [1000, 1200], 'Platinum', [330, 380]],
  ['ASUS', 'ROG Strix Gold Aura', 'ROG Strix {w}G Aura', [850, 1000], 'Gold', [160, 200]],
  ['ASUS', 'TUF Gaming Gold', 'TUF Gaming {w}G', [750, 850, 1000], 'Gold', [100, 120, 160]],
  ['Super Flower', 'Leadex VII XG', 'Leadex VII XG {w}W', [850, 1000], 'Gold', [140, 170]],
  ['Super Flower', 'Leadex V Platinum Pro', 'Leadex V Platinum Pro {w}W', [850, 1000], 'Platinum', [160, 190]],
  ['Super Flower', 'Leadex III Gold', 'Leadex III Gold {w}W', [750, 850], 'Gold', [100, 110], true],
  ['Lian Li', 'Edge', 'Edge {w}', [1000, 1300], 'Gold', [190, 280]],
  ['Lian Li', 'SP (SFX)', 'SP{w}', [750, 850], 'Gold', [150, 170]],
  ['FSP', 'Hydro G Pro', 'Hydro G Pro {w}W', [850, 1000], 'Gold', [120, 150]],
  ['FSP', 'Hydro PTM Pro', 'Hydro PTM Pro {w}W', [1200], 'Platinum', [250]],
  ['FSP', 'Dagger Pro (SFX)', 'Dagger Pro {w}W', [850], 'Gold', [150]],
  ['DeepCool', 'PX-G', 'PX{w}G', [850, 1000, 1300], 'Gold', [100, 140, 190]],
  ['DeepCool', 'PQ-M', 'PQ{w}M', [750, 850, 1000], 'Gold', [95, 110, 140]],
  ['DeepCool', 'PK-D', 'PK{w}D', [650], 'Bronze', [55]],
  ['DeepCool', 'PL-D', 'PL{w}D', [750], 'Bronze', [75]],
  ['Montech', 'Century II', 'Century II {w}W', [850, 1050, 1200], 'Gold', [110, 140, 170]],
  ['Montech', 'Titan Gold', 'Titan Gold {w}W', [850, 1000, 1200], 'Gold', [120, 150, 190]],
  ['Gigabyte', 'UD GM PG5', 'UD{w}GM PG5', [750, 850, 1000], 'Gold', [90, 100, 140]],
  ['Gigabyte', 'P-B', 'P{w}B', [550, 650], 'Bronze', [50, 55]],
  ['Fractal Design', 'Ion+ 2 Platinum', 'Ion+ 2 Platinum {w}W', [760, 860], 'Platinum', [150, 170], true],
  ['Fractal Design', 'Ion Gold', 'Ion Gold {w}W', [750, 850], 'Gold', [110, 120]],
  ['SilverStone', 'SX Platinum (SFX)', 'SX{w} Platinum', [750, 1000], 'Platinum', [170, 250]],
  ['ADATA XPG', 'Core Reactor II', 'Core Reactor II {w}W', [750, 850, 1200], 'Gold', [95, 110, 170]],
];
function psuModels(): UsedModel[] {
  const out: UsedModel[] = [];
  for (const [maker, series, tpl, watts, rating, prices, old] of PSUS) {
    watts.forEach((w, i) => {
      const r = rating === 'White' ? '80+' : `80+ ${rating}`;
      out.push(
        mk({
          kind: 'psu',
          maker,
          group: series,
          name: `${maker} ${tpl.replace('{w}', String(w))}`,
          short: `${tpl.replace('{w}', String(w))} (${w} W, ${r})`,
          newUsd: prices[i],
          factor: old || rating === 'Bronze' || rating === 'White' ? 0.45 : 0.55,
          info: `${w} W · ${r}${series.includes('SFX') ? ' · SFX' : ''}${old ? ' · older model' : ''}`,
        }),
      );
    });
  }
  const generic: [number, string, number][] = [[550, 'Bronze', 55], [650, 'Bronze', 65], [650, 'Gold', 85], [750, 'Gold', 100], [850, 'Gold', 120], [1000, 'Gold', 170], [1000, 'Platinum', 230], [1200, 'Gold', 220]];
  for (const [w, r, p] of generic)
    out.push(mk({ kind: 'psu', maker: 'Other / not sure', group: `80+ ${r}`, name: `${w} W 80+ ${r} (any brand)`, short: `${w} W, 80+ ${r}`, newUsd: p, factor: r === 'Bronze' ? 0.42 : 0.5, info: `${w} W · 80+ ${r}` }));
  return out;
}

// ---- Cases ---------------------------------------------------------------------------------
// [maker, model, size, typical price new]
type Size = 'Full tower' | 'Mid-tower' | 'Micro-ATX' | 'Mini-ITX';
const CASES: [string, string, Size, number][] = [
  ['Lian Li', 'O11 Dynamic EVO', 'Mid-tower', 160], ['Lian Li', 'O11 Dynamic EVO XL', 'Full tower', 250], ['Lian Li', 'O11 Vision', 'Mid-tower', 140], ['Lian Li', 'O11 Vision Compact', 'Mid-tower', 110], ['Lian Li', 'O11 Dynamic Mini V2', 'Micro-ATX', 120], ['Lian Li', 'O11 Air Mini', 'Mid-tower', 110],
  ['Lian Li', 'Lancool 216', 'Mid-tower', 100], ['Lian Li', 'Lancool 217', 'Mid-tower', 120], ['Lian Li', 'Lancool 207', 'Mid-tower', 80], ['Lian Li', 'Lancool III', 'Mid-tower', 150], ['Lian Li', 'A3-mATX', 'Micro-ATX', 70], ['Lian Li', 'A4-H2O', 'Mini-ITX', 150], ['Lian Li', 'Q58', 'Mini-ITX', 110],
  ['Fractal Design', 'North', 'Mid-tower', 140], ['Fractal Design', 'North XL', 'Full tower', 180], ['Fractal Design', 'Meshify 2', 'Mid-tower', 160], ['Fractal Design', 'Meshify 2 Compact', 'Mid-tower', 120], ['Fractal Design', 'Meshify C', 'Mid-tower', 100], ['Fractal Design', 'Torrent', 'Mid-tower', 190], ['Fractal Design', 'Torrent Compact', 'Mid-tower', 150],
  ['Fractal Design', 'Pop Air', 'Mid-tower', 80], ['Fractal Design', 'Pop Mini Air', 'Micro-ATX', 80], ['Fractal Design', 'Define 7', 'Mid-tower', 170], ['Fractal Design', 'Define 7 Compact', 'Mid-tower', 110], ['Fractal Design', 'Focus 2', 'Mid-tower', 70], ['Fractal Design', 'Terra', 'Mini-ITX', 180], ['Fractal Design', 'Ridge', 'Mini-ITX', 130], ['Fractal Design', 'Mood', 'Mini-ITX', 150],
  ['NZXT', 'H5 Flow', 'Mid-tower', 95], ['NZXT', 'H6 Flow', 'Mid-tower', 120], ['NZXT', 'H7 Flow', 'Mid-tower', 130], ['NZXT', 'H9 Flow', 'Mid-tower', 160], ['NZXT', 'H9 Elite', 'Mid-tower', 220], ['NZXT', 'H510 / H510 Flow', 'Mid-tower', 80], ['NZXT', 'H1 V2 (with PSU and cooler)', 'Mini-ITX', 400],
  ['Corsair', '4000D Airflow', 'Mid-tower', 95], ['Corsair', '4000D RGB Airflow', 'Mid-tower', 130], ['Corsair', 'Frame 4000D', 'Mid-tower', 100], ['Corsair', '5000D Airflow', 'Mid-tower', 170], ['Corsair', '3000D Airflow', 'Mid-tower', 80], ['Corsair', '3500X', 'Mid-tower', 100], ['Corsair', '6500X', 'Mid-tower', 200],
  ['Corsair', '2500X', 'Micro-ATX', 110], ['Corsair', '2000D Airflow', 'Mini-ITX', 130], ['Corsair', '7000D Airflow', 'Full tower', 250], ['Corsair', '9000D', 'Full tower', 500], ['Corsair', 'iCUE 465X', 'Mid-tower', 110],
  ['Phanteks', 'NV5', 'Mid-tower', 110], ['Phanteks', 'NV7', 'Full tower', 200], ['Phanteks', 'XT Pro', 'Mid-tower', 80], ['Phanteks', 'XT Pro Ultra', 'Mid-tower', 100], ['Phanteks', 'Eclipse G360A', 'Mid-tower', 90], ['Phanteks', 'Eclipse G400A', 'Mid-tower', 100], ['Phanteks', 'Eclipse P400A', 'Mid-tower', 90], ['Phanteks', 'Evolv X2', 'Mid-tower', 180], ['Phanteks', 'Enthoo Pro 2', 'Full tower', 150],
  ['be quiet!', 'Pure Base 500DX', 'Mid-tower', 110], ['be quiet!', 'Pure Base 501 Airflow', 'Mid-tower', 100], ['be quiet!', 'Light Base 900 DX', 'Full tower', 260], ['be quiet!', 'Shadow Base 800 DX', 'Mid-tower', 220], ['be quiet!', 'Dark Base 701', 'Mid-tower', 200], ['be quiet!', 'Silent Base 802', 'Mid-tower', 180],
  ['Hyte', 'Y40', 'Mid-tower', 150], ['Hyte', 'Y60', 'Mid-tower', 200], ['Hyte', 'Y70', 'Mid-tower', 240], ['Hyte', 'Y70 Touch Infinite', 'Mid-tower', 400], ['Hyte', 'Revolt 3', 'Mini-ITX', 150],
  ['Montech', 'Air 903 Max', 'Mid-tower', 90], ['Montech', 'Air 903 Base', 'Mid-tower', 70], ['Montech', 'King 95 Pro', 'Mid-tower', 150], ['Montech', 'XR', 'Mid-tower', 80], ['Montech', 'Sky Two', 'Mid-tower', 100], ['Montech', 'Air 100 ARGB', 'Micro-ATX', 60],
  ['Cooler Master', 'NR200P V2', 'Mini-ITX', 100], ['Cooler Master', 'TD500 Mesh V2', 'Mid-tower', 110], ['Cooler Master', 'HAF 700', 'Full tower', 300], ['Cooler Master', 'HAF 500', 'Mid-tower', 140], ['Cooler Master', 'MasterBox Q300L', 'Micro-ATX', 50], ['Cooler Master', 'Qube 500', 'Mid-tower', 100],
  ['Thermaltake', 'Tower 500', 'Mid-tower', 200], ['Thermaltake', 'Tower 300', 'Micro-ATX', 140], ['Thermaltake', 'View 51 TG ARGB', 'Full tower', 180], ['Thermaltake', 'Core P3 TG Pro', 'Mid-tower', 150], ['Thermaltake', 'Ceres 500 TG ARGB', 'Mid-tower', 130], ['Thermaltake', 'Versa H18', 'Micro-ATX', 50], ['Thermaltake', 'S100 TG', 'Micro-ATX', 60],
  ['Jonsbo', 'D41 Mesh', 'Mid-tower', 90], ['Jonsbo', 'D31 Mesh', 'Micro-ATX', 80], ['Jonsbo', 'TK-1', 'Micro-ATX', 120], ['Jonsbo', 'Z20', 'Micro-ATX', 90],
  ['DeepCool', 'CH560', 'Mid-tower', 100], ['DeepCool', 'CH510', 'Mid-tower', 70], ['DeepCool', 'CH370', 'Micro-ATX', 70], ['DeepCool', 'CC560', 'Mid-tower', 60], ['DeepCool', 'CH780', 'Full tower', 180], ['DeepCool', 'CG580 4F', 'Mid-tower', 90],
  ['Antec', 'C8', 'Full tower', 140], ['Antec', 'Flux Pro', 'Full tower', 130], ['Antec', 'NX410', 'Mid-tower', 60], ['Antec', 'Performance 1 FT', 'Full tower', 200],
  ['ASUS', 'ROG Hyperion GR701', 'Full tower', 400], ['ASUS', 'TUF Gaming GT502', 'Mid-tower', 160], ['ASUS', 'ProArt PA602', 'Mid-tower', 230], ['ASUS', 'Prime AP201', 'Micro-ATX', 90], ['ASUS', 'A21', 'Micro-ATX', 80],
  ['MSI', 'MAG Forge 100R', 'Mid-tower', 70], ['MSI', 'MPG Gungnir 110R', 'Mid-tower', 120], ['SSUPD', 'Meshroom S', 'Mini-ITX', 120], ['SilverStone', 'FARA R1', 'Mid-tower', 60], ['SilverStone', 'SG13', 'Mini-ITX', 60], ['Zalman', 'i3 Neo', 'Mid-tower', 60], ['Cougar', 'FV270', 'Mid-tower', 120],
];
function caseModels(): UsedModel[] {
  const out = CASES.map(([maker, model, size, usd]) =>
    mk({ kind: 'case', maker, group: size, name: `${maker} ${model}`, short: model, newUsd: usd, factor: usd <= 70 || size === 'Full tower' ? 0.45 : 0.5, info: size }),
  );
  const generic: [string, Size, number][] = [['Budget case (glass side, 2-3 fans)', 'Mid-tower', 60], ['Airflow mid-tower', 'Mid-tower', 100], ['Premium mid-tower', 'Mid-tower', 160], ['Full tower', 'Full tower', 200], ['Micro-ATX case', 'Micro-ATX', 70], ['Mini-ITX case', 'Mini-ITX', 130]];
  for (const [n, size, usd] of generic) out.push(mk({ kind: 'case', maker: 'Other / not sure', group: size, name: `${n} (any brand)`, short: n, newUsd: usd, factor: 0.45, info: size }));
  return out;
}

// ---- All models --------------------------------------------------------------------------
let cache: Record<PartKind, UsedModel[]> | null = null;
export function usedModels(kind: PartKind): UsedModel[] {
  cache ??= { gpu: gpuModels(), cpu: cpuModels(), ram: ramModels(), ssd: ssdModels(), board: boardModels(), psu: psuModels(), case: caseModels() };
  return cache[kind];
}
export const findModel = (id: string): UsedModel | undefined => {
  const kind = id.split('|')[0] as PartKind;
  return KIND_LIST.includes(kind) ? usedModels(kind).find((m) => m.id === id) : undefined;
};
export const KIND_LIST: PartKind[] = ['gpu', 'cpu', 'ram', 'ssd', 'board', 'psu', 'case'];

/** Brands in a sensible order: well-known first, "any brand" last. */
export function makersOf(kind: PartKind): string[] {
  const count = new Map<string, number>();
  for (const m of usedModels(kind)) count.set(m.maker, (count.get(m.maker) ?? 0) + 1);
  return [...count.keys()].sort((a, b) => {
    const la = /^(Any brand|Other)/.test(a) ? 1 : 0;
    const lb = /^(Any brand|Other)/.test(b) ? 1 : 0;
    return la - lb || a.localeCompare(b);
  });
}

export const MODEL_TIPS: Record<PartKind, string> = {
  gpu: 'Ask how it was used (mining or heavy overclocking wears cards faster), check the fans and temperatures under load, and whether any warranty is left. Premium versions (ROG Strix, Suprim, Nitro+...) sell for a little more, not a lot.',
  cpu: 'Processors almost never wear out. Check the pins (AMD AM4 and older on the chip, Intel and AM5 in the board socket) and that it was not delidded or run at extreme voltages.',
  ram: 'Memory rarely wears out, and the shortage keeps used kits in demand, so they hold their value. Make sure both sticks are the same kit, and test it (MemTest86 or the BIOS memory test) when you can.',
  ssd: "SSDs wear out with writes. Ask for a screenshot of the drive's health (CrystalDiskInfo): above 90% health and well under the rated TBW is fine.",
  board: 'Check that the socket and chipset match your CPU, that the BIOS supports it, and that the box comes with the I/O shield, Wi-Fi antennas and no bent CPU-socket pins.',
  psu: 'Power supplies age with use. Avoid ones older than about 5 years, buy known brands only, and check whether the warranty is still running and transfers to you.',
  case: "Cases don't wear out, but shipping is expensive, so most used cases sell for local pickup. Check for broken glass, missing screws and front-panel ports that work.",
};

// ---- Prices -----------------------------------------------------------------------------
export interface PriceCtx {
  /** USD per benchmark point of current parts (marketRate) */
  rate: { gpu: number; cpu: number };
  /** latest recorded US price of a benchmarked part */
  usPrice: (b: BenchItem) => number | undefined;
  /** latest recorded US price of a tracked model name in the weekly price list */
  latest: (model: string) => number | undefined;
}
export interface Range {
  low: number;
  high: number;
  mid: number;
  /** price new today, when we know it */
  newUsd?: number;
  note: string;
}

/** Fair used price of one model, USD before tax (private sale, good condition). */
export function modelRange(m: UsedModel, ctx: PriceCtx): Range {
  if (m.bench && (m.kind === 'gpu' || m.kind === 'cpu')) {
    const r = usedRange(m.bench, ctx.rate[m.kind], ctx.usPrice(m.bench));
    const mid = r.mid * (1 + (m.premium ?? 0));
    return { low: Math.round(mid * 0.85), high: Math.round(mid * 1.15), mid: Math.round(mid), note: r.note };
  }
  let newUsd = m.newUsd ?? 0;
  if (m.ddr5) {
    // Follows the DDR5 shortage: scale with the latest recorded price of the cheapest 2x16GB DDR5-6000 kit.
    const l = ctx.latest('DDR5-6000 2x16GB (cheapest)');
    if (l) newUsd *= Math.min(2, Math.max(0.5, l / 440));
  }
  const mid = newUsd * (m.factor ?? 0.5);
  return { low: Math.round(mid * 0.85), high: Math.round(mid * 1.15), mid: Math.round(mid), newUsd: Math.round(newUsd), note: '' };
}
