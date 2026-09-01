/**
 * Пошаговая диагностика: включаем части приложения по одной.
 *
 * Здесь нет ни expo-router, ни экранов — всё подключается только по нажатию кнопки
 * через динамический import. Это важно: expo-router грузит все файлы маршрутов
 * сразу при старте, поэтому внутри самого приложения изолировать ничего нельзя.
 *
 * Как включить: в package.json  "main": "./index-minimal.js"
 * Как вернуть:  в package.json  "main": "expo-router/entry"
 * После смены строки — обязательно  npx expo start -c
 */
import { registerRootComponent } from 'expo';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const OK = 'ok';
const FAIL = 'fail';
const IDLE = 'idle';

function message(error) {
  if (!error) return 'неизвестная ошибка';
  return String(error.message ?? error).slice(0, 300);
}

function Check({ index, title, result, onPress }) {
  const color = result.state === OK ? '#5FBE8E' : result.state === FAIL ? '#EE7A87' : '#6E7A88';
  const label = result.state === OK ? 'РАБОТАЕТ' : result.state === FAIL ? 'ОШИБКА' : 'не проверено';

  return (
    <View style={styles.check}>
      <Pressable onPress={onPress} style={styles.button}>
        <Text style={styles.buttonText}>{index}. {title}</Text>
      </Pressable>
      <Text style={[styles.state, { color }]}>{result.detail ?? label}</Text>
    </View>
  );
}

function Diagnostics() {
  const [results, setResults] = useState({});
  const [svgVisible, setSvgVisible] = useState(false);
  const [uiVisible, setUiVisible] = useState(false);
  const [Svg, setSvg] = useState(null);

  const set = (key, state, detail) =>
    setResults((current) => ({ ...current, [key]: { state, detail } }));

  const get = (key) => results[key] ?? { state: IDLE, detail: null };

  const run = async (key, fn) => {
    set(key, IDLE, 'проверяю…');
    try {
      const detail = await fn();
      set(key, OK, detail ?? 'РАБОТАЕТ');
    } catch (error) {
      set(key, FAIL, message(error));
    }
  };

  const checks = [
    {
      key: 'sqlite',
      title: 'База данных SQLite',
      run: async () => {
        const SQLite = await import('expo-sqlite');
        const db = await SQLite.openDatabaseAsync('diagnostic.db');
        await db.execAsync('PRAGMA journal_mode = WAL;');
        await db.execAsync('CREATE TABLE IF NOT EXISTS probe (id INTEGER PRIMARY KEY, value TEXT);');
        await db.runAsync('INSERT INTO probe (value) VALUES (?)', ['проверка']);
        const row = await db.getFirstAsync('SELECT value FROM probe ORDER BY id DESC LIMIT 1');
        await db.execAsync('DROP TABLE probe;');
        return `прочитано: ${row ? row.value : 'пусто'}`;
      },
    },
    {
      key: 'fts',
      title: 'Поиск FTS5',
      run: async () => {
        const SQLite = await import('expo-sqlite');
        const db = await SQLite.openDatabaseAsync('diagnostic.db');
        await db.execAsync(
          'CREATE VIRTUAL TABLE IF NOT EXISTS probe_fts USING fts5(name, tokenize = "unicode61 remove_diacritics 2");',
        );
        await db.runAsync('INSERT INTO probe_fts (name) VALUES (?)', ['жим лежа']);
        const row = await db.getFirstAsync("SELECT name FROM probe_fts WHERE probe_fts MATCH '\"жим\"*' LIMIT 1");
        await db.execAsync('DROP TABLE probe_fts;');
        if (!row) throw new Error('таблица создана, но поиск не отвечает');
        return 'поиск отвечает';
      },
    },
    {
      key: 'catalog',
      title: 'Каталог упражнений',
      run: async () => {
        const data = require('./assets/catalog/exercises.json');
        return `упражнений: ${data.exercises.length}`;
      },
    },
    {
      key: 'nav',
      title: 'Навигация (screens, safe-area)',
      run: async () => {
        await import('react-native-screens');
        await import('react-native-safe-area-context');
        return 'модули загружены';
      },
    },
    {
      key: 'svg',
      title: 'Графика SVG (иконки, графики)',
      run: async () => {
        const module = await import('react-native-svg');
        setSvg(() => module);
        setSvgVisible(true);
        return 'загружено, круг ниже должен быть виден';
      },
    },
    {
      key: 'haptics',
      title: 'Вибрация',
      run: async () => {
        const Haptics = await import('expo-haptics');
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return 'должна была ощущаться вибрация';
      },
    },
    {
      key: 'router',
      title: 'expo-router',
      run: async () => {
        await import('expo-router');
        return 'модуль загружен';
      },
    },
    {
      key: 'app',
      title: 'Наш код: тема, хранилища, база',
      run: async () => {
        await import('./src/theme/tokens');
        await import('./src/stores/settingsStore');
        await import('./src/db/client');
        await import('./src/repositories/ExerciseRepository');
        await import('./src/analytics/index');
        return 'модули приложения загружены';
      },
    },
    {
      key: 'screens',
      title: 'Наши экраны (все сразу)',
      run: async () => {
        await import('./src/features/home/HomeScreen');
        await import('./src/features/catalog/CatalogScreen');
        await import('./src/features/active-workout/ActiveWorkoutScreen');
        await import('./src/features/progress/ProgressScreen');
        await import('./src/features/coach/CoachScreen');
        await import('./src/features/settings/SettingsScreen');
        return 'экраны загружены';
      },
    },
    {
      key: 'ui',
      title: 'Отрисовать наши компоненты',
      run: async () => {
        setUiVisible(true);
        return 'блок ниже должен появиться';
      },
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Пошаговая проверка</Text>
        <Text style={styles.ok}>Экран виден — Expo Go и React Native работают.</Text>
        <Text style={styles.meta}>{Platform.OS} {String(Platform.Version)}</Text>
        <Text style={styles.hint}>
          Нажимайте кнопки строго по порядку. Та, на которой приложение закроется,
          и есть причина. Напишите её номер.
        </Text>

        {checks.map((check, index) => (
          <Check
            key={check.key}
            index={index + 1}
            title={check.title}
            result={get(check.key)}
            onPress={() => run(check.key, check.run)}
          />
        ))}

        {svgVisible && Svg ? (
          <View style={styles.demo}>
            <Text style={styles.demoTitle}>SVG отрисован:</Text>
            <Svg.default width={60} height={60} viewBox="0 0 60 60">
              <Svg.Circle cx="30" cy="30" r="26" fill="#1D4F91" />
            </Svg.default>
          </View>
        ) : null}

        {uiVisible ? <UiDemo /> : null}

        <Text style={styles.hint}>
          Если все пункты зелёные, а приложение всё равно падает — значит дело
          в самом expo-router при построении дерева маршрутов.
        </Text>
      </ScrollView>
    </View>
  );
}

/** Отрисовка наших настоящих компонентов вне приложения. */
function UiDemo() {
  const [error, setError] = useState(null);
  const [Parts, setParts] = useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [{ Card }, { Button }, { StatTile }, { MuscleGlyph }, { LineChart }, theme] =
          await Promise.all([
            import('./src/components/ui/Card'),
            import('./src/components/ui/Button'),
            import('./src/components/ui/StatTile'),
            import('./src/components/ui/MuscleGlyph'),
            import('./src/components/ui/LineChart'),
            import('./src/theme/ThemeProvider'),
          ]);
        setParts({ Card, Button, StatTile, MuscleGlyph, LineChart, ThemeProvider: theme.ThemeProvider });
      } catch (caught) {
        setError(message(caught));
      }
    })();
  }, []);

  if (error) return <Text style={[styles.state, { color: '#EE7A87' }]}>{error}</Text>;
  if (!Parts) return <Text style={styles.state}>загружаю компоненты…</Text>;

  const { Card, Button, StatTile, MuscleGlyph, LineChart, ThemeProvider } = Parts;

  return (
    <ThemeProvider>
      <View style={styles.demo}>
        <Text style={styles.demoTitle}>Наши компоненты:</Text>
        <Card>
          <StatTile label="Объём за неделю" value="8 420" hint="кг" />
        </Card>
        <MuscleGlyph muscle="chest" size={48} />
        <LineChart
          width={260}
          data={[
            { x: 1, y: 80 },
            { x: 2, y: 82.5 },
            { x: 3, y: 85 },
          ]}
        />
        <Button title="Кнопка" onPress={() => {}} />
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E1216' },
  content: { padding: 20, paddingTop: 64, paddingBottom: 64, gap: 8 },
  title: { color: '#E7ECF2', fontSize: 24, fontWeight: '700' },
  ok: { color: '#5FBE8E', fontSize: 15 },
  meta: { color: '#6E7A88', fontSize: 12 },
  hint: { color: '#9DAAB8', fontSize: 14, marginTop: 14, lineHeight: 20 },
  check: { gap: 4, marginTop: 10 },
  button: { backgroundColor: '#1D4F91', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  state: { color: '#9DAAB8', fontSize: 12, lineHeight: 17 },
  demo: { marginTop: 16, gap: 10, padding: 14, backgroundColor: '#161B21', borderRadius: 12 },
  demoTitle: { color: '#9DAAB8', fontSize: 12 },
});

registerRootComponent(Diagnostics);
