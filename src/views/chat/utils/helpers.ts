import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * HTML şablonunu ve kaynaklarını yükleme
 */
export function getWebviewContent(extensionUri: vscode.Uri, webview: vscode.Webview): string {
    // WebView kaynaklarına erişim için URI'lar
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'media', 'chat', 'chat-panel.js')
    );
    
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'media', 'chat', 'chat-panel.css')
    );
    
    // HTML şablonunu oku
    const htmlPath = vscode.Uri.joinPath(extensionUri, 'media', 'chat', 'chat-panel.html');
    let htmlContent = '';
    
    try {
        // Dosyayı okuma işlemini yap (async değil)
        const fileUri = htmlPath.fsPath;
        htmlContent = fs.readFileSync(fileUri, 'utf8');
        
        // Dosya içindeki placeholder'ları değiştir
        htmlContent = htmlContent
            .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
            .replace(/\{\{styleUri\}\}/g, styleUri.toString());
            
    } catch (error) {
        // Hata durumunda basit bir HTML oluştur
        htmlContent = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Byte AI Asistanı</title>
            <link rel="stylesheet" href="${styleUri}">
        </head>
        <body>
            <div class="chat-container">
                <div class="chat-header">
                    <h1>Byte</h1>
                    <div class="provider-selector">
                        <select id="aiProvider">
                            <option value="openai">OpenAI</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="local">Yerel Model</option>
                        </select>
                        <button id="configureButton" class="icon-button" title="Yapılandır">⚙️</button>
                    </div>
                </div>
                
                <div class="messages-container" id="messagesContainer">
                    <div class="welcome-message">
                        <div class="assistant-message">
                            <div class="message-content">
                                <h2>Welcome to Byte</h2>
                                <ul class="welcome-list">
                                    <li>Configure plugin settings</li>
                                    <li>Explore shortcuts</li>
                                    <li>Provide instructions for AI</li>
                                </ul>
                                
                                <div class="assistant-intro">
                                    <div class="assistant-icon">🔥</div>
                                    <p>Ask Byte anything to help you with your coding tasks or to learn something new.</p>
                                </div>
                                
                                <div class="quick-commands">
                                    <h3>Quick commands</h3>
                                    <ul>
                                        <li><span class="command">/code</span> to generate new feature or fix bug</li>
                                        <li><span class="command">/explain</span> file or selected code</li>
                                        <li><span class="command">/review</span> code to recommend improvements</li>
                                        <li><span class="command">/unittests</span> to generate unit tests</li>
                                    </ul>
                                </div>
                                
                                <div class="chill-mode">
                                    <h3>Chill mode</h3>
                                    <p>Enable to automatically apply changes and run safe commands</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="input-container">
                    <div class="context-info">
                        <span class="new-chat">New chat</span>
                        <span class="context-separator">|</span>
                        <span class="current-file" id="currentFile">package.json</span>
                        <div class="context-controls">
                            <label class="agent-toggle">
                                <span>Chill</span>
                                <input type="checkbox" id="agentToggle" checked disabled>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                    <div class="input-wrapper">
                        <textarea id="userInput" placeholder="Ask Byte..." rows="1"></textarea>
                        <button id="sendButton" class="send-button" title="Gönder">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
                            </svg>
                        </button>
                    </div>
                    <div class="loading-indicator" id="loadingIndicator">
                        <div class="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            </div>
            <script src="${scriptUri}"></script>
        </body>
        </html>
        `;
    }
    
    return htmlContent;
}

/**
 * Dil ID'sine göre test framework belirler
 */
export function detectTestFramework(languageId: string): string {
    switch (languageId) {
        case 'javascript':
        case 'typescript':
        case 'typescriptreact':
        case 'javascriptreact':
            return 'Jest';
        case 'python':
            return 'Pytest';
        case 'java':
            return 'JUnit';
        case 'csharp':
            return 'NUnit';
        case 'ruby':
            return 'RSpec';
        default:
            return 'appropriate';
    }
}

/**
 * Uygulanacak kodu uygun hale getirir
 */
export function cleanCodeForApply(code: string): string {
    // Yorum satırlarını temizleme
    // 1. /* ... */ çok satırlı yorumları temizle
    // 2. // ... tek satırlı yorumları temizle
    let cleanCode = code
        .replace(/\/\*[\s\S]*?\*\//g, '') // Çok satırlı yorumları kaldır
        .replace(/\/\/.*?($|\n)/g, '$1'); // Tek satırlı yorumları kaldır

    // Kod bloğunun yorum satırları olmadan da çalışır olduğundan emin ol
    // Örneğin, ardışık boş satırları tek boş satıra düşür
    cleanCode = cleanCode.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return cleanCode;
}

/**
 * Ollama API'sinin kullanılabilirliğini kontrol et
 */
export async function checkOllamaAvailability(): Promise<boolean> {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Ollama API'sine istek gönder
 */
export async function sendOllamaRequest(message: string, model: string): Promise<string> {
    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                prompt: message,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error('Ollama API yanıt vermedi');
        }

        const data = await response.json() as { response: string };
        return data.response;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
        throw new Error(`Ollama API hatası: ${errorMessage}`);
    }
} 