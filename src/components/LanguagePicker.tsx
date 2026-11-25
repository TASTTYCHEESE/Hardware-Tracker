import type { AppData } from '../lib/useData';
import { LANGS } from '../lib/i18n';

/** Language menu (languages listed most spoken first; names in their own language, never translated). */
export function LanguagePicker({ data, compact }: { data: AppData; compact?: boolean }) {
  const cur = data.settings.language ?? 'en';
  return (
    <select
      className={compact ? 'select lang-pick' : 'select'}
      translate="no"
      value={cur}
      title="Language"
      aria-label="Language"
      onChange={(e) => data.setSettings({ language: e.target.value })}
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {compact ? '🌐 ' : ''}
          {l.name}
          {l.name !== l.english ? ` (${l.english})` : ''}
        </option>
      ))}
    </select>
  );
}
