import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * InlineChat paneli başlığını oluşturur
 */
export function createAnalysisPanelTitle(fileName: string, languageId: string, lineCount: number): string {
    return `Kod Analizi: ${fileName || 'Kod Parçası'} (${languageId || 'text'}) - ${lineCount} satır`;
}

/**
 * WebView HTML içeriğini oluşturur
 */
export function getInlineChatWebviewContent(
    webview: vscode.Webview, 
    extensionUri: vscode.Uri, 
    code: string,
    fileName: string,
    languageId: string,
    lineCount: number
): string {
    // WebView kaynaklarına erişim için URI'lar
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'media', 'inline-chat', 'inline-chat.js')
    );
    
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'media', 'inline-chat', 'inline-chat.css')
    );
    
    // Syntax highlighting için Prism.js ekle
    const prismCssUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'media', 'inline-chat', 'prism.css')
    );
    
    const prismJsUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'media', 'inline-chat', 'prism.js')
    );
    
    // Kod satır sayısını hesapla
    const lineInfo = `${lineCount} satır`;
    
    // Kod güvenliği için HTML kaçış
    const escapedCode = code.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    // HTML şablonunu oku
    const htmlPath = vscode.Uri.joinPath(extensionUri, 'media', 'inline-chat', 'inline-chat.html');
    let htmlContent = '';
    
    try {
        // Dosyayı okuma işlemini yap (async değil)
        const fileUri = htmlPath.fsPath;
        htmlContent = fs.readFileSync(fileUri, 'utf8');
        
        // Content-Security-Policy meta etiketini güncellemek için regex
        htmlContent = htmlContent.replace(
            /<meta http-equiv="Content-Security-Policy"[^>]*>/,
            `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:;">`
        );
        
        // Stil ve script bağlantılarını ekle
        htmlContent = htmlContent.replace(
            '</head>',
            `<link rel="stylesheet" href="${styleUri}">
             <link rel="stylesheet" href="${prismCssUri}">
             <script src="${prismJsUri}"></script>
             <script src="${scriptUri}"></script>
             </head>`
        );
        
        // Eksik içeriği ekle
        const placeholders = {
            'code': escapedCode,
            'fileName': fileName || 'Kod Parçası',
            'languageId': languageId || 'text',
            'lineInfo': lineInfo,
            // Diğer placeholder'lar
            'codeHighlightClass': languageId ? `language-${languageId}` : 'language-plaintext'
        };
        
        // Tüm placeholderları yerleştir
        for (const [key, value] of Object.entries(placeholders)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            htmlContent = htmlContent.replace(regex, value);
        }
            
    } catch (error) {
        console.error('HTML şablonu yüklenirken hata:', error);
        
        // Hata durumunda basit bir HTML oluştur
        htmlContent = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Kod Analizi</title>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:;">
            <link rel="stylesheet" href="${styleUri}">
            <link rel="stylesheet" href="${prismCssUri}">
            <script src="${prismJsUri}"></script>
        </head>
        <body>
            <div class="chat-container">
                <div class="code-section">
                    <div class="code-header">
                        <div class="code-title">
                            <span class="file-name">${fileName || 'Kod Parçası'}</span>
                            <span class="language-badge">${languageId || 'text'}</span>
                            <span class="line-info">${lineInfo}</span>
                        </div>
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
                                <span>Test Et</span>
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
                        <div class="code-language">${languageId || 'text'}</div>
                        <pre class="line-numbers"><code class="language-${languageId || 'plaintext'}">${escapedCode}</code></pre>
                    </div>
                </div>
                <div class="chat-section">
                    <div id="messagesContainer" class="messages-container">
                        <!-- Mesajlar burada görünecek -->
                    </div>
                    <div class="input-container">
                        <textarea id="userInput" placeholder="Kod hakkında bir soru sorun..." rows="1"></textarea>
                        <button id="sendButton" class="send-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            <script>
                // Initialization code
                document.addEventListener('DOMContentLoaded', () => {
                    // Highlight code
                    if (window.Prism) {
                        Prism.highlightAll();
                    }
                    
                    // Setup event listeners
                    const sendButton = document.getElementById('sendButton');
                    const userInput = document.getElementById('userInput');
                    const messagesContainer = document.getElementById('messagesContainer');
                    
                    if (sendButton && userInput) {
                        sendButton.addEventListener('click', () => {
                            const text = userInput.value.trim();
                            if (text) {
                                // Send message to extension
                                const vscode = acquireVsCodeApi();
                                vscode.postMessage({
                                    command: 'sendMessage',
                                    text: text
                                });
                                
                                // Clear input
                                userInput.value = '';
                            }
                        });
                        
                        userInput.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendButton.click();
                            }
                        });
                    }
                    
                    // Setup action buttons
                    const actionButtons = {
                        'fixCodeBtn': 'fixCode',
                        'optimizeCodeBtn': 'optimizeCode',
                        'testCodeBtn': 'testCode',
                        'explainCodeBtn': 'explainCode',
                        'copyCodeBtn': 'copyCode'
                    };
                    
                    const vscode = acquireVsCodeApi();
                    Object.entries(actionButtons).forEach(([id, command]) => {
                        const button = document.getElementById(id);
                        if (button) {
                            button.addEventListener('click', () => {
                                vscode.postMessage({ command });
                            });
                        }
                    });
                });
            </script>
        </body>
        </html>
        `;
    }
    
    return htmlContent;
} 