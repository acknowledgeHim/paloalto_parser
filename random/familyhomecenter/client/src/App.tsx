import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { NavBar } from './components/NavBar.js';
import { Slideshow } from './components/Slideshow.js';
import { Dashboard } from './pages/Dashboard.js';
import { CalendarPage } from './pages/CalendarPage.js';
import { TasksPage } from './pages/TasksPage.js';
import { MealsPage } from './pages/MealsPage.js';
import { PrizeBankPage } from './pages/PrizeBankPage.js';
import { FamilyBoardPage } from './pages/FamilyBoardPage.js';
import { PersonPage } from './pages/PersonPage.js';
import { MusicPage } from './pages/MusicPage.js';
import { PhotosPage } from './pages/PhotosPage.js';
import { IntercomPage } from './pages/IntercomPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { useIdle } from './hooks/useIdle.js';
import { api } from './api/client.js';
import { useFamilyMembers } from './state/FamilyMemberContext.js';

export function App() {
  const { activeProfile, setActiveProfile } = useFamilyMembers();
  const [idleTimeoutMs, setIdleTimeoutMs] = useState(5 * 60 * 1000);
  const [slideshowIntervalSec, setSlideshowIntervalSec] = useState(12);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api
      .get<{ idle_timeout_seconds: string; slideshow_interval_seconds: string }>('/settings')
      .then((s) => {
        setIdleTimeoutMs(Number(s.idle_timeout_seconds) * 1000);
        setSlideshowIntervalSec(Number(s.slideshow_interval_seconds));
      })
      .catch(() => {});
  }, []);

  const idle = useIdle(idleTimeoutMs);
  const showSlideshow = idle && !dismissed;

  useEffect(() => {
    if (!idle) setDismissed(false);
  }, [idle]);

  // Nobody's here — forget who was picked (and drop any parent/kid login) so the next person sees
  // "Who's this?" instead of walking up to someone else's still-active profile.
  useEffect(() => {
    if (!idle || !activeProfile) return;
    api.post('/auth/logout').catch(() => {});
    setActiveProfile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle]);

  if (showSlideshow) {
    return <Slideshow intervalSeconds={slideshowIntervalSec} onExit={() => setDismissed(true)} />;
  }

  return (
    <HashRouter>
      <NavBar />
      <main className="page-container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/prizes" element={<PrizeBankPage />} />
          <Route path="/board" element={<FamilyBoardPage />} />
          <Route path="/person/:id" element={<PersonPage />} />
          <Route path="/music" element={<MusicPage />} />
          <Route path="/photos" element={<PhotosPage />} />
          <Route path="/intercom" element={<IntercomPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
