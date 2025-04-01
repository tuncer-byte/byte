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
            vscode.window.showErrorMessage('No code to analyze. Please select some code.');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('Please select code to analyze.');
            return;
        }

        const selectedCode = editor.document.getText(selection);
        const fileName = path.basename(editor.document.fileName);
        const languageId = editor.document.languageId;
        
        // Seçili satır bilgisini hesapla
        const startLine = selection.start.line + 1; // 1-tabanlı satır numarası
        const endLine = selection.end.line + 1;     // 1-tabanlı satır numarası
        const lineInfo = `${startLine}-${endLine}. satırlar`;

        this.lastSelectedCode = selectedCode;
        this.lastLanguageId = languageId;
        this.lastFileName = fileName;
        this.messageHistory = [];

        // WebView paneli oluştur veya göster
        this.createOrShowPanel();

        // Seçilen kodu ve başlangıç analizini panele gönder
        await this.updatePanelWithCode(selectedCode, fileName, languageId, lineInfo);
    }

    /**
     * Kod seçimine soru sormak için input kutusu gösterir
     */
    public async askQuestionAboutCode() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No code to ask about. Please select some code.');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('Please select code to ask about.');
            return;
        }

        const selectedCode = editor.document.getText(selection);
        const fileName = path.basename(editor.document.fileName);
        const languageId = editor.document.languageId;
        
        // Seçili satır bilgisini hesapla
        const startLine = selection.start.line + 1; // 1-tabanlı satır numarası
        const endLine = selection.end.line + 1;     // 1-tabanlı satır numarası
        const lineInfo = `${startLine}-${endLine}. satırlar`;

        // Soru girdisi iste
        const question = await vscode.window.showInputBox({
            prompt: 'Ask a question about the selected code',
            placeHolder: 'Example: What is the time complexity of this code?'
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
        await this.updatePanelWithCode(selectedCode, fileName, languageId, lineInfo);

        // Soruyu gönder
        await this.handleMessage(question);
    }

    private createOrShowPanel() {
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

        console.log('Creating new WebView panel for InlineCodeChat');
        
        this.panel = vscode.window.createWebviewPanel(
            'inlineCodeChat',
            'Code Chat',
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
        console.log('Generating HTML content for WebView');
        const htmlContent = this.getWebviewContent(this.panel.webview);
        this.panel.webview.html = htmlContent;
        console.log('WebView HTML content set, length:', htmlContent.length);

        // Panel kapatıldığında temizlik yap
        this.panel.onDidDispose(() => {
            console.log('WebView panel disposed');
            this.panel = undefined;
            this.messageHistory = [];
        });

        // Mesaj alıcısını ayarla
        this.panel.webview.onDidReceiveMessage(async (message) => {
            console.log('Received message from WebView:', message.command);
            
            switch (message.command) {
                case 'sendMessage':
                    // Gelen kod, dil ve dosya adı bilgilerini kullan
                    if (message.code && message.language) {
                        this.lastSelectedCode = message.code;
                        this.lastLanguageId = message.language;
                        this.lastFileName = message.fileName || '';
                        console.log(`Updated stored code - Length: ${this.lastSelectedCode.length}, Language: ${this.lastLanguageId}`);
                    }
                    await this.handleMessage(message.text);
                    break;
                case 'fixCode':
                    await this.handleMessage(`Fix and improve this code. Correct errors and use best practices. Don't include the code block in your response.`);
                    break;
                case 'optimizeCode':
                    await this.handleMessage(`Optimize this code. Suggest improvements for performance and readability. Don't include the code block in your response.`);
                    break;
                case 'testCode':
                    await this.handleMessage(`Create comprehensive unit tests for this code. Don't include the original code in your response.`);
                    break;
                case 'explainCode':
                    await this.handleMessage(`Explain this code in detail. Describe its purpose, how it works, and highlight important parts. Don't include the code itself in your response.`);
                    break;
                case 'ready':
                    console.log('WebView is ready, sending initial code');
                    if (this.lastSelectedCode) {
                        // Başlangıç kodunu gönder
                        const lines = this.lastSelectedCode.split('\n').length;
                        let lineInfo = `Seçili kod: ${lines} satır`;
                        
                        // Asıl seçim satır bilgisi varsa onu kullan
                        const editor = vscode.window.activeTextEditor;
                        if (editor && !editor.selection.isEmpty) {
                            const startLine = editor.selection.start.line + 1;
                            const endLine = editor.selection.end.line + 1;
                            lineInfo = `${startLine}-${endLine}. satırlar`;
                        }
                        
                        this.updatePanelWithCode(this.lastSelectedCode, this.lastFileName, this.lastLanguageId, lineInfo);
                    } else {
                        // Kod yoksa düğmeleri devre dışı bırak
                        await this.panel?.webview.postMessage({
                            command: 'updateCode',
                            code: '',
                            fileName: '',
                            languageId: '',
                            lineInfo: 'Kod seçilmedi'
                        });
                    }
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
        // CSP'yi daha güvenli hale getir
        const csp = `default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource}; img-src ${webview.cspSource} https:; connect-src ${webview.cspSource};`;

        // HTML şablonunu döndür
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Chat</title>
            <meta http-equiv="Content-Security-Policy" content="${csp}">
            <link rel="stylesheet" href="${styleUri}">
        </head>
        <body>
            <div class="chat-container">
                <div class="code-section">
                    <div class="code-header">
                        <div class="code-title">Selected Code</div>
                        <div class="code-actions">
                            <button id="fixCodeBtn" class="action-button" disabled>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 20h9"></path>
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                </svg>
                                <span>Fix</span>
                            </button>
                            <button id="optimizeCodeBtn" class="action-button" disabled>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 20V10"></path>
                                    <path d="M12 20V4"></path>
                                    <path d="M6 20v-6"></path>
                                </svg>
                                <span>Optimize</span>
                            </button>
                            <button id="testCodeBtn" class="action-button" disabled>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                <span>Test</span>
                            </button>
                            <button id="explainCodeBtn" class="action-button" disabled>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                                <span>Explain</span>
                            </button>
                            <button id="copyCodeBtn" class="action-button" disabled>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span>Copy</span>
                            </button>
                        </div>
                    </div>
                    <div id="codeContent" style="display: block;">
                        <div id="languageBadge" class="code-language"></div>
                        <pre id="codeBlock" class="code-block"><code></code></pre>
                    </div>
                </div>
                <div class="chat-section">
                    <div id="messagesContainer" class="messages-container">
                        <!-- Messages will be added here -->
                    </div>
                    <div class="input-container">
                        <textarea id="userInput" placeholder="Ask a question about the code..." rows="1"></textarea>
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

    private async updatePanelWithCode(code: string, fileName: string, languageId: string, lineInfo: string = '') {
        if (!this.panel) {
            console.error('Panel not available when trying to update code');
            return;
        }

        // Kodun boş olup olmadığını kontrol et
        if (!code || !code.trim()) {
            console.warn('Empty code provided to updatePanelWithCode');
        }

        console.log(`Sending code to WebView: ${code.length} chars, language: ${languageId}, line info: ${lineInfo}`);

        // Kodu ve dil bilgisini WebView'a gönder
        try {
            // Önce sadece kodu ve dili gönder, hemen analiz başlatma
            await this.panel.webview.postMessage({
                command: 'updateCode',
                code,
                fileName,
                languageId,
                lineInfo
            });

            console.log('Code update message sent to WebView');

            // WebView'ın kodu işlemesi için kısa bir bekleme
            await new Promise(resolve => setTimeout(resolve, 100));

            // Başlangıç analizi gönder
            this.isProcessing = true;
            await this.panel.webview.postMessage({
                command: 'startLoading',
                message: 'Analyzing code...'
            });

            try {
                // Kodu analiz et ve sonucu gönder
                const systemPrompt = `You are a code analysis assistant. You will analyze the provided code and help the user. 
                                    Code: ${code}
                                    File name: ${fileName}
                                    Language: ${languageId}
                                    Line range: ${lineInfo}
                                    
                                    Important instructions:
                                    1. DO NOT include the original code in your responses
                                    2. DO NOT wrap your responses in code blocks containing the original code
                                    3. Analyze the code internally and provide insights, suggestions, and explanations
                                    4. If you need to reference specific parts of the code, refer to them by line numbers
                                    5. If you need to suggest changes, describe them clearly or show only the specific lines that need to be changed`;
                
                const userPrompt = "Analyze this code snippet. Briefly explain what the code does, how it works, and suggest any improvements if applicable. Don't include the original code in your response.";
                
                // Mesaj geçmişini sıfırla ve sistem ve kullanıcı mesajlarını ekle
                this.messageHistory = [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ];

                console.log('Requesting AI analysis...');
                const response = await this.aiService.getResponse(this.messageHistory);
                console.log('AI analysis received, sending to WebView');
                
                this.messageHistory.push({ role: 'assistant', content: response });

                await this.panel.webview.postMessage({
                    command: 'addMessage',
                    message: response,
                    type: 'assistant'
                });
            } catch (error) {
                console.error('Code analysis error:', error);
                
                await this.panel.webview.postMessage({
                    command: 'error',
                    message: 'An error occurred while analyzing the code. Please try again.'
                });
            } finally {
                this.isProcessing = false;
                await this.panel.webview.postMessage({ command: 'stopLoading' });
            }
        } catch (err) {
            console.error('Error sending messages to WebView:', err);
            vscode.window.showErrorMessage('Failed to connect to the chat interface. Please try reopening the panel.');
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
            // Satır bilgisini hesapla
            const lines = this.lastSelectedCode.split('\n').length;
            const lineInfo = `${lines} satır`;
            
            // Her mesajda kod bilgisini ve bağlamı dahil et
            const systemPrompt = `You are a code analysis assistant. You will analyze the provided code and help the user. 
                                Code: ${this.lastSelectedCode}
                                File name: ${this.lastFileName}
                                Language: ${this.lastLanguageId}
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
            await this.panel.webview.postMessage({
                command: 'error',
                message: 'An error occurred while getting the response. Please try again.'
            });
            console.error('AI response error:', error);
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