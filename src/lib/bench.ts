// Approximate gaming performance for the Benchmarks tab, the bottleneck checker, the deal
// checker and the used-price guide. Rounded from public review averages (relative-performance
// charts at TechPowerUp, Hardware Unboxed, Gamers Nexus and similar), not our own tests.
//   GPU score: 1440p, high settings, RTX 4090 = 100.
//   CPU score: games with a very fast GPU (CPU-limited), Ryzen 7 9800X3D = 100.

export interface BenchItem {
  name: string;
  maker: 'Nvidia' | 'AMD' | 'Intel';
  year: number;
  score: number;
  /** USD launch price */
  msrp?: number;
  vram?: number;
  cores?: number;
  threads?: number;
}

export const GPUS: BenchItem[] = [
  { name: 'GeForce RTX 5090', maker: 'Nvidia', year: 2025, score: 128, msrp: 1999, vram: 32 },
  { name: 'GeForce RTX 4090', maker: 'Nvidia', year: 2022, score: 100, msrp: 1599, vram: 24 },
  { name: 'GeForce RTX 5080', maker: 'Nvidia', year: 2025, score: 83, msrp: 999, vram: 16 },
  { name: 'Radeon RX 7900 XTX', maker: 'AMD', year: 2022, score: 80, msrp: 999, vram: 24 },
  { name: 'GeForce RTX 4080 SUPER', maker: 'Nvidia', year: 2024, score: 78, msrp: 999, vram: 16 },
  { name: 'GeForce RTX 4080', maker: 'Nvidia', year: 2022, score: 77, msrp: 1199, vram: 16 },
  { name: 'GeForce RTX 5070 Ti', maker: 'Nvidia', year: 2025, score: 73, msrp: 749, vram: 16 },
  { name: 'Radeon RX 9070 XT', maker: 'AMD', year: 2025, score: 72, msrp: 599, vram: 16 },
  { name: 'Radeon RX 7900 XT', maker: 'AMD', year: 2022, score: 68, msrp: 899, vram: 20 },
  { name: 'GeForce RTX 4070 Ti SUPER', maker: 'Nvidia', year: 2024, score: 67, msrp: 799, vram: 16 },
  { name: 'Radeon RX 9070', maker: 'AMD', year: 2025, score: 64, msrp: 549, vram: 16 },
  { name: 'GeForce RTX 3090 Ti', maker: 'Nvidia', year: 2022, score: 62, msrp: 1999, vram: 24 },
  { name: 'GeForce RTX 4070 Ti', maker: 'Nvidia', year: 2023, score: 61, msrp: 799, vram: 12 },
  { name: 'GeForce RTX 5070', maker: 'Nvidia', year: 2025, score: 60, msrp: 549, vram: 12 },
  { name: 'Radeon RX 7900 GRE', maker: 'AMD', year: 2024, score: 58, msrp: 549, vram: 16 },
  { name: 'GeForce RTX 4070 SUPER', maker: 'Nvidia', year: 2024, score: 57, msrp: 599, vram: 12 },
  { name: 'GeForce RTX 3090', maker: 'Nvidia', year: 2020, score: 57, msrp: 1499, vram: 24 },
  { name: 'Radeon RX 6950 XT', maker: 'AMD', year: 2022, score: 56, msrp: 1099, vram: 16 },
  { name: 'GeForce RTX 3080 Ti', maker: 'Nvidia', year: 2021, score: 55, msrp: 1199, vram: 12 },
  { name: 'Radeon RX 7800 XT', maker: 'AMD', year: 2023, score: 52, msrp: 499, vram: 16 },
  { name: 'Radeon RX 6900 XT', maker: 'AMD', year: 2020, score: 52, msrp: 999, vram: 16 },
  { name: 'GeForce RTX 3080', maker: 'Nvidia', year: 2020, score: 51, msrp: 699, vram: 10 },
  { name: 'GeForce RTX 4070', maker: 'Nvidia', year: 2023, score: 50, msrp: 599, vram: 12 },
  { name: 'Radeon RX 6800 XT', maker: 'AMD', year: 2020, score: 49, msrp: 649, vram: 16 },
  { name: 'GeForce RTX 5060 Ti 16 GB', maker: 'Nvidia', year: 2025, score: 45, msrp: 429, vram: 16 },
  { name: 'Radeon RX 9060 XT 16 GB', maker: 'AMD', year: 2025, score: 44, msrp: 349, vram: 16 },
  { name: 'Radeon RX 7700 XT', maker: 'AMD', year: 2023, score: 44, msrp: 449, vram: 12 },
  { name: 'Radeon RX 6800', maker: 'AMD', year: 2020, score: 43, msrp: 579, vram: 16 },
  { name: 'GeForce RTX 3070 Ti', maker: 'Nvidia', year: 2021, score: 42, msrp: 599, vram: 8 },
  { name: 'GeForce RTX 3070', maker: 'Nvidia', year: 2020, score: 40, msrp: 499, vram: 8 },
  { name: 'GeForce RTX 5060', maker: 'Nvidia', year: 2025, score: 38, msrp: 299, vram: 8 },
  { name: 'GeForce RTX 2080 Ti', maker: 'Nvidia', year: 2018, score: 38, msrp: 999, vram: 11 },
  { name: 'Radeon RX 6750 XT', maker: 'AMD', year: 2022, score: 38, msrp: 549, vram: 12 },
  { name: 'GeForce RTX 4060 Ti', maker: 'Nvidia', year: 2023, score: 37, msrp: 399, vram: 8 },
  { name: 'Radeon RX 6700 XT', maker: 'AMD', year: 2021, score: 36, msrp: 479, vram: 12 },
  { name: 'GeForce RTX 3060 Ti', maker: 'Nvidia', year: 2020, score: 35, msrp: 399, vram: 8 },
  { name: 'Arc B580', maker: 'Intel', year: 2024, score: 34, msrp: 249, vram: 12 },
  { name: 'GeForce RTX 2080 SUPER', maker: 'Nvidia', year: 2019, score: 33, msrp: 699, vram: 8 },
  { name: 'Radeon RX 7600 XT', maker: 'AMD', year: 2024, score: 31, msrp: 329, vram: 16 },
  { name: 'GeForce RTX 2080', maker: 'Nvidia', year: 2018, score: 31, msrp: 699, vram: 8 },
  { name: 'GeForce RTX 4060', maker: 'Nvidia', year: 2023, score: 30, msrp: 299, vram: 8 },
  { name: 'Arc B570', maker: 'Intel', year: 2025, score: 30, msrp: 219, vram: 10 },
  { name: 'Radeon RX 7600', maker: 'AMD', year: 2023, score: 30, msrp: 269, vram: 8 },
  { name: 'Arc A770', maker: 'Intel', year: 2022, score: 29, msrp: 329, vram: 16 },
  { name: 'GeForce GTX 1080 Ti', maker: 'Nvidia', year: 2017, score: 28, msrp: 699, vram: 11 },
  { name: 'GeForce RTX 5050', maker: 'Nvidia', year: 2025, score: 28, msrp: 249, vram: 8 },
  { name: 'Radeon RX 6650 XT', maker: 'AMD', year: 2022, score: 29, msrp: 399, vram: 8 },
  { name: 'GeForce RTX 2070 SUPER', maker: 'Nvidia', year: 2019, score: 29, msrp: 499, vram: 8 },
  { name: 'Arc A750', maker: 'Intel', year: 2022, score: 27, msrp: 289, vram: 8 },
  { name: 'Radeon RX 6600 XT', maker: 'AMD', year: 2021, score: 27, msrp: 379, vram: 8 },
  { name: 'Radeon RX 5700 XT', maker: 'AMD', year: 2019, score: 26, msrp: 399, vram: 8 },
  { name: 'GeForce RTX 3060', maker: 'Nvidia', year: 2021, score: 26, msrp: 329, vram: 12 },
  { name: 'GeForce RTX 2070', maker: 'Nvidia', year: 2018, score: 26, msrp: 499, vram: 8 },
  { name: 'Radeon RX 6600', maker: 'AMD', year: 2021, score: 24, msrp: 329, vram: 8 },
  { name: 'GeForce RTX 2060 SUPER', maker: 'Nvidia', year: 2019, score: 24, msrp: 399, vram: 8 },
  { name: 'Radeon VII', maker: 'AMD', year: 2019, score: 24, msrp: 699, vram: 16 },
  { name: 'Radeon RX 5700', maker: 'AMD', year: 2019, score: 23, msrp: 349, vram: 8 },
  { name: 'GeForce GTX 1080', maker: 'Nvidia', year: 2016, score: 22, msrp: 599, vram: 8 },
  { name: 'GeForce RTX 2060', maker: 'Nvidia', year: 2019, score: 21, msrp: 349, vram: 6 },
  { name: 'Radeon RX 5600 XT', maker: 'AMD', year: 2020, score: 21, msrp: 279, vram: 6 },
  { name: 'GeForce GTX 1070 Ti', maker: 'Nvidia', year: 2017, score: 20, msrp: 449, vram: 8 },
  { name: 'Radeon RX Vega 64', maker: 'AMD', year: 2017, score: 19, msrp: 499, vram: 8 },
  { name: 'GeForce GTX 1070', maker: 'Nvidia', year: 2016, score: 18, msrp: 379, vram: 8 },
  { name: 'GeForce RTX 3050', maker: 'Nvidia', year: 2022, score: 18, msrp: 249, vram: 8 },
  { name: 'GeForce GTX 1660 Ti', maker: 'Nvidia', year: 2019, score: 16, msrp: 279, vram: 6 },
  { name: 'GeForce GTX 1660 SUPER', maker: 'Nvidia', year: 2019, score: 16, msrp: 229, vram: 6 },
  { name: 'GeForce GTX 980 Ti', maker: 'Nvidia', year: 2015, score: 15, msrp: 649, vram: 6 },
  { name: 'GeForce GTX 1660', maker: 'Nvidia', year: 2019, score: 14, msrp: 219, vram: 6 },
  { name: 'Radeon RX 590', maker: 'AMD', year: 2018, score: 14, msrp: 279, vram: 8 },
  { name: 'Radeon RX 5500 XT', maker: 'AMD', year: 2019, score: 13, msrp: 199, vram: 8 },
  { name: 'Radeon RX 580', maker: 'AMD', year: 2017, score: 13, msrp: 229, vram: 8 },
  { name: 'GeForce GTX 1060 6 GB', maker: 'Nvidia', year: 2016, score: 13, msrp: 249, vram: 6 },
  { name: 'GeForce GTX 1650 SUPER', maker: 'Nvidia', year: 2019, score: 12, msrp: 159, vram: 4 },
  { name: 'Radeon RX 6500 XT', maker: 'AMD', year: 2022, score: 11, msrp: 199, vram: 4 },
  { name: 'GeForce GTX 980', maker: 'Nvidia', year: 2014, score: 11, msrp: 549, vram: 4 },
  { name: 'GeForce GTX 970', maker: 'Nvidia', year: 2014, score: 9, msrp: 329, vram: 4 },
  { name: 'GeForce GTX 1650', maker: 'Nvidia', year: 2019, score: 9, msrp: 149, vram: 4 },
  { name: 'GeForce GTX 1050 Ti', maker: 'Nvidia', year: 2016, score: 7, msrp: 139, vram: 4 },
];

export const CPUS: BenchItem[] = [
  { name: 'Ryzen 7 9800X3D', maker: 'AMD', year: 2024, score: 100, msrp: 479, cores: 8, threads: 16 },
  { name: 'Ryzen 9 9950X3D', maker: 'AMD', year: 2025, score: 99, msrp: 699, cores: 16, threads: 32 },
  { name: 'Ryzen 9 9900X3D', maker: 'AMD', year: 2025, score: 94, msrp: 599, cores: 12, threads: 24 },
  { name: 'Ryzen 7 7800X3D', maker: 'AMD', year: 2023, score: 89, msrp: 449, cores: 8, threads: 16 },
  { name: 'Ryzen 9 7950X3D', maker: 'AMD', year: 2023, score: 88, msrp: 699, cores: 16, threads: 32 },
  { name: 'Ryzen 9 9950X', maker: 'AMD', year: 2024, score: 85, msrp: 649, cores: 16, threads: 32 },
  { name: 'Core i9-14900K', maker: 'Intel', year: 2023, score: 84, msrp: 589, cores: 24, threads: 32 },
  { name: 'Ryzen 9 9900X', maker: 'AMD', year: 2024, score: 84, msrp: 499, cores: 12, threads: 24 },
  { name: 'Ryzen 7 9700X', maker: 'AMD', year: 2024, score: 83, msrp: 359, cores: 8, threads: 16 },
  { name: 'Core Ultra 9 285K', maker: 'Intel', year: 2024, score: 82, msrp: 589, cores: 24, threads: 24 },
  { name: 'Core i9-13900K', maker: 'Intel', year: 2022, score: 82, msrp: 589, cores: 24, threads: 32 },
  { name: 'Core i7-14700K', maker: 'Intel', year: 2023, score: 82, msrp: 409, cores: 20, threads: 28 },
  { name: 'Ryzen 5 9600X', maker: 'AMD', year: 2024, score: 80, msrp: 279, cores: 6, threads: 12 },
  { name: 'Core Ultra 7 265K', maker: 'Intel', year: 2024, score: 80, msrp: 394, cores: 20, threads: 20 },
  { name: 'Core i5-14600K', maker: 'Intel', year: 2023, score: 80, msrp: 319, cores: 14, threads: 20 },
  { name: 'Ryzen 9 7950X', maker: 'AMD', year: 2022, score: 80, msrp: 699, cores: 16, threads: 32 },
  { name: 'Core i7-13700K', maker: 'Intel', year: 2022, score: 79, msrp: 409, cores: 16, threads: 24 },
  { name: 'Ryzen 7 7700X', maker: 'AMD', year: 2022, score: 78, msrp: 399, cores: 8, threads: 16 },
  { name: 'Core i5-13600K', maker: 'Intel', year: 2022, score: 77, msrp: 319, cores: 14, threads: 20 },
  { name: 'Ryzen 5 7600X', maker: 'AMD', year: 2022, score: 76, msrp: 299, cores: 6, threads: 12 },
  { name: 'Core Ultra 5 245K', maker: 'Intel', year: 2024, score: 75, msrp: 309, cores: 14, threads: 14 },
  { name: 'Ryzen 5 7600', maker: 'AMD', year: 2023, score: 74, msrp: 229, cores: 6, threads: 12 },
  { name: 'Core i9-12900K', maker: 'Intel', year: 2021, score: 74, msrp: 589, cores: 16, threads: 24 },
  { name: 'Ryzen 7 5800X3D', maker: 'AMD', year: 2022, score: 72, msrp: 449, cores: 8, threads: 16 },
  { name: 'Core i7-12700K', maker: 'Intel', year: 2021, score: 71, msrp: 409, cores: 12, threads: 20 },
  { name: 'Ryzen 7 5700X3D', maker: 'AMD', year: 2024, score: 70, msrp: 249, cores: 8, threads: 16 },
  { name: 'Core i5-12600K', maker: 'Intel', year: 2021, score: 68, msrp: 289, cores: 10, threads: 16 },
  { name: 'Core i5-14400F', maker: 'Intel', year: 2024, score: 67, msrp: 196, cores: 10, threads: 16 },
  { name: 'Core i5-13400F', maker: 'Intel', year: 2023, score: 66, msrp: 196, cores: 10, threads: 16 },
  { name: 'Ryzen 9 5950X', maker: 'AMD', year: 2020, score: 64, msrp: 799, cores: 16, threads: 32 },
  { name: 'Ryzen 9 5900X', maker: 'AMD', year: 2020, score: 64, msrp: 549, cores: 12, threads: 24 },
  { name: 'Core i5-12400F', maker: 'Intel', year: 2022, score: 63, msrp: 167, cores: 6, threads: 12 },
  { name: 'Ryzen 7 5800X', maker: 'AMD', year: 2020, score: 62, msrp: 449, cores: 8, threads: 16 },
  { name: 'Ryzen 7 5700X', maker: 'AMD', year: 2022, score: 61, msrp: 299, cores: 8, threads: 16 },
  { name: 'Ryzen 5 5600X', maker: 'AMD', year: 2020, score: 60, msrp: 299, cores: 6, threads: 12 },
  { name: 'Ryzen 5 5600', maker: 'AMD', year: 2022, score: 59, msrp: 199, cores: 6, threads: 12 },
  { name: 'Core i9-11900K', maker: 'Intel', year: 2021, score: 58, msrp: 539, cores: 8, threads: 16 },
  { name: 'Core i5-11600K', maker: 'Intel', year: 2021, score: 55, msrp: 262, cores: 6, threads: 12 },
  { name: 'Core i9-10900K', maker: 'Intel', year: 2020, score: 55, msrp: 488, cores: 10, threads: 20 },
  { name: 'Ryzen 5 5500', maker: 'AMD', year: 2022, score: 51, msrp: 159, cores: 6, threads: 12 },
  { name: 'Core i7-10700K', maker: 'Intel', year: 2020, score: 52, msrp: 374, cores: 8, threads: 16 },
  { name: 'Core i5-11400F', maker: 'Intel', year: 2021, score: 50, msrp: 157, cores: 6, threads: 12 },
  { name: 'Core i9-9900K', maker: 'Intel', year: 2018, score: 50, msrp: 488, cores: 8, threads: 16 },
  { name: 'Core i5-10600K', maker: 'Intel', year: 2020, score: 49, msrp: 262, cores: 6, threads: 12 },
  { name: 'Core i7-9700K', maker: 'Intel', year: 2018, score: 47, msrp: 374, cores: 8, threads: 8 },
  { name: 'Ryzen 7 3700X', maker: 'AMD', year: 2019, score: 46, msrp: 329, cores: 8, threads: 16 },
  { name: 'Core i5-10400F', maker: 'Intel', year: 2020, score: 45, msrp: 155, cores: 6, threads: 12 },
  { name: 'Ryzen 5 3600', maker: 'AMD', year: 2019, score: 44, msrp: 199, cores: 6, threads: 12 },
  { name: 'Core i7-8700K', maker: 'Intel', year: 2017, score: 44, msrp: 359, cores: 6, threads: 12 },
  { name: 'Ryzen 5 2600', maker: 'AMD', year: 2018, score: 36, msrp: 199, cores: 6, threads: 12 },
  { name: 'Core i5-9400F', maker: 'Intel', year: 2019, score: 38, msrp: 182, cores: 6, threads: 6 },
  { name: 'Ryzen 5 1600', maker: 'AMD', year: 2017, score: 32, msrp: 219, cores: 6, threads: 12 },
  { name: 'Core i7-7700K', maker: 'Intel', year: 2017, score: 36, msrp: 339, cores: 4, threads: 8 },
];

export const BENCH_NOTE =
  'Approximate gaming performance, rounded from public review averages (not our own tests). GPUs at 1440p, RTX 4090 = 100. CPUs in games with a very fast graphics card, Ryzen 7 9800X3D = 100. Real results depend on the game, settings and the rest of the PC.';

export type Kind = 'gpu' | 'cpu';
export const benchList = (k: Kind) => (k === 'gpu' ? GPUS : CPUS);
const norm = (s: string) => s.toLowerCase().replace(/^(nvidia |amd |intel )/, '').replace(/^(geforce |radeon )/, '').replace(/[^a-z0-9]+/g, '');
export const findBench = (k: Kind, name: string) => benchList(k).find((b) => norm(b.name) === norm(name));

// ---- Bottleneck -------------------------------------------------------------
export type Res = '1080p' | '1440p' | '4K';
/** Average fps an RTX 4090 would reach if nothing else held it back (typical modern games, high settings). */
const GPU_FPS_4090: Record<Res, number> = { '1080p': 215, '1440p': 160, '4K': 95 };
/** Average fps a Ryzen 7 9800X3D can feed in the same games, at any resolution. */
const CPU_FPS_TOP = 230;

export interface Bottleneck {
  gpuFps: number;
  cpuFps: number;
  fps: number;
  limit: 'cpu' | 'gpu' | 'balanced';
  /** how much performance the slower part costs, 0-100 */
  loss: number;
  text: string;
}

export function bottleneck(cpu: BenchItem, gpu: BenchItem, res: Res): Bottleneck {
  const gpuFps = Math.round((gpu.score / 100) * GPU_FPS_4090[res]);
  const cpuFps = Math.round((cpu.score / 100) * CPU_FPS_TOP);
  const fps = Math.min(gpuFps, cpuFps);
  const ratio = cpuFps / gpuFps;
  if (ratio < 0.9) {
    const loss = Math.round((1 - ratio) * 100);
    return {
      gpuFps, cpuFps, fps, limit: 'cpu', loss,
      text: `The CPU holds the graphics card back at ${res}: the ${gpu.name} could do about ${gpuFps} fps, but the ${cpu.name} can only prepare about ${cpuFps}. ${loss >= 25 ? 'A faster CPU would help a lot' : 'A faster CPU would help a little'}, or play at a higher resolution or settings.`,
    };
  }
  if (ratio > 1.6) {
    return {
      gpuFps, cpuFps, fps, limit: 'gpu', loss: 0,
      text: `The graphics card sets the limit at ${res} (about ${gpuFps} fps), which is normal. The CPU has plenty left over: a faster graphics card would still run at full speed with it.`,
    };
  }
  return {
    gpuFps, cpuFps, fps, limit: 'balanced', loss: 0,
    text: `A well-balanced pair at ${res}: both parts are used well, at about ${fps} fps on average.`,
  };
}

// ---- Value: price per performance ------------------------------------------------
/** USD per performance point of current new parts, from the latest recorded prices (or launch prices). */
export function marketRate(k: Kind, priceOf: (b: BenchItem) => number | undefined): number {
  const now = new Date().getFullYear();
  const rates = benchList(k)
    .filter((b) => b.year >= now - 2)
    .map((b) => {
      const p = priceOf(b) ?? b.msrp;
      return p ? p / b.score : undefined;
    })
    .filter((x): x is number => !!x)
    .sort((a, b) => a - b);
  if (!rates.length) return k === 'gpu' ? 9 : 4;
  // the better-value half of the market: what a smart buyer pays per point today
  return rates[Math.floor(rates.length / 3)];
}

/** Fair second-hand price range in USD: what the same performance costs new, minus the used discount.
 *  `newPrice` is what the part itself costs new today, if it is still sold. */
export function usedRange(b: BenchItem, rate: number, newPrice?: number): { low: number; high: number; mid: number; note: string } {
  const age = Math.max(0, new Date().getFullYear() - b.year);
  // Used parts sell for less: no warranty, wear, older features (and for GPUs, less VRAM and no newest upscaling).
  let factor = 0.72 - Math.max(0, age - 3) * 0.04;
  if (b.vram !== undefined && b.vram < 8) factor -= 0.08;
  factor = Math.max(0.4, factor);
  let mid = b.score * rate * factor;
  // Parts still on sale (flagships especially) hold their value close to the new price.
  const ref = age <= 2 ? newPrice ?? b.msrp : undefined;
  if (ref) mid = Math.max(mid, ref * 0.75);
  if (b.msrp) mid = Math.min(mid, Math.max(b.msrp, newPrice ?? 0) * 0.85);
  const notes: string[] = [];
  if (age >= 5) notes.push(`${age} years old`);
  if (b.vram !== undefined && b.vram < 8) notes.push(`only ${b.vram} GB of video memory`);
  return { low: Math.round(mid * 0.85), high: Math.round(mid * 1.15), mid: Math.round(mid), note: notes.join(', ') };
}
