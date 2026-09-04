UPDATE "Payment"
SET "status" = 'CAPTURED'
WHERE "status" = 'SUCCESS';

UPDATE "PaymentAttempt"
SET "status" = 'CAPTURED'
WHERE "status" = 'SUCCESS';

ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";

CREATE TYPE "PaymentStatus" AS ENUM (
    'CREATED',
    'PENDING',
    'FAILED',
    'UNKNOWN',
    'REFUND_PENDING',
    'REFUNDED',
    'AUTHORIZED',
    'CAPTURED'
);

ALTER TABLE "Payment"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "PaymentStatus"
        USING "status"::text::"PaymentStatus",
    ALTER COLUMN "status" SET DEFAULT 'CREATED';

ALTER TABLE "PaymentAttempt"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "PaymentStatus"
        USING "status"::text::"PaymentStatus",
    ALTER COLUMN "status" SET DEFAULT 'CREATED';

DROP TYPE "PaymentStatus_old";
