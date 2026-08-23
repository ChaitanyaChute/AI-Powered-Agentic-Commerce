import {Request, Response, NextFunction} from 'express';
import { logger } from '../lib/logger.js';  

export class AppError extends Error{
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details?: unknown;

    constructor(
        message: string,
        statusCode =  500,
        code = "INTERNAL_SERVER_ERROR",
        details? : unknown,
    ){
        super(message);

        this.name ="AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.details = details

        Error.captureStackTrace(this,this.constructor);
    }
}

export function errorHandler(
    err:unknown,
    req:Request,
    res:Response,
    next:NextFunction
){
    const reqId = res.locals.reqId;

    if(err instanceof AppError){
        logger.warn(
            {
                reqId,
                method:req.method,
                path:req.originalUrl,
                statusCode: err.statusCode,
                code: err.code,
                details: err.details
            },
            err.message,
        );

        return res.status(err.statusCode).json({
            error:{
                code:err.code,
                message: err.message,
                reqId,
                ...(err.details !==  undefined ? {details:err.details}:{})
            }
        })
    }


logger.error(
        {
         reqId,
         method: req.method,
         path:req.originalUrl,
         err
       },
       "Unhandled application error",
    )

    return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      reqId,
    },
  });
}