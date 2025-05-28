"use client"

import { MagnifyingGlassMini } from "@medusajs/icons"
import { useEffect, useState } from "react"
import SearchModal from "../search-modal"

export default function SearchButton() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const handleSearchClick = () => {
    setIsSearchOpen(true)
  }

  const handleSearchClose = () => {
    setIsSearchOpen(false)
  }

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <>
      <div className="relative mr-2 hidden small:inline-flex">
        <button
          onClick={handleSearchClick}
          className="bg-gray-100 text-zinc-900 px-4 py-2 rounded-full pr-10 shadow-borders-base hidden small:flex items-center hover:bg-gray-200 transition-colors group"
          title="Search for products (⌘K)"
        >
          <span className="text-gray-500 group-hover:text-gray-700 transition-colors">
            Search for products
          </span>
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <MagnifyingGlassMini className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </div>
        </button>
      </div>

      {/* Mobile search button */}
      <button
        onClick={handleSearchClick}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors small:hidden"
        title="Search for products"
      >
        <MagnifyingGlassMini className="h-5 w-5 text-gray-600" />
      </button>

      <SearchModal isOpen={isSearchOpen} onClose={handleSearchClose} />
    </>
  )
} 