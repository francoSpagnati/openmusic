import React from 'react';
import { notFound } from 'next/navigation';
import { getRelease, redirectLegacyId } from './data';

/**
 * Resolves the release before the page's `loading.tsx` boundary starts streaming, so an unknown
 * id answers with a real HTTP 404 (Next 16 streams metadata, so `generateMetadata` no longer
 * blocks the response). `getRelease` is cached per request: the page reuses this lookup.
 * `notFound()` here is caught by `app/releases/not-found.tsx`.
 */
export default async function ReleaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirectLegacyId(id);
  if (!(await getRelease(id))) notFound();
  return children;
}
