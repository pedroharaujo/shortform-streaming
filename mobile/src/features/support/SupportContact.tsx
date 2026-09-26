import { useRef, useState, type JSX } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { useMessages } from '../../localization/messages';
import { ActionButton } from '../../ui/ScreenElements';
import { colors, fontSizes, spacing } from '../../ui/theme';
import { privacyNoticeUrl, supportEmail } from './contactDetails';

function ExternalLink({
  url,
  label,
}: {
  readonly url: string;
  readonly label: string;
}): JSX.Element {
  const copy = useMessages().support;
  const opening = useRef(false);
  const [status, setStatus] = useState<'idle' | 'opening' | 'failed'>('idle');
  async function open(): Promise<void> {
    if (opening.current) return;
    opening.current = true;
    setStatus('opening');
    try {
      await Linking.openURL(url);
      setStatus('idle');
    } catch {
      setStatus('failed');
    } finally {
      opening.current = false;
    }
  }
  return (
    <View style={styles.content}>
      <ActionButton label={label} disabled={status === 'opening'} onPress={() => void open()} />
      {status !== 'idle' ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {status === 'opening' ? copy.opening : copy.openFailed}
        </Text>
      ) : null}
    </View>
  );
}

export function SupportContact({
  topic = 'general',
  reference,
}: {
  readonly topic?: 'general' | 'purchase' | 'unlock';
  readonly reference?: string | undefined;
}): JSX.Element {
  const messages = useMessages();
  const copy = messages.support;
  const body = [
    copy.emailBody,
    ...(reference ? [messages.purchases.supportReference(reference)] : []),
  ].join('\n\n');
  const url = `mailto:${supportEmail}?subject=${encodeURIComponent(copy.subjects[topic])}&body=${encodeURIComponent(body)}`;
  return (
    <View style={styles.content}>
      <Text selectable style={styles.address}>
        {supportEmail}
      </Text>
      {reference ? (
        <Text selectable style={styles.body}>
          {messages.purchases.supportReference(reference)}
        </Text>
      ) : null}
      <Text style={styles.body}>{reference ? copy.withReference : copy.description}</Text>
      <ExternalLink label={copy.emailSupport} url={url} />
    </View>
  );
}

export function PrivacyNoticeLink(): JSX.Element {
  const copy = useMessages().support;
  return (
    <View style={styles.content}>
      <ExternalLink label={copy.privacyPolicy} url={privacyNoticeUrl} />
      <Text style={styles.body}>{copy.privacyPolicyDescription}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  address: { color: colors.foreground, fontSize: fontSizes.body },
  body: { color: colors.muted, fontSize: fontSizes.label, lineHeight: 22 },
});
