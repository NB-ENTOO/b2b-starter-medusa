import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { performanceMonitor } from "../../../utils/performance-monitor"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const stats = performanceMonitor.getStats()
    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve search statistics",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
} 