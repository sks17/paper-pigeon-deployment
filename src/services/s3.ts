import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
  },
});

export class S3Service {
  private bucketName: string;

  constructor() {
    this.bucketName = import.meta.env.VITE_S3_BUCKET_NAME || '';
    if (!this.bucketName) {
      throw new Error('S3 bucket name not configured');
    }
  }

  /**
   * Generate a presigned URL for a PDF document
   * @param labId - The lab ID from the papers table
   * @param documentId - The document ID (without .pdf extension)
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns Presigned URL for the PDF
   */
  async getPresignedPdfUrl(labId: string, documentId: string, expiresIn: number = 3600): Promise<string> {
    try {
      const key = `${labId}/${documentId}.pdf`;
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      return presignedUrl;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error(`Failed to generate PDF URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a PDF exists in S3
   * @param labId - The lab ID from the papers table
   * @param documentId - The document ID (without .pdf extension)
   * @returns Promise<boolean> indicating if the PDF exists
   */
  async pdfExists(labId: string, documentId: string): Promise<boolean> {
    try {
      const key = `${labId}/${documentId}.pdf`;
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      // If the object doesn't exist, S3 will throw a 404 error
      return false;
    }
  }
}

// Export singleton instance
export const s3Service = new S3Service();
