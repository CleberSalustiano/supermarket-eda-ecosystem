import type { StockMovement } from '../entities/stock-movement.entity';

export const STOCK_MOVEMENT_REPOSITORY = Symbol('STOCK_MOVEMENT_REPOSITORY');

export interface StockMovementRepositoryPort {
  save(movement: StockMovement): Promise<void>;
}
