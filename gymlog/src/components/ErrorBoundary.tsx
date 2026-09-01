import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  info: string | null;
}

/**
 * Показывает текст ошибки вместо белого экрана.
 *
 * Без этого любая ошибка при загрузке приложения выглядит как «программа вылетела»,
 * и понять причину без Mac и Xcode невозможно. Здесь она видна прямо на телефоне.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[gymlog] ошибка в интерфейсе', error, info.componentStack);
    this.setState({ info: info.componentStack ?? null });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Приложение не смогло запуститься</Text>
          <Text style={styles.hint}>
            Покажите этот текст разработчику — по нему видно точную причину.
          </Text>

          <Text style={styles.label}>Ошибка</Text>
          <Text style={styles.mono}>{error.name}: {error.message}</Text>

          {error.stack ? (
            <>
              <Text style={styles.label}>Стек</Text>
              <Text style={styles.mono}>{error.stack.split('\n').slice(0, 12).join('\n')}</Text>
            </>
          ) : null}

          {info ? (
            <>
              <Text style={styles.label}>Компонент</Text>
              <Text style={styles.mono}>{info.split('\n').slice(0, 10).join('\n')}</Text>
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E1216' },
  content: { padding: 24, paddingTop: 72, gap: 8 },
  title: { color: '#EE7A87', fontSize: 20, fontWeight: '700' },
  hint: { color: '#9DAAB8', fontSize: 14, marginBottom: 12 },
  label: {
    color: '#6E7A88',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 16,
  },
  mono: {
    color: '#E7ECF2',
    fontSize: 12,
    fontFamily: 'Courier',
    lineHeight: 18,
  },
});
