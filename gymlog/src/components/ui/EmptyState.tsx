import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Txt } from '@/components/ui/Txt';
import { spacing } from '@/theme/tokens';

interface Props {
  icon?: string;
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = '💤', title, description, actionTitle, onAction }: Props) {
  return (
    <View style={styles.wrapper}>
      <Txt style={styles.icon}>{icon}</Txt>
      <Txt variant="title" align="center">{title}</Txt>
      {description ? (
        <Txt tone="muted" align="center" style={styles.description}>{description}</Txt>
      ) : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  icon: { fontSize: 40 },
  description: { maxWidth: 280 },
  action: { marginTop: spacing.md },
});
