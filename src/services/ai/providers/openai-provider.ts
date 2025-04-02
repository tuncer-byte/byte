import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Message } from '../types';
import { AILogger } from '../utils/logger';

/**
 * OpenAI servisi ile iletişim kuran provider sınıfı
 */
export class OpenAIProvider {
    private logger: AILogger;
    
    constructor(private context: vscode.ExtensionContext) {
        this.logger = new AILogger();
    }
    
    /**
     * OpenAI API'sine istek gönderir
     */
    public async callOpenAI(userMessage: string, messages: Message[]): Promise<string> {
        // API anahtarını secret storage'dan al
        let apiKey = await this.getApiKey();
        
        if (!apiKey) {
            throw new Error('OpenAI API anahtarı bulunamadı. Lütfen yapılandırın.');
        }
        
        // OpenAI chat formatındaki mesaj geçmişini oluştur
        const formattedMessages = this.formatMessages(messages);
        formattedMessages.push({ role: 'user', content: userMessage });
        
        this.logger.log('OpenAI API isteği gönderiliyor...');
        
        try {
            const config = vscode.workspace.getConfiguration('byte');
            const model = config.get<string>('openai.model') || 'gpt-3.5-turbo';
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: formattedMessages,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API Hatası: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            
            const data = await response.json();
            const assistantResponse = data.choices[0].message.content;
            
            this.logger.log('OpenAI API yanıtı alındı');
            return assistantResponse;
        } catch (error: any) {
            this.logger.log(`OpenAI API Hatası: ${error.message}`, true);
            throw new Error(`OpenAI API isteği başarısız: ${error.message}`);
        }
    }
    
    /**
     * OpenAI API mesaj formatına dönüştürme
     */
    private formatMessages(messages: Message[]): any[] {
        // Sistem mesajı ekle
        const formattedMessages = [
            { 
                role: 'system', 
                content: 'Sen Byte adlı bir kodlama asistanısın. Kullanıcıların programlama sorularına yardımcı ol. Yanıtlarında Türkçe dil kurallarına uy ve net, anlaşılır olarak cevap ver. Kod örnekleri ve açıklamalar ekleyebilirsin.'
            }
        ];
        
        // Son 10 mesajı ekle (limit)
        const recentMessages = messages.slice(-10);
        recentMessages.forEach(message => {
            formattedMessages.push({
                role: message.role,
                content: message.content
            });
        });
        
        return formattedMessages;
    }
    
    /**
     * OpenAI API anahtarını güvenli depodan alır
     */
    public async getApiKey(): Promise<string | undefined> {
        // Önce secret storage'dan anahtarı almayı dene
        let apiKey = await this.context.secrets.get('openai-api-key');
        
        // Secret storage'da yoksa, ayarlardan al
        if (!apiKey) {
            const config = vscode.workspace.getConfiguration('byte');
            apiKey = config.get<string>('openai.apiKey');
        }
        
        return apiKey;
    }
    
    /**
     * OpenAI API anahtarını güvenli depoya kaydeder
     */
    public async setApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store('openai-api-key', apiKey);
        this.logger.log('OpenAI API anahtarı güvenli depoya kaydedildi');
    }
} 