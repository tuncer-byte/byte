import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
    
    // Kod satır sayısını hesapla
    const lineInfo = `${lineCount} satır`;
    
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
            `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource}; img-src ${webview.cspSource} https:;">`
        );
        
        // Stil ve script etiketlerini güncellemek için regex
        htmlContent = htmlContent.replace(
            /<link rel="stylesheet" href="inline-chat.css">/,
            `<link rel="stylesheet" href="${styleUri}">`
        );
        
        htmlContent = htmlContent.replace(
            /<script src="inline-chat.js"><\/script>/,
            `<script src="${scriptUri}"></script>`
        );
        
        // Kod ve diğer bilgileri ekle
        if (code) {
            const escapedCode = code.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
                
            const codeBlockElement = htmlContent.match(/<pre id="codeBlock".*?>([\s\S]*?)<\/pre>/);
            if (codeBlockElement) {
                htmlContent = htmlContent.replace(
                    /<pre id="codeBlock".*?>([\s\S]*?)<\/pre>/,
                    `<pre id="codeBlock" class="code-block"><code>${escapedCode}</code></pre>`
                );
            }
        }
        
        // Dosya adı, dil ID'si ve satır bilgisini ekle
        if (languageId) {
            htmlContent = htmlContent.replace(
                /<div id="languageBadge" class="code-language"><\/div>/,
                `<div id="languageBadge" class="code-language">${languageId}</div>`
            );
        }
        
        // Alternatif placeholder değiştirme yöntemi
        htmlContent = htmlContent
            .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
            .replace(/\{\{styleUri\}\}/g, styleUri.toString())
            .replace(/\{\{fileName\}\}/g, fileName || '')
            .replace(/\{\{languageId\}\}/g, languageId || '')
            .replace(/\{\{lineInfo\}\}/g, lineInfo || '');
            
    } catch (error) {
        // Hata durumunda basit bir HTML oluştur
        htmlContent = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Chat</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    padding: 0;
                    margin: 0;
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                }
                
                .code-header {
                    background-color: var(--vscode-editor-lineHighlightBackground);
                    padding: 8px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                
                .file-info {
                    display: flex;
                    align-items: center;
                    font-size: 13px;
                }
                
                .file-name {
                    font-weight: bold;
                    margin-right: 8px;
                }
                
                .language-id {
                    color: var(--vscode-descriptionForeground);
                    margin-right: 8px;
                }
                
                .line-info {
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                }
                
                .message-container {
                    padding: 16px;
                    max-height: calc(100vh - 140px);
                    overflow-y: auto;
                }
                
                .message {
                    margin-bottom: 16px;
                    padding: 12px;
                    border-radius: 6px;
                }
                
                .user-message {
                    background-color: var(--vscode-inputValidation-infoBorder);
                    color: var(--vscode-editor-foreground);
                }
                
                .assistant-message {
                    background-color: var(--vscode-editor-lineHighlightBackground);
                }
                
                .input-container {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    padding: 16px;
                    background-color: var(--vscode-editor-background);
                    border-top: 1px solid var(--vscode-panel-border);
                }
                
                .input-box {
                    display: flex;
                }
                
                #messageInput {
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                    font-family: inherit;
                    resize: none;
                    min-height: 40px;
                }
                
                #sendButton {
                    margin-left: 8px;
                    padding: 8px 16px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                #sendButton:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                .loading-indicator {
                    display: none;
                    justify-content: center;
                    margin-top: 8px;
                }
                
                .loading-indicator.active {
                    display: flex;
                }
                
                .loading-spinner {
                    border: 3px solid rgba(0, 0, 0, 0.1);
                    border-top-color: var(--vscode-progressBar-background);
                    border-radius: 50%;
                    width: 16px;
                    height: 16px;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 8px;
                    border-radius: 4px;
                    overflow-x: auto;
                }
                
                code {
                    font-family: Menlo, Monaco, 'Courier New', monospace;
                    font-size: 0.9em;
                }
            </style>
            <link rel="stylesheet" href="${styleUri}">
        </head>
        <body>
            <div class="code-header">
                <div class="file-info">
                    <div class="file-name">${fileName}</div>
                    <div class="language-id">${languageId}</div>
                    <div class="line-info">${lineInfo}</div>
                </div>
            </div>
            
            <div class="message-container" id="messageContainer">
                <!-- Mesajlar burada görünecek -->
            </div>
            
            <div class="input-container">
                <div class="input-box">
                    <textarea id="messageInput" placeholder="AI'ya soru sorun veya talimatta bulunun..." rows="1"></textarea>
                    <button id="sendButton">Gönder</button>
                </div>
                <div class="loading-indicator" id="loadingIndicator">
                    <div class="loading-spinner"></div>
                </div>
            </div>

            <script>
                // VS Code API'yi al
                const vscode = acquireVsCodeApi();
                
                // HTML elementleri
                const messageContainer = document.getElementById('messageContainer');
                const messageInput = document.getElementById('messageInput');
                const sendButton = document.getElementById('sendButton');
                const loadingIndicator = document.getElementById('loadingIndicator');
                
                // Mesaj gönderme işlevi
                function sendMessage() {
                    const text = messageInput.value.trim();
                    if (!text) return;
                    
                    // Mesajı VS Code'a gönder
                    vscode.postMessage({
                        command: 'sendMessage',
                        text
                    });
                    
                    // Kullanıcı mesajını ekle
                    addMessage(text, 'user');
                    
                    // Input temizle
                    messageInput.value = '';
                    
                    // Yükleniyor göstergesi göster
                    loadingIndicator.classList.add('active');
                }
                
                // Basit markdown dönüşümü
                function simpleMarkdown(text) {
                    return text
                        .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
                        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                        .replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*([^\*]+)\*/g, '<em>$1</em>')
                        .replace(/\\n/g, '<br>');
                }
                
                // Mesaj ekleme işlevi
                function addMessage(text, type) {
                    const messageElement = document.createElement('div');
                    messageElement.className = 'message ' + type + '-message';
                    
                    // Markdown for assistant messages
                    if (type === 'assistant') {
                        const formattedText = simpleMarkdown(text);
                        messageElement.innerHTML = formattedText;
                    } else {
                        messageElement.textContent = text;
                    }
                    
                    messageContainer.appendChild(messageElement);
                    
                    // Otomatik scroll
                    messageContainer.scrollTop = messageContainer.scrollHeight;
                }
                
                // Enter tuşu ile mesaj gönderme
                messageInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });
                
                // Gönder butonu ile mesaj gönderme
                sendButton.addEventListener('click', sendMessage);
                
                // VS Code'dan gelen mesajları işle
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'addMessage':
                            // Asistan mesajı ekle
                            addMessage(message.text, message.role || 'assistant');
                            
                            // Yükleniyor göstergesini gizle
                            loadingIndicator.classList.remove('active');
                            break;
                            
                        case 'setCode':
                            // Dosya bilgilerini güncelle
                            if (message.fileName && message.languageId && message.lineInfo) {
                                document.querySelector('.file-name').textContent = message.fileName;
                                document.querySelector('.language-id').textContent = message.languageId;
                                document.querySelector('.line-info').textContent = message.lineInfo;
                            }
                            break;
                    }
                });
                
                // VS Code'a hazır olduğunu bildir
                vscode.postMessage({ command: 'ready' });
            </script>
        </body>
        </html>
        `;
    }
    
    return htmlContent;
}

/**
 * Analiz paneli için başlık oluşturur
 */
export function createAnalysisPanelTitle(fileName: string, languageId: string, lineCount: number): string {
    return `${fileName} (${languageId}) - ${lineCount} satır`;
} 