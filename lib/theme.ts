// Skupne barve in stili novega dizajna (temni, Apple-podoben).
// Vsi zasloni naj barve jemljejo od tu, da je videz povsod enak.

export const T = {
  bg: '#000000',
  accent: '#0A84FF',      // modra: gumbi, izbrano, poudarek
  accentSoft: '#64D2FF',  // svetlo modra: radelci, ikone, nazivi
  success: '#30D158',     // plus točke
  danger: '#FF453A',      // minus točke, brisanje
  gold: '#FFD60A',
  silver: '#D1D1D6',
  bronze: '#FF9F0A',
  orange: '#FF9F0A',      // drugi igralec pri dvoboju
  text: '#FFFFFF',
  textSoft: '#EBEBF5',
  muted: '#8E8E93',
  muted2: '#636366',
  separator: 'rgba(255,255,255,0.10)',
  tabBar: 'rgba(22,22,24,0.94)',
  tabBorder: '#38383A',
};

// rahel moder odtenek (za kartico zmagovalca, igralca meseca ...)
export const ACCENT_TINT = 'rgba(10,132,255,0.15)';

// steklena kartica
export const glass = {
  backgroundColor: 'rgba(255,255,255,0.09)',
  borderWidth: 0.5,
  borderColor: 'rgba(255,255,255,0.10)',
  borderTopColor: 'rgba(255,255,255,0.22)',
  borderRadius: 16,
} as const;

// vdolbeno polje (točke, iskanje, statistike)
export const inset = {
  backgroundColor: 'rgba(0,0,0,0.28)',
  borderWidth: 0.5,
  borderColor: 'rgba(255,255,255,0.06)',
  borderRadius: 16,
} as const;

// modro steklo za okna (od zgoraj navzdol)
export const SHEET_GRADIENT = ['rgba(26,36,58,0.97)', 'rgba(14,18,30,0.98)', 'rgba(10,12,20,0.99)'] as const;
export const sheetBorder = {
  borderWidth: 0.5,
  borderColor: 'rgba(100,170,255,0.14)',
  borderTopColor: 'rgba(120,190,255,0.40)',
} as const;
