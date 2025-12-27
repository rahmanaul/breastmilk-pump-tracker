import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'fake-indexeddb/auto';
import {
  queueMutation,
  getQueuedMutations,
  removeMutation,
  updateMutationRetryCount,
  getQueuedCount,
  clearQueue,
} from './offlineQueue';

describe('offlineQueue', () => {
  // Clean up before and after all tests
  beforeAll(async () => {
    await clearQueue();
  });

  afterAll(async () => {
    await clearQueue();
  });

  describe('queueMutation', () => {
    it('should queue a mutation and return an id', async () => {
      const id = await queueMutation('sessions.start', { type: 'regular' });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id).toContain('sessions.start');

      // Clean up
      await removeMutation(id);
    });

    it('should generate unique ids for each mutation', async () => {
      const id1 = await queueMutation('sessions.start', { type: 'regular' });
      const id2 = await queueMutation('sessions.start', { type: 'power' });

      expect(id1).not.toBe(id2);

      // Clean up
      await removeMutation(id1);
      await removeMutation(id2);
    });

    it('should store mutation with correct structure', async () => {
      const beforeQueue = Date.now();
      const id = await queueMutation('sessions.complete', { duration: 1800 });
      const afterQueue = Date.now();

      const mutations = await getQueuedMutations();
      const mutation = mutations.find(m => m.id === id);

      expect(mutation).toBeDefined();
      expect(mutation).toMatchObject({
        functionName: 'sessions.complete',
        args: { duration: 1800 },
        retryCount: 0,
      });
      expect(mutation!.timestamp).toBeGreaterThanOrEqual(beforeQueue);
      expect(mutation!.timestamp).toBeLessThanOrEqual(afterQueue);

      // Clean up
      await removeMutation(id);
    });
  });

  describe('getQueuedMutations', () => {
    it('should return all queued mutations', async () => {
      // Ensure queue is empty
      await clearQueue();

      const id1 = await queueMutation('sessions.start', { type: 'regular' });
      const id2 = await queueMutation('sessions.complete', { duration: 1800 });

      const mutations = await getQueuedMutations();

      expect(mutations.length).toBeGreaterThanOrEqual(2);

      // Clean up
      await removeMutation(id1);
      await removeMutation(id2);
    });
  });

  describe('removeMutation', () => {
    it('should remove a mutation by id', async () => {
      const id = await queueMutation('sessions.start', { type: 'regular' });
      const countBefore = await getQueuedCount();

      await removeMutation(id);

      const countAfter = await getQueuedCount();

      expect(countAfter).toBe(countBefore - 1);
    });

    it('should not affect other mutations when removing one', async () => {
      const id1 = await queueMutation('sessions.start', { type: 'regular' });
      const id2 = await queueMutation('sessions.complete', { duration: 1800 });

      await removeMutation(id1);

      const mutations = await getQueuedMutations();
      const remaining = mutations.find(m => m.id === id2);

      expect(remaining).toBeDefined();
      expect(remaining!.functionName).toBe('sessions.complete');

      // Clean up
      await removeMutation(id2);
    });
  });

  describe('updateMutationRetryCount', () => {
    it('should update retry count for a mutation', async () => {
      const id = await queueMutation('sessions.start', { type: 'regular' });
      await updateMutationRetryCount(id, 2);

      const mutations = await getQueuedMutations();
      const updated = mutations.find(m => m.id === id);

      expect(updated!.retryCount).toBe(2);

      // Clean up
      await removeMutation(id);
    });

    it('should handle updating non-existent mutation gracefully', async () => {
      // Should not throw
      await expect(updateMutationRetryCount('non-existent-id', 1)).resolves.not.toThrow();
    });
  });

  describe('getQueuedCount', () => {
    it('should return correct count of queued mutations', async () => {
      // Clear and add specific items
      await clearQueue();

      const id1 = await queueMutation('sessions.start', { type: 'regular' });
      const id2 = await queueMutation('sessions.complete', { duration: 1800 });
      const id3 = await queueMutation('preferences.save', { goal: 300 });

      const count = await getQueuedCount();

      expect(count).toBe(3);

      // Clean up
      await removeMutation(id1);
      await removeMutation(id2);
      await removeMutation(id3);
    });
  });

  describe('clearQueue', () => {
    it('should clear all queued mutations', async () => {
      await queueMutation('sessions.start', { type: 'regular' });
      await queueMutation('sessions.complete', { duration: 1800 });

      await clearQueue();

      const count = await getQueuedCount();

      expect(count).toBe(0);
    });

    it('should work on empty queue', async () => {
      await clearQueue();
      await clearQueue();

      const count = await getQueuedCount();

      expect(count).toBe(0);
    });
  });
});
