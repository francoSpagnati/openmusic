import React from 'react';
import { notFound } from 'next/navigation';
import { getReleaseGroup } from './data';

/**
 * Resolves the album before the page's `loading.tsx` boundary starts streaming, so an unknown id
 * answers with a real HTTP 404. `getReleaseGroup` is cached per request: the page reuses it.
 * `notFound()` here is caught by `app/albums/not-found.tsx`.
 */
export default async function AlbumLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  if (!(await getReleaseGroup(groupId))) notFound();
  return children;
}
