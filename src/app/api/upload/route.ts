import { NextRequest, NextResponse } from "next/server";
import { requireAuth, createAuthErrorResponse, createErrorResponse } from "@/lib/auth-helpers";
import { analyzeEngineeringDrawing } from "@/lib/services/gemini";
import { convertPDFToImage } from "@/lib/services/pdfConverter";
import { extractPDFText } from "@/lib/services/pdfTextExtractor";
import { storage } from "@/lib/storage";
import { parseFormData, validateFileType, validateFileSize } from "@/lib/file-upload-helpers";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const { file, fields } = await parseFormData(request);
    
    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }
    
    if (!validateFileType(file)) {
      return NextResponse.json({ 
        message: "Invalid file type. Only PDF, PNG, and JPG files are allowed." 
      }, { status: 400 });
    }
    
    if (!validateFileSize(file)) {
      return NextResponse.json({ 
        message: "File too large. Maximum size is 50MB." 
      }, { status: 400 });
    }

    const metadata = fields.metadata ? JSON.parse(fields.metadata) : {};

    // Upload to storage
    const fileName = `${Date.now()}-${file.fileName}`;
    const uploadResult = await storage.uploadFile(fileName, file.buffer, file.fileType);

    let analysisResult = null;
    let extractedText = null;
    let thumbnailUrl = null;

    // Process PDF files
    if (file.fileType === "application/pdf") {
      try {
        // Extract text
        extractedText = await extractPDFText(file.buffer);
        
        // Convert to image for analysis
        const imageBuffer = await convertPDFToImage(file.buffer);
        if (imageBuffer) {
          // Analyze with AI
          analysisResult = await analyzeEngineeringDrawing(imageBuffer);
          
          // Upload thumbnail
          const thumbnailName = `thumbnails/${fileName}.png`;
          await storage.uploadFile(thumbnailName, imageBuffer, "image/png");
          thumbnailUrl = storage.getFileUrl(thumbnailName);
        }
      } catch (error) {
        console.error("Error processing PDF:", error);
      }
    } else {
      // Process image files
      try {
        analysisResult = await analyzeEngineeringDrawing(file.buffer);
        thumbnailUrl = uploadResult.url;
      } catch (error) {
        console.error("Error analyzing image:", error);
      }
    }

    // Save to database
    const drawing = await storage.createDrawing({
      fileName: file.fileName,
      fileSize: file.fileSize,
      fileType: file.fileType,
      uploadUrl: uploadResult.url,
      thumbnailUrl,
      uploadedBy: user.id,
      extractedText,
      aiAnalysis: analysisResult,
      metadata: {
        ...metadata,
        uploadMethod: analysisResult ? "ai" : "manual",
      },
    });

    return NextResponse.json({
      success: true,
      drawing,
      analysis: analysisResult,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAuthErrorResponse();
    }
    
    console.error("Error uploading file:", error);
    return createErrorResponse("Failed to upload file");
  }
}
