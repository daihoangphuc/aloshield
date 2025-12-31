import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class R2Service implements OnModuleInit {
  private s3Client: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') || 'aloshield';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      console.warn('R2 configuration is missing, file uploads will not work');
      return;
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadFile(
    buffer: Buffer,
    conversationId: string,
    originalName: string,
    mimeType: string,
  ): Promise<{ key: string; fileId: string }> {
    const fileId = uuidv4();
    const key = `conversations/${conversationId}/${fileId}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/octet-stream', // Always binary for encrypted files
        Metadata: {
          'original-name': encodeURIComponent(originalName),
          'original-type': mimeType,
          encrypted: 'true',
        },
      }),
    );

    return { key, fileId };
  }

  async uploadThumbnail(
    buffer: Buffer,
    conversationId: string,
    fileId: string,
  ): Promise<string> {
    const key = `conversations/${conversationId}/thumbnails/${fileId}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/octet-stream',
      }),
    );

    return key;
  }

  async getFile(key: string): Promise<Buffer> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}


