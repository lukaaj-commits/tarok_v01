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
    html, body { background-color: #000000; }
    div, span, input, textarea, button { font-family: 'Poppins', -apple-system, system-ui, sans-serif !important; }
  `;

  document.head.appendChild(pre1);
  document.head.appendChild(pre2);
  document.head.appendChild(link);
  document.head.appendChild(style);
}
