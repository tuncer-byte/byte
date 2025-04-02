import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Message } from '../types';
import { AILogger } from '../utils/logger';

/**
 * Google Gemini servisi ile iletişim kuran provider sınıfı
 */
export class GeminiProvider {
    private logger: AILogger;
    
    constructor(private context: vscode.ExtensionContext) {
        this.logger = new AILogger();
    }
    
    /**
     * Google Gemini API'sine istek gönderir
     */
    public async callGemini(userMessage: string, messages: Message[]): Promise<string> {
        // API anahtarını al
        let apiKey = await this.getApiKey();
        
        if (!apiKey) {
            throw new Error('Google Gemini API anahtarı bulunamadı. Lütfen yapılandırın.');
        }
        
        // Yapılandırmadan model adını al, varsayılan olarak gemini-1.5-flash kullan
        const config = vscode.workspace.getConfiguration('byte');
        const modelName = config.get<string>('gemini.model') || 'gemini-1.5-flash';
        
        this.logger.log(`Gemini API isteği gönderiliyor (model: ${modelName})...`);
        
        try {
            // Gemini API endpoint'i - model adını dinamik olarak ayarla
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            // Kullanıcı mesajını ve geçmiş sohbeti birleştir
            const promptText = this.formatMessages(messages) + "\n\nKullanıcı: " + userMessage;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: promptText }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7
                    }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                this.logger.log(`Gemini API yanıt hatası: ${JSON.stringify(errorData)}`, true);
                
                // Eğer model bulunamadı hatası alındıysa, desteklenen modelleri göster
                if (errorData.error && errorData.error.code === 404) {
                    throw new Error(`Gemini API Hatası: Model "${modelName}" bulunamadı. Lütfen gemini-1.5-flash veya gemini-1.0-pro gibi geçerli bir model kullanın.`);
                }
                
                throw new Error(`Gemini API Hatası: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            
            const data = await response.json();
            const assistantResponse = data.candidates[0].content.parts[0].text;
            
            this.logger.log('Gemini API yanıtı alındı');
            return assistantResponse;
        } catch (error: any) {
            this.logger.log(`Gemini API Hatası: ${error.message}`, true);
            throw new Error(`Gemini API isteği başarısız: ${error.message}`);
        }
    }
    
    /**
     * Gemini API için mesaj formatına dönüştürme
     */
    private formatMessages(messages: Message[]): string {
        // Sistem yönergeleri
        let result = "Sen Byte adlı bir kodlama asistanısın. Kullanıcıların programlama sorularına yardımcı ol. Yanıtlarında Türkçe dil kurallarına uy ve net, anlaşılır olarak cevap ver.\n\n";
        
        // Son 5 mesajı ekle (limit)
        const recentMessages = messages.slice(-5);
        
        recentMessages.forEach(message => {
            if (message.role === 'user') {
                result += `Kullanıcı: ${message.content}\n\n`;
            } else {
                result += `Asistan: ${message.content}\n\n`;
            }
        });
        
        return result;
    }
    
    /**
     * Google Gemini API anahtarını güvenli depodan alır
     */
    public async getApiKey(): Promise<string | undefined> {
        // Önce secret storage'dan anahtarı almayı dene
        let apiKey = await this.context.secrets.get('gemini-api-key');
        
        // Secret storage'da yoksa, ayarlardan al
        if (!apiKey) {
            const config = vscode.workspace.getConfiguration('byte');
            apiKey = config.get<string>('gemini.apiKey');
        }
        
        return apiKey;
    }
    
    /**
     * Google Gemini API anahtarını güvenli depoya kaydeder
     */
    public async setApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store('gemini-api-key', apiKey);
        this.logger.log('Gemini API anahtarı güvenli depoya kaydedildi');
    }
} 