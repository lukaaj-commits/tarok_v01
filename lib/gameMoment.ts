// =====================================================================
// MOMENT VEČERA - en umirjen stavek o tem, kaj je zaznamovalo igro.
// Iz vpisov poiščemo več možnih zgodb in izberemo najmočnejšo.
// =====================================================================
import { g } from '@/lib/gender';

type P = { id: string; name: string; total_score: number };
type E = {
  points: number; created_at: string; played: boolean; player_id?: string;
  is_partner?: boolean; is_beggar?: boolean; is_valat?: boolean; is_penalty?: boolean;
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });

// sklanjanje po zadnjih dveh števkah (1, 2, 3–4, ostalo)
const form = (n: number, f1: string, f2: string, f34: string, f5: string) => {
  const r = Math.abs(n) % 100;
  return r === 1 ? f1 : r === 2 ? f2 : r === 3 || r === 4 ? f34 : f5;
};
const tockAcc = (n: number) => `${n} ${form(n, 'točko', 'točki', 'točke', 'točk')}`;
const tockNom = (n: number) => `${n} ${form(n, 'točka', 'točki', 'točke', 'točk')}`;
const minus = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `${n}`);

// trajanje v tožilniku: "26 minut", "uro in 13 minut", "dve uri"
const dur = (ms: number) => {
  const all = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(all / 60), m = all % 60;
  const hs = h === 0 ? '' : h === 1 ? 'uro' : h === 2 ? 'dve uri' : `${h} ${form(h, 'uro', 'uri', 'ure', 'ur')}`;
  const ms_ = m === 0 ? '' : `${m} ${form(m, 'minuto', 'minuti', 'minute', 'minut')}`;
  return [hs, ms_].filter(Boolean).join(' in ');
};

const WORDS: Record<number, string> = { 4: 'štiri igre', 5: 'pet iger', 6: 'šest iger', 7: 'sedem iger', 8: 'osem iger', 9: 'devet iger', 10: 'deset iger' };
const iger = (n: number) => WORDS[n] || `${n} ${form(n, 'igro', 'igri', 'igre', 'iger')}`;

export function gameMoment(players: P[], entries: E[]): string | null {
  if (players.length < 2 || !entries.length) return null;
  const ids = new Set(players.map(p => p.id));
  const list = entries.filter(e => e.player_id && ids.has(e.player_id));
  if (!list.length) return null;

  const nameOf = new Map(players.map(p => [p.id, p.name]));
  const ranked = [...players].sort((a, b) => b.total_score - a.total_score);
  const max = ranked[0].total_score;
  const winners = players.filter(p => p.total_score === max);
  const W = winners.length === 1 ? winners[0] : null;
  const place = (p: P) => 1 + players.filter(o => o.total_score > p.total_score).length;

  const run: Record<string, number> = {};
  players.forEach(p => { run[p.id] = 0; });
  const leaders: (string | null)[] = [];
  const low: Record<string, { v: number; at: string }> = {};
  let deficit = { v: 0, at: '', last: false };
  const streak: Record<string, { n: number; from: string }> = {};
  let bestStreak = { id: '', n: 0, from: '', to: '' };

  list.forEach(e => {
    const id = e.player_id!;
    run[id] += Number(e.points);
    const vals = players.map(p => run[p.id]);
    const top = Math.max(...vals);
    const atTop = players.filter(p => run[p.id] === top);
    leaders.push(atTop.length === 1 ? atTop[0].id : null);

    if (!low[id] || run[id] < low[id].v) low[id] = { v: run[id], at: e.created_at };

    if (W) {
      const d = top - run[W.id];
      if (d > deficit.v) deficit = { v: d, at: e.created_at, last: run[W.id] < Math.min(...players.filter(p => p.id !== W.id).map(p => run[p.id])) };
    }

    // niz dobljenih iger (samo igre, ki jih je igralec igral sam ali kot berač)
    if (!e.is_penalty && (e.played || e.is_beggar)) {
      const s = streak[id] || { n: 0, from: '' };
      if (Number(e.points) > 0) {
        if (s.n === 0) s.from = e.created_at;
        s.n++;
        if (s.n > bestStreak.n) bestStreak = { id, n: s.n, from: s.from, to: e.created_at };
      } else s.n = 0;
      streak[id] = s;
    }
  });

  // čas vodstva
  const t = list.map(e => new Date(e.created_at).getTime());
  const total = t[t.length - 1] - t[0];
  const held: Record<string, number> = {};
  for (let i = 0; i < list.length - 1; i++) {
    const l = leaders[i];
    if (l) held[l] = (held[l] || 0) + (t[i + 1] - t[i]);
  }

  // kdaj je zmagovalec zadnjič prevzel vodstvo
  let k = -1;
  if (W && leaders[leaders.length - 1] === W.id) {
    k = leaders.length - 1;
    while (k > 0 && leaders[k - 1] === W.id) k--;
  }

  const cand: { s: number; text: string }[] = [];

  if (W) {
    const n = W.name;
    // velik zaostanek, na koncu zmaga
    if (deficit.v >= 100) {
      cand.push({
        s: (deficit.v >= 200 ? deficit.v : deficit.v / 3) + (deficit.last ? 100 : 0),
        text: `${n} je ob ${time(deficit.at)} ${g(n, 'zaostajal', 'zaostajala')} ${tockAcc(deficit.v)}${deficit.last ? ` in ${g(n, 'bil zadnji', 'bila zadnja')}` : ''}, na koncu pa je ${g(n, 'zmagal', 'zmagala')}.`,
      });
    }
    // odločilni vpis
    if (k > 0) {
      const e = list[k];
      if (e.player_id === W.id && !e.is_penalty && Number(e.points) >= 100) {
        const kind = e.is_valat ? ' z valatom' : e.is_beggar ? ' z beračem' : '';
        cand.push({
          s: Number(e.points) >= 150 ? 120 + Number(e.points) / 5 : 60,
          text: `${n} je ob ${time(e.created_at)}${kind} ${g(n, 'vpisal', 'vpisala')} +${e.points} in do konca ${g(n, 'ostal', 'ostala')} na vrhu.`,
        });
      }
    }
    // vodil skoraj ves večer
    if (total > 0) {
      const share = (held[W.id] || 0) / total;
      if (share > 0.85) {
        const off = total - (held[W.id] || 0);
        const text = off < 60000
          ? `${n} je ${g(n, 'bil', 'bila')} v vodstvu od prve igre do zadnje.`
          : `${n} je ${g(n, 'vodil', 'vodila')} skoraj ves večer. Na vrhu ni ${g(n, 'bil', 'bila')} le ${dur(off)}.`;
        cand.push({ s: off < 60000 ? 140 : 110, text });
      }
    }
    // tesen izid: kako se je odločilo
    const second = ranked[1];
    const margin = max - second.total_score;
    if (margin > 0 && margin <= 20 && k >= 0 && second.total_score !== ranked[2]?.total_score) {
      const s2 = second.name;
      const lastT = t[t.length - 1];
      const lastRound = list.map((e, i) => i).filter(i => t[i] >= lastT - 60000);
      const firstOfLast = lastRound[0];
      // razlika pred zadnjo igro in največja prednost po prevzemu vodstva
      const tot: Record<string, number> = {};
      players.forEach(p => { tot[p.id] = 0; });
      let before = 0, maxLead = 0;
      list.forEach((e, i) => {
        if (i === firstOfLast) before = tot[W.id] - tot[second.id];
        tot[e.player_id!] += Number(e.points);
        if (i >= k) maxLead = Math.max(maxLead, tot[W.id] - tot[second.id]);
      });
      let text: string;
      if (k >= firstOfLast) {
        text = `${n} je vodstvo ${g(n, 'prevzel', 'prevzela')} šele v zadnji igri, ob ${time(list[k].created_at)}, in ${g(n, 'zmagal', 'zmagala')} za ${tockAcc(margin)}.`;
      } else if (before > margin) {
        text = `${n} je vodstvo ${g(n, 'prevzel', 'prevzela')} ob ${time(list[k].created_at)} in ga ${g(n, 'obdržal', 'obdržala')} do konca. ${s2} se je v zadnji igri ${g(s2, 'približal', 'približala')} na ${tockAcc(margin)}.`;
      } else if (maxLead >= margin * 3) {
        text = `${n} je vodstvo ${g(n, 'prevzel', 'prevzela')} ob ${time(list[k].created_at)}. Prednost je zrasla do ${maxLead} točk, na koncu pa je ostalo le še ${margin}.`;
      } else {
        text = `${n} je vodstvo ${g(n, 'prevzel', 'prevzela')} ob ${time(list[k].created_at)} in ga ${g(n, 'obdržal', 'obdržala')} do konca, a nikoli z več kot ${tockAcc(maxLead)} prednosti.`;
      }
      cand.push({ s: 170, text });
    }
    // dolgo vodil, pa ni zmagal
    if (total > 0 && k >= 0) {
      const top = players
        .filter(p => p.id !== W.id)
        .map(p => ({ p, h: held[p.id] || 0 }))
        .sort((a, b) => b.h - a.h)[0];
      if (top && top.h / total > 0.4 && top.h >= 45 * 60000) {
        const longest = Object.entries(held).every(([id, h]) => id === top.p.id || h < top.h);
        const pn = top.p.name;
        cand.push({
          s: 150 + place(top.p) * 20,
          text: `${pn} je ${g(pn, 'vodil', 'vodila')} ${dur(top.h)}${longest ? ', dlje kot kdorkoli drug' : ''}, ${g(pn, 'končal', 'končala')} pa je na ${place(top.p)}. mestu. ${n} je vodstvo ${g(n, 'prevzel', 'prevzela')} šele ob ${time(list[k].created_at)}.`,
        });
      }
    }
  }

  // niz zmag
  if (bestStreak.n >= 4) {
    const pn = nameOf.get(bestStreak.id) || '';
    cand.push({
      s: bestStreak.n >= 5 ? 90 + bestStreak.n * 10 : 70,
      text: `${pn} je med ${time(bestStreak.from)} in ${time(bestStreak.to)} ${g(pn, 'dobil', 'dobila')} ${iger(bestStreak.n)} zapored.`,
    });
  }

  // globok padec in vrnitev
  players.forEach(p => {
    const l = low[p.id];
    if (!l) return;
    const gain = run[p.id] - l.v;
    if (l.v <= -150 && gain >= 200) {
      cand.push({
        s: 100 + gain / 10,
        text: `${p.name} je ob ${time(l.at)} ${g(p.name, 'padel', 'padla')} na ${minus(l.v)} točk, do konca pa je ${g(p.name, 'nabral', 'nabrala')} še ${tockAcc(gain)}.`,
      });
    }
  });

  if (!cand.length) return null;
  cand.sort((a, b) => b.s - a.s);
  return cand[0].text;
}
