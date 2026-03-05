import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface AIRiskReport {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  factors: string[];
  recommendation: string;
  analysis: string;
}

export async function analyzeStudentRisk(studentData: any): Promise<AIRiskReport> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following student data for academic and dropout risk. 
      Student: ${JSON.stringify(studentData)}
      
      Provide a professional data science assessment.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: { type: Type.STRING, description: "LOW, MEDIUM, or HIGH" },
            confidence: { type: Type.NUMBER },
            factors: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendation: { type: Type.STRING },
            analysis: { type: Type.STRING, description: "A brief data-driven explanation" }
          },
          required: ["riskLevel", "confidence", "factors", "recommendation", "analysis"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("AI Analysis Error:", error);
    // Fallback mock data if AI fails
    return {
      riskLevel: studentData.attendance < 75 ? 'HIGH' : 'LOW',
      confidence: 0.85,
      factors: ["Attendance patterns", "Grade consistency"],
      recommendation: "Standard monitoring",
      analysis: "Automated assessment based on current thresholds."
    };
  }
}
