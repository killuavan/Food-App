import type { MeasurementUnit } from './foodInventory';
import type { ConsumptionUnit } from './foodConsumption';
import { convertCompatibleQuantity } from './foodConsumption';

export function quantityInInventoryUnit(
  quantity: number,
  consumedUnit: ConsumptionUnit,
  inventoryUnit: MeasurementUnit,
): number {
  const converted = convertCompatibleQuantity(quantity, consumedUnit, inventoryUnit);
  if (converted === null) {
    throw new Error(`Cannot deduct ${consumedUnit} from inventory measured in ${inventoryUnit}. Use compatible units.`);
  }
  if (!Number.isFinite(converted) || converted <= 0) {
    throw new Error('Consumed quantity must convert to a valid amount greater than zero.');
  }
  return converted;
}

export function calculateInventoryAfterMovement(
  currentQuantity: number,
  quantityToDeduct: number,
  quantityToRestore = 0,
  unit = 'units',
): number {
  if (
    !Number.isFinite(currentQuantity)
    || currentQuantity < 0
    || !Number.isFinite(quantityToDeduct)
    || quantityToDeduct < 0
    || !Number.isFinite(quantityToRestore)
    || quantityToRestore < 0
  ) {
    throw new Error('Inventory movement contains an invalid quantity.');
  }
  const available = currentQuantity + quantityToRestore;
  if (quantityToDeduct > available) {
    throw new Error(`Insufficient inventory. Only ${Number(available.toFixed(3))} ${unit} is available.`);
  }
  return Number((available - quantityToDeduct).toFixed(9));
}
