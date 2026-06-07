import type { ProductRepositoryPort } from '#/domain/repositories/product.repository';
import { Product } from '#/domain/entities/product.entity';
import { ProductTypeormEntity } from '../entities/product.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormProductRepository implements ProductRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async findById(tenantId: string, productId: string): Promise<Product | null> {
    const entity = await this.repositoryAccessor.getRepository(ProductTypeormEntity).findOne({
      where: {
        id: productId,
        tenantId
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async findByBarcode(tenantId: string, barcode: string): Promise<Product | null> {
    const entity = await this.repositoryAccessor.getRepository(ProductTypeormEntity).findOne({
      where: {
        barcode,
        tenantId
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async save(product: Product): Promise<void> {
    const productState = product.toPrimitives();

    await this.repositoryAccessor.getRepository(ProductTypeormEntity).save({
      id: productState.id,
      tenantId: productState.tenantId,
      name: productState.name,
      barcode: productState.barcode,
      unitOfMeasure: productState.unitOfMeasure,
      currentPrice: productState.currentPrice,
      active: productState.active,
      createdAt: new Date(productState.createdAt),
      updatedAt: new Date(productState.updatedAt)
    });
  }
}

function toDomain(entity: ProductTypeormEntity): Product {
  return Product.rehydrate({
    id: entity.id,
    tenantId: entity.tenantId,
    name: entity.name,
    barcode: entity.barcode,
    unitOfMeasure: entity.unitOfMeasure,
    currentPrice: entity.currentPrice,
    active: entity.active,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  });
}
