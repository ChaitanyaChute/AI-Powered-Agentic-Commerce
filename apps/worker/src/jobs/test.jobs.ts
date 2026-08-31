import { exampleQueue } from "../queues/example.queue.js";

await exampleQueue.add(
  "example-job",
  {
    message: "Hello from BullMQ"
    },
  {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
);

console.log("Example job queued");

await exampleQueue.close();