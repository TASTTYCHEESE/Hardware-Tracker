import { useEffect, useState } from 'react';

/** True while the device has no internet connection. */
export function useOnline() {
  const [on, setOn] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
}

/** "Offline" pill in the top bar: everything keeps working except news, recaps that weren't saved yet and updates. */
export function OfflineBadge({ phone }: { phone?: boolean }) {
  const online = useOnline();
  if (online) return null;
  return (
    <span className={phone ? 'offline-badge phone-only' : 'offline-badge'} title="No internet. Hardware specs, benchmarks, used prices, builds, your saved recaps and settings all still work. Live news, new recaps, translations of new text and app updates come back when you're online.">
      ● Offline
    </span>
  );
}

/** Short notice for pages that need the internet (news). */
export function OfflineNote({ what }: { what: string }) {
  const online = useOnline();
  if (online) return null;
  return <p className="card offline-note small">You're offline. {what} needs the internet; everything else in the app still works.</p>;
}
