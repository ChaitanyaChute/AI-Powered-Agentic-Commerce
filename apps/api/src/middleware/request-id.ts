import { randomUUID } from "node:crypto";
import { Request,Response, NextFunction } from "express";

const REQ_ID_HEADER = "X-Request-ID";

export function requestId(req:Request,res:Response,next:NextFunction){
    const incoming_req_id = req.header(REQ_ID_HEADER);

    const id = incoming_req_id?.trim() || `req_${randomUUID()}`;

    res.setHeader(REQ_ID_HEADER,id);

    res.locals.reqId = id;

    next();
}