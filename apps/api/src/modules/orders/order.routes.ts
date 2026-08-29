import { Router } from "express";

import {
  CartRepository,
  CustomerRepository,
  InventoryRepository,
  OrderItemRepository,
  OrderRepository,
  ProductRepository,
} from "@repo/database";

import { redis } from "../../config/redis.js";
import { IdempotencyService } from "../../lib/idempotency/idempotency.service.js";

import { OrderController } from "./order.controller.js";
import { OrderService } from "./order.service.js";

const router: Router = Router();

const orderService = new OrderService(
  new CartRepository(),
  new CustomerRepository(),
  new OrderRepository(),
  new OrderItemRepository(),
  new ProductRepository(),
  new InventoryRepository(),
);

const idempotencyService =new IdempotencyService(redis);

const orderController = new OrderController(orderService,idempotencyService);

router.post("/",orderController.createOrder);

router.get("/:id",orderController.getOrder);

export { router as orderRouter };