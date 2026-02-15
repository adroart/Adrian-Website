import { GoogleGenAI } from "@google/genai";

// Robustly retrieve API Key, defaulting to empty string if missing to prevent crash
const getApiKey = () => {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
    }
    if (typeof window !== 'undefined' && (window as any).process && (window as any).process.env && (window as any).process.env.API_KEY) {
        return (window as any).process.env.API_KEY;
    }
    return '';
};

const apiKey = getApiKey();

// Initialize AI only if we have a key, otherwise create a placeholder or handle gracefully
// The SDK might throw if apiKey is empty, so we wrap it.
let ai: GoogleGenAI | null = null;
try {
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
    } else {
        console.warn("Gemini API Key missing - Oracle features will return mock data.");
    }
} catch (e) {
    console.error("Failed to initialize GoogleGenAI", e);
}

export const generateOracleInsight = async (intent: string): Promise<string> => {
  if (!ai) {
      return "The mists are thick today. (API Key missing)";
  }

  try {
    // Basic Text Tasks should use 'gemini-3-flash-preview'
    const model = 'gemini-3-flash-preview';
    
    const systemInstruction = `
      You are a calm, grounded guide for Adrian Rasmussen's art studio.
      Adrian creates laser-cut wood and metal art focusing on geometry and natural textures.
      
      Tone:
      - Simple, clear, and quiet.
      - Avoid complex "mystical" jargon or clichés.
      - Don't use words like "triangulation", "mechanism", or "celestial".
      - Focus on nature, silence, and the feeling of wood and light.
      
      Task:
      Provide a brief reflection (max 50 words) based on the user's question. 
      If no question is asked, reflect on the beauty of a simple material like wood or brass.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: intent ? `Reflect upon: ${intent}` : "Give me a simple daily reflection.",
      config: {
        systemInstruction,
        maxOutputTokens: 100,
        temperature: 0.6,
      }
    });

    return response.text || "The silence speaks for itself.";
  } catch (error) {
    console.error("Oracle Error:", error);
    return "The connection is faint. Try again.";
  }
};