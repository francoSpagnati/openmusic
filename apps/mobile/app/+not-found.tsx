import React from 'react';
import { router } from 'expo-router';
import { Button, EmptyState, Screen } from '../src/components/ui';

export default function NotFound() {
  return (
    <Screen edges={['top', 'bottom']}>
      <EmptyState
        title="Solco vuoto"
        description="Questa pagina non esiste o è stata spostata."
        action={<Button label="Torna alla home" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
