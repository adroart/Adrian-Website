import { GoogleGenAI } from "@google/genai";

// Lazy initialization wrapper to prevent crash on module load
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : 
                   (typeof window !== 'undefined' && (window as any).process?.env?.API_KEY) ? (window as any).process.env.API_KEY : '';
    
    // We instantiate even with empty key to allow the app to run (it will just fail on generate)
    // This prevents the "white screen" crash at startup
    aiInstance = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-init' });
  }
  return aiInstance;
};

export const generateOracleInsight = async (intent: string): Promise<string> => {
  try {
    const ai = getAI();
    const model = 'gemini-2.5-flash-latest';
    
    const systemInstruction = `
      You are a calm, grounded guide for Adrian Rasmussen's art studio.
      Adrian creates laser-cut wood and metal art focusing on geometry and natural textures.
      
      Tone:
      - Simple, clear, and quiet.
      - Avoid complex "mystical" jargon or clichés.
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
    return "The oracle is silent today. Look within.";
  }
};