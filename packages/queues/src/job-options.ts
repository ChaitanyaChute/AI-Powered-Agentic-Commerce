import type { JobsOptions} from "bullmq";

export const defaultJobOptions:JobsOptions = {
    attempts: 3 ,

    backoff:{
        type:"exponential",
        delay:1000
    },

    removeOnComplete:{
        age: 60*60*24,
        count:100
    },

    removeOnFail:{
        age: 60*60*24*7,
        count:1000
    }

} 