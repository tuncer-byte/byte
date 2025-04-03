// AI Provider türleri
export enum AIProvider {
    OpenAI = 'openai',
    Gemini = 'gemini',
    Local = 'local',
    Anthropic = 'anthropic'
}

// Ollama API yanıt tipi
export interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    context: number[];
    total_duration: number;
    load_duration: number;
    prompt_eval_duration: number;
    eval_duration: number;
}

// Mesaj tipi tanımlaması
export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Yapılandırma durumu için arayüz
export interface AIServiceState {
    provider: AIProvider;
    messages: Message[];
}

export interface AISettings {
    defaultProvider: string;
    openai: {
        apiKey: string;
        model: string;
    };
    gemini: {
        apiKey: string;
        model: string;
    };
    local: {
        endpoint: string;
        model: string;
    };
    anthropic: {
        apiKey: string;
        model: string;
    };
    autoSwitch: {
        enabled: boolean;
        maxCostPerDay: number;
        preferredProvider: 'fastest' | 'cheapest' | 'most-accurate';
    };
    saveHistory: boolean;
    cache?: {
        enabled: boolean;
        defaultTtl: string;
        maxCachedItems: number;
        automaticCaching: boolean;
    };
}

// Model maliyetleri ve performans metrikleri
export interface ModelMetrics {
    costPer1kTokens: number;
    averageResponseTime: number;
    accuracyScore: number;
}

// Cache tiplerini export et
export * from './cache'; 