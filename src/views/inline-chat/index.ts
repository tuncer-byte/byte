import * as vscode from 'vscode';
import { AIService } from '../../services/ai';
import { InlineCodeChatProvider } from './types';
import { createAnalysisPanelTitle, getInlineChatWebviewContent } from './utils/webview-helper';
import { InlineChatMessageHandler } from './handlers/message-handler';

/**
 * Seçili kodu analiz edip sohbet paneli açan sınıf
 */
export class InlineCodeChat implements InlineCodeChatProvider {
    private panel: vscode.WebviewPanel | undefined;
    private messageHandler: InlineChatMessageHandler;
    private lastSelectedCode: string = '';
    private lastFileName: string = '';
    private lastLanguageId: string = '';
    
    constructor(
        private readonly extensionUri: vscode.Uri,
        private aiService: AIService
    ) {
        this.messageHandler = new InlineChatMessageHandler(aiService, undefined);
    }
    
    /**
     * Seçili kodu analiz eder
     */
    public async analyzeSelectedCode(): Promise<void> {
        // Aktif editör kontrol et
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Lütfen bir kod seçin.');
            return;
        }
        
        // Seçili kodu al
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Lütfen bir kod parçası seçin.');
            return;
        }
        
        const code = editor.document.getText(selection);
        const fileName = editor.document.fileName.split(/[\\/]/).pop() || '';
        const languageId = editor.document.languageId;
        
        // Son seçilen kodu kaydet
        this.lastSelectedCode = code;
        this.lastFileName = fileName;
        this.lastLanguageId = languageId;
        
        // Panel oluştur veya var olanı göster
        this.createOrShowPanel();
        
        // Kod satır sayısını hesapla
        const lines = code.split('\n').length;
        const lineInfo = `Seçili kod: ${lines} satır`;
        
        // Paneli güncelle
        this.updatePanelWithCode(code, fileName, languageId, lineInfo);
        
        // İlk analiz mesajını gönder
        const initialMessage = `Lütfen bu kod parçasını analiz edin ve açıklayın.`;
        await this.promptAnalysis(initialMessage);
    }
    
    /**
     * Seçili kod hakkında soru sorma
     */
    public async askQuestionAboutCode(): Promise<void> {
        // Aktif editör kontrol et
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Lütfen bir kod seçin.');
            return;
        }
        
        // Seçili kodu al
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Lütfen bir kod parçası seçin.');
            return;
        }
        
        const code = editor.document.getText(selection);
        const fileName = editor.document.fileName.split(/[\\/]/).pop() || '';
        const languageId = editor.document.languageId;
        
        // Son seçilen kodu kaydet
        this.lastSelectedCode = code;
        this.lastFileName = fileName;
        this.lastLanguageId = languageId;
        
        // Panel oluştur veya var olanı göster
        this.createOrShowPanel();
        
        // Kod satır sayısını hesapla
        const lines = code.split('\n').length;
        const lineInfo = `Seçili kod: ${lines} satır`;
        
        // Paneli güncelle
        this.updatePanelWithCode(code, fileName, languageId, lineInfo);
        
        // Kullanıcıdan soru girmesini iste - otomatik analiz yapmadan bekle
        vscode.window.showInformationMessage('Sormak istediğiniz soruyu doğrudan sohbet paneline yazabilirsiniz.');
    }
    
    /**
     * Analiz istemi gönderir
     */
    private async promptAnalysis(message: string): Promise<void> {
        // Satır sayısını hesapla
        const lines = this.lastSelectedCode.split('\n').length;
        
        // Mesajı işle
        await this.messageHandler.handleMessage(message, {
            code: this.lastSelectedCode,
            fileName: this.lastFileName,
            languageId: this.lastLanguageId,
            lineCount: lines
        });
    }
    
    /**
     * Panel oluşturur veya mevcutu gösterir
     */
    private createOrShowPanel(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
            
            // Panel zaten varsa ve kod da seçilmişse güncellemek için gönder
            if (this.lastSelectedCode) {
                const lines = this.lastSelectedCode.split('\n').length;
                const lineInfo = `Seçili kod: ${lines} satır`;
                this.updatePanelWithCode(this.lastSelectedCode, this.lastFileName, this.lastLanguageId, lineInfo);
            }
            
            return;
        }

        // Başlık oluştur
        const lines = this.lastSelectedCode.split('\n').length;
        const title = createAnalysisPanelTitle(this.lastFileName, this.lastLanguageId, lines);
        
        // Yeni WebView paneli oluştur
        this.panel = vscode.window.createWebviewPanel(
            'inlineCodeChat',
            title,
            {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true
            },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.extensionUri, 'media')
                ]
            }
        );

        // HTML içeriğini oluştur
        const htmlContent = getInlineChatWebviewContent(
            this.panel.webview,
            this.extensionUri,
            this.lastSelectedCode,
            this.lastFileName,
            this.lastLanguageId,
            lines
        );
        
        this.panel.webview.html = htmlContent;

        // MessageHandler'a paneli ileterek bağlantı kur
        this.messageHandler.setPanel(this.panel);
        
        // WebView'den gelen mesajları dinle
        this.panel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'ready':
                    // WebView hazır olduğunda herhangi bir başlangıç durumu gönder
                    break;
                    
                case 'sendMessage':
                    // Kullanıcıdan gelen yeni mesajı işle
                    if (message.text && this.lastSelectedCode) {
                        await this.promptAnalysis(message.text);
                    }
                    break;
            }
        });

        // Panel kapatıldığında temizlik yap
        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.messageHandler.clearMessageHistory();
        });
    }
    
    /**
     * Seçili kodu WebView'e göndererek panel içeriğini günceller
     */
    private updatePanelWithCode(code: string, fileName: string, languageId: string, lineInfo: string): void {
        // MessageHandler aracılığıyla güncelleme yap
        this.messageHandler.updatePanelWithCode(code, fileName, languageId, lineInfo);
        
        // Panel başlığını güncelle
        if (this.panel) {
            const lines = code.split('\n').length;
            const title = createAnalysisPanelTitle(fileName, languageId, lines);
            this.panel.title = title;
        }
    }
    
    /**
     * Kaynakları temizler
     */
    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }
} 