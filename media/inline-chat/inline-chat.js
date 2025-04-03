(function() {
    // VS Code API erişimi
    const vscode = acquireVsCodeApi();
    
    // Durum yönetimi
    let state = {
        currentCode: '',
        currentLanguage: '',
        currentFileName: '',
        isLoading: false,
        codeLoading: false,
        codeLineCount: 0
    };

    // DOM elementleri
    let messagesContainer, userInput, sendButton, 
        codeBlock, copyCodeBtn, loadingMessage, codeLoadingIndicator;
    
    // Buton eylemi islemleri
    const buttonActions = {
        'fixCode': 'Kodu düzelt ve iyileştir',
        'optimizeCode': 'Kodu optimize et',
        'testCode': 'Bu kod için unit testler oluştur',
        'explainCode': 'Bu kodu açıkla'
    };
    
    // DOM yükleme ve başlatma
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM content loaded, initializing UI');
        initializeDOM();
        setupEventListeners();
        setupAutoResizeTextarea();
        notifyReady();
        
        // Prism.js ile mevcut kod bloklarını vurgula
        setTimeout(() => {
            if (window.Prism) {
                Prism.highlightAll();
            }
        }, 100);
    });
    
    // DOM elementlerini tanımlama
    function initializeDOM() {
        messagesContainer = document.getElementById('messagesContainer');
        userInput = document.getElementById('userInput');
        sendButton = document.getElementById('sendButton');
        
        // Kod bloğunu bul
        const codeElement = document.querySelector('code');
        if (codeElement) {
            codeBlock = codeElement;
        } else {
            console.error('Code element not found');
        }
        
        // Diğer butonları tanımla
        copyCodeBtn = document.getElementById('copyCodeBtn');
        
        // Yükleniyor mesajı oluştur ama henüz ekleme
        loadingMessage = createLoadingMessageElement();
        
        // Kod yükleniyor göstergesi
        codeLoadingIndicator = document.getElementById('codeLoadingIndicator');
    }
    
    // Olay dinleyicilerini ayarla
    function setupEventListeners() {
        if (!userInput || !sendButton) {
            console.error('Required DOM elements not found');
            return;
        }
        
        // Kullanıcı mesajı gönderme olayı
        sendButton.addEventListener('click', sendMessage);
        userInput.addEventListener('keydown', handleKeyPress);
        userInput.addEventListener('input', handleInputChange);

        // Kod düğmeleri olayları
        setupActionButtons();
        
        // Hızlı aksiyon butonları
        setupQuickActionButtons();
        
        // Kopyalama butonu
        if (copyCodeBtn && codeBlock) {
            copyCodeBtn.addEventListener('click', copyCodeToClipboard);
        }
        
        // VS Code'dan gelen mesajları dinle
        window.addEventListener('message', handleVSCodeMessages);
    }
    
    // Action butonlarını ayarla
    function setupActionButtons() {
        Object.keys(buttonActions).forEach(action => {
            const button = document.getElementById(`${action}Btn`);
            if (button) {
                button.addEventListener('click', () => {
                    vscode.postMessage({ command: action });
                    // Kullanıcı mesajı VS Code tarafından eklenecek, burada ekleme yapmıyoruz
                });
            }
        });
    }
    
    // Hızlı aksiyon butonlarını ayarla
    function setupQuickActionButtons() {
        const quickActionButtons = document.querySelectorAll('.quick-action-btn');
        
        quickActionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Buton metnini input alanına yerleştir
                userInput.value = btn.textContent;
                
                // Input olayını tetikle (yükseklik için)
                userInput.dispatchEvent(new Event('input'));
                
                // Gönder düğmesini etkinleştir
                sendButton.disabled = false;
                
                // Odağı input alanına ver
                userInput.focus();
            });
        });
    }
    
    // Auto-resize textarea ayarı
    function setupAutoResizeTextarea() {
        if (userInput) {
            userInput.addEventListener('input', () => {
                userInput.style.height = 'auto';
                userInput.style.height = (userInput.scrollHeight < 150) 
                    ? userInput.scrollHeight + 'px' 
                    : '150px';
            });
        }
    }
    
    // Enter tuşuyla mesaj gönderme
    function handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }
    
    // Input alanı değişikliğini işle
    function handleInputChange() {
        sendButton.disabled = !userInput.value.trim();
    }
    
    // Hazır olduğunu VS Code'a bildir
    function notifyReady() {
        vscode.postMessage({ command: 'ready' });
    }
    
    // VS Code'dan gelen mesajları işle
    function handleVSCodeMessages(event) {
        const message = event.data;
        
        switch (message.command) {
            case 'addMessage':
                // Yükleniyor göstergesini kaldır
                removeLoadingIndicator();
                // Mesaj ekle
                addMessage(message.text, message.role);
                break;
                
            case 'setCode':
                // Kod yükleniyor göstergesini kaldır
                toggleCodeLoading(false);
                // Kod içeriğini ayarla
                setCode(message.code, message.language, message.fileName, message.lineInfo);
                break;
                
            case 'loadingCode':
                // Kod yükleniyor göstergesini göster/gizle
                toggleCodeLoading(message.isLoading);
                break;
                
            case 'clearMessages':
                // Mesajları temizle
                clearMessages();
                break;
                
            case 'setLoading':
                // Yükleniyor durumunu ayarla
                toggleLoading(message.isLoading);
                break;
                
            case 'focusInput':
                // Input alanına odaklan
                focusInput(message.placeholder);
                break;
                
            case 'error':
                // Hata mesajı göster
                showError(message.message);
                break;
        }
    }
    
    // Mesajı VS Code'a gönder
    function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;
        
        // VS Code'a mesajı gönder
        vscode.postMessage({
            command: 'sendMessage',
            text: text
        });
        
        // Input temizle
        userInput.value = '';
        userInput.style.height = 'auto';
        sendButton.disabled = true;
        
        // Yükleniyor göstergesini göster
        showLoadingIndicator();
    }
    
    // Kodu ayarla
    function setCode(code, language, fileName, lineInfo) {
        state.currentCode = code;
        state.currentLanguage = language;
        state.currentFileName = fileName;
        
        // Kod satır sayısı
        state.codeLineCount = code.split('\n').length;
        
        // Kod bloğuna içeriği ekle
        if (codeBlock) {
            codeBlock.textContent = code;
            
            // Dil sınıfını ayarla
            const parentPre = codeBlock.parentElement;
            if (parentPre && parentPre.tagName === 'PRE') {
                codeBlock.className = language ? `language-${language}` : 'language-plaintext';
                
                // Prism varsa kodu renklendir
                if (window.Prism) {
                    Prism.highlightElement(codeBlock);
                }
            }
        }
        
        // Dil rozetini güncelle
        const languageBadge = document.querySelector('.code-language');
        if (languageBadge) {
            languageBadge.textContent = language || 'text';
        }
        
        // Dosya adını güncelle
        const fileNameElement = document.querySelector('.file-name');
        if (fileNameElement) {
            fileNameElement.textContent = fileName || 'Kod Parçası';
            fileNameElement.title = fileName || 'Kod Parçası';
        }
        
        // Satır bilgisini güncelle
        const lineInfoElement = document.querySelector('.line-info');
        if (lineInfoElement) {
            lineInfoElement.textContent = lineInfo || `${state.codeLineCount} satır`;
        }
    }
    
    // Mesaj elementi oluştur
    function createMessageElement(text, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        // Mesaj içeriği
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Markdown formatında metni işle
        const formattedContent = formatMarkdown(text);
        messageContent.innerHTML = formattedContent;
        
        // Mesaj divina ekle
        messageDiv.appendChild(messageContent);
        
        return messageDiv;
    }
    
    // Markdown formatını işle
    function formatMarkdown(text) {
        // Kod bloklarını işle (``` ile sarılmış)
        text = text.replace(/```([a-z]*)([\s\S]*?)```/g, function(match, lang, code) {
            return `<pre><code class="language-${lang || 'plaintext'}">${escapeHTML(code.trim())}</code></pre>`;
        });
        
        // Diğer markdown öğeleri
        text = text
            // Satır içi kod
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Kalın
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            // İtalik
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Listeler
            .replace(/^- (.+)/gm, '<li>$1</li>')
            // Paragraflar
            .replace(/\n\n/g, '</p><p>')
            // Linkler
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // Son işlemler
        text = '<p>' + text + '</p>';
        text = text.replace(/<\/p><p>/g, '</p>\n<p>'); // Paragrafları düzelt
        text = text.replace(/<li>(.+?)<\/li>/g, '<ul><li>$1</li></ul>'); // Liste öğelerini düzelt
        text = text.replace(/<\/ul>\s*<ul>/g, ''); // Boş liste öğelerini temizle
        
        return text;
    }
    
    // HTML escape
    function escapeHTML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // Mesaj ekle
    function addMessage(text, role) {
        if (!messagesContainer) return;
        
        const messageElement = createMessageElement(text, role);
        messagesContainer.appendChild(messageElement);
        
        // Mesajlar alanını en alta kaydır
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Prism varsa yeni eklenen kod bloklarını renklendir
        setTimeout(() => {
            if (window.Prism) {
                const codeElements = messageElement.querySelectorAll('pre code');
                codeElements.forEach(el => {
                    Prism.highlightElement(el);
                });
            }
        }, 0);
    }
    
    // Tüm mesajları temizle
    function clearMessages() {
        if (messagesContainer) {
            // Sadece hoşgeldin mesajını tut
            const welcomeMessage = messagesContainer.querySelector('.message');
            messagesContainer.innerHTML = '';
            
            if (welcomeMessage) {
                messagesContainer.appendChild(welcomeMessage);
            }
        }
    }
    
    // Yükleniyor mesajı oluşturma
    function createLoadingMessageElement() {
        const loadingElement = document.createElement('div');
        loadingElement.className = 'loading-message';
        loadingElement.innerHTML = `
            <div class="message-avatar assistant-avatar">B</div>
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        return loadingElement;
    }
    
    // Yükleniyor göstergesini göster
    function showLoadingIndicator() {
        if (!messagesContainer || messagesContainer.contains(loadingMessage)) {
            return;
        }
        
        messagesContainer.appendChild(loadingMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        state.isLoading = true;
    }
    
    // Yükleniyor göstergesini kaldır
    function removeLoadingIndicator() {
        if (messagesContainer && messagesContainer.contains(loadingMessage)) {
            messagesContainer.removeChild(loadingMessage);
        }
        state.isLoading = false;
    }
    
    // Hata mesajı göster
    function showError(message) {
        addMessage(message, 'error');
    }
    
    // Yükleniyor durumunu değiştir
    function toggleLoading(isLoading) {
        if (isLoading) {
            showLoadingIndicator();
        } else {
            removeLoadingIndicator();
        }
    }
    
    // Input alanına odaklan
    function focusInput(placeholder) {
        if (userInput) {
            if (placeholder) {
                userInput.placeholder = placeholder;
            }
            userInput.focus();
        }
    }
    
    // Kodu panoya kopyala
    function copyCodeToClipboard() {
        if (!codeBlock || !copyCodeBtn) return;
        
        const codeText = codeBlock.textContent;
        navigator.clipboard.writeText(codeText)
            .then(() => {
                // Başarılı gösterim
                const originalText = copyCodeBtn.innerHTML;
                copyCodeBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Kopyalandı</span>
                `;
                copyCodeBtn.classList.add('copied');
                
                setTimeout(() => {
                    copyCodeBtn.innerHTML = originalText;
                    copyCodeBtn.classList.remove('copied');
                }, 2000);
            })
            .catch(err => {
                console.error('Kopyalama hatası:', err);
                showError('Kod kopyalanırken bir hata oluştu.');
            });
    }
    
    // Kod yükleniyor göstergesini göster/gizle
    function toggleCodeLoading(isLoading) {
        if (!codeLoadingIndicator) return;
        
        if (isLoading) {
            codeLoadingIndicator.style.display = 'flex';
            state.codeLoading = true;
        } else {
            codeLoadingIndicator.style.display = 'none';
            state.codeLoading = false;
        }
    }
})(); 