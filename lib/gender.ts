// =====================================================================
// SPOL IGRALCEV - za pravilna besedila ("je zmagal" / "je zmagala")
// Spol je shranjen v bazi (player_profiles.gender: 'M' ali 'Z').
// =====================================================================
import { supabase } from '@/lib/supabase';

const genders = new Map<string, 'M' | 'Z'>();
let loading: Promise<void> | null = null;

// Naloži spol vseh igralcev (enkrat; force = ponovno, npr. po novem igralcu)
export function loadGenders(force = false): Promise<void> {
  if (loading && !force) return loading;
  loading = (async () => {
    const { data, error } = await supabase.from('player_profiles').select('name, gender');
    if (error) return;
    genders.clear();
    (data || []).forEach((p: any) => { if (p.gender === 'M' || p.gender === 'Z') genders.set(String(p.name).trim(), p.gender); });
  })();
  return loading;
}

export const isFemale = (name?: string | null) => !!name && genders.get(name.trim()) === 'Z';

// g('Tina', 'zmagal', 'zmagala') -> 'zmagala'
export const g = (name: string | null | undefined, male: string, female: string) => (isFemale(name) ? female : male);
