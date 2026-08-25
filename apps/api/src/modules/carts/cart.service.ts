import {CartItemRepository,CartRepository, ProductRepository,} from "@repo/database";

export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly cartItemRepository: CartItemRepository,
    private readonly productRepository: ProductRepository,
  ){}

  async getCart(cartId: string) {
    return this.cartRepository.findByIdWithItems(cartId);
  }

  async getActiveCart(customerId: string) {
    return this.cartRepository.findActiveByCustomerId(customerId);
  }

  async addItem(
    customerId: string,
    productId: string,
    quantity: number,
  ){
    if(!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Quantity must be a positive integer.");
    }

    const product = await this.productRepository.findById(productId);

    if(!product){
      throw new Error("Product not found.");
    }

    if(!product.active){
      throw new Error("Product is not active.");
    }

    let cart =await this.cartRepository.findActiveByCustomerId(
        customerId,
      );

    if (!cart) {
      cart = await this.cartRepository.create({
        customer: {
          connect: {
            id: customerId,
          },
        },
      });
    }

    const existingItem =await this.cartItemRepository.findByCartAndProduct(
        cart.id,
        productId,
      );

    if (existingItem) {
      return this.cartItemRepository.update(existingItem.id, {
        quantity: existingItem.quantity + quantity,
      });
    }

    return this.cartItemRepository.create({
      cart: {
        connect: {
          id: cart.id,
        },
      },
      product: {
        connect: {
          id: productId,
        },
      },
      quantity,
    });
  }
}