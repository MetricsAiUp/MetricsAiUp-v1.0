import { describe, it, expect, beforeEach } from 'vitest';
import registry from '../../services/_serviceRegistry.js';

describe('_serviceRegistry', () => {
  beforeEach(() => registry.reset());

  it('register создаёт запись с running=true и нулевыми счётчиками', () => {
    registry.register('foo', { interval: 1000 });
    const all = registry.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      name: 'foo',
      running: true,
      ticks: 0,
      errors: 0,
      lastTickAt: null,
      lastError: null,
    });
    expect(all[0].meta.interval).toBe(1000);
    expect(all[0].registeredAt).toBeTruthy();
  });

  it('повторный register сохраняет ticks/errors и мержит meta', () => {
    registry.register('foo', { a: 1 });
    registry.tick('foo');
    registry.tick('foo');
    registry.register('foo', { b: 2 });
    const r = registry.get('foo');
    expect(r.ticks).toBe(2);
    expect(r.meta.a).toBe(1);
    expect(r.meta.b).toBe(2);
  });

  it('tick инкрементирует счётчик и обновляет lastTickAt', () => {
    registry.register('foo');
    registry.tick('foo');
    registry.tick('foo');
    registry.tick('foo');
    const all = registry.getAll();
    expect(all[0].ticks).toBe(3);
    expect(all[0].lastTickAt).toBeTruthy();
  });

  it('tick на незарегистрированный сервис — no-op', () => {
    expect(() => registry.tick('ghost')).not.toThrow();
    expect(registry.getAll()).toHaveLength(0);
  });

  it('error инкрементирует errors и сохраняет message', () => {
    registry.register('foo');
    registry.error('foo', new Error('boom'));
    const r = registry.get('foo');
    expect(r.errors).toBe(1);
    expect(r.lastError.message).toBe('boom');
  });

  it('error принимает строку', () => {
    registry.register('foo');
    registry.error('foo', 'string-error');
    expect(registry.get('foo').lastError.message).toBe('string-error');
  });

  it('unregister помечает сервис как running=false, но запись сохраняется', () => {
    registry.register('foo');
    registry.tick('foo');
    registry.unregister('foo');
    const all = registry.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].running).toBe(false);
    expect(all[0].ticks).toBe(1);
  });

  it('tick поддерживает payload в meta.lastPayload', () => {
    registry.register('foo');
    registry.tick('foo', { zones: 5 });
    expect(registry.get('foo').meta.lastPayload).toEqual({ zones: 5 });
  });

  it('reset очищает реестр', () => {
    registry.register('foo');
    registry.register('bar');
    expect(registry.getAll()).toHaveLength(2);
    registry.reset();
    expect(registry.getAll()).toHaveLength(0);
  });
});
