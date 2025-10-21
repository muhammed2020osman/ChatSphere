import { GoogleGenAI } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"

// Initialize Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * AI-extracted data structure from engineering drawings
 */
export interface DrawingAnalysis {
  title?: string;
  layers?: string[];
  dimensions?: Array<{
    value: string;
    unit?: string;
    location?: string;
  }>;
  elements?: Array<{
    type: string;
    description: string;
    quantity?: number;
  }>;
  titleBlock?: {
    sheetNumber?: string;
    revision?: string;
    projectName?: string;
    discipline?: string;
    floor?: string;
    scale?: string;
    date?: string;
  };
  annotations?: string[];
  summary?: string;
}

/**
 * Analyze an engineering drawing image using Gemini Vision API
 * Extracts structured data including layers, dimensions, elements, and title block info
 * 
 * @param imageBuffer - The image file buffer (PNG, JPG, or PDF first page)
 * @param mimeType - The MIME type of the image (e.g., "image/jpeg", "image/png")
 * @returns Structured analysis of the drawing
 */
export async function analyzeEngineeringDrawing(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<DrawingAnalysis> {
  try {
    const systemPrompt = `You are an expert engineering drawings analyzer specialized in construction and architectural blueprints.

Analyze this technical drawing and extract structured information in JSON format.

Focus on:
1. **Title Block**: Extract sheet number, revision, project name, discipline (ARCH/STR/MEP/GEN), floor level, scale, and date
2. **Layers/Disciplines**: Identify visible layers or disciplines (Architectural, Structural, MEP, General)
3. **Dimensions**: Extract key dimensions with units and their approximate locations
4. **Elements**: Identify major building elements (walls, columns, beams, doors, windows, equipment)
5. **Annotations**: Extract important text annotations, notes, or callouts
6. **Summary**: Provide a brief technical summary of what this drawing represents

Return JSON matching this structure:
{
  "title": "Drawing title",
  "layers": ["Architectural", "Structural"],
  "dimensions": [
    {"value": "3000", "unit": "mm", "location": "wall length"},
    {"value": "2.5", "unit": "m", "location": "floor height"}
  ],
  "elements": [
    {"type": "wall", "description": "concrete block wall", "quantity": 4},
    {"type": "door", "description": "single door D1", "quantity": 2}
  ],
  "titleBlock": {
    "sheetNumber": "A-101",
    "revision": "A",
    "projectName": "Construction Project",
    "discipline": "ARCH",
    "floor": "Ground Floor",
    "scale": "1:100",
    "date": "2024-01-15"
  },
  "annotations": ["Note: All dimensions in mm", "Verify on site"],
  "summary": "Ground floor architectural plan showing layout of rooms, doors, and windows"
}`;

    const contents = [
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType: mimeType,
        },
      },
      "Analyze this engineering drawing and provide detailed structured data as JSON.",
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            layers: {
              type: "array",
              items: { type: "string" },
            },
            dimensions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  value: { type: "string" },
                  unit: { type: "string" },
                  location: { type: "string" },
                },
              },
            },
            elements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  description: { type: "string" },
                  quantity: { type: "number" },
                },
              },
            },
            titleBlock: {
              type: "object",
              properties: {
                sheetNumber: { type: "string" },
                revision: { type: "string" },
                projectName: { type: "string" },
                discipline: { type: "string" },
                floor: { type: "string" },
                scale: { type: "string" },
                date: { type: "string" },
              },
            },
            annotations: {
              type: "array",
              items: { type: "string" },
            },
            summary: { type: "string" },
          },
        },
      },
      contents: contents,
    });

    const rawJson = response.text;

    if (rawJson) {
      const analysis: DrawingAnalysis = JSON.parse(rawJson);
      return analysis;
    } else {
      throw new Error("Empty response from Gemini model");
    }
  } catch (error) {
    console.error("Failed to analyze engineering drawing:", error);
    throw new Error(`Failed to analyze drawing: ${error}`);
  }
}

/**
 * Generate a thumbnail description for a drawing
 * Quick analysis for preview purposes
 * 
 * @param imageBuffer - The image file buffer
 * @param mimeType - The MIME type of the image
 * @returns Brief description of the drawing
 */
export async function generateDrawingThumbnailDescription(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<string> {
  try {
    const contents = [
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType: mimeType,
        },
      },
      "Provide a very brief 1-2 sentence description of this engineering drawing. What type of plan is it and what does it show?",
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Use faster model for thumbnails
      contents: contents,
    });

    return response.text || "Engineering drawing";
  } catch (error) {
    console.error("Failed to generate thumbnail description:", error);
    return "Engineering drawing";
  }
}
