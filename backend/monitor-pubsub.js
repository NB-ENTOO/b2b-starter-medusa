const Redis = require("ioredis")

async function monitorPubSub() {
  console.log("🔍 Monitoring Redis Pub/Sub activity...")
  
  const redis = new Redis("redis://192.168.101.1:6379")
  
  try {
    // Get Pub/Sub info
    const info = await redis.info("replication")
    console.log("📊 Redis Pub/Sub Information:")
    
    // Monitor active channels
    const channels = await redis.pubsub("channels")
    console.log(`📡 Active Channels (${channels.length}):`)
    channels.forEach(channel => console.log(`   - ${channel}`))
    
    // Monitor subscribers
    if (channels.length > 0) {
      for (const channel of channels.slice(0, 5)) { // Show first 5
        const numSubs = await redis.pubsub("numsub", channel)
        console.log(`   ${channel}: ${numSubs[1]} subscribers`)
      }
    }
    
    // Monitor patterns
    const patterns = await redis.pubsub("numpat")
    console.log(`🎯 Pattern Subscriptions: ${patterns}`)
    
    console.log("\n🎧 Listening for messages (Ctrl+C to stop)...")
    
    // Subscribe to all Medusa events
    const subscriber = new Redis("redis://192.168.101.1:6379")
    
    // Listen to common Medusa event patterns
    const eventPatterns = [
      "medusa:*",
      "product.*",
      "order.*",
      "workflow.*",
      "quote.*",
      "approval.*"
    ]
    
    eventPatterns.forEach(pattern => {
      subscriber.psubscribe(pattern)
    })
    
    subscriber.on("pmessage", (pattern, channel, message) => {
      const timestamp = new Date().toISOString()
      console.log(`📨 [${timestamp}] ${pattern} → ${channel}`)
      try {
        const parsed = JSON.parse(message)
        console.log(`   Data: ${JSON.stringify(parsed, null, 2)}`)
      } catch {
        console.log(`   Data: ${message}`)
      }
      console.log("")
    })
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log("\n🛑 Stopping Pub/Sub monitor...")
      await subscriber.disconnect()
      await redis.disconnect()
      process.exit(0)
    })
    
  } catch (error) {
    console.error("❌ Error monitoring Pub/Sub:", error.message)
    await redis.disconnect()
    process.exit(1)
  }
}

monitorPubSub() 