import * as vscode from 'vscode';
import * as path from 'path';
import { AIService, Message } from './aiService';

/**
 * Kod parçası ile sohbet etmek için modal panel
 */
export class CodeChatPanel {
    private static readonly viewType = 'byteCodeChat';
    private static currentPanel: CodeChatPanel | undefined = undefined;
    private _panel?: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _aiService: AIService;
    private _disposables: vscode.Disposable[] = [];
    private _messages: Message[] = [];
    private _selectedCode: string = '';
    private _languageId: string = '';
    private _fileName: string = '';

    constructor(
        extensionUri: vscode.Uri,
        aiService: AIService
    ) {
        this._extensionUri = extensionUri;
        this._aiService = aiService;
    }

    /**
     * Kod sohbet panelini açar
     */
    public openCodeChat(selectedCode: string, languageId: string, fileName: string) {
        // Eğer panel zaten açıksa, onu göster
        if (CodeChatPanel.currentPanel) {
            CodeChatPanel.currentPanel._panel?.reveal(vscode.ViewColumn.Beside);
            CodeChatPanel.currentPanel._updateForCode(selectedCode, languageId, fileName);
            return;
        }

        // Paneli oluştur
        const panel = vscode.window.createWebviewPanel(
            CodeChatPanel.viewType,
            'Byte Code Chat',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this._extensionUri]
            }
        );

        // Panel css ve js dosyaları için URI'lar oluştur
        const scriptUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'codeChat.js')
        );
        
        const styleUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'codeChat.css')
        );

        // Panel HTML içeriğini ayarla
        panel.webview.html = this._getHtmlForWebview(panel.webview, {
            scriptUri,
            styleUri,
            selectedCode,
            languageId,
            fileName: path.basename(fileName)
        });

        // Bu sınıfı panele bağla
        CodeChatPanel.currentPanel = this;
        this._panel = panel;
        
        // Mesaj geçmişini sıfırla
        this._messages = [];
        
        // Seçili kodu kaydet
        this._selectedCode = selectedCode;
        this._languageId = languageId;
        this._fileName = fileName;
        
        // İlk sistem mesajını ekle
        this._messages.push({
            role: 'system',
            content: `Bu bir kod sohbet oturumudur. Kullanıcı ${path.basename(fileName)} dosyasından bir kod bloğu seçmiş olup, bu kod üzerinde konuşmak istiyor. Aşağıdaki kod parçasını inceleyip, kullanıcının sorabileceği sorulara hazır ol:\n\n\`\`\`${languageId}\n${selectedCode}\n\`\`\``
        });
        
        // İlk mesajı AI'ya gönder ve cevabını al
        this._aiService.sendMessage(`Aşağıdaki ${path.basename(fileName)} dosyasındaki kod parçasını analiz et ve ne yaptığını açıkla:\n\n\`\`\`${languageId}\n${selectedCode}\n\`\`\``).then(response => {
            this._messages.push({ 
                role: 'assistant', 
                content: response 
            });
            
            // Panele mesajı ilet
            panel.webview.postMessage({
                type: 'initialResponse',
                content: response
            });
        });
        
        // Panel ile mesajlaşma
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'sendMessage':
                        this._handleUserMessage(message.message, panel.webview);
                        break;
                    case 'closePanel':
                        panel.dispose();
                        break;
                }
            },
            undefined,
            this._disposables
        );
        
        // Panel kapatıldığında temizlik yap
        panel.onDidDispose(
            () => {
                CodeChatPanel.currentPanel = undefined;
                
                // Kaynakları temizle
                while (this._disposables.length) {
                    const disposable = this._disposables.pop();
                    if (disposable) {
                        disposable.dispose();
                    }
                }
            },
            null,
            this._disposables
        );
    }
    
    /**
     * Kullanıcı mesajını işler ve AI cevabını alır
     */
    private async _handleUserMessage(message: string, webview: vscode.Webview) {
        try {
            // Kullanıcı mesajını geçmişe ekle
            this._messages.push({
                role: 'user',
                content: message
            });
            
            // Mesajı AI'ya gönder
            const response = await this._aiService.sendMessage(message);
            
            // AI yanıtını geçmişe ekle
            this._messages.push({
                role: 'assistant',
                content: response
            });
            
            // Yanıtı webview'e gönder
            webview.postMessage({
                type: 'response',
                content: response
            });
        } catch (error: any) {
            webview.postMessage({
                type: 'error',
                content: error.message
            });
        }
    }
    
    /**
     * Kod panelini yeni bir kod parçasıyla günceller
     */
    private _updateForCode(selectedCode: string, languageId: string, fileName: string) {
        if (!CodeChatPanel.currentPanel || !CodeChatPanel.currentPanel._panel) {
            return;
        }
        
        // Yeni kod bilgilerini kaydet
        this._selectedCode = selectedCode;
        this._languageId = languageId;
        this._fileName = fileName;
        
        // Mesaj geçmişini sıfırla
        this._messages = [];
        
        // Sistem mesajını ekle
        this._messages.push({
            role: 'system',
            content: `Bu bir kod sohbet oturumudur. Kullanıcı ${path.basename(fileName)} dosyasından bir kod bloğu seçmiş olup, bu kod üzerinde konuşmak istiyor. Aşağıdaki kod parçasını inceleyip, kullanıcının sorabileceği sorulara hazır ol:\n\n\`\`\`${languageId}\n${selectedCode}\n\`\`\``
        });
        
        // WebView'i güncelle
        if (CodeChatPanel.currentPanel._panel) {
            CodeChatPanel.currentPanel._panel.webview.postMessage({
                type: 'updateCode',
                code: selectedCode,
                languageId: languageId,
                fileName: path.basename(fileName)
            });
        }
        
        // İlk mesajı AI'ya gönder
        this._aiService.sendMessage(`Aşağıdaki ${path.basename(fileName)} dosyasındaki kod parçasını analiz et ve ne yaptığını açıkla:\n\n\`\`\`${languageId}\n${selectedCode}\n\`\`\``).then(response => {
            this._messages.push({ 
                role: 'assistant', 
                content: response 
            });
            
            // Panele mesajı ilet
            if (CodeChatPanel.currentPanel && CodeChatPanel.currentPanel._panel) {
                CodeChatPanel.currentPanel._panel.webview.postMessage({
                    type: 'initialResponse',
                    content: response
                });
            }
        });
    }
    
    /**
     * WebView için HTML içeriği oluşturur
     */
    private _getHtmlForWebview(webview: vscode.Webview, props: { 
        scriptUri: vscode.Uri, 
        styleUri: vscode.Uri,
        selectedCode: string,
        languageId: string,
        fileName: string
    }): string {
        return `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Byte Code Chat</title>
            <link rel="stylesheet" href="${props.styleUri}">
        </head>
        <body>
            <div class="code-chat-container">
                <div class="chat-header">
                    <h2>Byte Code Chat - ${props.fileName}</h2>
                    <div class="header-controls">
                        <button id="closeButton" class="icon-button" title="Kapat">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="code-section">
                    <div class="code-header">
                        <div class="code-title">Seçilen Kod (${props.languageId})</div>
                    </div>
                    <pre class="code-block"><code class="language-${props.languageId}">${this._escapeHtml(props.selectedCode)}</code></pre>
                </div>
                
                <div class="chat-section">
                    <div class="messages-container" id="messagesContainer">
                        <div class="loading-message">
                            <div class="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                            <div>Kod analiz ediliyor...</div>
                        </div>
                    </div>
                    
                    <div class="input-container">
                        <textarea id="userInput" placeholder="Kod hakkında bir şey sorun..." rows="1"></textarea>
                        <button id="sendButton" class="send-button" title="Gönder">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            
            <script src="${props.scriptUri}"></script>
        </body>
        </html>
        `;
    }
    
    /**
     * HTML özel karakterleri escape eder
     */
    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
} 