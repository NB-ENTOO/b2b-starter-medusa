interface PerformanceMetrics {
  searchQuery: string
  processingTimeMs: number
  resultCount: number
  timestamp: Date
  method: 'plugin' | 'direct'
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private maxMetrics = 1000 // Keep last 1000 searches

  logSearch(metrics: PerformanceMetrics) {
    this.metrics.push(metrics)
    
    // Keep only the last maxMetrics entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Log slow searches (> 500ms)
    if (metrics.processingTimeMs > 500) {
      console.warn(`Slow search detected: "${metrics.searchQuery}" took ${metrics.processingTimeMs}ms`)
    }
  }

  getAverageResponseTime(lastN = 100): number {
    const recentMetrics = this.metrics.slice(-lastN)
    if (recentMetrics.length === 0) return 0
    
    const total = recentMetrics.reduce((sum, metric) => sum + metric.processingTimeMs, 0)
    return Math.round(total / recentMetrics.length)
  }

  getSlowQueries(thresholdMs = 300): PerformanceMetrics[] {
    return this.metrics.filter(metric => metric.processingTimeMs > thresholdMs)
  }

  getPopularQueries(lastN = 500): { query: string; count: number }[] {
    const recentMetrics = this.metrics.slice(-lastN)
    const queryCount = new Map<string, number>()
    
    recentMetrics.forEach(metric => {
      const query = metric.searchQuery.toLowerCase().trim()
      queryCount.set(query, (queryCount.get(query) || 0) + 1)
    })
    
    return Array.from(queryCount.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  getStats() {
    return {
      totalSearches: this.metrics.length,
      averageResponseTime: this.getAverageResponseTime(),
      slowQueries: this.getSlowQueries().length,
      popularQueries: this.getPopularQueries(),
    }
  }
}

export const performanceMonitor = new PerformanceMonitor()
export type { PerformanceMetrics } 