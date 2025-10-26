import { writeFile, mkdir, readFile } from 'fs/promises';
import { exists } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Local file storage service for development
export class LocalStorageService {
  private storageDir: string;

  constructor() {
    this.storageDir = join(process.cwd(), 'uploads');
    this.ensureStorageDir();
  }

  private async ensureStorageDir() {
    try {
      await mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Error creating storage directory:', error);
    }
  }

  async uploadFile(
    filePath: string,
    buffer: Buffer,
    mimeType: string = 'application/octet-stream'
  ): Promise<string> {
    try {
      const fullPath = join(this.storageDir, filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      
      // Create directory if it doesn't exist
      await mkdir(dir, { recursive: true });
      
      // Write file
      await writeFile(fullPath, buffer);
      
      // Return local URL
      return `/uploads/${filePath}`;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    try {
      const fullPath = join(this.storageDir, filePath);
      return await readFile(fullPath);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error('File not found');
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = join(this.storageDir, filePath);
      return new Promise((resolve) => {
        exists(fullPath, resolve);
      });
    } catch (error) {
      return false;
    }
  }

  generateUniqueFileName(originalName: string, extension?: string): string {
    const uuid = randomUUID();
    const ext = extension || originalName.split('.').pop() || 'bin';
    return `${uuid}.${ext}`;
  }
}

export const localStorage = new LocalStorageService();
