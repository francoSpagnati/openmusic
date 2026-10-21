import { z } from 'zod';

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
