import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  EQUIPMENT,
  EQUIPMENT_LABELS,
  METRIC_TYPES,
  METRIC_TYPE_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  type Category,
  type Equipment,
  type MetricType,
  type MuscleGroup,
} from '@/constants/enums';
import { ExerciseRepository } from '@/repositories/ExerciseRepository';
import { usePalette } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export function ExerciseFormScreen() {
  const router = useRouter();
  const palette = usePalette();

  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [notes, setNotes] = useState('');
  const [metricType, setMetricType] = useState<MetricType>('weight_reps');
  const [category, setCategory] = useState<Category>('bodybuilding');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [saving, setSaving] = useState(false);

  const inputStyle = [
    styles.input,
    { backgroundColor: palette.surface, borderColor: palette.line, color: palette.ink },
  ];

  const save = async () => {
    if (name.trim().length < 2) {
      Alert.alert('Нужно название', 'Введите название упражнения.');
      return;
    }
    if (muscles.length === 0) {
      Alert.alert('Нужна мышечная группа', 'Выберите хотя бы одну основную мышцу.');
      return;
    }
    if (equipment.length === 0) {
      Alert.alert('Нужно оборудование', 'Выберите оборудование — например, «Свой вес».');
      return;
    }

    setSaving(true);
    try {
      const id = await ExerciseRepository.createCustom({
        nameRu: name.trim(),
        nameEn: nameEn.trim() || null,
        metricType,
        category,
        primaryMuscles: muscles,
        equipment,
        notes: notes.trim() || null,
      });
      router.replace(`/exercise/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <Screen scroll>
      <Txt variant="label" tone="faint" style={styles.label}>Название *</Txt>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Например: Жим гантелей на полу"
        placeholderTextColor={palette.inkFaint}
        style={inputStyle}
      />

      <Txt variant="label" tone="faint" style={styles.label}>Название на английском</Txt>
      <TextInput
        value={nameEn}
        onChangeText={setNameEn}
        placeholder="Floor Press"
        placeholderTextColor={palette.inkFaint}
        style={inputStyle}
      />

      <Txt variant="label" tone="faint" style={styles.label}>Как измеряем *</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {METRIC_TYPES.map((type) => (
          <Chip
            key={type}
            label={METRIC_TYPE_LABELS[type]}
            selected={metricType === type}
            onPress={() => setMetricType(type)}
          />
        ))}
      </ScrollView>

      <Txt variant="label" tone="faint" style={styles.label}>Основные мышцы *</Txt>
      <View style={styles.wrapChips}>
        {MUSCLE_GROUPS.map((muscle) => (
          <Chip
            key={muscle}
            label={MUSCLE_LABELS[muscle]}
            selected={muscles.includes(muscle)}
            onPress={() => setMuscles((current) => toggle(current, muscle))}
          />
        ))}
      </View>

      <Txt variant="label" tone="faint" style={styles.label}>Оборудование *</Txt>
      <View style={styles.wrapChips}>
        {EQUIPMENT.map((item) => (
          <Chip
            key={item}
            label={EQUIPMENT_LABELS[item]}
            selected={equipment.includes(item)}
            onPress={() => setEquipment((current) => toggle(current, item))}
          />
        ))}
      </View>

      <Txt variant="label" tone="faint" style={styles.label}>Категория</Txt>
      <View style={styles.wrapChips}>
        {CATEGORIES.map((item) => (
          <Chip
            key={item}
            label={CATEGORY_LABELS[item]}
            selected={category === item}
            onPress={() => setCategory(item)}
          />
        ))}
      </View>

      <Txt variant="label" tone="faint" style={styles.label}>Заметка / техника</Txt>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Как выполнять, на что обратить внимание"
        placeholderTextColor={palette.inkFaint}
        multiline
        style={[...inputStyle, styles.multiline]}
      />

      <Button title="Сохранить упражнение" fullWidth onPress={save} loading={saving} style={styles.save} />
      <Txt variant="caption" tone="faint" style={styles.hint}>
        Своё упражнение работает так же, как любое из каталога: в шаблонах, истории,
        статистике, рекордах и AI-анализе.
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  input: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  save: { marginTop: spacing.xl },
  hint: { marginTop: spacing.md },
});
