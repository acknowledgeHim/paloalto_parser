import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { NavBar } from './components/NavBar.js';
import { Screensaver } from './components/Screensaver.js';
import { CelebrationHost } from './components/Celebration.js';
import { Dashboard } from './pages/Dashboard.js';
import { CalendarPage } from './pages/CalendarPage.js';
import { TasksPage } from './pages/TasksPage.js';
import { MealsPage } from './pages/MealsPage.js';
import { ContactsPage } from './pages/ContactsPage.js';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage.js';
import { PrizeBankPage } from './pages/PrizeBankPage.js';
import { PastPrizesPage } from './pages/PastPrizesPage.js';
import { FamilyBoardPage } from './pages/FamilyBoardPage.js';
import { PersonPage } from './pages/PersonPage.js';
import { BankPage } from './pages/BankPage.js';
import { MusicPage } from './pages/MusicPage.js';
import { PhotosPage } from './pages/PhotosPage.js';
import { IntercomPage } from './pages/IntercomPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { InternetPage } from './pages/InternetPage.js';
import { PasswordsPage } from './pages/PasswordsPage.js';
import { TypingPage } from './pages/TypingPage.js';
import { PeoplePage } from './pages/PeoplePage.js';
import { ApprovalsPage } from './pages/ApprovalsPage.js';
import { CamerasPage } from './pages/CamerasPage.js';
import { CameraAgent } from './components/CameraAgent.js';
import { DressUpPage } from './pages/DressUpPage.js';
import { JournalPage } from './pages/JournalPage.js';
import { HeightsPage } from './pages/HeightsPage.js';
import { NotesPage } from './components/StickyNotes.js';
import { RecapPage } from './components/RecapStory.js';
import { MorningBriefing, OPEN_BRIEFING, briefingDue, markBriefingShown } from './components/MorningBriefing.js';
import { useIdle } from './hooks/useIdle.js';
import { api } from './api/client.js';
import { useFamilyMembers } from './state/FamilyMemberContext.js';
import { SectionGate } from './state/SectionAccess.js';
import { isPersonalDevice } from './utils/device.js';

export function App() {
  const { activeProfile, setActiveProfile } = useFamilyMembers();
  const [idleTimeoutMs, setIdleTimeoutMs] = useState(5 * 60 * 1000);
  const [slideshowIntervalSec, setSlideshowIntervalSec] = useState(12);
  const [dismissed, setDismissed] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  // ☀️ The morning briefing, over everything until "Let's go!".
  const [briefing, setBriefing] = useState(false);

  useEffect(() => {
    const load = () =>
      api
        .get<Record<string, string>>('/settings')
        .then((s) => {
          setIdleTimeoutMs(Number(s.idle_timeout_seconds) * 1000);
          setSlideshowIntervalSec(Number(s.slideshow_interval_seconds));
          setSettings(s);
        })
        .catch(() => {});
    load();
    // Pick up a change made on another screen (turning the briefing on…) now and then.
    const t = setInterval(load, 10 * 60_000);
    const open = () => setBriefing(true);
    window.addEventListener(OPEN_BRIEFING, open);
    return () => {
      clearInterval(t);
      window.removeEventListener(OPEN_BRIEFING, open);
    };
  }, []);

  // Someone's own phone: no screensaver and no forgetting who's logged in when it sits idle.
  const personal = isPersonalDevice();
  const idle = useIdle(idleTimeoutMs) && !personal;
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

  // The first time the wall screen is woken (or loaded) in the morning, the briefing comes up.
  useEffect(() => {
    if (showSlideshow || personal || !briefingDue(settings)) return;
    markBriefingShown();
    setBriefing(true);
  }, [showSlideshow, personal, settings]);

  // 📹 A tablet that's a camera keeps being one under the screensaver too (same place in the tree,
  // so it isn't restarted when the screensaver comes and goes).
  if (showSlideshow) {
    return (
      <>
        <CameraAgent />
        <Screensaver intervalSeconds={slideshowIntervalSec} recap={settings.recap_off !== '1'} onExit={() => setDismissed(true)} />
      </>
    );
  }

  return (
    <>
    <CameraAgent />
    <HashRouter>
      <NavBar />
      <CelebrationHost />
      {briefing && <MorningBriefing onClose={() => setBriefing(false)} />}
      <main className="page-container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/calendar" element={<SectionGate section="calendar"><CalendarPage /></SectionGate>} />
          <Route path="/tasks" element={<SectionGate section="tasks"><TasksPage /></SectionGate>} />
          <Route path="/meals" element={<SectionGate section="meals"><MealsPage /></SectionGate>} />
          <Route path="/contacts" element={<SectionGate section="contacts"><ContactsPage /></SectionGate>} />
          <Route path="/knowledge-base" element={<SectionGate section="knowledge-base"><KnowledgeBasePage /></SectionGate>} />
          <Route path="/prizes" element={<SectionGate section="prizes"><PrizeBankPage /></SectionGate>} />
          <Route path="/prizes/past/:id" element={<SectionGate section="prizes"><PastPrizesPage /></SectionGate>} />
          <Route path="/dress-up" element={<SectionGate section="prizes"><DressUpPage /></SectionGate>} />
          <Route path="/dress-up/:id" element={<SectionGate section="prizes"><DressUpPage /></SectionGate>} />
          <Route path="/journal" element={<SectionGate section="board"><JournalPage /></SectionGate>} />
          <Route path="/heights" element={<SectionGate section="board"><HeightsPage /></SectionGate>} />
          <Route path="/notes" element={<SectionGate section="board"><NotesPage /></SectionGate>} />
          <Route path="/recap" element={<SectionGate section="board"><RecapPage /></SectionGate>} />
          <Route path="/board" element={<SectionGate section="board"><FamilyBoardPage /></SectionGate>} />
          {/* A person's page is reached from the Family Board; their bank from the Prize Bank. */}
          <Route path="/person/:id" element={<SectionGate section="board"><PersonPage /></SectionGate>} />
          <Route path="/person/:id/bank" element={<SectionGate section="prizes"><BankPage /></SectionGate>} />
          <Route path="/music" element={<SectionGate section="music"><MusicPage /></SectionGate>} />
          <Route path="/photos" element={<SectionGate section="photos"><PhotosPage /></SectionGate>} />
          <Route path="/photos/people" element={<SectionGate section="photos"><PeoplePage /></SectionGate>} />
          <Route path="/intercom" element={<SectionGate section="intercom"><IntercomPage /></SectionGate>} />
          <Route path="/internet" element={<SectionGate section="internet"><InternetPage /></SectionGate>} />
          <Route path="/passwords" element={<PasswordsPage />} />
          <Route path="/typing" element={<TypingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/cameras" element={<CamerasPage />} />
        </Routes>
      </main>
    </HashRouter>
    </>
  );
}
