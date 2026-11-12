// Koliko iger (deljenj) je bilo odigranih v enem večeru.
// - vpis "Igral" ali "Berač" = ena igra (klicani spada k isti igri in se ne šteje posebej)
// - "Klop za vse" zapiše vse igralce naenkrat = ena igra
// - kazen in kazni za radelce ob koncu se ne štejejo
// Pri igrah pred 3. 11. 2026 klopi še niso bili označeni, zato je tam štetje lahko kakšno igro prenizko.
type E = { played?: boolean | null; is_beggar?: boolean | null; is_klop?: boolean | null; created_at: string };

export function countDeals(entries: E[]): number {
  const played = entries.filter(e => e.played || e.is_beggar).length;
  const klop = entries.filter(e => e.is_klop && !e.played && !e.is_beggar)
    .map(e => new Date(e.created_at).getTime()).sort((a, b) => a - b);
  let groups = 0, last = -Infinity;
  klop.forEach(t => { if (t - last > 60000) groups++; last = t; });
  return played + groups;
}

// "odigrana 1 igra", "odigrani 2 igri", "odigrane 3 igre", "odigranih 5 iger"
export function dealsLabel(n: number): string {
  const m = n % 100;
  if (m === 1) return `odigrana ${n} igra`;
  if (m === 2) return `odigrani ${n} igri`;
  if (m === 3 || m === 4) return `odigrane ${n} igre`;
  return `odigranih ${n} iger`;
}
