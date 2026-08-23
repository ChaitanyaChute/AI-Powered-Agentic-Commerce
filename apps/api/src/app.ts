import express, {type Express} from "express";
import cors from "cors";
import helmet from "helmet";

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
    
    app.get("/health" , (req, res)=>{
        res.status(200).json({
            "status":"ok"
        })
    })

    return app;
}