import { create } from 'zustand';
import * as repo from '../lib/messages';
import type { NewMessage } from '../lib/messages';
import type { Message } from '../lib/types';
import { isAbortError } from '../lib/useLatestRequest';

type Status = 'idle' | 'loading' | 'ready' | 'error';

/**
 * `items` is the Latest Whispers feed. `results` holds Browse search results.
 *
 * These are deliberately separate lists. They used to share one `items` array,
 * which meant a Browse search silently overwrote the feed: navigate back to
 * Home and Latest Whispers rendered the search results instead of the latest
 * messages. Keeping them apart makes each consumer read what it actually wants
 * and removes the cross-page contamination entirely.
 */
interface MessagesState {
  items: Message[];
  status: Status;
  error: string | null;
  results: Message[];
  resultStatus: Status;
  resultError: string | null;
  load: (signal?: AbortSignal) => Promise<void>;
  search: (recipient: string, signal?: AbortSignal) => Promise<void>;
  send: (payload: NewMessage) => Promise<Message>;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  items: [],
  status: 'idle',
  error: null,
  results: [],
  resultStatus: 'idle',
  resultError: null,

  load: async (signal?: AbortSignal) => {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: null });
    try {
      set({ items: await repo.listMessages(signal), status: 'ready' });
    } catch (error) {
      if (isAbortError(error)) {
        // A cancelled load must release the `loading` guard, otherwise the
        // next caller sees "loading" and returns without ever fetching.
        set({ status: 'idle' });
        return;
      }
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not load messages',
      });
    }
  },

  search: async (recipient, signal?: AbortSignal) => {
    const trimmed = recipient.trim();

    // An empty term clears the results instead of repopulating the feed. The
    // old code called `load()` here, which is what let a search round-trip
    // back into the Latest Whispers feed.
    if (!trimmed) {
      set({ results: [], resultStatus: 'idle', resultError: null });
      return;
    }

    set({ resultError: null, resultStatus: 'loading' });
    try {
      set({ results: await repo.findMessages(trimmed, signal), resultStatus: 'ready' });
    } catch (error) {
      if (isAbortError(error)) {
        set({ resultStatus: 'idle' });
        return;
      }
      set({
        resultStatus: 'error',
        resultError: error instanceof Error ? error.message : 'Search failed',
      });
    }
  },

  send: async (payload) => {
    const created = await repo.sendMessage(payload);
    // Only the feed is updated. A stale search result list is left alone
    // rather than being quietly rewritten from under the Browse page.
    set({ items: [created, ...get().items].slice(0, 100) });
    return created;
  },
}));