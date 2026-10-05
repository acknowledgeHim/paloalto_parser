import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { NavBar } from './components/NavBar.js';
import { Screensaver } from './components/Screensaver.js';
import { Dashboard } from './pages/Dashboard.js';
import { CalendarPage } from './pages/CalendarPage.js';
import { TasksPage } from './pages/TasksPage.js';
import { MealsPage } from './pages/MealsPage.js';
import { ContactsPage } from './pages/ContactsPage.js';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage.js';
import { PrizeBankPage } from './pages/PrizeBankPage.js';
import { FamilyBoardPage } from './pages/FamilyBoardPage.js';
import { PersonPage } from './pages/PersonPage.js';
import { BankPage } from './pages/BankPage.js';
import { MusicPage } from './pages/MusicPage.js';
import { PhotosPage } from './pages/PhotosPage.js';
import { IntercomPage } from './pages/IntercomPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { InternetPage } from './pages/InternetPage.js';
import { useIdle } from './hooks/useIdle.js';
import { api } from './api/client.js';
import { useFamilyMembers } from './state/FamilyMemberContext.js';
import { SectionGate } from './state/SectionAccess.js';

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
    return <Screensaver intervalSeconds={slideshowIntervalSec} onExit={() => setDismissed(true)} />;
  }

  return (
    <HashRouter>
      <NavBar />
      <main className="page-container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<SectionGate section="calendar"><CalendarPage /></SectionGate>} />
          <Route path="/tasks" element={<SectionGate section="tasks"><TasksPage /></SectionGate>} />
          <Route path="/meals" element={<SectionGate section="meals"><MealsPage /></SectionGate>} />
          <Route path="/contacts" element={<SectionGate section="contacts"><ContactsPage /></SectionGate>} />
          <Route path="/knowledge-base" element={<SectionGate section="knowledge-base"><KnowledgeBasePage /></SectionGate>} />
          <Route path="/prizes" element={<SectionGate section="prizes"><PrizeBankPage /></SectionGate>} />
          <Route path="/board" element={<SectionGate section="board"><FamilyBoardPage /></SectionGate>} />
          {/* A person's page is reached from the Family Board; their bank from the Prize Bank. */}
          <Route path="/person/:id" element={<SectionGate section="board"><PersonPage /></SectionGate>} />
          <Route path="/person/:id/bank" element={<SectionGate section="prizes"><BankPage /></SectionGate>} />
          <Route path="/music" element={<SectionGate section="music"><MusicPage /></SectionGate>} />
          <Route path="/photos" element={<SectionGate section="photos"><PhotosPage /></SectionGate>} />
          <Route path="/intercom" element={<SectionGate section="intercom"><IntercomPage /></SectionGate>} />
          <Route path="/internet" element={<SectionGate section="internet"><InternetPage /></SectionGate>} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
