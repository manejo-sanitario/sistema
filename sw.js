/* Guarda o sistema no aparelho para abrir e lançar registros sem internet.
   Os dados vão para o servidor pela fila do próprio app quando a conexão volta. */
const VERSAO = 'msa-v89';
const ARQUIVOS = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/tudo.js',
  'js/vendor/supabase-2.117.2.js', 'js/vendor/qrcode-generator-2.0.4.js', 'assets/icon-192.png', 'assets/escudo.svg', 'manifest.webmanifest',
  'assets/fontes/plus-jakarta-sans-latin-wght-normal.woff2', 'assets/fontes/manrope-marca-700.woff2'];
const EXTERNOS = [];   // desde a v4 as fontes ficam no próprio sistema
// cada versão nova baixa tudo de novo, sem passar pelo cache do navegador (senão podia guardar arquivo velho)
self.addEventListener('install', e => e.waitUntil(caches.open(VERSAO)
  .then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())));
const guardar = (req, r) => { if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(VERSAO).then(x => x.put(req, c)); } return r; };
// internet com prazo: se não responder em ms milissegundos, usa a cópia do aparelho (se houver)
const comPrazo = (req, ms) => new Promise((ok, falha) => {
  let feito = false; const t = setTimeout(() => caches.match(req).then(r => { if (r && !feito) { feito = true; ok(r); } }), ms);
  fetch(req).then(r => { clearTimeout(t); guardar(req, r); if (!feito) { feito = true; ok(r); } })
    .catch(() => { clearTimeout(t); caches.match(req).then(r => { if (!feito) { feito = true; r ? ok(r) : falha(); } }); });
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const proprio = u.origin === location.origin;
  if (!proprio && !EXTERNOS.includes(u.hostname)) return;   // API do Supabase passa direto
  if (proprio && u.pathname.includes('/manuais/')) return;   // manuais em PDF: sempre da internet, não ocupam o aparelho
  // a página: internet com prazo de 3 s (para pegar versão nova); sem sinal, abre a guardada
  if (e.request.mode === 'navigate') {
    e.respondWith(comPrazo(e.request, 3000).catch(() => caches.match('index.html')));
    return;
  }
  // arquivos do sistema, biblioteca e fontes: abre do aparelho na hora; o que não estiver guardado vem da internet
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => guardar(e.request, x)))
    .catch(() => proprio ? caches.match(e.request) : Response.error()));
});

/* 05/11/2026: avisos no celular. O servidor manda só { titulo, corpo, tag } (sem nome de animal nem de pessoa). Tocar no aviso abre o sistema. */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { corpo: e.data ? e.data.text() : '' }; }
  const op = { body: String(d.corpo || '').slice(0, 200), icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { url: './' }, lang: 'pt-BR' };
  if (d.tag) { op.tag = String(d.tag).slice(0, 60); op.renotify = true; }   // o mesmo assunto troca o aviso anterior em vez de empilhar
  const titulo = String(d.titulo || 'Manejo Sanitário').slice(0, 60);
  /* além da notificação, avisa a página aberta (ela busca os dados novos na hora) */
  e.waitUntil(self.registration.showNotification(titulo, op).then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .then(l => l.forEach(c => c.postMessage({ chegouAviso: true, titulo, corpo: op.body, tag: op.tag || '' }))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    const j = l.find(c => c.url.startsWith(self.registration.scope)); if (j) return j.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  }));
});
