import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCursorList, type CursorPage } from '../useCursorList';

type Item = { id: string };

describe('useCursorList', () => {
  it('loads page 1, appends the next page deduped by id, and stops at the last cursor', async () => {
    const pages: Record<string, CursorPage<Item>> = {
      first: { items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'c2' },
      c2: { items: [{ id: 'b' }, { id: 'c' }], nextCursor: null },
    };
    const fetchPage = jest.fn(async (cursor: string | undefined): Promise<CursorPage<Item>> => {
      const page = pages[cursor ?? 'first'];
      if (!page) throw new Error(`unexpected cursor ${cursor}`);
      return page;
    });
    const { result } = await renderHook(() => useCursorList<Item>(fetchPage, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((x) => x.id)).toEqual(['a', 'b']);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.items.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.hasMore).toBe(false);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('keeps the list and exposes loadMoreError when a later page fails', async () => {
    const fetchPage = jest.fn(async (cursor: string | undefined): Promise<CursorPage<Item>> => {
      if (cursor) throw new Error('offline');
      return { items: [{ id: 'a' }], nextCursor: 'next' };
    });
    const { result } = await renderHook(() => useCursorList<Item>(fetchPage, []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.items).toEqual([{ id: 'a' }]);
    expect(result.current.loadMoreError).toBeInstanceOf(Error);
    expect(result.current.error).toBeNull();
  });
});
