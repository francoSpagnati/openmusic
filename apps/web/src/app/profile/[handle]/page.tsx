import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { ProfileView } from '@/components/web-core/profile/ProfileView';
import { displayNameOf, isUuid } from '@/components/web-core/format';

interface Props {
  params: Promise<{ handle: string }>;
}

/** Public profile (`/profile/<username>` or `/profile/<id>`), with server-side metadata for SEO. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = decodeURIComponent((await params).handle);
  try {
    const profile = isUuid(handle)
      ? await api.profile.byId(handle)
      : await api.profile.byUsername(handle);
    const name = displayNameOf(profile.user);
    const description =
      profile.user.bio?.slice(0, 160) ||
      `${name} su OpenMusic: ${profile.social.postsCount} post e ${profile.stats.totalReviews} recensioni.`;
    return {
      title: `${name} (@${profile.user.username})`,
      description,
      alternates: { canonical: `/profile/${profile.user.username}` },
      openGraph: {
        title: `${name} su OpenMusic`,
        description,
        type: 'profile',
        username: profile.user.username,
        images: profile.user.avatarUrl ? [profile.user.avatarUrl] : undefined,
      },
    };
  } catch {
    // Unknown user or API down: the page itself shows the right state.
    return { title: 'Profilo', robots: { index: false } };
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const { handle } = await params;
  return <ProfileView handle={decodeURIComponent(handle)} />;
}
