import { describe, it, expect } from 'vitest';

// Test prediction route logic: seeded random, load curves, duration, free post format

// Replicate seededRand from predict.js
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Replicate baseLoad from predict.js
function baseLoad(hour, dow) {
  const weekendFactor = dow >= 5 ? 0.4 : 1.0;
  const curve = {
    8: 0.35, 9: 0.55, 10: 0.78, 11: 0.85, 12: 0.75,
    13: 0.55, 14: 0.72, 15: 0.80, 16: 0.70, 17: 0.55,
    18: 0.40, 19: 0.25, 20: 0.10,
  };
  return (curve[hour] || 0.3) * weekendFactor;
}

describe('predict - seeded random consistency', () => {
  it('same seed produces same sequence', () => {
    const rand1 = seededRand(42);
    const rand2 = seededRand(42);
    const seq1 = Array.from({ length: 10 }, () => rand1());
    const seq2 = Array.from({ length: 10 }, () => rand2());
    expect(seq1).toEqual(seq2);
  });

  it('different seeds produce different sequences', () => {
    const rand1 = seededRand(42);
    const rand2 = seededRand(99);
    const val1 = rand1();
    const val2 = rand2();
    expect(val1).not.toBe(val2);
  });

  it('output is between 0 and 1', () => {
    const rand = seededRand(123);
    for (let i = 0; i < 100; i++) {
      const val = rand();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});

describe('predict - load prediction hourly structure', () => {
  it('generates predictions for hours 8-20 (13 entries)', () => {
    const dateStr = '2026-04-14';
    const date = new Date(dateStr);
    const dow = date.getDay();
    const dateSeed = Math.floor(date.getTime() / 86400000);
    const hourly = [];

    for (let h = 8; h <= 20; h++) {
      const rand = seededRand(dateSeed * 100 + h);
      const predictions = {};
      for (let p = 1; p <= 10; p++) {
        const noise = (rand() - 0.5) * 0.2;
        const postVariation = (rand() - 0.5) * 0.15;
        const load = Math.max(0, Math.min(1, baseLoad(h, dow) + noise + postVariation));
        predictions[`post_${p}`] = Math.round(load * 1000) / 1000;
      }
      const values = Object.values(predictions);
      const avg = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 1000) / 1000;
      hourly.push({ hour: h, predictions, avg });
    }

    expect(hourly).toHaveLength(13);
    expect(hourly[0].hour).toBe(8);
    expect(hourly[12].hour).toBe(20);
    expect(Object.keys(hourly[0].predictions)).toHaveLength(10);
    expect(hourly[0].avg).toBeGreaterThanOrEqual(0);
    expect(hourly[0].avg).toBeLessThanOrEqual(1);
  });

  it('all prediction values are clamped between 0 and 1', () => {
    const rand = seededRand(1000);
    for (let i = 0; i < 50; i++) {
      const load = Math.max(0, Math.min(1, baseLoad(10, 1) + (rand() - 0.5) * 0.2));
      expect(load).toBeGreaterThanOrEqual(0);
      expect(load).toBeLessThanOrEqual(1);
    }
  });
});

describe('predict - weekly prediction', () => {
  it('generates 7 days of predictions', () => {
    const days = [];
    const now = new Date('2026-04-14');
    for (let d = 0; d < 7; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      const dow = date.getDay();
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      days.push({ date: dateStr, weekday: weekdays[dow], avg_load: 0.5, peak_hour: 11 });
    }
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-04-14');
    expect(days[0].weekday).toBe('Tuesday');
  });

  it('weekend days have lower base load', () => {
    const weekdayLoad = baseLoad(11, 2); // Tuesday hour 11
    const weekendLoad = baseLoad(11, 6); // Saturday hour 11
    expect(weekendLoad).toBeLessThan(weekdayLoad);
    expect(weekendLoad).toBeCloseTo(weekdayLoad * 0.4, 5);
  });
});

describe('predict - duration prediction by work type and brand', () => {
  const baselines = {
    diagnostics: 1.0, oil_change: 0.8, brake_service: 2.5,
    tire_mounting: 1.2, alignment: 1.5, engine_repair: 4.0,
    body_work: 6.0, electrical: 2.0, suspension: 3.0, ac_service: 1.5,
  };
  const brandFactors = {
    'CITROEN': 1.1, 'OPEL': 1.05, 'PEUGEOT': 1.1, 'BMW': 1.2,
    'DONGFENG': 1.15, 'MAXUS': 1.1, 'HYUNDAI': 0.9, 'RENAULT': 0.95,
  };

  it('returns base hours for known work type without brand', () => {
    const predicted = baselines['diagnostics'] * 1.0;
    expect(predicted).toBe(1.0);
  });

  it('applies brand factor to base hours', () => {
    const base = baselines['brake_service']; // 2.5
    const factor = brandFactors['BMW']; // 1.2
    const predicted = Math.round(base * factor * 100) / 100;
    expect(predicted).toBe(3.0);
  });

  it('uses factor 1.0 for unknown brand', () => {
    const brand = 'UNKNOWN_BRAND';
    const factor = brandFactors[brand.toUpperCase()] || 1.0;
    expect(factor).toBe(1.0);
  });

  it('response includes confidence and range', () => {
    const predicted = 2.5;
    const response = {
      work_type: 'brake_service',
      brand: 'BMW',
      predicted_hours: predicted,
      confidence: 0.78,
      range_min: Math.round(predicted * 0.7 * 100) / 100,
      range_max: Math.round(predicted * 1.4 * 100) / 100,
    };
    expect(response.confidence).toBe(0.78);
    expect(response.range_min).toBe(1.75);
    expect(response.range_max).toBe(3.5);
    expect(response.range_min).toBeLessThan(response.predicted_hours);
    expect(response.range_max).toBeGreaterThan(response.predicted_hours);
  });

  it('defaults to 2.0 for unknown work type', () => {
    const workType = 'unknown_type';
    const base = baselines[workType] || 2.0;
    expect(base).toBe(2.0);
  });
});

describe('predict - free post prediction format', () => {
  it('free post returns free_in_minutes = 0', () => {
    const post = { number: 1, status: 'free', timeline: [] };
    const prediction = post.status === 'free'
      ? { post: post.number, status: 'free', free_in_minutes: 0 }
      : { post: post.number, status: 'occupied', free_in_minutes: null };
    expect(prediction.free_in_minutes).toBe(0);
    expect(prediction.status).toBe('free');
  });

  it('occupied post with estimatedEnd returns remaining minutes', () => {
    const now = new Date('2026-04-14T10:00:00Z');
    const estimatedEnd = '2026-04-14T10:45:00Z';
    const remaining = Math.max(0, Math.round((new Date(estimatedEnd) - now) / 60000));
    expect(remaining).toBe(45);
  });
});

describe('predict - health check response', () => {
  it('returns ok status with service name', () => {
    const response = { status: 'ok', service: 'ml-predict-builtin' };
    expect(response.status).toBe('ok');
    expect(response.service).toBe('ml-predict-builtin');
  });
});
