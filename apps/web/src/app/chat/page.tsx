import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ChatScreen } from '@/components/web-social/chat/ChatScreen';

export const metadata: Metadata = {
  title: 'Messaggi',
  description: 'Consiglia brani ai tuoi amici con anteprime di 30 secondi e link per ogni player.',
  robots: { index: false, follow: false },
};

export default function ChatPage() {
  // ChatScreen reads `?with=` with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <ChatScreen />
    </Suspense>
  );
}
