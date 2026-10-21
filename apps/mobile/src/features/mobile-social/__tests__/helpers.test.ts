import { bestTrackLink } from '../MusicChatBubble';
import { describeNotification, notificationTarget } from '../notificationText';
import { parseVibeTags } from '../PostComposerSheet';
import { ELENA_ID, notification } from '../__fixtures__/social';

describe('notification copy and targets', () => {
  it('describes each type in Italian', () => {
    expect(describeNotification(notification())).toBe('Elena Rossi ha iniziato a seguirti');
    expect(
      describeNotification(
        notification({ type: 'POST_LIKE', post: { id: ELENA_ID, excerpt: 'Ciao' } })
      )
    ).toBe('Elena Rossi ha apprezzato il tuo post: “Ciao”');
    expect(
      describeNotification(
        notification({
          type: 'TRACK_LISTENED',
          track: { id: ELENA_ID, title: 'Reckoner', artistName: 'Radiohead' },
        })
      )
    ).toBe('Elena Rossi ha ascoltato “Reckoner” di Radiohead');
    expect(describeNotification(notification({ type: 'CRITIC_APPROVED', actor: null }))).toBe(
      'Il tuo accredito da critico è stato approvato'
    );
  });

  it('routes to the profile, release or chat the notification is about', () => {
    expect(notificationTarget(notification())).toBe(`/profile/${ELENA_ID}`);
    expect(notificationTarget(notification({ type: 'TRACK_LISTENED' }))).toBe(`/chat/${ELENA_ID}`);
    const releaseId = '55555555-5555-4555-8555-555555555555';
    expect(
      notificationTarget(
        notification({
          type: 'REVIEW_REACTION',
          review: { id: ELENA_ID, releaseId, releaseTitle: 'In Rainbows', artistName: 'Radiohead' },
        })
      )
    ).toBe(`/release/${releaseId}`);
    expect(notificationTarget(notification({ type: 'CRITIC_APPROVED', actor: null }))).toBe(
      '/profile'
    );
    expect(notificationTarget(notification({ type: 'POST_LIKE', actor: null }))).toBeNull();
  });
});

describe('parseVibeTags', () => {
  it('splits on commas and spaces and drops empty / bare "#" tags', () => {
    expect(parseVibeTags('#notturno, malinconico  #  ,, #lo-fi')).toEqual([
      '#notturno',
      'malinconico',
      '#lo-fi',
    ]);
    expect(parseVibeTags('   ')).toEqual([]);
  });
});

describe('bestTrackLink', () => {
  it('prefers streaming apps and falls back to OpenMusic', () => {
    expect(
      bestTrackLink({
        openmusic: 'https://o.test/t',
        deezer: 'https://d.test/t',
        spotify: 'https://s.test/t',
      })
    ).toBe('https://s.test/t');
    expect(bestTrackLink({ openmusic: 'https://o.test/t', spotify: null })).toBe(
      'https://o.test/t'
    );
    expect(bestTrackLink(null)).toBeNull();
  });
});
