export interface RedisConnectionConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export function createRedisConnection(
  config: RedisConnectionConfig,
): RedisConnectionConfig {
  return{
    host: config.host,
    port: config.port,
    ...(config.username ? { username: config.username }: {}),
    ...(config.password ? { password: config.password }: {}),
  };
}