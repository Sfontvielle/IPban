/**
 * Минимальная точка входа для поиска причины краша на устройстве.
 *
 * Здесь НЕТ ничего из src/: ни expo-router, ни базы, ни экранов приложения.
 * Это важно — expo-router загружает все файлы маршрутов сразу при старте,
 * поэтому «аварийный режим» внутри самого приложения ничего не изолирует.
 *
 * Как включить: в package.json поменять
 *     "main": "expo-router/entry"   →   "main": "./index-minimal.js"
 * и запустить  npx expo start -c
 *
 * Как вернуть обратно: та же строка, значение "expo-router/entry".
 */
import { registerRootComponent } from 'expo';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function Row({ title, state, detail, onPress }) {
  const color = state === 'ok' ? '#5FBE8E' : state === 'fail' ? '#EE7A87' : '#9DAAB8';
  return (
    <View style={styles.row}>
      <Pressable onPress={onPress} style={styles.button}>
        <Text style={styles.buttonText}>{title}</Text>
      </Pressable>
      <Text style={[styles.state, { color }]}>
        {state === 'ok' ? 'РАБОТАЕТ' : state === 'fail' ? 'ОШИБКА' : 'не проверено'}
      </Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

function Diagnostics() {
  const [sqlite, setSqlite] = useState({ state: 'idle', detail: null });
  const [fts, setFts] = useState({ state: 'idle', detail: null });
  const [catalog, setCatalog] = useState({ state: 'idle', detail: null });

  const checkSqlite = async () => {
    setSqlite({ state: 'idle', detail: 'проверяю…' });
    try {
      const SQLite = await import('expo-sqlite');
      const db = await SQLite.openDatabaseAsync('diagnostic.db');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('CREATE TABLE IF NOT EXISTS probe (id INTEGER PRIMARY KEY, value TEXT);');
      await db.runAsync('INSERT INTO probe (value) VALUES (?)', ['проверка']);
      const row = await db.getFirstAsync('SELECT value FROM probe ORDER BY id DESC LIMIT 1');
      await db.execAsync('DROP TABLE probe;');
      setSqlite({ state: 'ok', detail: `прочитано: ${row ? row.value : 'пусто'}` });
    } catch (error) {
      setSqlite({ state: 'fail', detail: String(error && error.message ? error.message : error) });
    }
  };

  const checkFts = async () => {
    setFts({ state: 'idle', detail: 'проверяю…' });
    try {
      const SQLite = await import('expo-sqlite');
      const db = await SQLite.openDatabaseAsync('diagnostic.db');
      await db.execAsync(
        'CREATE VIRTUAL TABLE IF NOT EXISTS probe_fts USING fts5(name, tokenize = "unicode61 remove_diacritics 2");',
      );
      await db.runAsync('INSERT INTO probe_fts (name) VALUES (?)', ['жим лежа']);
      const row = await db.getFirstAsync("SELECT name FROM probe_fts WHERE probe_fts MATCH '\"жим\"*' LIMIT 1");
      await db.execAsync('DROP TABLE probe_fts;');
      setFts({ state: row ? 'ok' : 'fail', detail: row ? 'поиск отвечает' : 'таблица есть, поиск молчит' });
    } catch (error) {
      setFts({ state: 'fail', detail: String(error && error.message ? error.message : error) });
    }
  };

  const checkCatalog = async () => {
    setCatalog({ state: 'idle', detail: 'загружаю…' });
    try {
      const data = require('./assets/catalog/exercises.json');
      setCatalog({ state: 'ok', detail: `упражнений: ${data.exercises.length}` });
    } catch (error) {
      setCatalog({ state: 'fail', detail: String(error && error.message ? error.message : error) });
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Проверка окружения</Text>
        <Text style={styles.ok}>Экран виден — React Native и Expo Go работают.</Text>
        <Text style={styles.meta}>
          {Platform.OS} {Platform.Version}
        </Text>

        <Text style={styles.hint}>
          Нажимайте кнопки по очереди. Если приложение вылетит на какой-то из них —
          именно она и есть причина.
        </Text>

        <Row title="1. Проверить SQLite" state={sqlite.state} detail={sqlite.detail} onPress={checkSqlite} />
        <Row title="2. Проверить FTS5 (поиск)" state={fts.state} detail={fts.detail} onPress={checkFts} />
        <Row title="3. Загрузить каталог" state={catalog.state} detail={catalog.detail} onPress={checkCatalog} />

        <Text style={styles.hint}>
          Пришлите, какие пункты стали зелёными, а на каком приложение закрылось.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E1216' },
  content: { padding: 24, paddingTop: 72, gap: 12 },
  title: { color: '#E7ECF2', fontSize: 24, fontWeight: '700' },
  ok: { color: '#5FBE8E', fontSize: 15 },
  meta: { color: '#6E7A88', fontSize: 12 },
  hint: { color: '#9DAAB8', fontSize: 14, marginTop: 12, lineHeight: 20 },
  row: { gap: 4, marginTop: 12 },
  button: { backgroundColor: '#1D4F91', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  state: { fontSize: 13, fontWeight: '600' },
  detail: { color: '#9DAAB8', fontSize: 12, lineHeight: 17 },
});

registerRootComponent(Diagnostics);
