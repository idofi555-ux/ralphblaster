import { getSettings } from '@/lib/settings';
import SettingsPageClient from '@/components/settings/SettingsPageClient';

export default async function SettingsPage() {
  const settings = await getSettings();

  return <SettingsPageClient initialSettings={settings} />;
}
