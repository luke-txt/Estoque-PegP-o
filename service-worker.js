// ══════════════════════════════════════════════
// service-worker.js — PegPão PWA
// Versão: atualizar este número força o cache
// a ser renovado em todos os dispositivos
// ══════════════════════════════════════════════

const CACHE_NAME  = 'pegpao-v2.1';
const CACHE_STATIC = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/auth.js',
  '/js/app.js',
  '/js/estoque.js',
  '/js/movimentos.js',
  '/js/diario.js',
  '/js/relatorio.js',
  '/js/dono.js',
  '/js/usuarios.js',
  '/js/main.js',
  '/assets/logo.png',
  '/manifest.json',
  // Fontes Google (cache externo)
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap',
  // Libs externas
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// ── Install: guarda todos os arquivos estáticos ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando arquivos estáticos...');
      // Tenta cachear cada arquivo individualmente
      // para não falhar tudo se um externo não carregar
      return Promise.allSettled(
        CACHE_STATIC.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Não cacheou:', url, err.message)
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: remove caches antigos ──────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estratégia por tipo de recurso ─────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignora requests não-GET
  if (event.request.method !== 'GET') return;

  // Firebase Realtime Database — NUNCA intercepta
  // (precisa de internet para sincronizar dados)
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('firebase.com') ||
      url.hostname.includes('firebaseapp.com') ||
      url.hostname.includes('googleapis.com') && url.pathname.includes('identitytoolkit')) {
    return;
  }

  // Arquivos estáticos do próprio app (JS, CSS, HTML, assets)
  // Estratégia: Cache First → se não tiver, busca na rede
  if (url.hostname === self.location.hostname ||
      url.href.includes('fonts.googleapis.com') ||
      url.href.includes('fonts.gstatic.com') ||
      url.href.includes('gstatic.com/firebasejs') ||
      url.href.includes('cdnjs.cloudflare.com') ||
      url.href.includes('unpkg.com')) {

    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(response => {
            // Guarda no cache para próxima vez
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Offline e não tem cache: retorna página principal
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
    );
    return;
  }
});

// ── Mensagens do app ──────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
