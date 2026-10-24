import React from 'react';

/**
 * One titled block of the settings page; `id` is the in-page anchor. Open layout: a hairline
 * above, title and description on the left measure, controls below. No card chrome.
 */
export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  /** @deprecated No longer shown: section titles carry the context on their own. */
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      id={id}
      className="scroll-mt-20 border-t border-line pb-4 pt-10"
    >
      <h2 id={`${id}-title`} className="om-headline text-2xl text-fg">
        {title}
      </h2>
      {description && <p className="mt-2 max-w-prose text-sm text-fg-muted">{description}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}
