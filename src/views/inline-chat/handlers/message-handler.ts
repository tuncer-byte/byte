import * as vscode from 'vscode';
import { AIService } from '../../../services/ai';
import { Message } from '../types';

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
    public async handleMessage(text: string, codeContext: {
        code: string,
        fileName: string,
        languageId: string,
        lineCount: number
    }): Promise<void> {
        if (!this.panel || this.isProcessing || !text.trim()) {
            return;
        }

        // Kullanıcı mesajını WebView'a gönder
        await this.panel.webview.postMessage({
            command: 'addMessage',
            message: text,
            type: 'user'
        });

        // Yükleniyor durumunu başlat
        this.isProcessing = true;
        await this.panel.webview.postMessage({
            command: 'startLoading'
        });

        try {
            // Satır bilgisini hesapla
            const lineInfo = `${codeContext.lineCount} satır`;
            
            // Her mesajda kod bilgisini ve bağlamı dahil et
            const systemPrompt = `You are a code analysis assistant. You will analyze the provided code and help the user. 
                                Code: ${codeContext.code}
                                File name: ${codeContext.fileName}
                                Language: ${codeContext.languageId}
                                Lines: ${lineInfo}
                                
                                Important instructions:
                                1. DO NOT include the original code in your responses
                                2. DO NOT wrap your responses in code blocks containing the original code
                                3. Analyze the code internally and provide insights, suggestions, and explanations
                                4. If you need to reference specific parts of the code, refer to them by line numbers
                                5. If you need to suggest changes, describe them clearly or show only the specific lines that need to be changed`;
            
            // Mesaj geçmişinde ilk mesajı güncelle veya yoksa ekle
            if (this.messageHistory.length > 0 && this.messageHistory[0].role === 'system') {
                this.messageHistory[0].content = systemPrompt;
            } else {
                this.messageHistory.unshift({ role: 'system', content: systemPrompt });
            }
            
            // Kullanıcı mesajını ekle
            this.messageHistory.push({ role: 'user', content: text });

            // AI yanıtını al
            const response = await this.aiService.getResponse(this.messageHistory);
            
            // Mesaj geçmişine AI yanıtını ekle
            this.messageHistory.push({ role: 'assistant', content: response });

            // AI yanıtını WebView'a gönder
            await this.panel.webview.postMessage({
                command: 'addMessage',
                message: response,
                type: 'assistant'
            });
        } catch (error) {
            if (this.panel) {
                await this.panel.webview.postMessage({
                    command: 'error',
                    message: 'An error occurred while getting the response. Please try again.'
                });
            }
            console.error('AI response error:', error);
        } finally {
            this.isProcessing = false;
            if (this.panel) {
                await this.panel.webview.postMessage({ command: 'stopLoading' });
            }
        }
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
            command: 'updateCodeInfo',
            code,
            fileName,
            languageId,
            lineInfo
        });
    }
} 