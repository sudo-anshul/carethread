import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEpisode } from '../core/model';
import { createWorkspacePersistence } from './workspacePersistence';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup() {
  const episode = createEpisode({ label: 'September visit', person: 'Demo Patient A' });
  const writer = { save: vi.fn().mockResolvedValue(undefined), clear: vi.fn().mockResolvedValue(undefined) };
  const report = vi.fn();
  return { episode, writer, report, persistence: createWorkspacePersistence(writer, report) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('workspace persistence lifecycle', () => {
  it('coalesces rapid edits and reports saved only after the latest transaction commits', async () => {
    const { episode, writer, report, persistence } = setup();
    const write = deferred();
    writer.save.mockReturnValue(write.promise);
    persistence.schedule(episode);
    await vi.advanceTimersByTimeAsync(200);
    const latest = { ...episode, revision: 2 };
    persistence.schedule(latest);
    await vi.advanceTimersByTimeAsync(299);
    expect(writer.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(writer.save).toHaveBeenCalledExactlyOnceWith(latest);
    expect(report).toHaveBeenLastCalledWith('saving');
    write.resolve();
    await persistence.flush();
    expect(report).toHaveBeenLastCalledWith('saved');
  });

  it('serializes overlapping writes and never reports an older snapshot as saved', async () => {
    const { episode, writer, report, persistence } = setup();
    const first = deferred(), last = deferred();
    writer.save.mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise);
    persistence.schedule(episode, true);
    await Promise.resolve();
    const latest = { ...episode, revision: 3 };
    persistence.schedule({ ...episode, revision: 2 }, true);
    persistence.schedule(latest, true);
    expect(writer.save).toHaveBeenCalledTimes(1);
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(writer.save).toHaveBeenCalledTimes(2);
    expect(writer.save).toHaveBeenLastCalledWith(latest);
    expect(report.mock.calls.flat()).not.toContain('saved');
    last.resolve(); await persistence.flush();
    expect(report).toHaveBeenLastCalledWith('saved');
  });

  it('suppresses a superseded failure and continues saving the newer draft', async () => {
    const { episode, writer, report, persistence } = setup();
    const first = deferred();
    writer.save.mockReturnValueOnce(first.promise);
    persistence.schedule(episode, true); await Promise.resolve();
    persistence.schedule({ ...episode, revision: 2 }, true);
    first.reject(new Error('Earlier transaction failed'));
    await persistence.flush();
    expect(report.mock.calls.flat()).not.toContain('error');
    expect(writer.save).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenLastCalledWith('saved');
  });

  it('keeps the draft intact on failure and accepts an immediate retry', async () => {
    const { episode, writer, report, persistence } = setup();
    const original = JSON.stringify(episode);
    writer.save.mockRejectedValueOnce(new Error('Quota exceeded'));
    persistence.schedule(episode, true); await persistence.flush();
    expect(report).toHaveBeenLastCalledWith('error');
    expect(JSON.stringify(episode)).toBe(original);
    persistence.schedule(episode, true); await persistence.flush();
    expect(writer.save).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenLastCalledWith('saved');
  });

  it('cancels a debounced draft before clearing, without writing it back later', async () => {
    const { episode, writer, persistence } = setup();
    persistence.schedule(episode);
    await persistence.clear();
    await vi.runAllTimersAsync();
    expect(writer.save).not.toHaveBeenCalled();
    expect(writer.clear).toHaveBeenCalledOnce();
  });

  it('blocks retries throughout clear and waits for active writes and the deletion commit', async () => {
    const { episode, writer, report, persistence } = setup();
    const save = deferred(), deletion = deferred();
    writer.save.mockReturnValue(save.promise);
    writer.clear.mockReturnValue(deletion.promise);
    persistence.schedule(episode, true); await Promise.resolve();
    persistence.schedule({ ...episode, revision: 2 }, true);
    const clearing = persistence.clear();
    expect(persistence.clear()).toBe(clearing);
    expect(persistence.schedule(episode, true)).toBe(false);
    expect(writer.clear).not.toHaveBeenCalled();
    save.resolve(); await vi.advanceTimersByTimeAsync(0);
    expect(writer.clear).toHaveBeenCalledOnce();
    expect(persistence.schedule(episode, true)).toBe(false);
    expect(report.mock.calls.flat()).not.toContain('saved');
    deletion.resolve(); await clearing; await vi.runAllTimersAsync();
    expect(writer.save).toHaveBeenCalledTimes(1);
    expect(persistence.schedule({ ...episode, revision: 3 }, true)).toBe(true);
    await persistence.flush();
    expect(writer.save).toHaveBeenCalledTimes(2);
  });

  it('surfaces a failed clear and releases the barrier for retry', async () => {
    const { episode, writer, persistence } = setup();
    writer.clear.mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(persistence.clear()).rejects.toThrow('Storage unavailable');
    expect(persistence.schedule(episode, true)).toBe(true);
    await persistence.flush();
    await expect(persistence.clear()).resolves.toBeUndefined();
    expect(writer.clear).toHaveBeenCalledTimes(2);
  });

  it('flushes the pending draft on disposal without late UI notifications or further writes', async () => {
    const { episode, writer, report, persistence } = setup();
    persistence.schedule(episode);
    const notifications = report.mock.calls.length;
    await persistence.dispose();
    expect(writer.save).toHaveBeenCalledExactlyOnceWith(episode);
    expect(report).toHaveBeenCalledTimes(notifications);
    expect(persistence.schedule({ ...episode, revision: 2 }, true)).toBe(false);
    await vi.runAllTimersAsync();
    expect(writer.save).toHaveBeenCalledOnce();
  });
});
