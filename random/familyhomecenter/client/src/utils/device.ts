/**
 * Is this someone's own device (a phone) rather than the shared screen on the wall? Then whoever's
 * logged in stays logged in until they tap "Log out" on purpose — no forgetting them (or showing
 * the screensaver) after a few idle minutes. Phones count by default; any device can be set either
 * way from the person menu ("Keep me logged in on this device").
 */
const KEY = 'familyhomecenter.device.personal';

export function isPersonalDevice(): boolean {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch {
    // no storage — fall through to the guess
  }
  // A phone: a small screen either way round.
  return Math.min(window.screen.width, window.screen.height) <= 600;
}

export function setPersonalDevice(personal: boolean): void {
  try {
    localStorage.setItem(KEY, personal ? '1' : '0');
  } catch {
    // not remembered — fine
  }
}
