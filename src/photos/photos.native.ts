import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

// Medicine photos live in the app's private documents folder. Medications store only the
// file name, never an absolute path: iOS can move the app container between updates.
const dir = () => new Directory(Paths.document, 'photos');

/** Only plain file names we created ourselves are accepted (no paths from backups). */
export const isPhotoName = (name: unknown): name is string => typeof name === 'string' && /^med-[a-z0-9-]+\.jpg$/i.test(name);

export function photoUri(name: string | null | undefined): string | null {
  if (!isPhotoName(name)) return null;
  const f = new File(dir(), name);
  return f.exists ? f.uri : null;
}

function ensureDir() {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true });
}

const newName = () => `med-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;

/** Opens the camera or photo library, saves a square, compressed copy, and returns its file name. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access is off', 'Allow camera access in Settings to photograph your medicine.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return null;
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled || !res.assets?.length) return null;
  ensureDir();
  const name = newName();
  await new File(res.assets[0].uri).copy(new File(dir(), name));
  return name;
}

export function deletePhoto(name: string | null | undefined) {
  if (!isPhotoName(name)) return;
  try {
    const f = new File(dir(), name);
    if (f.exists) f.delete();
  } catch {
    // Already gone; nothing to clean up.
  }
}

export async function readPhotoBase64(name: string): Promise<string | null> {
  if (!isPhotoName(name)) return null;
  const f = new File(dir(), name);
  return f.exists ? f.base64() : null;
}

export function writePhotoBase64(name: string, base64: string) {
  if (!isPhotoName(name)) return;
  ensureDir();
  const f = new File(dir(), name);
  if (f.exists) f.delete();
  f.create();
  f.write(base64, { encoding: 'base64' });
}

/** Removes photo files no medication refers to any more (e.g. a photo taken in a cancelled wizard). */
export function cleanOrphanPhotos(keep: Set<string>) {
  try {
    const d = dir();
    if (!d.exists) return;
    for (const entry of d.list()) {
      if (entry instanceof File && isPhotoName(entry.name) && !keep.has(entry.name)) entry.delete();
    }
  } catch {
    // Best effort only.
  }
}
