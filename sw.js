/* Guarda o sistema no aparelho para abrir e lançar registros sem internet.
   Os dados vão para o servidor pela fila do próprio app quando a conexão volta. */
const VERSAO = 'msa-v139';
const ARQUIVOS = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/tudo.js',
  'js/vendor/supabase-2.117.2.js', 'js/vendor/qrcode-generator-2.0.4.js', 'assets/icon-192.png', 'assets/escudo.svg', 'assets/icone.svg', 'assets/mapa-rn.json', 'manifest.webmanifest',
  'assets/fontes/lexend-latin-wght-normal.woff2', 'assets/fontes/manrope-marca-700.woff2'];
const EXTERNOS = [];   // desde a v4 as fontes ficam no próprio sistema
// cada versão nova baixa tudo de novo, sem passar pelo cache do navegador (senão podia guardar arquivo velho)
self.addEventListener('install', e => e.waitUntil(caches.open(VERSAO)
  .then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())));
const guardar = (req, r) => { if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(VERSAO).then(x => x.put(req, c)); } return r; };
// internet com prazo: se não responder em ms milissegundos, usa a cópia do aparelho (se houver)
// chave: com que nome guardar (a página vai sempre como "index.html"/"simulacao.html", sem o endereço com ?cadastro=<código> ou ?muda=…:
// o código do link de cadastro ficava guardado no aparelho e cada muda virava uma cópia nova; verificação completa de 14/11/2026)
const comPrazo = (req, ms, chave) => new Promise((ok, falha) => {
  const k = chave || req;
  let feito = false; const t = setTimeout(() => caches.match(k).then(r => { if (r && !feito) { feito = true; ok(r); } }), ms);
  fetch(req).then(r => { clearTimeout(t); guardar(k, r); if (!feito) { feito = true; ok(r); } })
    .catch(() => { clearTimeout(t); caches.match(k).then(r => { if (!feito) { feito = true; r ? ok(r) : falha(); } }); });
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const proprio = u.origin === location.origin;
  if (!proprio && !EXTERNOS.includes(u.hostname)) return;   // API do Supabase passa direto
  if (proprio && u.pathname.includes('/manuais/')) return;   // manuais em PDF: sempre da internet, não ocupam o aparelho
  // a página: internet com prazo de 3 s (para pegar versão nova); sem sinal, abre a guardada
  if (e.request.mode === 'navigate') {
    /* a simulação (simulacao.html) nunca cai na página do sistema real: sem sinal, avisa (antes abria a index.html guardada no
       endereço da simulação, e a pessoa podia entrar no sistema de verdade achando que treinava; revisão de 10/11/2026) */
    const sim = /\/simulacao\.html$/.test(u.pathname);
    e.respondWith(comPrazo(e.request, sim ? 8000 : 3000, sim ? 'simulacao.html' : 'index.html').catch(() => sim
      ? new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulação sem internet</title><body style="font:16px system-ui;padding:24px;max-width:36em;margin:auto"><h1>A simulação precisa de internet</h1><p>A página de treino não fica guardada no aparelho. Tente de novo quando houver sinal.</p><p><a href="./">Abrir o sistema</a></p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      : caches.match('index.html')));
    return;
  }
  // arquivos do sistema, biblioteca e fontes: abre do aparelho na hora; o que não estiver guardado vem da internet
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => guardar(e.request, x)))
    .catch(() => proprio ? caches.match(e.request) : Response.error()));
});

/* v137 (verificação completa de 14/11/2026): o toque no aviso abre a seção do assunto (antes, sempre a primeira tela). As etiquetas
   (tag) são as que o banco manda em avisar() (05_avisos_e_fotos.sql); etiqueta sem seção abre o sistema onde estava. */
const ABA_DO_AVISO = { conferir: 'procedimentos', aval: 'equipe', famacha: 'pesquisa', 'resumo-dia': 'calendario' };
const abaDoAviso = tag => ABA_DO_AVISO[String(tag || '')] || '';
/* 05/11/2026: avisos no celular. O servidor manda só { titulo, corpo, tag } (sem nome de animal nem de pessoa). Tocar no aviso abre o sistema. */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { corpo: e.data ? e.data.text() : '' }; }
  const op = { body: String(d.corpo || '').slice(0, 200), icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { url: './' + (abaDoAviso(d.tag) ? '#' + abaDoAviso(d.tag) : ''), aba: abaDoAviso(d.tag) }, lang: 'pt-BR' };
  if (d.tag) { op.tag = String(d.tag).slice(0, 60); op.renotify = true; }   // o mesmo assunto troca o aviso anterior em vez de empilhar
  const titulo = String(d.titulo || 'Manejo Sanitário').slice(0, 60);
  /* além da notificação, avisa a página aberta (ela busca os dados novos na hora) */
  e.waitUntil(self.registration.showNotification(titulo, op).then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .then(l => l.forEach(c => c.postMessage({ chegouAviso: true, titulo, corpo: op.body, tag: op.tag || '' }))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    const dados = e.notification.data || {};
    const j = l.find(c => c.url.startsWith(self.registration.scope));
    if (j) { if (dados.aba) j.postMessage({ abrirAba: dados.aba }); return j.focus(); }
    return self.clients.openWindow(dados.url || './');
  }));
});
