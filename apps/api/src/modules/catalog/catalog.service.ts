import {ProductRepository} from "@repo/database";

export class CatalogService {
  private readonly productRepository: ProductRepository;

  constructor(
    productRepository: ProductRepository,
  ){
    this.productRepository = productRepository;
  }

  async getProductById(id: string){
    return this.productRepository.findById(id);
  }

  async getProductBySku(sku: string){
    return this.productRepository.findBySku(sku);
  }

  async listActiveProducts(){
    return this.productRepository.listActive();
  }
}