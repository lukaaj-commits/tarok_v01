// Pisava Poppins za spletno različico (Netlify / Chrome na telefonu).
// Naloži se enkrat ob zagonu; brez interneta ostane sistemska pisava.
import { Platform } from 'react-native';

let done = false;

export function loadWebFont() {
  if (done || Platform.OS !== 'web' || typeof document === 'undefined') return;
  done = true;

  const pre1 = document.createElement('link');
  pre1.rel = 'preconnect';
  pre1.href = 'https://fonts.googleapis.com';
  const pre2 = document.createElement('link');
  pre2.rel = 'preconnect';
  pre2.href = 'https://fonts.gstatic.com';
  pre2.crossOrigin = 'anonymous';
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';

  const style = document.createElement('style');
  style.setAttribute('data-tarok', 'font');
  style.textContent = `
    html, body { background-color: #000000; overscroll-behavior-y: contain; } /* brez osvežitve cele strani ob potegu; osvežimo samo seznam */
    div, span, input, textarea, button { font-family: 'Poppins', -apple-system, system-ui, sans-serif !important; }
    div:focus, div:focus-visible { outline: none; }
  `;

  document.head.appendChild(pre1);
  document.head.appendChild(pre2);
  document.head.appendChild(link);
  document.head.appendChild(style);

  // Jezik strani (da brskalnik ne ponuja prevoda iz angleščine), ime in ikona za domači zaslon telefona
  document.documentElement.lang = 'sl';
  const addMeta = (name: string, content: string) => {
    if (document.querySelector(`meta[name="${name}"]`)) return;
    const m = document.createElement('meta');
    m.name = name; m.content = content;
    document.head.appendChild(m);
  };
  addMeta('theme-color', '#000000');
  addMeta('apple-mobile-web-app-title', 'Tarok');
  addMeta('application-name', 'Tarok');
  const addLink = (rel: string, href: string, sizes?: string) => {
    const l = document.createElement('link');
    l.rel = rel; l.href = href;
    if (sizes) l.setAttribute('sizes', sizes);
    document.head.appendChild(l);
  };
  addLink('apple-touch-icon', '/apple-touch-icon.png', '180x180');
  addLink('icon', '/icon-512.png', '512x512');
}
