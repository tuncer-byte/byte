import * as vscode from 'vscode';
import { AIProvider, AISettings, ModelMetrics } from '../types';
import { MODEL_METRICS } from './constants';
import { AILogger } from './logger';

/**
 * AI sağlayıcı seçimi yönetimi için sınıf
 */
export class ProviderSelector {
    private logger: AILogger;
    private dailyCost: number = 0;
    private lastCostReset: Date = new Date();

    constructor() {
        this.logger = new AILogger();
    }

    /**
     * Günlük maliyet limitini takip eder ve en iyi sağlayıcıyı seçer
     */
    public async selectOptimalProvider(
        currentProvider: AIProvider, 
        settings: AISettings, 
        context: vscode.ExtensionContext,
        taskComplexity: number
    ): Promise<AIProvider> {
        if (!settings.autoSwitch.enabled) {
            return currentProvider;
        }

        // Günlük maliyet limitini kontrol et
        const now = new Date();
        if (now.getDate() !== this.lastCostReset.getDate()) {
            this.dailyCost = 0;
            this.lastCostReset = now;
        }

        if (this.dailyCost >= settings.autoSwitch.maxCostPerDay) {
            this.logger.log('Günlük maliyet limiti aşıldı, yerel modele geçiliyor...');
            return AIProvider.Local;
        }

        const config = vscode.workspace.getConfiguration('byte');
        const availableProviders = new Map<AIProvider, ModelMetrics>();

        // OpenAI API anahtarını kontrol et
        const openaiApiKey = await context.secrets.get('openai-api-key') || config.get<string>('openai.apiKey');
        if (openaiApiKey) {
            const model = config.get<string>('openai.model') || 'gpt-3.5-turbo';
            availableProviders.set(AIProvider.OpenAI, MODEL_METRICS[model]);
        }

        // Gemini API anahtarını kontrol et
        const geminiApiKey = await context.secrets.get('gemini-api-key') || config.get<string>('gemini.apiKey');
        if (geminiApiKey) {
            const model = config.get<string>('gemini.model') || 'gemini-1.5-flash';
            availableProviders.set(AIProvider.Gemini, MODEL_METRICS[model]);
        }

        // Anthropic API anahtarını kontrol et
        const anthropicApiKey = await context.secrets.get('byte.anthropic.apiKey') || config.get<string>('anthropic.apiKey');
        if (anthropicApiKey) {
            const model = config.get<string>('anthropic.model') || 'claude-3-sonnet';
            availableProviders.set(AIProvider.Anthropic, MODEL_METRICS[model]);
        }

        // Yerel model her zaman kullanılabilir
        availableProviders.set(AIProvider.Local, {
            costPer1kTokens: 0,
            averageResponseTime: 2000,
            accuracyScore: 0.75
        });

        // Tercih edilen stratejiye göre en iyi sağlayıcıyı seç
        switch (settings.autoSwitch.preferredProvider) {
            case 'fastest':
                return this.selectFastestProvider(availableProviders);
            case 'cheapest':
                return this.selectCheapestProvider(availableProviders);
            case 'most-accurate':
                return this.selectMostAccurateProvider(availableProviders, taskComplexity);
            default:
                return currentProvider;
        }
    }

    /**
     * En hızlı yanıt veren sağlayıcıyı seçer
     */
    private selectFastestProvider(providers: Map<AIProvider, ModelMetrics>): AIProvider {
        let fastest = { provider: AIProvider.Local, time: Infinity };
        for (const [provider, metrics] of providers) {
            if (metrics.averageResponseTime < fastest.time) {
                fastest = { provider, time: metrics.averageResponseTime };
            }
        }
        return fastest.provider;
    }

    /**
     * En ucuz sağlayıcıyı seçer
     */
    private selectCheapestProvider(providers: Map<AIProvider, ModelMetrics>): AIProvider {
        let cheapest = { provider: AIProvider.Local, cost: Infinity };
        for (const [provider, metrics] of providers) {
            if (metrics.costPer1kTokens < cheapest.cost) {
                cheapest = { provider, cost: metrics.costPer1kTokens };
            }
        }
        return cheapest.provider;
    }

    /**
     * En doğru sonuçları veren sağlayıcıyı seçer
     */
    private selectMostAccurateProvider(providers: Map<AIProvider, ModelMetrics>, taskComplexity: number): AIProvider {
        let best = { provider: AIProvider.Local, score: -Infinity };
        for (const [provider, metrics] of providers) {
            const score = metrics.accuracyScore * taskComplexity;
            if (score > best.score) {
                best = { provider, score };
            }
        }
        return best.provider;
    }

    /**
     * AI kullanımının maliyetini günceller
     */
    public updateCost(provider: AIProvider, userMessageLength: number, responseLength: number): void {
        if (provider === AIProvider.Local) {
            return; // Yerel model için maliyet yok
        }

        const config = vscode.workspace.getConfiguration('byte');
        let model = '';

        switch (provider) {
            case AIProvider.OpenAI:
                model = config.get<string>('openai.model') || 'gpt-3.5-turbo';
                break;
            case AIProvider.Gemini:
                model = config.get<string>('gemini.model') || 'gemini-1.5-flash';
                break;
            case AIProvider.Anthropic:
                model = config.get<string>('anthropic.model') || 'claude-3-sonnet';
                break;
        }

        if (model && MODEL_METRICS[model]) {
            // Yaklaşık token sayısını hesapla (4 karakter = 1 token)
            const totalTokens = (userMessageLength + responseLength) / 4;
            this.dailyCost += (totalTokens / 1000) * MODEL_METRICS[model].costPer1kTokens;
        }
    }

    /**
     * Günlük maliyeti döndürür
     */
    public getDailyCost(): number {
        return this.dailyCost;
    }
} 