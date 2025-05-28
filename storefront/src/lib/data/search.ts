"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders, getCacheOptions } from "@/lib/data/cookies"
import { getRegion } from "@/lib/data/regions"
import { HttpTypes } from "@medusajs/types"

export interface SearchResult {
  id: string
  title: string
  description: string
  handle: string
  thumbnail: string | null
  variant_sku: string
}

export interface SearchResponse {
  hits: SearchResult[]
  query: string
  processingTimeMs: number
  limit: number
  offset: number
  estimatedTotalHits: number
}

export const searchProducts = async ({
  query,
  limit = 20,
  offset = 0,
  countryCode,
}: {
  query: string
  limit?: number
  offset?: number
  countryCode: string
}): Promise<SearchResponse> => {
  // Early return for empty queries
  const trimmedQuery = query.trim()
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return {
      hits: [],
      query: trimmedQuery,
      processingTimeMs: 0,
      limit,
      offset,
      estimatedTotalHits: 0,
    }
  }

  const region = await getRegion(countryCode)

  if (!region) {
    return {
      hits: [],
      query: trimmedQuery,
      processingTimeMs: 0,
      limit,
      offset,
      estimatedTotalHits: 0,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
    "Content-Type": "application/json",
  }

  const next = {
    ...(await getCacheOptions("search")),
  }

  try {
    // Use GET method (more reliable for search)
    const searchParams = new URLSearchParams({
      q: trimmedQuery,
      limit: limit.toString(),
      offset: offset.toString(),
    })
    
    const response = await sdk.client.fetch<SearchResponse>(
      `/store/search?${searchParams.toString()}`,
      {
        credentials: "include",
        method: "GET",
        headers: {
          ...(await getAuthHeaders()),
        },
        next: {
          ...next,
          revalidate: 60, // Cache search results for 1 minute
        },
      }
    )

    return response
  } catch (error) {
    console.error("Search error:", error)
    return {
      hits: [],
      query,
      processingTimeMs: 0,
      limit,
      offset,
      estimatedTotalHits: 0,
    }
  }
}

export const getSearchSuggestions = async ({
  query,
  countryCode,
}: {
  query: string
  countryCode: string
}): Promise<string[]> => {
  if (query.length < 2) return []

  try {
    const searchResult = await searchProducts({
      query,
      limit: 5,
      countryCode,
    })

    // Extract unique words from product titles for suggestions
    const suggestions = searchResult.hits
      .flatMap((hit) => hit.title.toLowerCase().split(" "))
      .filter((word) => word.length > 2 && word.includes(query.toLowerCase()))
      .filter((word, index, arr) => arr.indexOf(word) === index)
      .slice(0, 5)

    return suggestions
  } catch (error) {
    console.error("Suggestions error:", error)
    return []
  }
} 