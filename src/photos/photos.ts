// Web preview: there's no app sandbox, so the photo is kept inline as a data URI in the
// medication record. Native builds resolve photos.native.ts instead.
import * as ImagePicker from 'expo-image-picker';

export const isPhotoName = (name: unknown): name is string => typeof name === 'string' && name.startsWith('data:image/');

export function photoUri(name: string | null | undefined): string | null {
  return isPhotoName(name) ? name : null;
}

export async function pickPhoto(_source: 'camera' | 'library'): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
  const a = res.canceled ? null : res.assets?.[0];
  if (!a) return null;
  return a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
}

export function deletePhoto(_name: string | null | undefined) {}

export async function readPhotoBase64(_name: string): Promise<string | null> {
  return null;
}

export function writePhotoBase64(_name: string, _base64: string) {}

export function cleanOrphanPhotos(_keep: Set<string>) {}
