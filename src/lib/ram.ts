// Memory kits are compared by their specs, not their brand: "DDR5-6000 2x16GB CL30" etc.

export interface RamSpec {
  type: string; // DDR4 / DDR5
  speed?: number; // MT/s
  sticks?: number;
  perStick?: number; // GB
  total?: number; // GB
  cl?: number;
  form: 'Desktop (DIMM)' | 'Laptop (SO-DIMM)';
  cheapest: boolean;
}

export function parseRam(model: string): RamSpec | null {
  const t = model.match(/\b(DDR\d)\b/i);
  if (!t) return null;
  const speed = model.match(/DDR\d-?(\d{4})/i) ?? model.match(/(\d{4})\s*MT\/s/i);
  const kit = model.match(/(\d+)\s*x\s*(\d+)\s*GB/i);
  const single = !kit && model.match(/(\d+)\s*GB/i);
  const cl = model.match(/\bCL\s?(\d+)/i);
  const sticks = kit ? Number(kit[1]) : single ? 1 : undefined;
  const perStick = kit ? Number(kit[2]) : single ? Number(single[1]) : undefined;
  return {
    type: t[1].toUpperCase(),
    speed: speed ? Number(speed[1]) : undefined,
    sticks,
    perStick,
    total: sticks && perStick ? sticks * perStick : undefined,
    cl: cl ? Number(cl[1]) : undefined,
    form: /SO-?DIMM|laptop/i.test(model) ? 'Laptop (SO-DIMM)' : 'Desktop (DIMM)',
    cheapest: /cheapest/i.test(model),
  };
}

/** Main line and detail line for showing a memory kit. */
export function ramLabel(r: RamSpec): { main: string; sub: string } {
  const main = [r.type, r.speed ? `${r.speed} MT/s` : 'any speed'].join(' · ');
  const sub = [
    r.total ? `${r.sticks} × ${r.perStick} GB = ${r.total} GB` : '',
    r.cl ? `CL${r.cl}` : '',
    r.form,
    r.cheapest ? 'cheapest kit' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return { main, sub };
}

export const RAM_SPEEDS: Record<string, number[]> = {
  DDR5: [4800, 5200, 5600, 6000, 6400, 6800, 7200, 8000],
  DDR4: [2400, 2666, 3000, 3200, 3600, 4000],
};
export const RAM_KITS = ['1x8', '1x16', '1x32', '2x8', '2x16', '2x24', '2x32', '2x48', '2x64', '4x16', '4x32'];
