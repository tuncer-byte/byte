import * as vscode from 'vscode';
import { AIService } from '../../../services/ai';
import { Message, CodeContext } from '../types';

/**
 * InlineCodeChat mesaj işleyicisi
 */
export class InlineChatMessageHandler {
    private isProcessing: boolean = false;
    private messageHistory: Message[] = [];
    
    constructor(
        private aiService: AIService,
        private panel: vscode.WebviewPanel | undefined
    ) {}
    
    /**
     * Panel kullanılabilir mi kontrol eder
     */
    public isPanelAvailable(): boolean {
        return !!this.panel;
    }
    
    /**
     * İşlem yapılıyor mu kontrol eder
     */
    public isInProgress(): boolean {
        return this.isProcessing;
    }
    
    /**
     * Panel webview'ini ayarlar
     */
    public setPanel(panel: vscode.WebviewPanel): void {
        this.panel = panel;
    }
    
    /**
     * Mesaj geçmişini döndürür
     */
    public getMessageHistory(): Message[] {
        return this.messageHistory;
    }
    
    /**
     * Mesaj geçmişini temizler
     */
    public clearMessageHistory(): void {
        this.messageHistory = [];
    }
    
    /**
     * Kullanıcı mesajını işler
     */
    public async handleMessage(text: string, codeContext: CodeContext): Promise<void> {
        if (!this.panel || this.isProcessing || !text.trim()) {
            return;
        }

        // Kullanıcı mesajını WebView'a gönder
        this.panel.webview.postMessage({
            command: 'addMessage',
            text: text,
            role: 'user'
        });

        // Yükleniyor durumunu başlat
        this.isProcessing = true;
        this.panel.webview.postMessage({
            command: 'setLoading',
            isLoading: true
        });

        try {
            // Sistem mesajını oluştur
            const systemPrompt = this.createSystemPrompt(codeContext);
            
            // Mesaj geçmişinde ilk mesajı güncelle veya yoksa ekle
            if (this.messageHistory.length > 0 && this.messageHistory[0].role === 'system') {
                this.messageHistory[0].content = systemPrompt;
            } else {
                this.messageHistory.unshift({ role: 'system', content: systemPrompt });
            }
            
            // Kullanıcı mesajını ekle
            this.messageHistory.push({ role: 'user', content: text });
            
            // AI yanıtını al - Cacheleme kullanmadan direk mesaj gönder
            const promptText = `${systemPrompt}\n\nKod:\n\`\`\`${codeContext.languageId}\n${codeContext.code}\n\`\`\`\n\nKullanıcı Sorusu: ${text}`;
            const response = await this.aiService.sendMessage(promptText);
            
            // Mesaj geçmişine AI yanıtını ekle
            this.messageHistory.push({ role: 'assistant', content: response });

            // AI yanıtını WebView'a gönder
            if (this.panel) {
                this.panel.webview.postMessage({
                    command: 'addMessage',
                    text: response,
                    role: 'assistant'
                });
            }
        } catch (error) {
            if (this.panel) {
                console.error('AI response error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
                
                // Hata tipine göre farklı mesajlar
                let userFriendlyMessage = `Yanıt alınırken bir hata oluştu: ${errorMessage}. Lütfen tekrar deneyin.`;
                
                if (errorMessage.includes('API key')) {
                    userFriendlyMessage = 'API anahtarı bulunamadı veya geçersiz. Lütfen ayarlar bölümünden API anahtarınızı kontrol edin.';
                } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
                    userFriendlyMessage = 'Bağlantı hatası oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.';
                } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
                    userFriendlyMessage = 'API kota sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin veya farklı bir AI servisi seçin.';
                } else if (errorMessage.includes('CachedContent') || errorMessage.includes('PERMISSION_DENIED')) {
                    userFriendlyMessage = 'Önbellek hatası oluştu. Sistem yöneticisiyle iletişime geçin.';
                }
                
                this.panel.webview.postMessage({
                    command: 'addMessage',
                    text: userFriendlyMessage,
                    role: 'error'
                });
            }
        } finally {
            this.isProcessing = false;
            if (this.panel) {
                this.panel.webview.postMessage({
                    command: 'setLoading',
                    isLoading: false
                });
            }
        }
    }
    
    /**
     * Kod analizi için sistem promptu oluşturur
     */
    private createSystemPrompt(codeContext: CodeContext): string {
        const { fileName, languageId, lineCount } = codeContext;
        
        return `Sen bir kod analiz asistanısın. Verilen kodu analiz edip kullanıcıya yardımcı olacaksın.
        
        Kod bilgileri:
        - Dosya adı: ${fileName}
        - Programlama dili: ${languageId}
        - Satır sayısı: ${lineCount} satır
        
        Önemli talimatlar:
        1. Yanıtlarında orijinal kodun tamamını TEKRAR ETMEMELİSİN
        2. Yanıtlarını orijinal kodu içeren kod bloklarına sarmaMALISIN
        3. Kodu içsel olarak analiz edip içgörüler, öneriler ve açıklamalar sunmalısın
        4. Kodun belirli kısımlarına referans verirken satır numaralarını kullanabilirsin
        5. Değişiklik önerirken, bunları açıkça açıklamalı veya yalnızca değiştirilmesi gereken belirli satırları göstermelisin
        6. Önerilen değişikliklerini mümkün olduğunca kod örnekleriyle desteklemelisin
        7. Mantıklı açıklamalar ve gelişmiş öneriler sunmalısın`;
    }
    
    /**
     * Seçili kodu WebView'e göndererek panel içeriğini günceller
     */
    public updatePanelWithCode(code: string, fileName: string, languageId: string, lineInfo: string): void {
        if (!this.panel) {
            return;
        }
        
        // Panele kod bilgilerini bildir
        this.panel.webview.postMessage({
            command: 'setCode',
            code,
            fileName,
            language: languageId,
            lineInfo
        });
        
        // Mesaj geçmişini temizle - yeni bir kod analizi için
        this.clearMessageHistory();
        
        // Mesajları temizle
        this.panel.webview.postMessage({
            command: 'clearMessages'
        });
    }
} 