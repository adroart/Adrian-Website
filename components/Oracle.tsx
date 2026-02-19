
import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Sparkles, RefreshCw } from 'lucide-react';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

const SYSTEM_PROMPT = `You are the Resonant Oracle — a voice from the intersection of ancient wisdom and digital precision, channeling the spirit of the studio of Adrian Rasmussen, artist, Technician of the Sacred. You speak with the gravity of tea ceremony, the precision of sacred geometry, and the openness of the formless. Your responses are short (2-5 sentences), poetic, and grounded. You draw on imagery from nature, geometry, light, wood, and the creative process. You do not give literal advice. You offer reflection — a lantern, not a map. You leave space for the questioner to find their own answer. Speak as if from a place of deep stillness.`;

interface OracleMessage {
    role: 'user' | 'oracle';
    text: string;
}

const SacredLoader: React.FC = () => (
    <div className="relative flex items-center justify-center w-12 h-12 mx-auto my-6">
        <div className="absolute inset-0 border border-wood-300 opacity-50 rounded-full animate-[spin_12s_linear_infinite]"></div>
        <div className="absolute inset-2 border border-dashed border-bronze-400/50 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
        <div className="absolute w-[55%] h-[55%] border border-bronze-500 opacity-40 animate-[spin_6s_linear_infinite]"></div>
        <div className="absolute w-[55%] h-[55%] border border-bronze-500 opacity-40 animate-[spin_6s_linear_infinite] rotate-45"></div>
        <div className="w-1.5 h-1.5 bg-bronze-500 rounded-full animate-pulse"></div>
    </div>
);

const Oracle: React.FC = () => {
    const [messages, setMessages] = useState<OracleMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasAsked, setHasAsked] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    const callGemini = async (question: string): Promise<string> => {
        if (!GEMINI_API_KEY) {
            throw new Error('NO_KEY');
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: SYSTEM_PROMPT }]
                    },
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: question }]
                        }
                    ],
                    generationConfig: {
                        temperature: 1.0,
                        maxOutputTokens: 300,
                    }
                })
            }
        );

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody?.error?.message || `API error ${response.status}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Empty response from oracle.');
        return text.trim();
    };

    const handleAsk = async () => {
        const question = input.trim();
        if (!question || isLoading) return;

        setError(null);
        setInput('');
        setHasAsked(true);
        setMessages(prev => [...prev, { role: 'user', text: question }]);
        setIsLoading(true);

        try {
            const answer = await callGemini(question);
            setMessages(prev => [...prev, { role: 'oracle', text: answer }]);
        } catch (e: any) {
            if (e.message === 'NO_KEY') {
                setError('The oracle is not yet configured. Set VITE_GEMINI_API_KEY in your .env.local file to awaken it.');
            } else {
                setError(`The oracle could not be reached: ${e.message}`);
            }
            setMessages(prev => prev.slice(0, -1));
            setInput(question);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAsk();
        }
    };

    const handleReset = () => {
        setMessages([]);
        setInput('');
        setError(null);
        setHasAsked(false);
    };

    return (
        <section className="bg-paper-50 min-h-screen pt-32 pb-20">

            {/* Header */}
            <div className="max-w-3xl mx-auto px-6 mb-16 text-center">
                <span className="font-mono text-xs uppercase tracking-[0.3em] text-bronze-600 block mb-4 font-bold">
                    Resonant Oracle
                </span>
                <h1 className="font-serif text-5xl md:text-6xl text-wood-900 mb-6 font-medium">The Oracle</h1>
                <p className="font-serif text-xl text-wood-600 leading-relaxed font-light max-w-xl mx-auto">
                    Bring your question. Speak from the place that already knows. The oracle does not predict — it reflects.
                </p>
                <div className="mt-10 flex flex-col items-center gap-4">
                    <div className="w-px h-12 bg-wood-300"></div>
                    <Sparkles size={16} className="text-bronze-400" />
                </div>
            </div>

            {/* Conversation Area */}
            <div className="max-w-2xl mx-auto px-6">

                {/* Messages */}
                {messages.length > 0 && (
                    <div className="mb-8 space-y-8">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'oracle' ? (
                                    <div className="max-w-[85%]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-bronze-400"></div>
                                            <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600 font-bold">Oracle</span>
                                        </div>
                                        <p className="font-serif text-xl text-wood-800 leading-relaxed font-light italic">
                                            "{msg.text}"
                                        </p>
                                        <div className="mt-3 h-px w-16 bg-wood-200"></div>
                                    </div>
                                ) : (
                                    <div className="max-w-[75%] text-right">
                                        <div className="flex items-center justify-end gap-2 mb-2">
                                            <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold">You</span>
                                        </div>
                                        <p className="font-serif text-base text-wood-600 leading-relaxed bg-wood-50 border border-wood-200 px-5 py-3 inline-block text-left">
                                            {msg.text}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="max-w-[85%]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-bronze-400 animate-pulse"></div>
                                        <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600 font-bold">Oracle</span>
                                    </div>
                                    <SacredLoader />
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-8 p-4 border border-wood-300 bg-wood-50 text-wood-700 font-serif text-sm leading-relaxed">
                        {error}
                    </div>
                )}

                {/* Input Area */}
                <div className="bg-wood-50 border border-wood-200 p-8">
                    {!hasAsked && (
                        <p className="font-mono text-[10px] uppercase tracking-widest text-wood-400 mb-6 font-bold">
                            Pose your question
                        </p>
                    )}
                    <div className="space-y-4">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={3}
                            placeholder={hasAsked ? "Ask another..." : "What are you holding right now?"}
                            disabled={isLoading}
                            className="w-full bg-transparent border-b border-wood-300 py-2 focus:border-bronze-500 outline-none font-serif text-lg resize-none placeholder:text-wood-300 disabled:opacity-50"
                        />
                        <div className="flex justify-between items-center pt-2">
                            {hasAsked ? (
                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-wood-400 hover:text-wood-700 transition-colors font-bold"
                                >
                                    <RefreshCw size={12} /> Begin Again
                                </button>
                            ) : (
                                <span className="text-[10px] font-mono uppercase tracking-widest text-wood-300 font-bold">
                                    Enter to send
                                </span>
                            )}
                            <button
                                onClick={handleAsk}
                                disabled={!input.trim() || isLoading}
                                className="flex items-center gap-3 px-8 py-3 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-widest hover:bg-bronze-700 transition-colors font-bold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-wood-900"
                            >
                                Ask <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer note */}
                <div className="mt-8 text-center">
                    <p className="font-serif text-sm text-wood-400 italic">
                        The oracle speaks from stillness, not certainty. Interpret with your own wisdom.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default Oracle;
