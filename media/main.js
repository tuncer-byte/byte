(function() {
    // VS Code API'ye erişim
    const vscode = acquireVsCodeApi();
    
    // DOM Elementleri
    const messagesContainer = document.getElementById('messagesContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const aiProviderSelect = document.getElementById('aiProvider');
    const configureButton = document.getElementById('configureButton');
    const currentFileElement = document.getElementById('currentFile');
    const agentToggle = document.getElementById('agentToggle');
    const sendFileButton = document.getElementById('sendFileButton');
    const addFileButton = document.getElementById('addFileButton');
    
    // Mesajları saklamak için durum
    let state = vscode.getState() || { 
        messages: [],
        agentEnabled: true,
        currentFile: 'package.json',
        currentFilePath: '',
        recentFiles: []
    };
    
    // Sayfa yüklendiğinde VS Code'a hazır olduğumuzu bildir
    window.addEventListener('load', () => {
        vscode.postMessage({ type: 'webviewReady' });
        
        // Agent durumunu kayıtlı durumdan al
        if (state.agentEnabled !== undefined) {
            agentToggle.checked = state.agentEnabled;
        }
        
        // Mevcut dosya bilgisini göster
        if (state.currentFile) {
            currentFileElement.textContent = state.currentFile;
        }
    });
    
    // Agent toggle değişikliği
    agentToggle.addEventListener('change', () => {
        state.agentEnabled = agentToggle.checked;
        vscode.setState(state);
        
        // VS Code eklentisine agent durumunu bildir
        vscode.postMessage({
            type: 'agentStatusChanged',
            enabled: agentToggle.checked
        });
    });
    
    // Önceki mesajları yükle
    function loadMessages() {
        if (state.messages && state.messages.length) {
            state.messages.forEach(message => {
                appendMessage(message.role, message.content);
            });
            
            // Mesaj alanını en alta kaydır
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    // Mesajı ekrana ekle
    function appendMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        if (role === 'user') {
            messageDiv.classList.add('user-message');
        } else {
            messageDiv.classList.add('assistant-message');
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        // Markdown formatlaması uygula (basitleştirilmiş)
        let formattedContent = formatMarkdown(content);
        contentDiv.innerHTML = formattedContent;
        
        messageDiv.appendChild(contentDiv);
        
        // AI mesajları için ekstra butonlar
        if (role === 'assistant') {
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('message-actions');
            
            const copyButton = document.createElement('button');
            copyButton.classList.add('copy-button');
            
            // SVG ikon ve metin ile modern buton
            copyButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Kopyala</span>
            `;
            
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(content)
                    .then(() => {
                        copyButton.classList.add('copy-success');
                        copyButton.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>Kopyalandı!</span>
                        `;
                        
                        setTimeout(() => {
                            copyButton.classList.remove('copy-success');
                            copyButton.innerHTML = `
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span>Kopyala</span>
                            `;
                        }, 2000);
                    });
            });
            
            actionsDiv.appendChild(copyButton);
            messageDiv.appendChild(actionsDiv);
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Geliştirilmiş Markdown formatlaması
    function formatMarkdown(text) {
        if (!text) return '';
        
        // Kod bloklarını işle - dil desteği eklendi
        text = text.replace(/```(\w*)([\s\S]*?)```/g, function(match, language, code) {
            const langClass = language ? ` class="language-${language}"` : '';
            const formattedCode = escapeHtml(code.trim());
            // Dil belirteci gösterimi eklendi
            const langBadge = language ? `<div class="code-language">${language}</div>` : '';
            return `<pre>${langBadge}<code${langClass}>${formattedCode}</code></pre>`;
        });
        
        // Satır içi kod
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Başlıklar
        text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Kalın metinler
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // İtalik metinler
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Listeler - geliştirildi
        // Sırasız liste öğelerini grup olarak dönüştür
        const ulRegex = /^[*\-] (.+)$/gm;
        const ulMatches = text.match(ulRegex);
        
        if (ulMatches) {
            let listItems = '';
            ulMatches.forEach(match => {
                const content = match.replace(/^[*\-] (.+)$/, '$1');
                listItems += `<li>${content}</li>`;
            });
            text = text.replace(ulRegex, '');
            // Listeleri düzgün grup olarak ekle
            if (listItems) {
                text = `<ul>${listItems}</ul>${text}`;
            }
        }
        
        // Numaralı listeler
        const olRegex = /^\d+\. (.+)$/gm;
        const olMatches = text.match(olRegex);
        
        if (olMatches) {
            let listItems = '';
            olMatches.forEach(match => {
                const content = match.replace(/^\d+\. (.+)$/, '$1');
                listItems += `<li>${content}</li>`;
            });
            text = text.replace(olRegex, '');
            if (listItems) {
                text = `<ol>${listItems}</ol>${text}`;
            }
        }
        
        // Kalan satırları paragraflara dönüştür
        const paragraphs = text.split(/\n\n+/);
        return paragraphs.map(p => {
            if (p.trim() && !p.includes('<h') && !p.includes('<ul') && !p.includes('<ol') && !p.includes('<pre')) {
                return `<p>${p.replace(/\n/g, '<br>')}</p>`;
            }
            return p;
        }).join('');
    }
    
    // HTML özel karakterleri kaçış
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    // Mesaj Gönderme
    function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;
        
        // Kullanıcı mesajını ekle
        appendMessage('user', text);
        
        // Durumu güncelle
        state.messages.push({ role: 'user', content: text });
        vscode.setState(state);
        
        // Input'u temizle
        userInput.value = '';
        
        // Yükleniyor göstergesini aç
        loadingIndicator.style.display = 'block';
        
        // VS Code eklentisine mesajı gönder
        vscode.postMessage({
            type: 'sendMessage',
            message: text,
            provider: aiProviderSelect.value
        });
    }
    
    // Mesaj gönderme butonu
    sendButton.addEventListener('click', sendMessage);
    
    // Enter tuşuyla gönderme (Shift+Enter için yeni satır)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Textarea otomatik yükseklik ayarı
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
    });
    
    // AI sağlayıcı değiştirildiğinde
    aiProviderSelect.addEventListener('change', () => {
        vscode.postMessage({
            type: 'changeProvider',
            provider: aiProviderSelect.value
        });
    });
    
    // Yapılandırma butonu
    configureButton.addEventListener('click', () => {
        vscode.postMessage({
            type: 'configureAI',
            provider: aiProviderSelect.value
        });
    });
    
    // Yeni chat başlatma butonu
    document.querySelector('.new-chat').addEventListener('click', () => {
        vscode.postMessage({ type: 'clearChat' });
    });
    
    // Dosyayı AI'ya gönderme butonu
    sendFileButton.addEventListener('click', () => {
        // Mevcut dosya içeriğini al ve AI'ya gönder
        vscode.postMessage({
            type: 'sendFileToAI',
            filePath: state.currentFilePath || ''
        });
        
        // Yükleniyor göstergesini aç
        loadingIndicator.style.display = 'block';
    });
    
    // Başka dosya ekleme butonu
    addFileButton.addEventListener('click', () => {
        // VS Code'a dosya seçim dialogu açma isteği gönder
        vscode.postMessage({
            type: 'openFileSelector'
        });
    });
    
    // VS Code'dan gelen mesajları dinle
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'response':
                // Yapay zeka yanıtını ekle
                appendMessage('assistant', message.content);
                
                // Durumu güncelle
                state.messages.push({ role: 'assistant', content: message.content });
                vscode.setState(state);
                
                // Yükleniyor göstergesini kapat
                loadingIndicator.style.display = 'none';
                break;
                
            case 'providerChanged':
                // AI sağlayıcı değiştiğinde seçiciyi güncelle
                aiProviderSelect.value = message.provider;
                break;
                
            case 'error':
                // Hata mesajını göster
                appendMessage('assistant', `⚠️ Hata: ${message.content}`);
                loadingIndicator.style.display = 'none';
                break;
                
            case 'init':
                // Yapılandırma bilgilerini al
                if (message.provider) {
                    aiProviderSelect.value = message.provider;
                }
                
                // Önceki mesajları yükle
                if (message.messages) {
                    state.messages = message.messages;
                    vscode.setState(state);
                    messagesContainer.innerHTML = '';
                    loadMessages();
                }
                
                // Agent durumunu al
                if (message.agentEnabled !== undefined) {
                    state.agentEnabled = message.agentEnabled;
                    agentToggle.checked = message.agentEnabled;
                    vscode.setState(state);
                }
                
                // Mevcut dosya bilgisini al
                if (message.currentFile) {
                    state.currentFile = message.currentFile;
                    currentFileElement.textContent = message.currentFile;
                    vscode.setState(state);
                }
                break;
                
            case 'currentFileChanged':
                // Mevcut açık dosya değiştiğinde bilgiyi güncelle
                if (message.filePath) {
                    const fileName = message.filePath.split('/').pop();
                    state.currentFile = fileName;
                    currentFileElement.textContent = fileName;
                    vscode.setState(state);
                }
                break;
                
            case 'clearChat':
                // Sohbeti temizle
                state.messages = [];
                vscode.setState(state);
                messagesContainer.innerHTML = '';
                
                // Karşılama mesajını yeni tasarımla tekrar ekle 
                const welcomeDiv = document.createElement('div');
                welcomeDiv.classList.add('welcome-message');
                welcomeDiv.innerHTML = `
                    <div class="assistant-message">
                        <div class="message-content">
                            <h2>Welcome to Byte</h2>
                            <ul class="welcome-list">
                                <li>Configure plugin settings</li>
                                <li>Explore shortcuts</li>
                                <li>Provide instructions for AI</li>
                            </ul>
                            
                            <div class="assistant-intro">
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
                            
                            <div class="coffee-mode">
                                <h3>Coffee mode</h3>
                                <p>Enable to automatically apply changes and run safe commands</p>
                            </div>
                        </div>
                    </div>
                `;
                messagesContainer.appendChild(welcomeDiv);
                break;
                
            case 'fileSelected':
                // Yeni bir dosya seçildiğinde
                if (message.filePath && message.fileName) {
                    state.currentFile = message.fileName;
                    state.currentFilePath = message.filePath;
                    
                    // Dosya adını güncelle
                    currentFileElement.textContent = message.fileName;
                    
                    // Son dosyalar listesine ekle (eğer yoksa)
                    if (!state.recentFiles.some(file => file.path === message.filePath)) {
                        state.recentFiles.push({
                            name: message.fileName,
                            path: message.filePath
                        });
                        
                        // Maksimum 5 dosya saklayalım
                        if (state.recentFiles.length > 5) {
                            state.recentFiles.shift();
                        }
                    }
                    
                    // Durumu kaydet
                    vscode.setState(state);
                }
                break;
                
            case 'setWidth':
                // Panel genişliğini ayarla
                if (message.width) {
                    // VSCode webview panelinin genişliğini ayarla
                    document.documentElement.style.setProperty('--panel-width', `${message.width}px`);
                    document.documentElement.style.setProperty('min-width', `${message.width}px`);
                    document.body.style.minWidth = `${message.width}px`;
                    // Container genişliğini ayarla
                    document.querySelector('.chat-container').style.minWidth = `${message.width}px`;
                }
                break;
        }
    });
    
    // Sayfa yüklendiğinde mesajları göster
    loadMessages();
})();