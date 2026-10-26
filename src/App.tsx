import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { TabBar } from './ui/TabBar';
import { Toasts } from './ui/kit';
import { useSettingsLoaded } from './hooks/data';
import { applyTokens } from './rooms/tokens';
import { setVolumes, setMuted, unlockAudio } from './audio/sound';
import { resumeQueue, retryPendingLookups } from './state/queue';
import { useAchievementWatcher } from './state/rewards';
import { onboardedNow } from './state/onboard';
import { startSync } from './sync/manager';
import './styles/ui.css';
import './styles/screens.css';

const Shelf = lazy(() => import('./screens/Shelf'));
const Read = lazy(() => import('./screens/Read'));
const AddBook = lazy(() => import('./screens/AddBook'));
const Stats = lazy(() => import('./screens/Stats'));
const Assistant = lazy(() => import('./screens/Assistant'));
const Settings = lazy(() => import('./screens/Settings'));
const BookDetail = lazy(() => import('./screens/BookDetail'));
const ReviewQueue = lazy(() => import('./screens/ReviewQueue'));
const Onboarding = lazy(() => import('./screens/Onboarding'));

function Shell() {
  const settings = useSettingsLoaded();
  const loc = useLocation();
  useAchievementWatcher();
  useEffect(() => { if (settings) applyTokens(settings.room); }, [settings?.room]);
  useEffect(() => { if (settings) setVolumes(settings.volume); }, [settings?.volume]);
  useEffect(() => { setMuted(!!settings?.muted); }, [settings?.muted]);
  useEffect(() => {
    startSync();
    resumeQueue();
    retryPendingLookups();
    const on = () => retryPendingLookups();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, []);
  useEffect(() => {
    const once = () => unlockAudio();
    window.addEventListener('pointerdown', once, { once: true });
    return () => window.removeEventListener('pointerdown', once);
  }, []);
  if (!settings) return null;
  if (!settings.onboarded && !onboardedNow() && loc.pathname !== '/welcome' && loc.pathname !== '/add') return <Navigate to="/welcome" replace />;
  const hideTabs = (!settings.onboarded && !onboardedNow()) || loc.pathname === '/welcome' || loc.pathname.startsWith('/read/session');
  return (
    <>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Shelf />} />
          <Route path="/read/*" element={<Read />} />
          <Route path="/add" element={<AddBook />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/book/:id" element={<BookDetail />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {!hideTabs && <TabBar />}
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
