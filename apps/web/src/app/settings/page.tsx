import type { Metadata } from 'next';
import { SettingsScreen } from '@/components/web-core/settings/SettingsScreen';

export const metadata: Metadata = {
  title: 'Impostazioni',
  robots: { index: false },
};

export default function SettingsPage() {
  return <SettingsScreen />;
}
