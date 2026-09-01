const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite грузит SQLite в вебе через WebAssembly.
// Без этого Metro не резолвит .wasm, и сборка веб-версии падает ещё на этапе бандлинга.
config.resolver.assetExts.push('wasm');

// wa-sqlite (веб-реализация expo-sqlite) требует эти заголовки для SharedArrayBuffer —
// без них база в браузере не откроется даже при успешной сборке.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    return middleware(req, res, next);
  },
};

module.exports = config;
