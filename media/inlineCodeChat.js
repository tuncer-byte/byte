(function() {
    // VS Code API erişimi
    const vscode = acquireVsCodeApi();
    
    // Seçilen kod ve dil bilgisi için değişkenler
    let currentCode = '';
    let currentLanguage = '';
    let currentFileName = '';

    // DOM elementleri
    let messagesContainer, userInput, sendButton, codeBlock, languageBadge, 
        fixCodeBtn, optimizeCodeBtn, testCodeBtn, explainCodeBtn, copyCodeBtn;
    
    // DOM yükleme ve başlatma
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM content loaded, initializing UI');
        initializeDOM();
        setupEventListeners();
        notifyReady();
    });
    
    // DOM elementlerini tanımlama
    function initializeDOM() {
        messagesContainer = document.getElementById('messagesContainer');
        userInput = document.getElementById('userInput');
        sendButton = document.getElementById('sendButton');
        
        // Kod bloğu elementleri
        const codeBlockElement = document.getElementById('codeBlock');
        console.log('Code block element found:', codeBlockElement ? 'Yes' : 'No');
        
        if (codeBlockElement) {
            // Direkt olarak pre elementi ise
            if (codeBlockElement.tagName === 'PRE') {
                // code etiketi var mı kontrol et
                const codeEl = codeBlockElement.querySelector('code');
                if (codeEl) {
                    codeBlock = codeEl;
                    console.log('Found code element inside pre element');
                } else {
                    // Yoksa oluştur
                    const newCodeEl = document.createElement('code');
                    codeBlockElement.appendChild(newCodeEl);
                    codeBlock = newCodeEl;
                    console.log('Created new code element inside pre element');
                }
            } else {
                // Direkt olarak codeBlock referansını sakla, içine code etiketi oluşturulacak
                codeBlock = codeBlockElement;
                console.log('Using codeBlock directly');
            }
        } else {
            console.error('Code block element (#codeBlock) not found');
        }
        
        languageBadge = document.getElementById('languageBadge');
        fixCodeBtn = document.getElementById('fixCodeBtn');
        optimizeCodeBtn = document.getElementById('optimizeCodeBtn');
        testCodeBtn = document.getElementById('testCodeBtn');
        explainCodeBtn = document.getElementById('explainCodeBtn');
        copyCodeBtn = document.getElementById('copyCodeBtn');
        
        // Başlangıçta kod alanını görünür yap ama içerik olmadan
        const codeContent = document.getElementById('codeContent');
        if (codeContent) {
            codeContent.style.display = 'block';
            console.log('Code content section is now visible');
        } else {
            console.error('Code content element (#codeContent) not found');
        }
    }
    
    // Olay dinleyicilerini ayarla
    function setupEventListeners() {
        if (!userInput || !sendButton) {
            console.error('Required DOM elements not found');
            return;
        }
        
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
        if (fixCodeBtn) {
            fixCodeBtn.addEventListener('click', () => {
                if (!currentCode) {
                    showError('No code selected to fix.');
                    return;
                }
                
                vscode.postMessage({
                    command: 'fixCode',
                    code: currentCode,
                    language: currentLanguage,
                    fileName: currentFileName
                });
                
                // Kullanıcı istediği komutu manuel olarak sohbete ekle
                appendMessage('Fix and improve this code', 'user');
            });
        }

        if (optimizeCodeBtn) {
            optimizeCodeBtn.addEventListener('click', () => {
                if (!currentCode) {
                    showError('No code selected to optimize.');
                    return;
                }
                
                vscode.postMessage({
                    command: 'optimizeCode',
                    code: currentCode,
                    language: currentLanguage,
                    fileName: currentFileName
                });
                
                // Kullanıcı istediği komutu manuel olarak sohbete ekle
                appendMessage('Optimize this code', 'user');
            });
        }

        if (testCodeBtn) {
            testCodeBtn.addEventListener('click', () => {
                if (!currentCode) {
                    showError('No code selected for testing.');
                    return;
                }
                
                vscode.postMessage({
                    command: 'testCode',
                    code: currentCode,
                    language: currentLanguage,
                    fileName: currentFileName
                });
                

            });
        }

        if (explainCodeBtn) {
            explainCodeBtn.addEventListener('click', () => {
                if (!currentCode) {
                    showError('No code selected to explain.');
                    return;
                }
                
                vscode.postMessage({
                    command: 'explainCode',
                    code: currentCode,
                    language: currentLanguage,
                    fileName: currentFileName
                });
                
                // Kullanıcı istediği komutu manuel olarak sohbete ekle
                appendMessage('Explain this code', 'user');
            });
        }

        if (copyCodeBtn && codeBlock) {
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
        }
    }
    
    // VS Code'a hazır olduğunu bildir
    function notifyReady() {
        console.log('Notifying VS Code that WebView is ready');
        vscode.postMessage({
            command: 'ready'
        });
    }

    // Kullanıcı mesajı gönderme fonksiyonu
    function sendMessage() {
        if (!userInput || !messagesContainer) {
            console.error('Required DOM elements not found for sending message');
            return;
        }
        
        const message = userInput.value.trim();
        if (message === '') return;

        vscode.postMessage({
            command: 'sendMessage',
            text: message,
            code: currentCode,
            language: currentLanguage,
            fileName: currentFileName
        });

        // Giriş alanını temizle
        userInput.value = '';
        userInput.style.height = 'auto';
        if (sendButton) sendButton.disabled = true;
    }

    // Mesaj ekleme fonksiyonu
    function appendMessage(message, type) {
        if (!messagesContainer) {
            console.error('Messages container not found when appending message');
            return;
        }
        
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
                    const code = codeBlock.querySelector('code')?.textContent || '';
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
        if (!messagesContainer) return;
        
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
        if (!messagesContainer) return;
        
        const loadingElement = document.getElementById('loadingMessage');
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    // Hata mesajı gösterme
    function showError(message) {
        if (!messagesContainer) return;
        
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
        console.log(`Received message with command: ${message.command}`);
        
        switch (message.command) {
            case 'updateCode':
                try {
                    // Kodu ve dil bilgisini güncelle
                    currentCode = message.code || '';
                    currentLanguage = message.languageId || '';
                    currentFileName = message.fileName || '';
                    const lineInfo = message.lineInfo || '';
                    
                    console.log(`Received code: Length=${currentCode.length}, Language=${currentLanguage}, LineInfo=${lineInfo}`);
                    
                    // Kod bloğu yerine dosya bilgisi göster
                    const codeContent = document.getElementById('codeContent');
                    if (codeContent) {
                        codeContent.style.display = 'block';
                        console.log('Code content section is now visible');
                    } else {
                        console.error('Code content element (#codeContent) not found');
                    }
                    
                    // codeBlock'un içeriğini dosya adı ve satır numaralarıyla değiştir
                    const codeBlockElement = document.getElementById('codeBlock');
                    if (codeBlockElement) {
                        // Eski içeriği temizle
                        codeBlockElement.innerHTML = '';
                        
                        // Dosya bilgisini göster
                        const fileInfoElement = document.createElement('div');
                        fileInfoElement.className = 'file-info';
                        
                        const fileName = currentFileName || 'Unnamed File';
                        fileInfoElement.innerHTML = `
                            <div class="file-name">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                                <span>${fileName}</span>
                            </div>
                            <div class="line-info">${lineInfo}</div>
                        `;
                        
                        codeBlockElement.appendChild(fileInfoElement);
                        console.log('Updated UI with file information');
                    } else {
                        console.error('Code block element not found for update');
                    }
                    
                    // Dil rozetini güncelle
                    if (languageBadge) {
                        if (currentLanguage) {
                            languageBadge.textContent = currentLanguage;
                            languageBadge.style.display = 'inline-block';
                            console.log(`Updated language badge to show: ${currentLanguage}`);
                        } else {
                            languageBadge.style.display = 'none';
                            console.log('Language badge hidden (no language specified)');
                        }
                    } else {
                        console.error('Language badge element not found');
                    }
                    
                    // Düğmeleri etkinleştir (kod varsa)
                    if (currentCode) {
                        if (fixCodeBtn) fixCodeBtn.disabled = false;
                        if (optimizeCodeBtn) optimizeCodeBtn.disabled = false;
                        if (testCodeBtn) testCodeBtn.disabled = false;
                        if (explainCodeBtn) explainCodeBtn.disabled = false;
                        if (copyCodeBtn) copyCodeBtn.disabled = false;
                        console.log('Buttons enabled as code is available');
                    } else {
                        console.error('No code received, buttons will remain disabled');
                    }
                    
                    console.log('Code update complete');
                } catch (error) {
                    console.error('Error updating code in UI:', error);
                    showError('An error occurred while displaying the code.');
                }
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
})(); 