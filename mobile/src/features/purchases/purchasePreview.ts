import { Platform } from 'react-native';
import { getApiConfiguration, getPurchaseConfiguration } from '../../config/appConfiguration';

/** Design-only preview. Never substitutes for a configured store or a release checkout. */
export function isPurchasePreviewEnabled(): boolean {
  return (
    __DEV__ &&
    Platform.OS === 'android' &&
    getApiConfiguration().environment === 'local' &&
    getPurchaseConfiguration().mode === 'disabled'
  );
}
