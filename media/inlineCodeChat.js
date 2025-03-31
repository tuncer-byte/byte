(function() {
    // VS Code API erişimi
    const vscode = acquireVsCodeApi();

    // DOM elementleri
    const messagesContainer = document.getElementById('messagesContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const codeBlock = document.getElementById('codeBlock').querySelector('code');
    const languageBadge = document.getElementById('languageBadge');
    const fixCodeBtn = document.getElementById('fixCodeBtn');
    const optimizeCodeBtn = document.getElementById('optimizeCodeBtn');
    const testCodeBtn = document.getElementById('testCodeBtn');
    const explainCodeBtn = document.getElementById('explainCodeBtn');
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    
    // Kullanıcı mesajı gönderme olayı
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Metin alanının yüksekliğini otomatik ayarlama
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
        
        // Gönder düğmesini etkinleştir/devre dışı bırak
        sendButton.disabled = userInput.value.trim() === '';
    });

    // Kod düğmeleri olayları
    fixCodeBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'fixCode'
        });
    });

    optimizeCodeBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'optimizeCode'
        });
    });

    testCodeBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'testCode'
        });
    });

    explainCodeBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'explainCode'
        });
    });

    copyCodeBtn.addEventListener('click', () => {
        const codeText = codeBlock.textContent;
        navigator.clipboard.writeText(codeText)
            .then(() => {
                // Success notification
                const originalText = copyCodeBtn.innerHTML;
                copyCodeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied</span>`;
                copyCodeBtn.classList.add('copied');
                
                setTimeout(() => {
                    copyCodeBtn.innerHTML = originalText;
                    copyCodeBtn.classList.remove('copied');
                }, 2000);
            })
            .catch(err => {
                console.error('Copy error:', err);
                vscode.postMessage({
                    command: 'error',
                    message: 'An error occurred while copying the code.'
                });
            });
    });

    // Kullanıcı mesajı gönderme fonksiyonu
    function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;

        vscode.postMessage({
            command: 'sendMessage',
            text: message
        });

        // Giriş alanını temizle
        userInput.value = '';
        userInput.style.height = 'auto';
        sendButton.disabled = true;
    }

    // Mesaj ekleme fonksiyonu
    function appendMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}-message`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (type === 'assistant') {
            messageContent.innerHTML = formatMarkdown(message);
            
            // Kod bloklarında kopyalama düğmesi ekle
            const codeBlocks = messageContent.querySelectorAll('pre');
            codeBlocks.forEach(codeBlock => {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'message-actions';
                
                const copyButton = document.createElement('button');
                copyButton.className = 'copy-button';
                copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>`;
                
                copyButton.addEventListener('click', () => {
                    const code = codeBlock.querySelector('code').textContent;
                    navigator.clipboard.writeText(code)
                        .then(() => {
                            copyButton.classList.add('copied');
                            copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                            
                            setTimeout(() => {
                                copyButton.classList.remove('copied');
                                copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>`;
                            }, 2000);
                        })
                        .catch(err => console.error('Code block copy error:', err));
                });
                
                actionsDiv.appendChild(copyButton);
                codeBlock.appendChild(actionsDiv);
            });
        } else {
            messageContent.textContent = message;
        }
        
        messageElement.appendChild(messageContent);
        messagesContainer.appendChild(messageElement);
        
        // Otomatik kaydırma
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Markdown formatı fonksiyonu
    function formatMarkdown(text) {
        // Başlıklar
        text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Kod blokları (dil belirtimli ve belirtimsiz)
        text = text.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, function(match, lang, code) {
            return `<pre><code class="language-${lang}">${encodeHTML(code.trim())}</code></pre>`;
        });
        
        // Satır içi kod
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Kalın
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // İtalik
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Listeler
        text = text.replace(/^\s*- (.*$)/gm, '<ul><li>$1</li></ul>');
        text = text.replace(/^\s*\d+\. (.*$)/gm, '<ol><li>$1</li></ol>');
        
        // Paragraflar
        text = text.replace(/\n\s*\n/g, '</p><p>');
        text = '<p>' + text + '</p>';
        
        // Üst üste gelen liste etiketlerini temizle
        text = text.replace(/<\/ul><ul>/g, '');
        text = text.replace(/<\/ol><ol>/g, '');
        
        return text;
    }

    // HTML karakterlerini kodlama fonksiyonu
    function encodeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Yükleniyor göstergesi
    function showLoadingIndicator() {
        const loadingElement = document.createElement('div');
        loadingElement.id = 'loadingMessage';
        loadingElement.className = 'loading-message';
        
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            typingIndicator.appendChild(dot);
        }
        
        loadingElement.appendChild(typingIndicator);
        messagesContainer.appendChild(loadingElement);
        
        // Otomatik kaydırma
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function hideLoadingIndicator() {
        const loadingElement = document.getElementById('loadingMessage');
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    // Hata mesajı gösterme
    function showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        
        messagesContainer.appendChild(errorElement);
        
        // Otomatik kaydırma
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Belli bir süre sonra kaldır
        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }

    // VS Code'dan gelen mesajları dinle
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'updateCode':
                // Kodu ve dil bilgisini güncelle
                codeBlock.textContent = message.code;
                languageBadge.textContent = message.languageId;
                break;
                
            case 'addMessage':
                // Mesaj ekle
                appendMessage(message.message, message.type);
                break;
                
            case 'startLoading':
                // Yükleniyor göstergesi
                hideLoadingIndicator(); // Önce varsa kaldır
                showLoadingIndicator();
                
                // Özel yükleme mesajı varsa göster
                if (message.message) {
                    const loadingElement = document.getElementById('loadingMessage');
                    const loadingText = document.createElement('div');
                    loadingText.textContent = message.message;
                    loadingElement.appendChild(loadingText);
                }
                break;
                
            case 'stopLoading':
                // Yükleniyor göstergesini kaldır
                hideLoadingIndicator();
                break;
                
            case 'error':
                // Hata mesajı göster
                hideLoadingIndicator();
                showError(message.message);
                break;
        }
    });

    // Başlangıçta Web sayfasının hazır olduğunu bildir
    vscode.postMessage({
        command: 'ready'
    });
})(); 