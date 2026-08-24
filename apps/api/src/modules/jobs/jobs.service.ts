import {createExampleQueue, type RedisConnectionConfig} from "@repo/queues";

export class JobsService {
  private readonly exampleQueue;

  constructor(redisConnection: RedisConnectionConfig) {
    this.exampleQueue = createExampleQueue(redisConnection);
  }

  async enqueueExampleJob(message: string) {
    const job = await this.exampleQueue.add(
      "example-job",
      {
        message,
      },
      {
        attempts: 3,
        backoff:{
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    );

    return{
      jobId: job.id,
    };
  }
}