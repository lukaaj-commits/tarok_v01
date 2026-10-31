// =====================================================================
// SLIKA VEČERA - izbira, zmanjšanje (pod 500 kB) in nalaganje slike igre
// Deluje v brskalniku (Netlify). Slika se shrani v Supabase Storage
// (mapa "slike-vecera"), pri igri pa samo povezava (games.photo_url).
// =====================================================================
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const BUCKET = 'slike-vecera';
const MAX_BYTES = 500 * 1024;   // največja velikost po stiskanju
const MAX_SIDE = 1600;          // največja dolžina daljše stranice (pik)

export const photoSupported = () => Platform.OS === 'web' && typeof document !== 'undefined';

// Odpre kamero ('camera') ali izbiro slike iz galerije ('gallery').
// iPhone (Safari): polje za izbiro datoteke mora biti v strani, sicer se izbira slike
// ne javi aplikaciji (slika se ne naloži). Zato ga dodamo skrito in po izbiri odstranimo.
export function pickImage(source: 'camera' | 'gallery' = 'gallery'): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.setAttribute('capture', 'environment'); // zadnja kamera telefona
    // skrito, a v strani; velikost pisave 16px prepreči samodejno povečavo strani na iPhonu
    input.style.cssText = 'position:fixed;left:-1000px;top:0;width:1px;height:1px;opacity:0;font-size:16px;';
    document.body.appendChild(input);
    let done = false;
    const finish = (file: File | null) => {
      if (done) return;
      done = true;
      setTimeout(() => input.remove(), 0);
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files && input.files[0] ? input.files[0] : null));
    input.addEventListener('cancel', () => finish(null)); // uporabnik je okno zaprl brez izbire
    input.click();
  });
}

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Slike ni bilo mogoče odpreti.')); };
    img.src = url;
  });

const toJpeg = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Stiskanje ni uspelo.'))), 'image/jpeg', quality));

// Zmanjša in stisne sliko, dokler ni manjša od 500 kB
export async function compressImage(file: File): Promise<Blob> {
  const img = await loadImage(file); // brskalnik sam upošteva obrat slike s telefona
  let side = MAX_SIDE;
  let quality = 0.82;
  for (let attempt = 0; attempt < 8; attempt++) {
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await toJpeg(canvas, quality);
    if (blob.size <= MAX_BYTES) return blob;
    // še prevelika: najprej znižaj kakovost, nato velikost
    if (quality > 0.6) quality -= 0.1; else side = Math.round(side * 0.8);
  }
  throw new Error('Slike ni bilo mogoče dovolj zmanjšati.');
}

// Naloži sliko igre (stara se prepiše) in shrani povezavo pri igri
export async function uploadGamePhoto(gameId: string, blob: Blob): Promise<string> {
  const path = `${gameId}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`; // nova različica, da telefon ne kaže stare slike
  const { error: updErr } = await supabase.from('games').update({ photo_url: url }).eq('id', gameId);
  if (updErr) throw updErr;
  return url;
}

// =====================================================================
// PROFILNA SLIKA - kvadrat iz sredine, 512 x 512, shrani v isto shrambo (mapa "profili")
// =====================================================================
const PROFILE_SIDE = 512;

// ime -> varno ime datoteke (šumniki, presledki)
const fileKey = (name: string) => Array.from(new TextEncoder().encode(name.trim())).map(b => b.toString(16).padStart(2, '0')).join('');

export async function cropSquare(file: File | Blob): Promise<Blob> {
  const img = await loadImage(file as File);
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(PROFILE_SIDE, s);
  canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
  return toJpeg(canvas, 0.85);
}

export async function uploadProfilePhoto(name: string, blob: Blob): Promise<string> {
  const path = `profili/${fileKey(name)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;
  const { error: e2 } = await supabase.from('profilne_slike').upsert({ ime: name.trim(), url, posodobljeno: new Date().toISOString() });
  if (e2) throw e2;
  return url;
}

// vrne prejšnjo sliko (odstrani povezavo in datoteko)
export async function removeProfilePhoto(name: string) {
  const { error } = await supabase.from('profilne_slike').delete().eq('ime', name.trim());
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([`profili/${fileKey(name)}.jpg`]).catch(() => {});
}

// ob brisanju igre: odstrani še njeno sliko večera iz shrambe (če je ni, se ne zgodi nič)
export async function removeGamePhoto(gameId: string) {
  try { await supabase.storage.from(BUCKET).remove([`${gameId}.jpg`]); } catch {}
}
