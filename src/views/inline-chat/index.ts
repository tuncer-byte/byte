import * as vscode from 'vscode';
import { AIService } from '../../services/ai';
import { InlineCodeChatProvider, CodeContext } from './types';
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
    private lastLineCount: number = 0;
    
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
        if (!await this.getSelectedCodeDetails()) {
            return;
        }
        
        // Panel oluştur veya var olanı göster
        this.createOrShowPanel();
        
        // Kod satır sayısını hesapla
        const lineInfo = `Seçili kod: ${this.lastLineCount} satır`;
        
        // Paneli güncelleyerek kodu görüntüle
        this.updatePanelWithCode(
            this.lastSelectedCode, 
            this.lastFileName, 
            this.lastLanguageId, 
            lineInfo
        );
        
        // İlk analiz mesajını gönder
        const initialMessage = `Lütfen bu kod parçasını analiz edin ve açıklayın.`;
        await this.promptAnalysis(initialMessage);
    }
    
    /**
     * Seçili kod hakkında soru sorma
     */
    public async askQuestionAboutCode(): Promise<void> {
        if (!await this.getSelectedCodeDetails()) {
            return;
        }
        
        // Panel oluştur veya var olanı göster
        this.createOrShowPanel();
        
        // Kod satır sayısını hesapla
        const lineInfo = `Seçili kod: ${this.lastLineCount} satır`;
        
        // Paneli güncelleyerek kodu görüntüle
        this.updatePanelWithCode(
            this.lastSelectedCode, 
            this.lastFileName, 
            this.lastLanguageId, 
            lineInfo
        );
        
        // Kullanıcıdan soru girmesini iste - otomatik analiz yapmadan bekle
        this.panel?.webview.postMessage({
            command: 'focusInput',
            placeholder: 'Seçili kod hakkında bir soru sorun...',
        });
        
        vscode.window.showInformationMessage('Sormak istediğiniz soruyu doğrudan sohbet paneline yazabilirsiniz.');
    }
    
    /**
     * Editor'den seçili kod detaylarını alır
     */
    private async getSelectedCodeDetails(): Promise<boolean> {
        // Aktif editör kontrol et
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Lütfen bir kod seçin.');
            return false;
        }
        
        // Seçili kodu al
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Lütfen bir kod parçası seçin.');
            return false;
        }
        
        try {
            // Seçili kodu ve ilgili bilgileri al
            const code = editor.document.getText(selection);
            const fileName = editor.document.fileName.split(/[\\/]/).pop() || '';
            const languageId = editor.document.languageId;
            const lineCount = code.split('\n').length;
            
            // Son seçilen kodu kaydet
            this.lastSelectedCode = code;
            this.lastFileName = fileName;
            this.lastLanguageId = languageId;
            this.lastLineCount = lineCount;
            
            return true;
        } catch (error) {
            console.error('Kod seçimi hatası:', error);
            vscode.window.showErrorMessage('Kod seçiminde bir hata oluştu. Lütfen tekrar deneyin.');
            return false;
        }
    }
    
    /**
     * Analiz istemi gönderir
     */
    private async promptAnalysis(message: string): Promise<void> {
        // Mesajı işlemek için gerekli kod bağlamını oluştur
        const codeContext: CodeContext = {
            code: this.lastSelectedCode,
            fileName: this.lastFileName,
            languageId: this.lastLanguageId,
            lineCount: this.lastLineCount
        };
        
        // Mesajı işle
        await this.messageHandler.handleMessage(message, codeContext);
    }
    
    /**
     * Panel oluşturur veya mevcutu gösterir
     */
    private createOrShowPanel(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
            return;
        }

        // Başlık oluştur
        const title = createAnalysisPanelTitle(this.lastFileName, this.lastLanguageId, this.lastLineCount);
        
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
            this.lastLineCount
        );
        
        this.panel.webview.html = htmlContent;

        // MessageHandler'a paneli ileterek bağlantı kur
        this.messageHandler.setPanel(this.panel);
        
        // WebView'den gelen mesajları dinle
        this.panel.webview.onDidReceiveMessage(async message => {
            try {
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
                        
                    case 'fixCode':
                        // Kodu düzeltme işlemi
                        await this.promptAnalysis('Bu kodu düzelt ve iyileştir. Hataları, performans sorunlarını ve okunabilirliği çöz.');
                        break;
                        
                    case 'optimizeCode':
                        // Kodu optimize etme işlemi
                        await this.promptAnalysis('Bu kodu optimize et. Performans, bellek kullanımı, algoritma karmaşıklığı ve genel verimliliği iyileştir.');
                        break;
                        
                    case 'testCode':
                        // Kod için test oluşturma
                        await this.promptAnalysis(`Bu kod için unit testler öner. ${this.lastLanguageId} diline uygun test framework kullan.`);
                        break;
                        
                    case 'explainCode':
                        // Kodu açıklama
                        await this.promptAnalysis('Bu kodu detaylı bir şekilde açıkla. Her önemli kısmı ve işlevi anlat.');
                        break;
                }
            } catch (error) {
                console.error('WebView mesaj işleme hatası:', error);
                if (this.panel) {
                    this.panel.webview.postMessage({
                        command: 'error',
                        message: 'İstek işlenirken bir hata oluştu.'
                    });
                }
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