import { S3Client, CreateBucketCommand, HeadBucketCommand, PutObjectCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

export interface MinIOConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  forcePathStyle: boolean;
}

export class MinIOManager {
  private s3Client: S3Client;
  private config: MinIOConfig;

  constructor(config: MinIOConfig) {
    this.config = config;
    this.s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle,
    });
  }

  async createBucketIfNotExists(): Promise<void> {
    try {
      // Check if bucket exists
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
      console.log(`Bucket ${this.config.bucket} already exists`);
      
      // Set public policy even if bucket exists to ensure it's public
      await this.setBucketPublicPolicy();
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        try {
          // Create bucket
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
          console.log(`Bucket ${this.config.bucket} created successfully`);
          
          // Set bucket policy to public
          await this.setBucketPublicPolicy();
        } catch (createError) {
          console.error(`Error creating bucket ${this.config.bucket}:`, createError);
          throw createError;
        }
      } else {
        console.error(`Error checking bucket ${this.config.bucket}:`, error);
        throw error;
      }
    }
  }

  private async setBucketPublicPolicy(): Promise<void> {
    try {
      const bucketPolicy = {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "PublicReadGetObject",
            Effect: "Allow",
            Principal: "*",
            Action: "s3:GetObject",
            Resource: `arn:aws:s3:::${this.config.bucket}/*`
          }
        ]
      };

      const policyCommand = new PutBucketPolicyCommand({
        Bucket: this.config.bucket,
        Policy: JSON.stringify(bucketPolicy)
      });

      await this.s3Client.send(policyCommand);
      console.log(`Bucket ${this.config.bucket} policy set to public read access`);
    } catch (error) {
      console.error(`Error setting bucket policy for ${this.config.bucket}:`, error);
      // Don't throw here as the bucket creation was successful, just log the warning
      console.warn("Bucket created but public policy could not be set. You may need to set it manually.");
    }
  }

  async downloadFile(url: string, tempPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
          return;
        }

        const fileStream = fs.createWriteStream(tempPath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        fileStream.on('error', (error) => {
          fs.unlink(tempPath, () => {}); // Delete the file on error
          reject(error);
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  async uploadFile(filePath: string, key: string, contentType: string): Promise<string> {
    try {
      const fileContent = fs.readFileSync(filePath);
      
      const uploadParams = {
        Bucket: this.config.bucket,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
      };

      await this.s3Client.send(new PutObjectCommand(uploadParams));
      
      // Return the public URL
      const publicUrl = `${this.config.endpoint}/${this.config.bucket}/${key}`;
      return publicUrl;
    } catch (error) {
      console.error(`Error uploading file ${key}:`, error);
      throw error;
    }
  }

  async processImageUrl(originalUrl: string, fileName: string): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    const tempFilePath = path.join(tempDir, fileName);

    try {
      // Create temp directory if it doesn't exist
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      console.log(`Downloading ${originalUrl}...`);
      await this.downloadFile(originalUrl, tempFilePath);

      console.log(`Uploading ${fileName} to MinIO...`);
      const contentType = this.getContentType(fileName);
      const minioUrl = await this.uploadFile(tempFilePath, fileName, contentType);

      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      console.log(`Successfully processed ${fileName}`);

      return minioUrl;
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      console.error(`Error processing ${originalUrl}:`, error);
      throw error;
    }
  }

  private getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  async cleanup(): Promise<void> {
    const tempDir = path.join(process.cwd(), 'temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('Cleaned up temporary directory');
    }
  }
}

export function createMinIOManager(): MinIOManager {
  const config: MinIOConfig = {
    endpoint: process.env.S3_ENDPOINT!,
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    region: process.env.S3_REGION!,
    bucket: process.env.S3_BUCKET!,
    forcePathStyle: true,
  };

  return new MinIOManager(config);
} 