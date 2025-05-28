import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { performanceMonitor } from "../../../utils/performance-monitor"

// Cache MeiliSearch client to avoid recreating it on every request
let meiliSearchClient: any = null

function getMeiliSearchClient() {
  if (!meiliSearchClient) {
    const { MeiliSearch } = require("meilisearch")
    meiliSearchClient = new MeiliSearch({
      host: process.env.MEILISEARCH_HOST!,
      apiKey: process.env.MEILISEARCH_API_KEY!,
    })
  }
  return meiliSearchClient
}

async function performSearch(
  query: string,
  limit: number,
  offset: number,
  req: MedusaRequest
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const startTime = Date.now()
  
  // Validate and sanitize inputs
  const sanitizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100) // Max 100 results
  const sanitizedOffset = Math.max(Number(offset) || 0, 0)
  const sanitizedQuery = query.trim()
  
  if (!sanitizedQuery) {
    return {
      hits: [],
      query: sanitizedQuery,
      processingTimeMs: 0,
      limit: sanitizedLimit,
      offset: sanitizedOffset,
      estimatedTotalHits: 0,
    }
  }
  
  try {
    // Try to get the search service first
    const searchService = req.scope.resolve("searchService") as any
    const searchResult = await searchService.search("products", sanitizedQuery, {
      paginationOptions: {
        limit: sanitizedLimit,
        offset: sanitizedOffset,
      },
    })
    
    const processingTimeMs = Date.now() - startTime
    const result = {
      hits: searchResult.hits,
      query: sanitizedQuery,
      processingTimeMs,
      limit: sanitizedLimit,
      offset: sanitizedOffset,
      estimatedTotalHits: searchResult.estimatedTotalHits || 0,
    }

    // Log performance metrics
    performanceMonitor.logSearch({
      searchQuery: sanitizedQuery,
      processingTimeMs,
      resultCount: searchResult.hits.length,
      timestamp: new Date(),
      method: 'plugin',
    })
    
    return result
  } catch (error) {
    logger.warn("Search service not found, using direct MeiliSearch")
    
    // Fallback: use cached MeiliSearch client
    const client = getMeiliSearchClient()
    const searchResult = await client.index("products").search(sanitizedQuery, {
      limit: sanitizedLimit,
      offset: sanitizedOffset,
      attributesToRetrieve: ["id", "title", "description", "handle", "thumbnail"], // Only get needed fields
    })

    const processingTimeMs = Date.now() - startTime
    const result = {
      hits: searchResult.hits,
      query: sanitizedQuery,
      processingTimeMs,
      limit: sanitizedLimit,
      offset: sanitizedOffset,
      estimatedTotalHits: searchResult.estimatedTotalHits || 0,
    }

    // Log performance metrics
    performanceMonitor.logSearch({
      searchQuery: sanitizedQuery,
      processingTimeMs,
      resultCount: searchResult.hits.length,
      timestamp: new Date(),
      method: 'direct',
    })

    return result
  }
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { q: query, limit = 20, offset = 0 } = req.query as any

  if (!query || typeof query !== "string") {
    res.status(400).json({
      error: "Query parameter 'q' is required and must be a string",
    })
    return
  }

  try {
    const result = await performSearch(query, Number(limit), Number(offset), req)
    res.json(result)
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    logger.error("Search error:", error)
    
    res.status(500).json({
      error: "Internal server error during search",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  let body: any
  
  try {
    // Log the raw request for debugging
    logger.info(`Search POST request body type: ${typeof req.body}`)
    logger.info(`Search POST request body: ${JSON.stringify(req.body)}`)
    
    // Handle different body formats
    if (typeof req.body === 'string') {
      // If it's a string, try to parse it
      try {
        body = JSON.parse(req.body)
      } catch (parseError) {
        // If it's a double-encoded string, try to parse twice
        const unescaped = req.body.replace(/\\"/g, '"').slice(1, -1)
        body = JSON.parse(unescaped)
      }
    } else if (req.body && typeof req.body === 'object') {
      // If it's already an object, use it directly
      body = req.body
    } else {
      throw new Error("Request body is neither string nor object")
    }
    
    logger.info(`Parsed search body: ${JSON.stringify(body)}`)
    
  } catch (error) {
    logger.error("JSON parsing error:", error)
    res.status(400).json({
      error: "Invalid JSON in request body",
      message: error instanceof Error ? error.message : "JSON parse error",
      receivedType: typeof req.body,
      receivedBody: req.body,
    })
    return
  }

  const { q: query, limit = 20, offset = 0 } = body

  if (!query || typeof query !== "string") {
    res.status(400).json({
      error: "Query parameter 'q' is required and must be a string",
      receivedQuery: query,
      queryType: typeof query,
    })
    return
  }

  try {
    const result = await performSearch(query, Number(limit), Number(offset), req)
    res.json(result)
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    logger.error("Search error:", error)
    
    res.status(500).json({
      error: "Internal server error during search",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
} 