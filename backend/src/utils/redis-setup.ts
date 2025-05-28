import Redis from "ioredis"

export class RedisManager {
  private static instance: RedisManager
  private eventsClient: Redis | null = null
  private workflowClient: Redis | null = null

  private constructor() {}

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager()
    }
    return RedisManager.instance
  }

  async connectEventsRedis(): Promise<Redis> {
    if (!this.eventsClient) {
      const redisUrl = process.env.EVENTS_REDIS_URL
      if (!redisUrl) {
        throw new Error("EVENTS_REDIS_URL environment variable is not set")
      }

      this.eventsClient = new Redis(redisUrl, {
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
      })

      this.eventsClient.on("connect", () => {
        console.log("Redis Events Client connected successfully")
      })

      this.eventsClient.on("error", (error) => {
        console.error("Redis Events Client error:", error)
      })
    }

    return this.eventsClient
  }

  async connectWorkflowRedis(): Promise<Redis> {
    if (!this.workflowClient) {
      const redisUrl = process.env.WE_REDIS_URL
      if (!redisUrl) {
        throw new Error("WE_REDIS_URL environment variable is not set")
      }

      this.workflowClient = new Redis(redisUrl, {
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
      })

      this.workflowClient.on("connect", () => {
        console.log("Redis Workflow Engine Client connected successfully")
      })

      this.workflowClient.on("error", (error) => {
        console.error("Redis Workflow Engine Client error:", error)
      })
    }

    return this.workflowClient
  }

  async testConnections(): Promise<{
    events: boolean
    workflow: boolean
    details: {
      eventsInfo?: any
      workflowInfo?: any
      errors?: string[]
    }
  }> {
    const result = {
      events: false,
      workflow: false,
      details: {
        eventsInfo: undefined as any,
        workflowInfo: undefined as any,
        errors: [] as string[],
      },
    }

    try {
      // Test Events Redis
      const eventsClient = await this.connectEventsRedis()
      await eventsClient.ping()
      const eventsInfo = await eventsClient.info("server")
      result.events = true
      result.details.eventsInfo = this.parseRedisInfo(eventsInfo)
      console.log("Events Redis connection test passed")
    } catch (error) {
      result.details.errors!.push(`Events Redis: ${error instanceof Error ? error.message : "Unknown error"}`)
      console.error("Events Redis connection test failed:", error)
    }

    try {
      // Test Workflow Redis
      const workflowClient = await this.connectWorkflowRedis()
      await workflowClient.ping()
      const workflowInfo = await workflowClient.info("server")
      result.workflow = true
      result.details.workflowInfo = this.parseRedisInfo(workflowInfo)
      console.log("Workflow Redis connection test passed")
    } catch (error) {
      result.details.errors!.push(`Workflow Redis: ${error instanceof Error ? error.message : "Unknown error"}`)
      console.error("Workflow Redis connection test failed:", error)
    }

    return result
  }

  private parseRedisInfo(info: string): any {
    const lines = info.split("\r\n")
    const parsed: any = {}
    
    for (const line of lines) {
      if (line.includes(":")) {
        const [key, value] = line.split(":")
        parsed[key] = value
      }
    }
    
    return {
      redis_version: parsed.redis_version,
      redis_mode: parsed.redis_mode,
      uptime_in_seconds: parsed.uptime_in_seconds,
      connected_clients: parsed.connected_clients,
      used_memory_human: parsed.used_memory_human,
    }
  }

  async disconnect(): Promise<void> {
    if (this.eventsClient) {
      await this.eventsClient.disconnect()
      this.eventsClient = null
    }
    if (this.workflowClient) {
      await this.workflowClient.disconnect()
      this.workflowClient = null
    }
  }
}

export const redisManager = RedisManager.getInstance() 