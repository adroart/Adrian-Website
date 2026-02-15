
import { GoogleGenAI } from "@google/genai";

// Initialize the Google GenAI SDK with the API key from environment variables.
// Always use a named parameter 'apiKey' as per the SDK guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateOracleInsight = async (intent: string): Promise<string> => {
  try {
    // Basic Text Tasks should use 'gemini-3-flash-preview' for optimal performance and reasoning.
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

    // Directly access the .text property from GenerateContentResponse. Do not call it as a method.
    return response.text || "The silence speaks for itself.";
  } catch (error) {
    console.error("Oracle Error:", error);
    return "Something went wrong. Please try again soon.";
  }
};
