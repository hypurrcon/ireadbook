import { useEffect, useRef, useState } from 'react';

/** Keep the screen on while `on` (Wake Lock API, re-acquired when the page becomes visible). */
export function useWakeLock(on: boolean) {
  const lock = useRef<any>(null);
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let alive = true;
    const get = async () => {
      try { lock.current = await (navigator as any).wakeLock.request('screen'); } catch { /* denied or unsupported */ }
    };
    const vis = () => { if (alive && document.visibilityState === 'visible') get(); };
    get();
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; document.removeEventListener('visibilitychange', vis); lock.current?.release?.(); lock.current = null; };
  }, [on]);
}

export type FaceState = 'unknown' | 'up' | 'down';

/** Is the phone lying face down? Uses device orientation (beta near ±180). */
export function useFaceDown(enabled: boolean) {
  const [state, setState] = useState<FaceState>('unknown');
  const [permission, setPermission] = useState<'unknown' | 'needed' | 'granted' | 'denied' | 'unsupported'>('unknown');

  useEffect(() => {
    if (!enabled) return;
    const DOE = (window as any).DeviceOrientationEvent;
    if (!DOE) { setPermission('unsupported'); return; }
    if (typeof DOE.requestPermission === 'function' && permission !== 'granted') { setPermission('needed'); return; }
    let seen = false;
    const onOri = (e: DeviceOrientationEvent) => {
      if (e.beta === null) return;
      seen = true;
      const down = Math.abs(e.beta) > 150 || (Math.abs(e.beta) > 120 && Math.abs(e.gamma ?? 0) < 30);
      setState(down ? 'down' : 'up');
    };
    window.addEventListener('deviceorientation', onOri);
    const t = setTimeout(() => { if (!seen) setPermission('unsupported'); else setPermission('granted'); }, 1500);
    return () => { window.removeEventListener('deviceorientation', onOri); clearTimeout(t); };
  }, [enabled, permission]);

  const request = async () => {
    try {
      const r = await (window as any).DeviceOrientationEvent.requestPermission();
      setPermission(r === 'granted' ? 'granted' : 'denied');
    } catch { setPermission('denied'); }
  };
  return { state, permission, request };
}
