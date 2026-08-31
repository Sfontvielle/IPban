import { estimateOneRepMax, isLowConfidence, weightForReps } from '@/analytics/oneRepMax';

describe('расчётный 1ПМ (формула Эпли)', () => {
  it('для одного повтора равен рабочему весу', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('считает по формуле вес × (1 + повторы / 30)', () => {
    expect(estimateOneRepMax(82.5, 8)).toBeCloseTo(104.5, 1);
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.667, 3);
  });

  it('возвращает 0 при некорректных данных', () => {
    expect(estimateOneRepMax(0, 8)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
    expect(estimateOneRepMax(-50, 5)).toBe(0);
  });

  it('помечает низкую достоверность выше 12 повторов', () => {
    expect(isLowConfidence(12)).toBe(false);
    expect(isLowConfidence(15)).toBe(true);
  });

  it('обратная формула согласована с прямой', () => {
    const oneRm = estimateOneRepMax(82.5, 8);
    expect(weightForReps(oneRm, 8)).toBeCloseTo(82.5, 6);
  });
});
