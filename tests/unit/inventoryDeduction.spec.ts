import { describe, expect, test } from 'vitest';
import {
  calculateInventoryAfterMovement,
  quantityInInventoryUnit,
} from '../../src/utils/inventoryDeduction';

describe('transactional inventory deduction calculations', () => {
  test('converts compatible mass and volume units into the inventory unit', () => {
    expect(quantityInInventoryUnit(250, 'g', 'kg')).toBe(0.25);
    expect(quantityInInventoryUnit(200, 'mL', 'L')).toBe(0.2);
    expect(quantityInInventoryUnit(1, 'pcs', 'pcs')).toBe(1);
  });

  test('rejects unsupported mass, volume, piece, and package conversions', () => {
    expect(() => quantityInInventoryUnit(1, 'g', 'mL')).toThrow(/Cannot deduct/);
    expect(() => quantityInInventoryUnit(1, 'servings', 'g')).toThrow(/Cannot deduct/);
    expect(() => quantityInInventoryUnit(1, 'packs', 'pcs')).toThrow(/Cannot deduct/);
  });

  test('prevents negative stock and reports the available amount and unit', () => {
    expect(() => calculateInventoryAfterMovement(0.1, 0.2, 0, 'kg'))
      .toThrow('Insufficient inventory. Only 0.1 kg is available.');
  });

  test('deducts, adjusts, and restores stock without double-counting an edit', () => {
    const afterFirstLog = calculateInventoryAfterMovement(1, 0.2, 0, 'kg');
    expect(afterFirstLog).toBe(0.8);

    const afterEditFrom200gTo300g = calculateInventoryAfterMovement(0.8, 0.3, 0.2, 'kg');
    expect(afterEditFrom200gTo300g).toBe(0.7);

    const afterDelete = calculateInventoryAfterMovement(0.7, 0, 0.3, 'kg');
    expect(afterDelete).toBe(1);
  });
});
