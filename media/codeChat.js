(function() {
    // VS Code API'ye erişim
    const vscode = acquireVsCodeApi();
    
    // DOM Elementleri
    const messagesContainer = document.getElementById('messagesContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const closeButton = document.getElementById('closeButton');
    
    // Durum değişkenleri
    let isWaitingForResponse = true;
    
    // Init işlevi
    function init() {
        // Kapat butonuna tıklama
        closeButton.addEventListener('click', () => {
            vscode.postMessage({ type: 'closePanel' });
        });
        
        // Gönder butonuna tıklama
        sendButton.addEventListener('click', sendMessage);
        
        // Enter tuşuna basma (Shift+Enter çok satır)
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Textarea otomatik yükseklik ayarı
        userInput.addEventListener('input', adjustTextareaHeight);
    }
    
    // Textarea yüksekliğini otomatik ayarla
    function adjustTextareaHeight() {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
    }
    
    // Mesaj gönderme fonksiyonu
    function sendMessage() {
        const text = userInput.value.trim();
        if (!text || isWaitingForResponse) return;
        
        // Kullanıcı mesajını ekle
        appendMessage('user', text);
        
        // Input'u temizle
        userInput.value = '';
        adjustTextareaHeight();
        
        // Yükleniyor durumunu göster
        isWaitingForResponse = true;
        showLoadingIndicator();
        
        // VS Code'a mesajı gönder
        vscode.postMessage({
            type: 'sendMessage',
            message: text
        });
    }
    
    // Mesajı ekrana ekler
    function appendMessage(role, content) {
        // Yükleme mesajını kaldır
        const loadingMessage = document.querySelector('.loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        if (role === 'user') {
            messageDiv.classList.add('user-message');
        } else {
            messageDiv.classList.add('assistant-message');
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        // Markdown formatlaması uygula
        contentDiv.innerHTML = formatMarkdown(content);
        
        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
        
        // Scrollu en alt seviyeye ayarla
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Yükleniyor göstergesini ekle
    function showLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('loading-message');
        
        loadingDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <div>Yanıt hazırlanıyor...</div>
        `;
        
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Basit Markdown formatlaması
    function formatMarkdown(text) {
        if (!text) return '';
        
        // Kod bloklarını işle - dil desteği eklendi
        text = text.replace(/```(\w*)([\s\S]*?)```/g, function(match, language, code) {
            const langClass = language ? ` class="language-${language}"` : '';
            const formattedCode = escapeHtml(code.trim());
            // Dil belirteci gösterimi
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
        
        // Sırasız liste öğeleri
        text = text.replace(/^\s*[\*\-] (.+)$/gm, '<ul><li>$1</li></ul>');
        text = text.replace(/<\/ul><ul>/g, '');
        
        // Numaralı liste öğeleri
        text = text.replace(/^\s*\d+\. (.+)$/gm, '<ol><li>$1</li></ol>');
        text = text.replace(/<\/ol><ol>/g, '');
        
        // Paragraflar
        const paragraphs = text.split(/\n\n+/);
        return paragraphs.map(p => {
            if (p.trim() && !p.includes('<h') && !p.includes('<ul') && !p.includes('<ol') && !p.includes('<pre')) {
                return `<p>${p.replace(/\n/g, '<br>')}</p>`;
            }
            return p;
        }).join('');
    }
    
    // HTML karakterlerini escape et
    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    // VS Code'dan gelen mesajları dinle
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'initialResponse':
                // İlk AI yanıtı
                appendMessage('assistant', message.content);
                isWaitingForResponse = false;
                break;
                
            case 'response':
                // AI yanıtı
                appendMessage('assistant', message.content);
                isWaitingForResponse = false;
                break;
                
            case 'error':
                // Hata mesajı
                appendMessage('assistant', `⚠️ Hata: ${message.content}`);
                isWaitingForResponse = false;
                break;
                
            case 'updateCode':
                // Kod güncellendiğinde
                const codeBlock = document.querySelector('.code-block code');
                const codeTitle = document.querySelector('.code-title');
                
                if (codeBlock) {
                    codeBlock.textContent = message.code;
                    codeBlock.className = `language-${message.languageId}`;
                }
                
                if (codeTitle) {
                    codeTitle.textContent = `Seçilen Kod (${message.languageId})`;
                }
                
                // Mesaj geçmişini temizle
                messagesContainer.innerHTML = `
                    <div class="loading-message">
                        <div class="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <div>Kod analiz ediliyor...</div>
                    </div>
                `;
                
                isWaitingForResponse = true;
                break;
        }
    });
    
    // Sayfayı başlat
    init();
})(); 