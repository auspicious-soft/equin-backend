
import { Readable } from "stream";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client } from "src/config/s3";

export const uploadStreamToS3Service = async (
  fileStream: Readable,
  fileName: string,
  fileType: string,
  userEmail: string
): Promise<string> => {
  const timestamp = Date.now();
  const imageKey = `users/${userEmail}/images/${timestamp}-${fileName}`;
  
  // Convert stream to buffer
  const chunks: any[] = [];
  for await (const chunk of fileStream) {
    chunks.push(chunk);
  }
  const fileBuffer = Buffer.concat(chunks);
  
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: imageKey,
    Body: fileBuffer,
    ContentType: fileType,
  };
  
  const s3Client = createS3Client();
  const command = new PutObjectCommand(params);
  await s3Client.send(command);
  
  return imageKey;
};
