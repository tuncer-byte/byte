import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Message } from '../types';
import { AILogger } from '../utils/logger';

/**
 * Anthropic Claude servisi ile iletişim kuran provider sınıfı
 */
export class AnthropicProvider {
    private logger: AILogger;
    
    constructor(private context: vscode.ExtensionContext) {
        this.logger = new AILogger();
    }
    
    /**
     * Anthropic Claude API'sine istek gönderir
     */
    public async callAnthropic(userMessage: string, messages: Message[]): Promise<string> {
        const apiKey = await this.getApiKey();
        
        if (!apiKey) {
            throw new Error('Anthropic API anahtarı bulunamadı. Lütfen yapılandırın.');
        }

        const config = vscode.workspace.getConfiguration('byte');
        const model = config.get<string>('anthropic.model') || 'claude-3-sonnet';

        this.logger.log(`Anthropic API isteği gönderiliyor (model: ${model})...`);

        try {
            // Claude mesajlarını formatla
            const claudeMessages = this.formatMessages(messages, userMessage);
            
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: model,
                    messages: claudeMessages,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Anthropic API Hatası: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            return data.content[0].text;
        } catch (error: any) {
            this.logger.log(`Anthropic API Hatası: ${error.message}`, true);
            throw new Error(`Anthropic API isteği başarısız: ${error.message}`);
        }
    }
    
    /**
     * Claude API için mesaj formatına dönüştürme
     */
    private formatMessages(messages: Message[], currentUserMessage: string): any[] {
        // Sistem mesajını ekle
        const systemMessage = {
            role: 'system',
            content: 'Sen Byte adlı bir kodlama asistanısın. Kullanıcıların programlama sorularına yardımcı ol. Yanıtlarında Türkçe dil kurallarına uy ve net, anlaşılır olarak cevap ver. Kod örnekleri ve açıklamalar ekleyebilirsin.'
        };
        
        // Mevcut mesajları Claude formatına dönüştür
        const claudeMessages = [];
        
        // Sistem mesajını ekle
        claudeMessages.push(systemMessage);
        
        // Son 10 mesajı ekle (limit)
        const recentMessages = messages.slice(-10);
        recentMessages.forEach(message => {
            claudeMessages.push({
                role: message.role === 'assistant' ? 'assistant' : 'user',
                content: message.content
            });
        });
        
        // Mevcut kullanıcı mesajını ekle
        claudeMessages.push({
            role: 'user',
            content: currentUserMessage
        });
        
        return claudeMessages;
    }
    
    /**
     * Anthropic API anahtarını güvenli depodan alır
     */
    public async getApiKey(): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('byte');
        return await this.context.secrets.get('byte.anthropic.apiKey') || config.get('anthropic.apiKey');
    }
    
    /**
     * Anthropic API anahtarını güvenli depoya kaydeder
     */
    public async setApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store('byte.anthropic.apiKey', apiKey);
        this.logger.log('Anthropic API anahtarı güvenli depoya kaydedildi');
    }
} 