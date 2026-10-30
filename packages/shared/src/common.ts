import { z } from 'zod';

/**
 * A user-supplied link that ends up in an `href`/`src`. Only http(s) is accepted: `z.string().url()`
 * alone also accepts `javascript:` and `data:` URLs, which would be stored XSS once rendered.
 */
export const HttpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  // A regex, not `new URL()`: Zod runs refinements even after `.url()` failed, and must not throw.
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'Sono ammessi solo link http(s)',
  });

/**
 * A 30s preview URL as served by the API: an absolute URL (iTunes clips, which do not expire) or
 * a root-relative path (`/api/catalog/tracks/<id>/preview`, a redirect to a fresh Deezer URL,
 * whose signed links expire after ~15 minutes). Clients resolve the path against the API base.
 */
export const PreviewUrlSchema = z.union([
  z.string().url(),
  z.string().regex(/^\/(?!\/)/, 'Percorso o URL non valido'),
]);

/**
 * A vibe tag as stored: without the leading `#` (the UI adds it when rendering), so `#Notturno`
 * and `Notturno` are the same tag.
 */
export const VibeTagSchema = z
  .string()
  .trim()
  .transform((tag) => tag.replace(/^#+/, '').trim())
  .pipe(z.string().min(1).max(30));

/** Up to five vibe tags on a review or post. */
export const VibeTagsSchema = z.array(VibeTagSchema).max(5).default([]);

/** Route params carrying a single UUID (`/:id`). */
export const IdParamSchema = z.object({ id: z.string().uuid() });

/** Cursor pagination query shared by every list endpoint (`?cursor=...&limit=20`). */
export const CursorQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Builds `{ items, nextCursor }` page schemas. `nextCursor` is null on the last page. */
export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type IdParam = z.infer<typeof IdParamSchema>;
export type CursorQuery = z.infer<typeof CursorQuerySchema>;
