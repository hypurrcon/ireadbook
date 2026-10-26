import { create } from 'zustand';

interface InstallState { prompt: any | null; installed: boolean }
export const useInstall = create<InstallState>(() => ({
  prompt: null,
  installed: typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); useInstall.setState({ prompt: e }); });
  window.addEventListener('appinstalled', () => useInstall.setState({ installed: true, prompt: null }));
}

export const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Ask the browser to keep our IndexedDB data even under storage pressure. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}
