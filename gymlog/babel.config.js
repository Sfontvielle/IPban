/**
 * Явная конфигурация Babel.
 *
 * babel-preset-expo сам подключает плагины react-native-worklets / reanimated,
 * но без этого файла применение пресета зависит от версии metro-config.
 * Несовпадение здесь на iOS даёт краш без единой строчки в логе Metro,
 * поэтому конфигурация задана явно.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
