import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Message } from '../types';
import { AILogger } from '../utils/logger';

/**
 * Yerel modeller (Ollama) ile iletişim kuran provider sınıfı
 */
export class LocalProvider {
    private logger: AILogger;
    
    constructor() {
        this.logger = new AILogger();
    }
    
    /**
     * Ollama modeline istek gönderir
     */
    public async callLocalModel(userMessage: string, messages: Message[]): Promise<string> {
        // Ollama model endpoint'i
        const config = vscode.workspace.getConfiguration('byte');
        const endpoint = config.get<string>('local.endpoint') || 'http://localhost:11434/api/generate';
        const model = config.get<string>('local.model') || 'llama3';
        
        this.logger.log(`Ollama isteği gönderiliyor (${endpoint}, model: ${model})...`);
        
        try {
            // Mesaj geçmişini birleştir
            const prompt = this.formatMessages(messages) + "\n\nKullanıcı: " + userMessage + "\n\nAsistan: ";
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    stream: false
                })
            });
            
            if (!response.ok) {
                throw new Error(`Ollama API Hatası: ${response.status}`);
            }
            
            const data = await response.json();
            // Ollama yanıt formatına göre çıkarımı uyarla
            const assistantResponse = data.response || "Üzgünüm, bir yanıt oluşturulamadı.";
            
            this.logger.log('Ollama yanıtı alındı');
            return assistantResponse;
        } catch (error: any) {
            this.logger.log(`Ollama API Hatası: ${error.message}`, true);
            throw new Error(`Ollama isteği başarısız: ${error.message}`);
        }
    }
    
    /**
     * Ollama model için mesaj formatına dönüştürme
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
} 