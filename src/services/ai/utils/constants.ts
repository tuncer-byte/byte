import { ModelMetrics } from '../types';

// Model maliyetleri ve performans metrikleri
export const MODEL_METRICS: Record<string, ModelMetrics> = {
    'gpt-3.5-turbo': { costPer1kTokens: 0.0015, averageResponseTime: 1000, accuracyScore: 0.85 },
    'gpt-4': { costPer1kTokens: 0.03, averageResponseTime: 2000, accuracyScore: 0.95 },
    'gpt-4-turbo': { costPer1kTokens: 0.01, averageResponseTime: 1500, accuracyScore: 0.92 },
    'claude-3-opus': { costPer1kTokens: 0.015, averageResponseTime: 1800, accuracyScore: 0.94 },
    'claude-3-sonnet': { costPer1kTokens: 0.008, averageResponseTime: 1200, accuracyScore: 0.90 },
    'claude-3-haiku': { costPer1kTokens: 0.003, averageResponseTime: 800, accuracyScore: 0.85 },
    'gemini-1.5-pro': { costPer1kTokens: 0.0025, averageResponseTime: 1100, accuracyScore: 0.88 },
    'gemini-1.5-flash': { costPer1kTokens: 0.001, averageResponseTime: 500, accuracyScore: 0.82 }
};

// Varsayılan AI ayarları
export const DEFAULT_AI_SETTINGS = {
    defaultProvider: 'openai',
    openai: {
        apiKey: '',
        model: 'gpt-3.5-turbo'
    },
    gemini: {
        apiKey: '',
        model: 'gemini-1.5-flash'
    },
    local: {
        endpoint: 'http://localhost:11434/api/generate',
        model: 'codellama'
    },
    anthropic: {
        apiKey: '',
        model: 'claude-3-sonnet'
    },
    autoSwitch: {
        enabled: false,
        maxCostPerDay: 1.0,
        preferredProvider: 'most-accurate' as 'fastest' | 'cheapest' | 'most-accurate'
    },
    saveHistory: true,
    cache: {
        enabled: true,
        defaultTtl: '3600s', // 1 saat
        maxCachedItems: 50,
        automaticCaching: true
    }
}; 