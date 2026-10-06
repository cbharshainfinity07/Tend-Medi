import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import type { Medication } from '@/domain/types';
import { photoUri } from '@/photos/photos';
import { useTheme } from '@/theme/theme';
import { haptic } from './haptics';
import { Icon } from './Icon';
import { PillTile } from './kit';
import { ND } from './motion';
import { Text } from './Text';

type Med = Pick<Medication, 'form' | 'color' | 'name'> & { photo?: string | null };

/**
 * The medicine's own photo when there is one, otherwise its pill drawing.
 * With `zoomable`, tapping opens the photo full screen: easier to recognise than a name.
 */
export function MedThumb({ med, size = 46, round, zoomable, style }: { med: Med; size?: number; round?: boolean; zoomable?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const uri = photoUri(med.photo);
  if (!uri) {
    return (
      <View style={style}>
        <PillTile form={med.form} color={med.color} size={size} />
      </View>
    );
  }
  const img = (
    <Image
      source={{ uri }}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: round ? size / 2 : size * 0.32, backgroundColor: c.surface2 }}
    />
  );
  if (!zoomable) return <View style={style}>{img}</View>;
  return (
    <Pressable
      style={style}
      onPress={() => openPhoto(uri, med.name)}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Photo of ${med.name}. Opens full screen`}
      hitSlop={6}
    >
      {img}
    </Pressable>
  );
}

const usePhotoViewer = create<{ uri: string | null; title: string; open(uri: string, title: string): void; close(): void }>()((set) => ({
  uri: null,
  title: '',
  open: (uri, title) => set({ uri, title }),
  close: () => set({ uri: null }),
}));

export const openPhoto = (uri: string, title: string) => {
  haptic.press();
  usePhotoViewer.getState().open(uri, title);
};

/** Full-screen photo with a soft zoom-in; pinch to zoom on iOS, tap anywhere to close. */
export function PhotoViewerHost() {
  const { uri, title, close } = usePhotoViewer();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [v] = useState(() => new Animated.Value(0));
  const side = Math.min(width - 32, height * 0.62);

  useEffect(() => {
    if (!uri) return;
    v.setValue(0);
    Animated.spring(v, { toValue: 1, useNativeDriver: ND, speed: 14, bounciness: 6 }).start();
  }, [uri, v]);

  const dismiss = () => {
    haptic.tap();
    Animated.timing(v, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: ND }).start(() => close());
  };

  return (
    <Modal visible={!!uri} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,12,10,0.92)', opacity: v }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close photo" />
        <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }] }}>
            <ScrollView
              style={{ width: side, height: side, borderRadius: 28 }}
              contentContainerStyle={{ width: side, height: side }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              {uri && <Image source={{ uri }} resizeMode="cover" style={{ width: side, height: side }} accessibilityIgnoresInvertColors />}
            </ScrollView>
          </Animated.View>
          <Animated.View style={{ opacity: v, marginTop: 22, alignItems: 'center' }}>
            <Text v="h2" style={{ color: '#F4F0E6', fontSize: 30, lineHeight: 34 }} center>
              {title}
            </Text>
            <Text v="sub" style={{ color: 'rgba(244,240,230,0.65)', marginTop: 6 }} center>
              Tap anywhere to close
            </Text>
          </Animated.View>
        </View>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          hitSlop={10}
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <Icon name="x" size={20} color="#F4F0E6" stroke={2.2} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  close: { position: 'absolute', right: 18, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
});
