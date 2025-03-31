import * as vscode from 'vscode';
import { AIService } from './aiService';
import path from 'path';

/**
 * Seçili kod üzerinde doğrudan AI analizi ve sohbeti sağlayan sınıf
 */
export class InlineCodeChat {
    private panel: vscode.WebviewPanel | undefined;
    private extensionUri: vscode.Uri;
    private aiService: AIService;
    private lastSelectedCode: string = '';
    private lastLanguageId: string = '';
    private lastFileName: string = '';
    private messageHistory: {role: string, content: string}[] = [];
    private isProcessing: boolean = false;

    constructor(extensionUri: vscode.Uri, aiService: AIService) {
        this.extensionUri = extensionUri;
        this.aiService = aiService;
    }

    /**
     * Seçili kod için AI analizi başlatır
     */
    public async analyzeSelectedCode() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Analiz edilecek kod yok. Lütfen bir kodu seçin.');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('Lütfen analiz edilecek kodu seçin.');
            return;
        }

        const selectedCode = editor.document.getText(selection);
        const fileName = path.basename(editor.document.fileName);
        const languageId = editor.document.languageId;

        this.lastSelectedCode = selectedCode;
        this.lastLanguageId = languageId;
        this.lastFileName = fileName;
        this.messageHistory = [];

        // WebView paneli oluştur veya göster
        this.createOrShowPanel();

        // Seçilen kodu ve başlangıç analizini panele gönder
        await this.updatePanelWithCode(selectedCode, fileName, languageId);
    }

    /**
     * Kod seçimine soru sormak için input kutusu gösterir
     */
    public async askQuestionAboutCode() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Soru sormak için kod yok. Lütfen bir kodu seçin.');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('Lütfen hakkında soru sormak istediğiniz kodu seçin.');
            return;
        }

        const selectedCode = editor.document.getText(selection);
        const fileName = path.basename(editor.document.fileName);
        const languageId = editor.document.languageId;

        // Soru girdisi iste
        const question = await vscode.window.showInputBox({
            prompt: 'Seçili kod hakkında bir soru sorun',
            placeHolder: 'Örnek: Bu kodun zaman karmaşıklığı nedir?'
        });

        if (!question) {
            return; // Kullanıcı iptal etti
        }

        this.lastSelectedCode = selectedCode;
        this.lastLanguageId = languageId;
        this.lastFileName = fileName;
        this.messageHistory = [];

        // WebView paneli oluştur veya göster
        this.createOrShowPanel();

        // Seçilen kodu panele gönder
        await this.updatePanelWithCode(selectedCode, fileName, languageId);

        // Soruyu gönder
        await this.handleMessage(question);
    }

    private createOrShowPanel() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'inlineCodeChat',
            'Kod Sohbeti',
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
        this.panel.webview.html = this.getWebviewContent(this.panel.webview);

        // Panel kapatıldığında temizlik yap
        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.messageHistory = [];
        });

        // Mesaj alıcısını ayarla
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this.handleMessage(message.text);
                    break;
                case 'fixCode':
                    await this.handleMessage('Bu kodu düzelt ve iyileştir. Hataları gider ve en iyi uygulama yöntemlerini kullan.');
                    break;
                case 'optimizeCode':
                    await this.handleMessage('Bu kodu optimize et. Performans ve okunabilirlik açısından iyileştirmeler öner.');
                    break;
                case 'testCode':
                    await this.handleMessage('Bu kod için kapsamlı birim testleri oluştur.');
                    break;
                case 'explainCode':
                    await this.handleMessage('Bu kodu detaylı bir şekilde açıkla. Amacını, nasıl çalıştığını ve önemli kısımlarını belirt.');
                    break;
            }
        });
    }

    private getWebviewContent(webview: vscode.Webview): string {
        // Webview kaynakları için URI'ları oluştur
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'inlineCodeChat.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'inlineCodeChat.css'));

        // CSP (Content Security Policy) tanımla
        const nonce = this.getNonce();
        const csp = `default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource}; img-src ${webview.cspSource} https:;`;

        // HTML şablonunu döndür
        return `<!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Kod Sohbeti</title>
            <meta http-equiv="Content-Security-Policy" content="${csp}">
            <link rel="stylesheet" href="${styleUri}">
        </head>
        <body>
            <div class="chat-container">
                <div class="code-section">
                    <div class="code-header">
                        <div class="code-title">Seçili Kod</div>
                        <div class="code-actions">
                            <button id="fixCodeBtn" class="action-button">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 20h9"></path>
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                </svg>
                                <span>Düzelt</span>
                            </button>
                            <button id="optimizeCodeBtn" class="action-button">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 20V10"></path>
                                    <path d="M12 20V4"></path>
                                    <path d="M6 20v-6"></path>
                                </svg>
                                <span>Optimize Et</span>
                            </button>
                            <button id="testCodeBtn" class="action-button">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                <span>Test Üret</span>
                            </button>
                            <button id="explainCodeBtn" class="action-button">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                                <span>Açıkla</span>
                            </button>
                            <button id="copyCodeBtn" class="action-button">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span>Kopyala</span>
                            </button>
                        </div>
                    </div>
                    <div id="codeContent">
                        <div id="languageBadge" class="code-language"></div>
                        <pre id="codeBlock" class="code-block"><code></code></pre>
                    </div>
                </div>
                <div class="chat-section">
                    <div id="messagesContainer" class="messages-container">
                        <!-- Mesajlar buraya eklenecek -->
                    </div>
                    <div class="input-container">
                        <textarea id="userInput" placeholder="Kod hakkında bir soru sorun..." rows="1"></textarea>
                        <button id="sendButton" class="send-button" disabled>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    private async updatePanelWithCode(code: string, fileName: string, languageId: string) {
        if (!this.panel) {
            return;
        }

        // Kodu ve dil bilgisini WebView'a gönder
        await this.panel.webview.postMessage({
            command: 'updateCode',
            code,
            fileName,
            languageId
        });

        // Başlangıç analizi gönder
        this.isProcessing = true;
        await this.panel.webview.postMessage({
            command: 'startLoading',
            message: 'Kod analiz ediliyor...'
        });

        try {
            // Kodu analiz et ve sonucu gönder
            const systemPrompt = `Sen kod analizi yapan bir asistansın. Verilen kodu analiz edip kullanıcıya yardımcı olacaksın. 
                                Kod: ${code}
                                Dosya adı: ${fileName}
                                Dil: ${languageId}`;
            
            const userPrompt = "Bu kod parçasını analiz et. Kodun ne yaptığını, nasıl çalıştığını ve varsa iyileştirme önerilerini kısa ve öz bir şekilde açıkla.";
            
            this.messageHistory = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ];

            const response = await this.aiService.getResponse(this.messageHistory);
            this.messageHistory.push({ role: 'assistant', content: response });

            await this.panel.webview.postMessage({
                command: 'addMessage',
                message: response,
                type: 'assistant'
            });
        } catch (error) {
            await this.panel.webview.postMessage({
                command: 'error',
                message: 'Kod analizi yapılırken bir hata oluştu. Lütfen tekrar deneyin.'
            });
            console.error('Kod analizi hatası:', error);
        } finally {
            this.isProcessing = false;
            await this.panel.webview.postMessage({ command: 'stopLoading' });
        }
    }

    private async handleMessage(text: string) {
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
            // Mesaj geçmişine kullanıcı mesajını ekle
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
            await this.panel.webview.postMessage({
                command: 'error',
                message: 'Yanıt alınırken bir hata oluştu. Lütfen tekrar deneyin.'
            });
            console.error('AI yanıtı hatası:', error);
        } finally {
            this.isProcessing = false;
            await this.panel.webview.postMessage({ command: 'stopLoading' });
        }
    }

    /**
     * Kaynakları temizler
     */
    public dispose() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }
} 