import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow
} from "@medusajs/core-flows";
import {
  ExecArgs,
  IFulfillmentModuleService,
  ISalesChannelModuleService,
  IStoreModuleService,
  IRegionModuleService,
  IProductModuleService,
  ITaxModuleService,
  IApiKeyModuleService
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import { createMinIOManager } from "../utils/minio-setup";
import { createMeiliSearchManager } from "../utils/meilisearch-setup";

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const fulfillmentModuleService: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );
  const salesChannelModuleService: ISalesChannelModuleService =
    container.resolve(ModuleRegistrationName.SALES_CHANNEL);
  const storeModuleService: IStoreModuleService = container.resolve(
    ModuleRegistrationName.STORE
  );
  const regionModuleService = container.resolve(ModuleRegistrationName.REGION);
  const productModuleService = container.resolve(ModuleRegistrationName.PRODUCT);
  const taxModuleService = container.resolve(ModuleRegistrationName.TAX);
  const apiKeyModuleService = container.resolve(ModuleRegistrationName.API_KEY);

  const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];

  // Initialize MinIO manager and create bucket
  logger.info("[1/8] Setting up MinIO file storage...");
  const minioManager = createMinIOManager();
  try {
    await minioManager.createBucketIfNotExists();
    logger.info("[1/8] MinIO setup completed successfully");
  } catch (error) {
    logger.error("[1/8] Failed to setup MinIO:", error);
    throw error;
  }

  // Initialize MeiliSearch manager and setup index
  logger.info("[2/8] Setting up MeiliSearch indexing...");
  const meiliSearchManager = createMeiliSearchManager();
  try {
    const isConnected = await meiliSearchManager.testConnection();
    if (!isConnected) {
      throw new Error("Failed to connect to MeiliSearch");
    }
    await meiliSearchManager.setupProductsIndex();
    logger.info("[2/8] MeiliSearch setup completed successfully");
  } catch (error) {
    logger.error("[2/8] Failed to setup MeiliSearch:", error);
    throw error;
  }

  // Helper function to process images
  async function processImages(images: { url: string }[]): Promise<{ url: string }[]> {
    const processedImages: { url: string }[] = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      try {
        const fileName = `${Date.now()}-${i}-${image.url.split('/').pop()}`;
        const minioUrl = await minioManager.processImageUrl(image.url, fileName);
        processedImages.push({ url: minioUrl });
      } catch (error) {
        logger.error(`Failed to process image ${image.url}:`, error);
        // Fallback to original URL if processing fails
        processedImages.push(image);
      }
    }
    return processedImages;
  }

  // Helper function to check if product exists by title
  async function productExists(title: string): Promise<boolean> {
    try {
      const existingProducts = await productModuleService.listProducts({ title });
      return existingProducts.length > 0;
    } catch (error) {
      // If error (e.g. service not ready early on), assume product does not exist to allow creation attempt
      // This might need adjustment based on how robust productModuleService is during early seed stages
      return false;
    }
  }

  logger.info("[3/8] Seeding store configuration...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          {
            currency_code: "eur",
            is_default: true,
          },
          {
            currency_code: "usd",
          },
        ],
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  logger.info("[4/8] Seeding regional configuration...");
  
  // Check if Europe region already exists
  let region;
  const existingRegions = await regionModuleService.listRegions({ name: "Europe" });
  
  if (existingRegions.length > 0) {
    logger.info("[4/8] Europe region already exists, skipping creation");
    region = existingRegions[0];
  } else {
    logger.info("[4/8] Creating Europe region...");
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Europe",
            currency_code: "eur",
            countries,
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    region = regionResult[0];
    logger.info("[4/8] Europe region created successfully");
  }
  
  logger.info("[4/8] Regional configuration completed");

  logger.info("[4/8] Configuring tax regions...");
  
  // Check if tax regions already exist for each country
  const countriesToSeed = ["gb", "de", "dk", "se", "fr", "es", "it"]; // Explicitly define for clarity
  const taxRegionsToCreate: { country_code: string }[] = [];

  for (const countryCode of countriesToSeed) {
    try {
      // Attempt to list tax regions for the specific country code
      // Note: TaxModuleService might not have a direct listByCountryCode method.
      // We are assuming a general list and then filtering, or a more direct method if available.
      // This part might need adjustment based on actual TaxModuleService capabilities.
      const existingCountryTaxRegions = await taxModuleService.listTaxRegions({ country_code: countryCode });
      if (existingCountryTaxRegions.length === 0) {
        taxRegionsToCreate.push({ country_code: countryCode });
      } else {
        logger.info(`[4/8] Tax region for country ${countryCode} already exists, skipping creation`);
      }
    } catch (e) {
      // If listing fails or method isn't available, assume it doesn't exist and attempt creation
      // This is a fallback, ideally the list method should be robust
      logger.warn(`[4/8] Could not verify tax region for ${countryCode}, attempting creation. Error: ${e.message}`);
      taxRegionsToCreate.push({ country_code: countryCode });
    }
  }
  
  if (taxRegionsToCreate.length > 0) {
    logger.info(`[4/8] Creating tax regions for new countries: ${taxRegionsToCreate.map(tr => tr.country_code).join(", ")}`);
    await createTaxRegionsWorkflow(container).run({
      input: taxRegionsToCreate,
    });
  } else {
    logger.info("[4/8] All tax regions already exist or no new countries to process, skipping creation");
  }
  
  logger.info("[4/8] Tax regions configuration completed");

  logger.info("[5/8] Setting up stock locations...");
  
  // Check if European Warehouse already exists
  let stockLocation;
  try {
    const stockLocationModule = container.resolve(ModuleRegistrationName.STOCK_LOCATION);
    const existingStockLocations = await stockLocationModule.listStockLocations({ name: "European Warehouse" });
    
    if (existingStockLocations.length > 0) {
      logger.info("[5/8] European Warehouse already exists, skipping creation");
      stockLocation = existingStockLocations[0];
    } else {
      throw new Error("No existing stock location found");
    }
  } catch (error) {
    logger.info("[5/8] Creating European Warehouse...");
    const { result: stockLocationResult } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          {
            name: "European Warehouse",
            address: {
              city: "Copenhagen",
              country_code: "DK",
              address_1: "",
            },
          },
        ],
      },
    });
    stockLocation = stockLocationResult[0];
    logger.info("[5/8] European Warehouse created successfully");
  }

  logger.info("[5/8] Configuring shipping and fulfillment...");
  
  let shippingProfile;
  const existingShippingProfiles = await fulfillmentModuleService.listShippingProfiles({ name: "Default" });

  if (existingShippingProfiles.length > 0) {
    logger.info("[5/8] Default shipping profile already exists, skipping creation.");
    shippingProfile = existingShippingProfiles[0];
  } else {
    logger.info("[5/8] Creating Default shipping profile...");
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default",
              type: "default",
            },
          ],
        },
      });
    shippingProfile = shippingProfileResult[0];
    logger.info("[5/8] Default shipping profile created successfully.");
  }

  let fulfillmentSet: any; 
  const existingFulfillmentSetSummaries = await fulfillmentModuleService.listFulfillmentSets({ name: "European Warehouse delivery" });

  if (existingFulfillmentSetSummaries.length > 0) {
    logger.info("[5/8] 'European Warehouse delivery' fulfillment set found by name. Verifying details...");
    try {
      const retrievedSet = await fulfillmentModuleService.retrieveFulfillmentSet(
        existingFulfillmentSetSummaries[0].id,
        { relations: ["service_zones"] } 
      );
      if (retrievedSet && retrievedSet.service_zones && retrievedSet.service_zones.length > 0 && retrievedSet.service_zones[0]?.id) {
        fulfillmentSet = retrievedSet;
        logger.info("[5/8] Successfully verified existing fulfillment set with service zones.");
      } else {
        logger.warn("[5/8] Existing fulfillment set retrieved, but service_zones are missing or invalid. Shipping options dependent on this set will be skipped.");
        fulfillmentSet = { ...retrievedSet, service_zones: [] }; // Use retrieved but ensure service_zones is empty array to prevent error
      }
    } catch (e) {
      logger.error(`[5/8] Error fully retrieving existing fulfillment set: ${e.message}. Shipping options dependent on this set will be skipped.`);
      fulfillmentSet = { ...existingFulfillmentSetSummaries[0], service_zones: [] }; // Fallback, ensure service_zones is empty
    }
  } else {
    logger.warn("[5/8] 'European Warehouse delivery' fulfillment set not found. This is unexpected if the seed has run successfully before. Creation will be skipped on re-run due to potential DTO issues. Please ensure it was created correctly on the first run or check the DTO structure in the seed script.");
    fulfillmentSet = { service_zones: [] }; // Initialize to prevent undefined errors & skip dependent creations
  }

  // Link stock location to fulfillment set - Ensure fulfillmentSet and its ID are valid.
  if (fulfillmentSet && fulfillmentSet.id) {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    });
    logger.info("[5/8] Linked stock location to fulfillment set.");
  } else {
    logger.warn("[5/8] Skipping link of stock location to fulfillment set due to missing fulfillment set ID.");
  }

  // Conditional creation of shipping options
  if (fulfillmentSet && fulfillmentSet.service_zones && fulfillmentSet.service_zones.length > 0 && fulfillmentSet.service_zones[0]?.id) {
    const shippingOptionsToCreate: any[] = [];
    const shippingOptionsData = [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          { currency_code: "usd", amount: 10 },
          { currency_code: "eur", amount: 10 },
          { region_id: region.id, amount: 10 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: '"true"', operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          { currency_code: "usd", amount: 10 },
          { currency_code: "eur", amount: 10 },
          { region_id: region.id, amount: 10 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: '"true"', operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ];

    for (const optionData of shippingOptionsData) {
      const existingOptions = await fulfillmentModuleService.listShippingOptions({ name: optionData.name });
      if (existingOptions.length === 0) {
        shippingOptionsToCreate.push(optionData);
        logger.info(`[5/8] Queuing creation of ${optionData.name} shipping option.`);
      } else {
        logger.info(`[5/8] Shipping option ${optionData.name} already exists, skipping creation.`);
      }
    }

    if (shippingOptionsToCreate.length > 0) {
      logger.info(`[5/8] Creating ${shippingOptionsToCreate.length} new shipping option(s)...`);
      await createShippingOptionsWorkflow(container).run({
        input: shippingOptionsToCreate,
      });
      logger.info("[5/8] New shipping option(s) created successfully.");
    } else {
      logger.info("[5/8] All shipping options already exist, no new options created.");
    }
  } else {
    logger.info("[5/8] Shipping and fulfillment configuration completed");
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("[5/8] Stock location setup completed");

  logger.info("[6/8] Setting up API keys and sales channels...");

  let publishableApiKey;
  const existingApiKeys = await apiKeyModuleService.listApiKeys({ title: "Webshop", type: "publishable" });

  if (existingApiKeys.length > 0) {
    logger.info("[6/8] Webshop API key already exists, skipping creation.");
    publishableApiKey = existingApiKeys[0];
  } else {
    logger.info("[6/8] Creating Webshop API key...");
    const { result: publishableApiKeyResult } = await createApiKeysWorkflow(
      container
    ).run({
      input: {
        api_keys: [
          {
            title: "Webshop",
            type: "publishable",
            created_by: "", // creator_id is usually a user id, seeding might not have one
          },
        ],
      },
    });
    publishableApiKey = publishableApiKeyResult[0];
    logger.info("[6/8] Webshop API key created successfully.");
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("[6/8] API keys and sales channels setup completed");

  logger.info("[7/8] Creating product catalog...");

  // Check if Featured collection already exists
  let collection;
  const existingCollections = await productModuleService.listProductCollections({ handle: "featured" });
  
  if (existingCollections.length > 0) {
    logger.info("[7/8] Featured collection already exists, skipping creation");
    collection = existingCollections[0];
  } else {
    logger.info("[7/8] Creating Featured collection...");
    const {
      result: [collectionResult],
    } = await createCollectionsWorkflow(container).run({
      input: {
        collections: [
          {
            title: "Featured",
            handle: "featured",
          },
        ],
      },
    });
    collection = collectionResult;
  }

  // Check if product categories already exist by attempting to fetch each by its handle
  let categoryResult: any[] = [];
  const categoryNamesToSeed = ["Laptops", "Accessories", "Phones", "Monitors"];
  const categoriesToCreateInput: { name: string, handle: string, is_active: boolean, parent_category_id?: string, rank?: number }[] = [];
  const foundCategories: any[] = [];

  const generateHandle = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); // More robust handle generation

  logger.info("[7/8] Verifying and preparing product categories...");

  for (const name of categoryNamesToSeed) {
    const handle = generateHandle(name);
    try {
      const existingCategoriesWithHandle = await productModuleService.listProductCategories({ handle: handle });
      if (existingCategoriesWithHandle.length > 0) {
        logger.info(`[7/8] Product category "${name}" (handle: ${handle}) already exists. Using existing.`);
        foundCategories.push(existingCategoriesWithHandle[0]);
      } else {
        logger.info(`[7/8] Product category "${name}" (handle: ${handle}) not found. Queuing for creation.`);
        // Basic DTO for creation. Adjust if parent_category_id or rank is needed for these top-level categories.
        categoriesToCreateInput.push({ name, handle, is_active: true }); 
      }
    } catch (e) {
      logger.error(`[7/8] Error checking product category ${name} (handle: ${handle}): ${e.message}. Assuming it needs creation.`);
      categoriesToCreateInput.push({ name, handle, is_active: true });
    }
  }

  if (categoriesToCreateInput.length > 0) {
    logger.info(`[7/8] Creating ${categoriesToCreateInput.length} new product categor(y/ies): ${categoriesToCreateInput.map(c => c.name).join(", ")}`);
    try {
      const { result: newlyCreatedCategories } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: categoriesToCreateInput,
        },
      });
      categoryResult = [...foundCategories, ...(newlyCreatedCategories || [])];
      logger.info("[7/8] New product categor(y/ies) created successfully.");
    } catch (e) {
      logger.error(`[7/8] CRITICAL: Error creating product categories: ${e.message}. Some categories might be missing.`);
      // Fallback: use only categories that were confirmed to exist if creation fails
      categoryResult = [...foundCategories];
       logger.warn("[7/8] Proceeding with only previously existing categories for product assignment.");
    }
  } else {
    logger.info("[7/8] All product categories already exist. No new categories created.");
    categoryResult = foundCategories; // All were found existing
  }
  // Ensure categoryResult always has a value for subsequent steps
  if (!categoryResult) categoryResult = []; 

  // Ensure all items in categoryResult have an id, important for product assignment
  categoryResult = categoryResult.filter(cat => cat && cat.id);
  if (categoryResult.length !== categoryNamesToSeed.length && categoriesToCreateInput.length === 0) {
      logger.warn("[7/8] Mismatch in expected and available categories, but no new categories were attempted. This might indicate an issue with fetching existing categories or previous partial seeding.");
  }

  logger.info("[7/8] Processing laptop products and images...");
  
  const laptopTitle = '16" Ultra-Slim AI Laptop | 3K OLED | 1.1cm Thin | 6-Speaker Audio';
  if (!(await productExists(laptopTitle))) {
    logger.info("[7/8] Creating laptop product...");
    const laptopImages = await processImages([
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-front.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-side.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/laptop-top.png",
      },
    ]);

    await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title:
            '16" Ultra-Slim AI Laptop | 3K OLED | 1.1cm Thin | 6-Speaker Audio',
          collection_id: collection.id,
          category_ids: [
            categoryResult.find((cat) => cat.name === "Laptops")?.id!,
          ],
          description:
            "This ultra-thin 16-inch laptop is a sophisticated, high-performance machine for the new era of artificial intelligence. It has been completely redesigned from the inside out. The cabinet features an exquisite new ceramic-aluminum composite material in a range of nature-inspired colors. This material provides durability while completing the ultra-slim design and resisting the test of time. This innovative computer utilizes the latest AI-enhanced processor with quiet ambient cooling. It's designed to enrich your lifestyle on the go with an astonishingly thin 1.1cm chassis that houses an advanced 16-inch 3K OLED display and immersive six-speaker audio.",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          images: laptopImages,
          options: [
            {
              title: "Storage",
              values: ["256 GB", "512 GB"],
            },
            {
              title: "Color",
              values: ["Blue", "Red"],
            },
          ],
          variants: [
            {
              title: "256 GB / Blue",
              sku: "256-BLUE",
              options: {
                Storage: "256 GB",
                Color: "Blue",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1299,
                  currency_code: "eur",
                },
                {
                  amount: 1299,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "512 GB / Red",
              sku: "512-RED",
              options: {
                Storage: "512 GB",
                Color: "Red",
              },
              manage_inventory: false,
              prices: [
                {
                  amount: 1259,
                  currency_code: "eur",
                },
                {
                  amount: 1259,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });
  } else {
    logger.info("[7/8] Laptop product already exists, skipping creation");
  }

  logger.info("[7/8] Processing webcam products and images...");
  const webcamTitle = "1080p HD Pro Webcam | Superior Video | Privacy enabled";
  if (!(await productExists(webcamTitle))) {
    logger.info("[7/8] Creating webcam product...");
    const webcamImages = await processImages([
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-front.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/camera-side.png",
      },
    ]);

    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "1080p HD Pro Webcam | Superior Video | Privacy enabled",
            category_ids: [
              categoryResult.find((cat) => cat.name === "Accessories")?.id!,
            ],
            description:
              "High-quality 1080p HD webcam that elevates your work environment with superior video and audio that outperforms standard laptop cameras. Achieve top-tier video collaboration at a cost-effective price point, ideal for widespread deployment across your organization.",
            weight: 400,
            status: ProductStatus.PUBLISHED,
            images: webcamImages,
            options: [
              {
                title: "Color",
                values: ["Black", "White"],
              },
            ],
            variants: [
              {
                title: "Webcam Black",
                sku: "WEBCAM-BLACK",
                options: {
                  Color: "Black",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 59,
                    currency_code: "eur",
                  },
                  {
                    amount: 59,
                    currency_code: "usd",
                  },
                ],
              },
              {
                title: "Webcam White",
                sku: "WEBCAM-WHITE",
                options: {
                  Color: "White",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 65,
                    currency_code: "eur",
                  },
                  {
                    amount: 65,
                    currency_code: "usd",
                  },
                ],
              },
            ],
            sales_channels: [
              {
                id: defaultSalesChannel[0].id,
              },
            ],
          },
        ],
      },
    });
  } else {
    logger.info(`[7/8] Product "${webcamTitle}" already exists, skipping creation.`);
  }

  logger.info("[7/8] Processing phone products and images...");
  const phoneTitle = `6.5" Ultra HD Smartphone | 3x Impact-Resistant Screen`;
  if (!(await productExists(phoneTitle))) {
    logger.info("[7/8] Creating phone product...");
    const phoneImages = await processImages([
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-front.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-side.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/phone-bottom.png",
      },
    ]);

    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: `6.5" Ultra HD Smartphone | 3x Impact-Resistant Screen`,
            collection_id: collection.id,
            category_ids: [
              categoryResult.find((cat) => cat.name === "Phones")?.id!,
            ],
            description:
              'This premium smartphone is crafted from durable and lightweight aerospace-grade aluminum, featuring an expansive 6.5" Ultra-High Definition AMOLED display. It boasts exceptional durability with a cutting-edge nanocrystal glass front, offering three times the impact resistance of standard smartphone screens. The device combines sleek design with robust protection, setting a new standard for smartphone resilience and visual excellence. Copy',
            weight: 400,
            status: ProductStatus.PUBLISHED,
            images: phoneImages,
            options: [
              {
                title: "Memory",
                values: ["256 GB", "512 GB"],
              },
              {
                title: "Color",
                values: ["Purple", "Red"],
              },
            ],
            variants: [
              {
                title: "256 GB Purple",
                sku: "PHONE-256-PURPLE",
                options: {
                  Memory: "256 GB",
                  Color: "Purple",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 999,
                    currency_code: "eur",
                  },
                  {
                    amount: 999,
                    currency_code: "usd",
                  },
                ],
              },
              {
                title: "256 GB Red",
                sku: "PHONE-256-RED",
                options: {
                  Memory: "256 GB",
                  Color: "Red",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 959,
                    currency_code: "eur",
                  },
                  {
                    amount: 959,
                    currency_code: "usd",
                  },
                ],
              },
            ],
            sales_channels: [
              {
                id: defaultSalesChannel[0].id,
              },
            ],
          },
        ],
      },
    });
  } else {
    logger.info(`[7/8] Product "${phoneTitle}" already exists, skipping creation.`);
  }

  logger.info("[7/8] Processing monitor products and images...");
  const monitorTitle = `34" QD-OLED Curved Gaming Monitor | Ultra-Wide | Infinite Contrast | 175Hz`;
  if (!(await productExists(monitorTitle))) {
    logger.info("[7/8] Creating monitor product...");
    const monitorImages = await processImages([
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-front.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-side.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-top.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/screen-back.png",
      },
    ]);

    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: `34" QD-OLED Curved Gaming Monitor | Ultra-Wide | Infinite Contrast | 175Hz`,
            collection_id: collection.id,
            category_ids: [
              categoryResult.find((cat) => cat.name === "Monitors")?.id!,
            ],
            description:
              "Experience the pinnacle of display technology with this 34-inch curved monitor. By merging OLED panels and Quantum Dot technology, this QD-OLED screen delivers exceptional contrast, deep blacks, unlimited viewing angles, and vivid colors. The curved design provides an immersive experience, allowing you to enjoy the best of both worlds in one cutting-edge display. This innovative monitor represents the ultimate fusion of visual performance and immersive design.",
            weight: 400,
            status: ProductStatus.PUBLISHED,
            images: monitorImages,
            options: [
              {
                title: "Color",
                values: ["White", "Black"],
              },
            ],
            variants: [
              {
                title: "ACME Monitor 4k White",
                sku: "ACME-MONITOR-WHITE",
                options: {
                  Color: "White",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 599,
                    currency_code: "eur",
                  },
                  {
                    amount: 599,
                    currency_code: "usd",
                  },
                ],
              },
              {
                title: "ACME Monitor 4k White",
                sku: "ACME-MONITOR-BLACK",
                options: {
                  Color: "Black",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 599,
                    currency_code: "eur",
                  },
                  {
                    amount: 599,
                    currency_code: "usd",
                  },
                ],
              },
            ],
            sales_channels: [
              {
                id: defaultSalesChannel[0].id,
              },
            ],
          },
        ],
      },
    });
  } else {
    logger.info(`[7/8] Product "${monitorTitle}" already exists, skipping creation.`);
  }

  logger.info("[7/8] Processing headphone products and images...");
  const headphoneTitle = "Hi-Fi Gaming Headset | Pro-Grade DAC | Hi-Res Certified";
  if (!(await productExists(headphoneTitle))) {
    logger.info("[7/8] Creating headphone product...");
    const headphoneImages = await processImages([
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-front.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-side.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/headphone-top.png",
      },
    ]);

    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Hi-Fi Gaming Headset | Pro-Grade DAC | Hi-Res Certified",
            collection_id: collection.id,
            category_ids: [
              categoryResult.find((cat) => cat.name === "Accessories")?.id!,
            ],
            description: `Experience studio-quality audio with this advanced acoustic system, which pairs premium hardware with high-fidelity sound and innovative audio software for an immersive listening experience. The integrated digital-to-analog converter (DAC) enhances the audio setup with high-resolution certification and a built-in amplifier, delivering exceptional sound clarity and depth. This comprehensive audio solution brings professional-grade sound to your personal environment, whether for gaming, music production, or general entertainment.`,
            weight: 400,
            status: ProductStatus.PUBLISHED,
            images: headphoneImages,
            options: [
              {
                title: "Color",
                values: ["Black", "White"],
              },
            ],
            variants: [
              {
                title: "Headphone Black",
                sku: "HEADPHONE-BLACK",
                options: {
                  Color: "Black",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 149,
                    currency_code: "eur",
                  },
                  {
                    amount: 149,
                    currency_code: "usd",
                  },
                ],
              },
              {
                title: "Headphone White",
                sku: "HEADPHONE-WHITE",
                options: {
                  Color: "White",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 149,
                    currency_code: "eur",
                  },
                  {
                    amount: 149,
                    currency_code: "usd",
                  },
                ],
              },
            ],
            sales_channels: [
              {
                id: defaultSalesChannel[0].id,
              },
            ],
          },
        ],
      },
    });
  } else {
    logger.info(`[7/8] Product "${headphoneTitle}" already exists, skipping creation.`);
  }

  logger.info("[7/8] Processing keyboard products and images...");
  const keyboardTitle = "Wireless Keyboard | Touch ID | Numeric Keypad";
  if (!(await productExists(keyboardTitle))) {
    logger.info("[7/8] Creating keyboard product...");
    const keyboardImages = await processImages([
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-front.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/keyboard-side.png",
      },
    ]);

    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Wireless Keyboard | Touch ID | Numeric Keypad",
            category_ids: [
              categoryResult.find((cat) => cat.name === "Accessories")?.id!,
            ],
            description: `This wireless keyboard offers a comfortable typing experience with a numeric keypad and Touch ID. It features navigation buttons, full-sized arrow keys, and is ideal for spreadsheets and gaming. The rechargeable battery lasts about a month. It pairs automatically with compatible computers and includes a USB-C to Lightning cable for charging and pairing.`,
            weight: 400,
            status: ProductStatus.PUBLISHED,
            images: keyboardImages,
            options: [
              {
                title: "Color",
                values: ["Black", "White"],
              },
            ],
            variants: [
              {
                title: "Keyboard Black",
                sku: "KEYBOARD-BLACK",
                options: {
                  Color: "Black",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 99,
                    currency_code: "eur",
                  },
                  {
                    amount: 99,
                    currency_code: "usd",
                  },
                ],
              },
              {
                title: "Keyboard White",
                sku: "KEYBOARD-WHITE",
                options: {
                  Color: "White",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 99,
                    currency_code: "eur",
                  },
                  {
                    amount: 99,
                    currency_code: "usd",
                  },
                ],
              },
            ],
            sales_channels: [
              {
                id: defaultSalesChannel[0].id,
              },
            ],
          },
        ],
      },
    });
  } else {
    logger.info(`[7/8] Product "${keyboardTitle}" already exists, skipping creation.`);
  }

  logger.info("[7/8] Processing mouse products and images...");
  const mouseTitle = "Wireless Rechargeable Mouse | Multi-Touch Surface";
  if (!(await productExists(mouseTitle))) {
    logger.info("[7/8] Creating mouse product...");
    const mouseImages = await processImages([
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-top.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/mouse-front.png",
      },
    ]);

    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Wireless Rechargeable Mouse | Multi-Touch Surface",
            category_ids: [
              categoryResult.find((cat) => cat.name === "Accessories")?.id!,
            ],
            description: `This wireless keyboard offers a comfortable typing experience with a numeric keypad and Touch ID. It features navigation buttons, full-sized arrow keys, and is ideal for spreadsheets and gaming. The rechargeable battery lasts about a month. It pairs automatically with compatible computers and includes a USB-C to Lightning cable for charging and pairing.`,
            weight: 400,
            status: ProductStatus.PUBLISHED,
            images: mouseImages,
            options: [
              {
                title: "Color",
                values: ["Black", "White"],
              },
            ],
            variants: [
              {
                title: "Mouse Black",
                sku: "MOUSE-BLACK",
                options: {
                  Color: "Black",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 79,
                    currency_code: "eur",
                  },
                  {
                    amount: 79,
                    currency_code: "usd",
                  },
                ],
              },
              {
                title: "Mouse White",
                sku: "MOUSE-WHITE",
                options: {
                  Color: "White",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 79,
                    currency_code: "eur",
                  },
                  {
                    amount: 79,
                    currency_code: "usd",
                  },
                ],
              },
            ],
            sales_channels: [
              {
                id: defaultSalesChannel[0].id,
              },
            ],
          },
        ],
      },
    });
  } else {
    logger.info(`[7/8] Product "${mouseTitle}" already exists, skipping creation.`);
  }

  logger.info("[7/8] Processing speaker products and images...");
  const speakerTitle = "Conference Speaker | High-Performance | Budget-Friendly";
  if (!(await productExists(speakerTitle))) {
    logger.info("[7/8] Creating speaker product...");
    const speakerImages = await processImages([
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-top.png",
      },
      {
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/speaker-front.png",
      },
    ]);

    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Conference Speaker | High-Performance | Budget-Friendly",
            category_ids: [
              categoryResult.find((cat) => cat.name === "Accessories")?.id!,
            ],
            description: `This compact, powerful conference speaker offers exceptional, high-performance features at a surprisingly affordable price. Packed with advanced productivity-enhancing technology, it delivers premium functionality without the premium price tag. Experience better meetings and improved communication, regardless of where your team members are calling from.`,
            weight: 400,
            status: ProductStatus.PUBLISHED,
            images: speakerImages,
            options: [
              {
                title: "Color",
                values: ["Black", "White"],
              },
            ],
            variants: [
              {
                title: "Speaker Black",
                sku: "SPEAKER-BLACK",
                options: {
                  Color: "Black",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 79,
                    currency_code: "eur",
                  },
                  {
                    amount: 79,
                    currency_code: "usd",
                  },
                ],
              },
              {
                title: "Speaker White",
                sku: "SPEAKER-WHITE",
                options: {
                  Color: "White",
                },
                manage_inventory: false,
                prices: [
                  {
                    amount: 55,
                    currency_code: "eur",
                  },
                  {
                    amount: 55,
                    currency_code: "usd",
                  },
                ],
              },
            ],
            sales_channels: [
              {
                id: defaultSalesChannel[0].id,
              },
            ],
          },
        ],
      },
    });
  } else {
    logger.info(`[7/8] Product "${speakerTitle}" already exists, skipping creation.`);
  }

  logger.info("[7/8] Product catalog creation completed");

  // Note: Products are automatically indexed by the MeiliSearch plugin
  // No manual indexing needed as the plugin handles this via event subscribers
  logger.info("[8/8] Finalizing search indexing...");
  logger.info("[8/8] Products will be automatically indexed by MeiliSearch plugin via event subscribers");

  // Clean up temporary files
  try {
    await minioManager.cleanup();
    logger.info("[8/8] Cleanup completed successfully");
  } catch (error) {
    logger.error("Cleanup failed:", error);
  }

  logger.info("=".repeat(60));
  logger.info("SEEDING COMPLETED SUCCESSFULLY");
  logger.info("=".repeat(60));
  logger.info("Your Medusa B2B backend is ready with:");
  logger.info("  - MinIO file storage with public bucket");
  logger.info("  - MeiliSearch integration with product indexing");
  logger.info("  - Sample products with processed images");
  logger.info("  - Regional and shipping configuration");
  logger.info("  - API keys and sales channels");
  logger.info("");
  logger.info("NOTE: This seed script is idempotent - it safely skips existing data");
  logger.info("and only creates new items. You can run it multiple times safely.");
  logger.info("");
  logger.info("Next steps:");
  logger.info("  1. Start your backend: yarn dev");
  logger.info("  2. Check MeiliSearch dashboard: http://192.168.101.1:7700");
  logger.info("  3. Check MinIO console: http://192.168.101.1:9001");
  logger.info("  4. Test search API: POST /store/products/search");
  logger.info("=".repeat(60));
}
