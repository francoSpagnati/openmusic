import React from 'react';
import { Card } from '@/components/ui';

/** One titled block of the settings page; `id` is the in-page anchor. */
export function SettingsSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      as="section"
      aria-labelledby={`${id}-title`}
      id={id}
      padding="lg"
      className="scroll-mt-20"
    >
      <p className="om-eyebrow">{eyebrow}</p>
      <h2 id={`${id}-title`} className="om-headline mt-1 text-2xl text-ink">
        {title}
      </h2>
      {description && <p className="mt-1 max-w-prose text-sm text-ink-secondary">{description}</p>}
      <div className="mt-6">{children}</div>
    </Card>
  );
}
