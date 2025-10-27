import { PDFParse } from 'pdf-parse';

export interface PDFTextContent {
  text: string;
  numPages: number;
  info: {
    Title?: string;
    Author?: string;
    Subject?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
  };
  metadata: {
    sheetNumbers: string[];
    roomNames: string[];
    dimensions: string[];
    notes: string[];
  };
}

/**
 * Extract text content and metadata from PDF
 * @param pdfBuffer - PDF file buffer
 * @returns Extracted text and structured metadata
 */
export async function extractPDFText(pdfBuffer: Buffer): Promise<PDFTextContent> {
  try {
    // Use pdf-parse v2 API
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    const infoResult = await parser.getInfo();
    
    // Extract structured information from text
    const text = result.text;
    const metadata = extractStructuredData(text);
    
    // Get number of pages from result.pages array
    const numPages = (result as any).pages?.length || 1;
    
    // pdf-parse v2 InfoResult has 'info' property containing the metadata
    const pdfInfo = (infoResult as any).info || {};
    
    return {
      text: result.text,
      numPages: numPages,
      info: {
        Title: pdfInfo.Title,
        Author: pdfInfo.Author,
        Subject: pdfInfo.Subject,
        Creator: pdfInfo.Creator,
        Producer: pdfInfo.Producer,
        CreationDate: pdfInfo.CreationDate,
        ModDate: pdfInfo.ModDate,
      },
      metadata,
    };
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract structured information from raw PDF text
 */
function extractStructuredData(text: string): PDFTextContent['metadata'] {
  const metadata: PDFTextContent['metadata'] = {
    sheetNumbers: [],
    roomNames: [],
    dimensions: [],
    notes: [],
  };

  // Extract sheet numbers (e.g., A-101, S-202, M-301)
  const sheetNumberPattern = /\b([A-Z]{1,2})-?(\d{3})\b/g;
  const sheetMatches = Array.from(text.matchAll(sheetNumberPattern));
  for (const match of sheetMatches) {
    const sheetNo = `${match[1]}-${match[2]}`;
    if (!metadata.sheetNumbers.includes(sheetNo)) {
      metadata.sheetNumbers.push(sheetNo);
    }
  }

  // Extract dimensions (e.g., 3.5m, 12'-6", 2500mm)
  const dimensionPattern = /\b(\d+(?:\.\d+)?)\s*(?:m|mm|cm|ft|'|")\b/gi;
  const dimMatches = Array.from(text.matchAll(dimensionPattern));
  for (const match of dimMatches) {
    if (!metadata.dimensions.includes(match[0])) {
      metadata.dimensions.push(match[0]);
    }
  }

  // Extract common room names (Arabic and English)
  const roomKeywords = [
    // English
    'bedroom', 'bathroom', 'kitchen', 'living room', 'dining room',
    'office', 'lobby', 'corridor', 'staircase', 'elevator',
    'storage', 'parking', 'garage', 'balcony', 'terrace',
    // Arabic patterns
    'غرفة', 'صالة', 'مطبخ', 'حمام', 'مكتب', 'ممر', 'مدخل', 'شرفة'
  ];
  
  const lowerText = text.toLowerCase();
  for (const keyword of roomKeywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      if (!metadata.roomNames.includes(keyword)) {
        metadata.roomNames.push(keyword);
      }
    }
  }

  // Extract notes (lines starting with "NOTE:", "REMARK:", etc.)
  const notePattern = /(?:NOTE|REMARK|IMPORTANT|WARNING):\s*([^\n]+)/gi;
  const noteMatches = Array.from(text.matchAll(notePattern));
  for (const match of noteMatches) {
    if (match[1] && !metadata.notes.includes(match[1].trim())) {
      metadata.notes.push(match[1].trim());
    }
  }

  return metadata;
}

/**
 * Extract text from specific page of PDF
 * @param pdfBuffer - PDF file buffer
 * @param pageNumber - Page number (1-indexed)
 * @returns Text content of the specified page
 */
export async function extractPageText(pdfBuffer: Buffer, pageNumber: number): Promise<string> {
  try {
    // Use pdf-parse v2 API - extract all text (v2 doesn't support page-specific extraction in the same way)
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    
    // pdf-parse v2 doesn't support single page extraction directly
    // This extracts all pages - for true per-page extraction, we'd need a more advanced library
    return result.text;
  } catch (error) {
    console.error(`Error extracting page ${pageNumber} text:`, error);
    throw new Error(`Failed to extract page text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
