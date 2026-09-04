import express, {type Express} from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { logger} from "./lib/logger.js";
import {requestId} from "./middleware/request-id.js";
import {errorHandler} from "./middleware/error-handler.js";
import { healthRoutes } from "./modules/health/index.js";
import jobsRoutes from "./modules/jobs/jobs.routes.js";
import idempotencyRoutes from "./modules/idempotency/idempotency.routes.js";
import { orderRouter } from "./modules/orders/index.js";
import { createPaymentRouter } from "./modules/payments/payment.routes.js";
import { RazorpayProvider } from "@repo/integrations";
import type { PaymentProvider } from "@repo/shared";
import { env } from "./config/env.js";

function createConfiguredPaymentProvider(): PaymentProvider {
    if (
        env.RAZORPAY_KEY_ID &&
        env.RAZORPAY_KEY_SECRET &&
        env.RAZORPAY_WEBHOOK_SECRET
    ) {
        return new RazorpayProvider({
            keyId: env.RAZORPAY_KEY_ID,
            keySecret: env.RAZORPAY_KEY_SECRET,
            webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
        });
    }

    return {
        name: "RAZORPAY",
        async createOrder() {
            throw new Error("Razorpay is not configured.");
        },
        async getPayment() {
            throw new Error("Razorpay is not configured.");
        },
        async verifyPayment() {
            return {
                verified: false,
                providerPaymentId: "",
                providerOrderId: "",
            };
        },
        async capturePayment() {
            throw new Error("Razorpay is not configured.");
        },
        async refundPayment() {
            throw new Error("Razorpay is not configured.");
        },
    };
}


export const createApp = ():Express =>{
    const app = express();

    app.use(helmet());

    app.use(
        cors({
            origin: true,
            credentials: true
        }),
    );

    app.use(express.json({limit:"1mb"}));

    app.use(express.urlencoded(
        {
            extended:true,
            limit:"1mb"
        }
    ))

    app.use(requestId)

    app.use(
        pinoHttp({
            logger,

            redact:{
                paths:[
                    "req.headers.authorization",
                    "req.headers.cookie",
                    "req.headers.x-api-key",
                    "res.headers.set-cookie",
                ],
                censor:"[REDACTED]",
            },

                customLogLevel:(req,res, err)=>{
                    if(err || res.statusCode >= 500){
                        return "error";
                    }
                    if(res.statusCode >= 400){
                        return "warn";
                    }

                    return "info";
                }
        })
    );
    
    app.use(healthRoutes);
    app.use(jobsRoutes);
    app.use(idempotencyRoutes);
    app.use("/api/orders", orderRouter);
    app.use(
        "/api/payments",
        createPaymentRouter(
            createConfiguredPaymentProvider(),
        ),
    );

    app.use(errorHandler)

    return app;
}
