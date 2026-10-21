import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LoginInputSchema, RegisterInputSchema, UpdateProfileSchema } from '../src/auth';
import { CreatePostInputSchema, FeedQuerySchema } from '../src/feed';
import { NotificationsQuerySchema } from '../src/notifications';

describe('RegisterInputSchema', () => {
  it('normalises email and username and defaults favoriteGenres', () => {
    const parsed = RegisterInputSchema.parse({
      email: '  Elena@Example.COM ',
      username: 'Elena_R',
      password: 'abcdefghij',
    });
    expect(parsed).toEqual({
      email: 'elena@example.com',
      username: 'elena_r',
      password: 'abcdefghij',
      favoriteGenres: [],
    });
  });

  it.each([
    ['short password', { password: 'short' }],
    ['username with spaces', { username: 'two words' }],
    ['too many genres', { favoriteGenres: Array.from({ length: 11 }, (_, i) => `g${i}`) }],
  ])('rejects %s', (_label, override) => {
    const base = { email: 'a@b.co', username: 'valid_name', password: 'long enough pw' };
    expect(RegisterInputSchema.safeParse({ ...base, ...override }).success).toBe(false);
  });
});

describe('LoginInputSchema', () => {
  it('does not apply the password policy on login', () => {
    expect(LoginInputSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
});

describe('UpdateProfileSchema', () => {
  it('is strict, so privileged fields cannot be smuggled in', () => {
    expect(UpdateProfileSchema.safeParse({ role: 'ADMIN' }).success).toBe(false);
    expect(UpdateProfileSchema.safeParse({ bio: 'ciao' }).success).toBe(true);
  });
});

describe('CreatePostInputSchema', () => {
  it('requires an attachment when a rating is given', () => {
    expect(CreatePostInputSchema.safeParse({ content: 'x', rating: 80 }).success).toBe(false);
    expect(
      CreatePostInputSchema.safeParse({ content: 'x', rating: 80, releaseId: randomUUID() }).success
    ).toBe(true);
  });

  it('trims content and rejects blank posts', () => {
    expect(CreatePostInputSchema.parse({ content: '  hi ' }).content).toBe('hi');
    expect(CreatePostInputSchema.safeParse({ content: '   ' }).success).toBe(false);
  });
});

describe('query schemas', () => {
  it('coerce and default pagination params from query strings', () => {
    expect(FeedQuerySchema.parse({})).toEqual({ limit: 20, scope: 'following' });
    expect(FeedQuerySchema.parse({ limit: '5', scope: 'global' })).toEqual({
      limit: 5,
      scope: 'global',
    });
    expect(FeedQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
    expect(NotificationsQuerySchema.parse({ unreadOnly: 'true' }).unreadOnly).toBe(true);
  });
});
