import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSizes, minimumTouchTarget, radii, spacing } from './theme';

export function ScreenIntro({
  title,
  subtitle,
}: {
  readonly title: string;
  readonly subtitle: string;
}): JSX.Element {
  return (
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

export function ProfileAvatar(): JSX.Element {
  return (
    <View style={styles.avatar} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.head} />
      <View style={styles.shoulders} />
    </View>
  );
}

export function BackButton({ label, onPress, disabled = false }: ActionButtonProps): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Text style={styles.backArrow} accessible={false}>
        {'\u2039'}
      </Text>
      <Text style={styles.backLabel}>{label}</Text>
    </Pressable>
  );
}

export function SettingsRow({ label, onPress, disabled = false }: ActionButtonProps): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron} accessible={false}>
        {'\u203a'}
      </Text>
    </Pressable>
  );
}

export interface ActionButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly tone?: 'primary' | 'secondary' | 'quiet' | 'danger';
  readonly testID?: string;
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  tone = 'secondary',
  testID,
}: ActionButtonProps): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        styles[tone],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          tone === 'primary' && styles.primaryLabel,
          tone === 'danger' && styles.dangerLabel,
          tone === 'quiet' && styles.quietLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const panelStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  label: { color: colors.accent, fontSize: fontSizes.caption, fontWeight: '700', letterSpacing: 1 },
});

const styles = StyleSheet.create({
  intro: { gap: spacing.sm, marginBottom: spacing.lg },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  head: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.foreground,
    marginBottom: 3,
  },
  shoulders: {
    width: 20,
    height: 9,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: colors.foreground,
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
  },
  backArrow: { color: colors.foreground, fontSize: 32 },
  backLabel: { color: colors.foreground, fontSize: fontSizes.body, flexShrink: 1 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 68,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.foreground, fontSize: fontSizes.body, flex: 1 },
  chevron: { color: colors.muted, fontSize: 24 },
  title: {
    color: colors.foreground,
    fontSize: fontSizes.display,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  subtitle: { color: colors.muted, fontSize: fontSizes.body, lineHeight: 24 },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonLabel: {
    color: colors.foreground,
    fontSize: fontSizes.body,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  primaryLabel: { color: colors.onAccent },
  secondary: { backgroundColor: colors.surfaceRaised, borderColor: 'transparent' },
  quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  quietLabel: { color: colors.muted },
  danger: { backgroundColor: colors.surface, borderColor: colors.danger },
  dangerLabel: { color: colors.dangerForeground },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
});
