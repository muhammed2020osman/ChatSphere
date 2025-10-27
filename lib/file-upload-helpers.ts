import { NextRequest } from "next/server";

export interface FileUploadResult {
  fileName: string;
  fileSize: number;
  fileType: string;
  buffer: Buffer;
}

/**
 * Parse multipart form data for file uploads
 */
export async function parseFormData(request: NextRequest): Promise<{
  file?: FileUploadResult;
  fields: Record<string, string>;
}> {
  const formData = await request.formData();
  const fields: Record<string, string> = {};
  let file: FileUploadResult | undefined;

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const buffer = Buffer.from(await value.arrayBuffer());
      file = {
        fileName: value.name,
        fileSize: value.size,
        fileType: value.type,
        buffer,
      };
    } else {
      fields[key] = value;
    }
  }

  return { file, fields };
}

/**
 * Validate file type
 */
export function validateFileType(file: FileUploadResult): boolean {
  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ];
  
  return allowedTypes.includes(file.fileType);
}

/**
 * Validate file size (50MB max)
 */
export function validateFileSize(file: FileUploadResult): boolean {
  const maxSize = 50 * 1024 * 1024; // 50MB
  return file.fileSize <= maxSize;
}



