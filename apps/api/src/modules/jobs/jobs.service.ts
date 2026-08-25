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
      }
    );

    return{
      jobId: job.id,
    };
  }
}