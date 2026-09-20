import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, type ScrollView, type TextInputProps } from 'react-native';

import { spacing } from './theme';

/** Reveal the focused field after Android has resized the form for its keyboard. */
export function useKeyboardScroll() {
  const ref = useRef<ScrollView>(null);
  const focused = useRef<number | null>(null);
  const reveal = useCallback(() => {
    const field = focused.current;
    const scroll = ref.current;
    if (field === null || scroll === null || !Keyboard.isVisible()) return;
    // The responder assumes a full-screen viewport; our form starts below the safe area.
    scroll.getNativeScrollRef()?.measureInWindow((_x, top) => {
      if (focused.current === field && ref.current === scroll && Keyboard.isVisible()) {
        scroll.scrollResponderScrollNativeHandleToKeyboard(field, top + spacing.lg, true);
      }
    });
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', reveal);
    return () => subscription.remove();
  }, [reveal]);

  const onFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
    focused.current = event.nativeEvent.target;
    reveal();
  };
  const onBlur = () => {
    focused.current = null;
  };

  return { scrollRef: ref, revealField: reveal, onFieldFocus: onFocus, onFieldBlur: onBlur };
}
