// Dynamic import wrapper to prevent crash on module load if library has issues
let aiInstance: any = null;

const getAI = async () => {
  if (!aiInstance) {
    try {
        const { GoogleGenAI } = await import("@google/genai");
        
        // Safe environment variable access for browser (window.process)
        let apiKey = '';
        
        // Check window.process first (set by index.html)
        if (typeof window !== 'undefined' && (window as any).process?.env?.API_KEY) {
            apiKey = (window as any).process.env.API_KEY;
        } 
        // Fallback for some build environments
        else if (typeof process !== 'undefined' && process.env?.API_KEY) {
            apiKey = process.env.API_KEY;
        }

        // We instantiate even with empty key to allow the app to run (it will just fail on generate)
        aiInstance = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-init' });
    } catch (e) {
        console.error("Failed to load Google GenAI SDK:", e);
        return null;
    }
  }
  return aiInstance;
};

export const generateOracleInsight = async (intent: string): Promise<string> => {
  try {
    const ai = await getAI();
    
    if (!ai) {
        return "The oracle is disconnected. (SDK Load Failed)";
    }

    // Using gemini-2.5-flash-latest as per guidelines for standard text tasks
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