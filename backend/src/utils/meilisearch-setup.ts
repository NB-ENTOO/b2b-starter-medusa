export interface MeiliSearchConfig {
  host: string;
  apiKey: string;
}

export class MeiliSearchManager {
  private client: any;
  private config: MeiliSearchConfig;

  constructor(config: MeiliSearchConfig) {
    this.config = config;
  }

  private async initializeClient() {
    if (!this.client) {
      const { MeiliSearch } = await import("meilisearch");
      this.client = new MeiliSearch({
        host: this.config.host,
        apiKey: this.config.apiKey,
      });
    }
    return this.client;
  }

  async createIndexIfNotExists(indexName: string): Promise<void> {
    const client = await this.initializeClient();
    try {
      // Check if index exists
      await client.getIndex(indexName);
      console.log(`MeiliSearch index ${indexName} already exists`);
    } catch (error: any) {
      if (error.code === "index_not_found") {
        try {
          // Create index
          await client.createIndex(indexName, { primaryKey: "id" });
          console.log(`MeiliSearch index ${indexName} created successfully`);
        } catch (createError) {
          console.error(`Error creating MeiliSearch index ${indexName}:`, createError);
          throw createError;
        }
      } else {
        console.error(`Error checking MeiliSearch index ${indexName}:`, error);
        throw error;
      }
    }
  }

  async configureIndex(indexName: string): Promise<void> {
    const client = await this.initializeClient();
    try {
      const index = client.index(indexName);
      
      // Configure searchable attributes
      await index.updateSearchableAttributes([
        "title",
        "description",
        "variant_sku"
      ]);

      // Configure displayed attributes
      await index.updateDisplayedAttributes([
        "id",
        "handle",
        "title",
        "description",
        "variant_sku",
        "thumbnail"
      ]);

      // Configure filterable attributes
      await index.updateFilterableAttributes([
        "id",
        "handle"
      ]);

      console.log(`MeiliSearch index ${indexName} configured successfully`);
    } catch (error) {
      console.error(`Error configuring MeiliSearch index ${indexName}:`, error);
      throw error;
    }
  }

  async indexProducts(products: any[]): Promise<void> {
    const client = await this.initializeClient();
    try {
      const index = client.index("products");
      
      // Transform products for indexing
      const documents = products.map(product => ({
        id: product.id,
        title: product.title,
        description: product.description,
        handle: product.handle,
        thumbnail: product.thumbnail,
        variant_sku: product.variants?.map((v: any) => v.sku).join(" ") || "",
      }));

      if (documents.length > 0) {
        const task = await index.addDocuments(documents);
        console.log(`Indexed ${documents.length} products to MeiliSearch. Task ID: ${task.taskUid}`);
      }
    } catch (error) {
      console.error("Error indexing products to MeiliSearch:", error);
      throw error;
    }
  }

  async clearIndex(indexName: string): Promise<void> {
    const client = await this.initializeClient();
    try {
      const index = client.index(indexName);
      await index.deleteAllDocuments();
      console.log(`Cleared all documents from MeiliSearch index ${indexName}`);
    } catch (error) {
      console.error(`Error clearing MeiliSearch index ${indexName}:`, error);
      // Don't throw here as the index might not exist yet
    }
  }

  async setupProductsIndex(): Promise<void> {
    await this.createIndexIfNotExists("products");
    await this.configureIndex("products");
    // Clear any existing documents to prevent duplicates
    await this.clearIndex("products");
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = await this.initializeClient();
      await client.health();
      console.log("MeiliSearch connection successful");
      return true;
    } catch (error) {
      console.error("MeiliSearch connection failed:", error);
      return false;
    }
  }
}

export function createMeiliSearchManager(): MeiliSearchManager {
  const config: MeiliSearchConfig = {
    host: process.env.MEILISEARCH_HOST!,
    apiKey: process.env.MEILISEARCH_API_KEY!,
  };

  return new MeiliSearchManager(config);
} 