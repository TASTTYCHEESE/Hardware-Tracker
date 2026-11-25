// Fair second-hand prices for parts without a performance score: RAM, SSDs, motherboards,
// power supplies and cases. Each entry has what it costs new today (USD, before tax, November 2026,
// rounded from US shop prices in our recaps and Black Friday trackers), and the used value is a
// share of that, lower for older or riskier parts. Where the weekly price list tracks the same
// part (`tracked`), the latest recorded price replaces the built-in one.

export type UsedKind = 'ram' | 'ssd' | 'board' | 'psu' | 'case';

export interface UsedPart {
  name: string;
  group: string;
  /** typical new price today, USD before tax */
  newUsd: number;
  /** share of the new price a used one is worth */
  factor: number;
  /** model name in the price list, to use the latest recorded price */
  tracked?: string;
  note?: string;
}

const ram = (name: string, newUsd: number, tracked?: string, ddr4 = false): UsedPart => ({
  name,
  group: ddr4 ? 'DDR4' : name.includes('SO-DIMM') ? 'Laptop (SO-DIMM)' : 'DDR5',
  newUsd,
  factor: ddr4 ? 0.65 : 0.75,
  tracked: tracked ?? name,
});

export const USED_PARTS: Record<UsedKind, UsedPart[]> = {
  // Memory rarely wears out, and the shortage keeps used kits in demand: they hold their value well.
  ram: [
    ram('DDR5-6000 2x16GB', 440, 'DDR5-6000 2x16GB (cheapest)'),
    ram('DDR5-6000 2x16GB CL30', 480),
    ram('DDR5-6400 2x16GB', 470),
    ram('DDR5-5600 2x16GB', 410),
    ram('DDR5-6000 2x32GB', 1360, 'DDR5 2x32GB (cheapest)'),
    ram('DDR5-5600 2x32GB', 1250),
    ram('DDR5-6000 2x48GB', 1900),
    ram('DDR5-8000 2x24GB', 950),
    ram('DDR5-5600 SO-DIMM 2x16GB', 400),
    ram('DDR5-5600 SO-DIMM 2x32GB', 1200),
    ram('DDR4-3600 2x16GB CL18', 240, undefined, true),
    ram('DDR4-3200 2x16GB', 220, undefined, true),
    ram('DDR4-3200 2x32GB', 430, undefined, true),
    ram('DDR4-3200 2x8GB', 120, undefined, true),
  ],
  // SSDs wear with writes: ask for a health screenshot (CrystalDiskInfo) before buying.
  ssd: [
    { name: 'NVMe PCIe 5.0, 2 TB', group: 'NVMe Gen 5', newUsd: 350, factor: 0.6 },
    { name: 'NVMe PCIe 5.0, 1 TB', group: 'NVMe Gen 5', newUsd: 200, factor: 0.6 },
    { name: 'NVMe PCIe 4.0, 4 TB', group: 'NVMe Gen 4', newUsd: 430, factor: 0.55 },
    { name: 'NVMe PCIe 4.0, 2 TB', group: 'NVMe Gen 4', newUsd: 240, factor: 0.55 },
    { name: 'NVMe PCIe 4.0, 1 TB', group: 'NVMe Gen 4', newUsd: 130, factor: 0.55 },
    { name: 'NVMe PCIe 4.0, 500 GB', group: 'NVMe Gen 4', newUsd: 80, factor: 0.5 },
    { name: 'NVMe PCIe 3.0, 2 TB', group: 'NVMe Gen 3', newUsd: 190, factor: 0.5 },
    { name: 'NVMe PCIe 3.0, 1 TB', group: 'NVMe Gen 3', newUsd: 100, factor: 0.5 },
    { name: 'SATA SSD, 2 TB', group: 'SATA', newUsd: 180, factor: 0.5 },
    { name: 'SATA SSD, 1 TB', group: 'SATA', newUsd: 100, factor: 0.5 },
    { name: 'SATA SSD, 500 GB', group: 'SATA', newUsd: 60, factor: 0.45 },
  ],
  // Boards for current platforms keep more value; older sockets only matter to people upgrading an old PC.
  board: [
    { name: 'AM5 X870E', group: 'AMD AM5 (Ryzen 7000-9000)', newUsd: 330, factor: 0.6 },
    { name: 'AM5 X870', group: 'AMD AM5 (Ryzen 7000-9000)', newUsd: 230, factor: 0.6 },
    { name: 'AM5 B850', group: 'AMD AM5 (Ryzen 7000-9000)', newUsd: 170, factor: 0.6 },
    { name: 'AM5 B650', group: 'AMD AM5 (Ryzen 7000-9000)', newUsd: 150, factor: 0.6 },
    { name: 'AM5 A620', group: 'AMD AM5 (Ryzen 7000-9000)', newUsd: 100, factor: 0.55 },
    { name: 'AM4 X570', group: 'AMD AM4 (Ryzen 1000-5000)', newUsd: 160, factor: 0.5 },
    { name: 'AM4 B550', group: 'AMD AM4 (Ryzen 1000-5000)', newUsd: 120, factor: 0.5 },
    { name: 'AM4 A520', group: 'AMD AM4 (Ryzen 1000-5000)', newUsd: 80, factor: 0.45 },
    { name: 'LGA 1851 Z890', group: 'Intel LGA 1851 (Core Ultra 200)', newUsd: 260, factor: 0.55 },
    { name: 'LGA 1851 B860', group: 'Intel LGA 1851 (Core Ultra 200)', newUsd: 160, factor: 0.55 },
    { name: 'LGA 1700 Z790', group: 'Intel LGA 1700 (12th-14th gen)', newUsd: 200, factor: 0.5 },
    { name: 'LGA 1700 B760', group: 'Intel LGA 1700 (12th-14th gen)', newUsd: 130, factor: 0.5 },
    { name: 'LGA 1700 Z690', group: 'Intel LGA 1700 (12th-14th gen)', newUsd: 170, factor: 0.45 },
    { name: 'LGA 1700 B660', group: 'Intel LGA 1700 (12th-14th gen)', newUsd: 110, factor: 0.45 },
    { name: 'LGA 1200 Z590 / B560', group: 'Intel LGA 1200 (10th-11th gen)', newUsd: 110, factor: 0.4 },
  ],
  // Power supplies age: avoid used units older than about 5 years, and check the remaining warranty.
  psu: [
    { name: '550 W, 80+ Bronze', group: 'Budget', newUsd: 55, factor: 0.45 },
    { name: '650 W, 80+ Bronze', group: 'Budget', newUsd: 65, factor: 0.45 },
    { name: '650 W, 80+ Gold', group: 'Mainstream', newUsd: 85, factor: 0.5 },
    { name: '750 W, 80+ Gold', group: 'Mainstream', newUsd: 100, factor: 0.5 },
    { name: '850 W, 80+ Gold (ATX 3.1)', group: 'Mainstream', newUsd: 120, factor: 0.55 },
    { name: '1000 W, 80+ Gold (ATX 3.1)', group: 'High-end', newUsd: 170, factor: 0.55 },
    { name: '1000 W, 80+ Platinum', group: 'High-end', newUsd: 230, factor: 0.55 },
    { name: '1200 W, 80+ Gold (ATX 3.1)', group: 'High-end', newUsd: 260, factor: 0.55 },
    { name: '1600 W, 80+ Platinum', group: 'High-end', newUsd: 450, factor: 0.5 },
  ],
  // Cases don't wear out, but they're bulky to ship: used ones sell cheap, mostly for local pickup.
  case: [
    { name: 'Budget mid-tower (glass side, 2-3 fans)', group: 'Mid-tower', newUsd: 60, factor: 0.45 },
    { name: 'Airflow mid-tower (e.g. Lancool 216, North)', group: 'Mid-tower', newUsd: 100, factor: 0.5 },
    { name: 'Premium mid-tower (e.g. O11 Dynamic EVO, H7 Flow)', group: 'Mid-tower', newUsd: 160, factor: 0.5 },
    { name: 'Full tower', group: 'Large', newUsd: 200, factor: 0.45 },
    { name: 'Micro-ATX case', group: 'Small', newUsd: 70, factor: 0.45 },
    { name: 'Mini-ITX small form factor', group: 'Small', newUsd: 130, factor: 0.5 },
  ],
};

export const USED_TIPS: Record<UsedKind, string> = {
  ram: 'Memory rarely wears out, and the shortage keeps used kits in demand, so they hold their value. Make sure both sticks are the same kit, and test it (MemTest86 or the BIOS memory test) when you can.',
  ssd: "SSDs wear out with writes. Ask for a screenshot of the drive's health (CrystalDiskInfo): above 90% health and well under the rated TBW is fine.",
  board: 'Check that the socket and chipset match your CPU, that the BIOS supports it, and that the box comes with the I/O shield, Wi-Fi antennas and no bent CPU-socket pins.',
  psu: 'Power supplies age with use. Avoid ones older than about 5 years, buy known brands only, and check whether the warranty is still running and transfers to you.',
  case: "Cases don't wear out, but shipping is expensive, so most used cases sell for local pickup. Check for broken glass, missing screws and front-panel ports that work.",
};

/** Fair used range in USD. `latest` is the latest recorded new price, when the part is tracked. */
export function usedPartRange(p: UsedPart, latest?: number): { low: number; high: number; mid: number; newUsd: number } {
  const newUsd = latest ?? p.newUsd;
  const mid = newUsd * p.factor;
  return { low: Math.round(mid * 0.85), high: Math.round(mid * 1.15), mid: Math.round(mid), newUsd };
}
