import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { redisManager } from "../../../utils/redis-setup"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("Checking Redis health status...")
    
    const healthCheck = await redisManager.testConnections()
    
    const status = healthCheck.events && healthCheck.workflow ? "healthy" : "unhealthy"
    const statusCode = status === "healthy" ? 200 : 503
    
    res.status(statusCode).json({
      success: status === "healthy",
      status,
      timestamp: new Date().toISOString(),
      services: {
        eventBus: {
          status: healthCheck.events ? "connected" : "disconnected",
          url: process.env.EVENTS_REDIS_URL,
          info: healthCheck.details.eventsInfo,
        },
        workflowEngine: {
          status: healthCheck.workflow ? "connected" : "disconnected", 
          url: process.env.WE_REDIS_URL,
          info: healthCheck.details.workflowInfo,
        },
      },
      errors: healthCheck.details.errors,
    })
    
    console.log(`Redis health check completed: ${status}`)
    
  } catch (error) {
    console.error("Redis health check failed:", error)
    
    res.status(500).json({
      success: false,
      status: "error",
      timestamp: new Date().toISOString(),
      error: "Failed to check Redis health",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
} 