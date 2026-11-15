// "Klik skozi": ko gumb zapre okno že ob dvigu prsta, brskalnik takoj zatem pošlje še
// svoj običajni klik na isto mesto. Okna takrat ni več, zato bi klik zadel tisto, kar je
// bilo pod gumbom (drug profil, obvestilo, slika večera ...). Ta funkcija tisti en klik
// prestreže in zavrže. Velja le kratek čas, nato se sama odstrani.
export function swallowNextClick(ms = 500) {
  if (typeof document === 'undefined') return;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); done(); };
  const done = () => {
    document.removeEventListener('click', stop, true);
    if (timer) clearTimeout(timer);
  };
  document.addEventListener('click', stop, true);
  timer = setTimeout(done, ms);
}
