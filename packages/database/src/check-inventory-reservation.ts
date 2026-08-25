import {InventoryRepository,withDatabaseTransaction,} from "./index.js";

async function main(): Promise<void> {
  try {
    await withDatabaseTransaction(async (tx) => {
      const inventory = await tx.inventory.create({
        data: {
          product: {
            create: {
              sku: `SMOKE-${Date.now()}`,
              name: "Smoke Test Product",
              priceMinor: 1000,
              currency: "INR",
              active: true,
            },
          },
          quantity: 5,
          reserved: 0,
        },
      });

      const repository = new InventoryRepository(tx);

      const reserved = await repository.reserve(
        inventory.id,
        3,
      );

      console.log("Inventory reservation: OK");
      console.log(
        "Reserved after first reservation:",
        reserved.reserved,
      );

      try {
        await repository.reserve(
          inventory.id,
          3,
        );

        throw new Error(
          "Expected second reservation to fail.",
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Expected second reservation to fail."
        ) {
          throw error;
        }

        console.log(
          "Over-reservation correctly rejected.",
        );
      }

      throw new Error(
        "__ROLLBACK_SMOKE_TEST__",
      );
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "__ROLLBACK_SMOKE_TEST__"
    ) {
      console.log(
        "Inventory reservation transaction: ROLLED BACK",
      );
      return;
    }

    console.error(
      "Inventory reservation test: FAILED",
    );
    console.error(error);
    process.exitCode = 1;
  }
}

void main();