"use client"

import { searchProducts, SearchResult } from "@/lib/data/search"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { Dialog, Transition } from "@headlessui/react"
import { MagnifyingGlassMini, XMark } from "@medusajs/icons"
import { useParams } from "next/navigation"
import { Fragment, useCallback, useEffect, useState } from "react"
import { useDebounce } from "@/lib/hooks/use-debounce"

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [processingTime, setProcessingTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 300)
  const params = useParams()
  const countryCode = params.countryCode as string

  const performSearch = useCallback(
    async (searchQuery: string) => {
      const trimmedQuery = searchQuery.trim()
      
      if (!trimmedQuery || trimmedQuery.length < 2) {
        setResults([])
        setProcessingTime(null)
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const response = await searchProducts({
          query: trimmedQuery,
          limit: 6, // Reduced from 8 for better performance
          countryCode,
        })
        setResults(response.hits)
        setProcessingTime(response.processingTimeMs)
      } catch (error) {
        console.error("Search failed:", error)
        setResults([])
        setProcessingTime(null)
        setError("Search failed. Please try again.")
      } finally {
        setIsLoading(false)
      }
    },
    [countryCode]
  )

  useEffect(() => {
    if (debouncedQuery) {
      performSearch(debouncedQuery)
    } else {
      setResults([])
      setProcessingTime(null)
    }
  }, [debouncedQuery, performSearch])

  const handleClose = () => {
    setQuery("")
    setResults([])
    setProcessingTime(null)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose()
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        {/* Backdrop with blur */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-start justify-center p-4 pt-16">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-4"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-4"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                {/* Search Header */}
                <div className="relative border-b border-gray-200">
                  <div className="flex items-center px-6 py-4">
                    <MagnifyingGlassMini className="h-6 w-6 text-gray-400 mr-3" />
                    <input
                      type="text"
                      placeholder="Search for products..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1 border-none outline-none text-lg placeholder-gray-400 bg-transparent"
                      autoFocus
                    />
                    <button
                      onClick={handleClose}
                      className="ml-3 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <XMark className="h-5 w-5 text-gray-400" />
                    </button>
                  </div>
                  
                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-200">
                      <div className="h-full bg-blue-500 animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Search Results */}
                <div className="max-h-96 overflow-y-auto">
                  {error && (
                    <div className="px-6 py-8 text-center text-red-500">
                      <XMark className="h-12 w-12 mx-auto mb-4 text-red-300" />
                      <p className="text-lg font-medium">Search Error</p>
                      <p className="text-sm">{error}</p>
                    </div>
                  )}

                  {query && !isLoading && !error && results.length === 0 && (
                    <div className="px-6 py-8 text-center text-gray-500">
                      <p className="text-lg font-medium">No products found for "{query}"</p>
                      <p className="text-sm">Try searching with different keywords</p>
                    </div>
                  )}

                  {!query && (
                    <div className="px-6 py-8 text-center text-gray-500">
                      <p className="text-lg font-medium">Search for products</p>
                      <p className="text-sm">Start typing to find what you're looking for</p>
                    </div>
                  )}

                  {results.length > 0 && (
                    <div className="py-2">
                      {results.map((product) => (
                        <LocalizedClientLink
                          key={product.id}
                          href={`/products/${product.handle}`}
                          onClick={handleClose}
                          className="flex items-center px-6 py-3 hover:bg-gray-50 transition-colors group"
                        >
                          <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg overflow-hidden mr-4">
                            {product.thumbnail ? (
                              <img
                                src={product.thumbnail}
                                alt={product.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                              {product.title}
                            </h3>
                            <p className="text-xs text-gray-500 truncate mt-1">
                              {product.description}
                            </p>
                            {product.variant_sku && (
                              <p className="text-xs text-gray-400 mt-1">
                                SKU: {product.variant_sku}
                              </p>
                            )}
                          </div>
                        </LocalizedClientLink>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {processingTime !== null && results.length > 0 && (
                  <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
                    <p className="text-xs text-gray-500 text-center">
                      Found {results.length} results in {processingTime}ms
                    </p>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
} 