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
        codeLineCount: 0,
        isMobileView: false // Mobil görünüm durumu
    };

    // DOM elementleri
    let messagesContainer, userInput, sendButton, 
        codeBlock, loadingMessage, codeLoadingIndicator;
    
    // Buton eylemi işlemleri
    const buttonActions = {
        'fixCode': 'Kodu düzelt ve iyileştir',
        'optimizeCode': 'Kodu optimize et',
        'testCode': 'Bu kod için unit testler oluştur',
        'explainCode': 'Bu kodu açıkla'
    };
    
    // DOM yükleme ve başlatma
    document.addEventListener('DOMContentLoaded', () => {
        initializeDOM();
        setupEventListeners();
        setupAutoResizeTextarea();
        checkResponsiveLayout(); // İlk yüklemede responsive durumu kontrol et
        notifyReady();
        
        // Prism.js ile mevcut kod bloklarını vurgula
        if (window.Prism) {
            Prism.highlightAll();
        }
    });
    
    // Pencere boyutu değiştiğinde responsive durumu kontrol et
    window.addEventListener('resize', debounce(checkResponsiveLayout, 250));
    
    // DOM elementlerini tanımlama
    function initializeDOM() {
        messagesContainer = document.getElementById('messagesContainer');
        userInput = document.getElementById('userInput');
        sendButton = document.getElementById('sendButton');
        
        // Kod bloğunu bul
        codeBlock = document.querySelector('code');
        
        // Yükleniyor mesajı oluştur
        loadingMessage = createLoadingMessageElement();
        
        // Kod yükleniyor göstergesi
        codeLoadingIndicator = document.getElementById('codeLoadingIndicator');
    }
    
    // Debounce fonksiyonu - kısa sürede çok fazla çağrılması durumunda optimize eder
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // Responsive durumu kontrol et ve UI'ı güncelle
    function checkResponsiveLayout() {
        // Mobil görünüm için breakpoint kontrolü
        const isMobile = window.innerWidth <= 600;
        
        // Durum değişmişse UI'ı güncelle
        if (state.isMobileView !== isMobile) {
            state.isMobileView = isMobile;
            updateResponsiveUI();
        }
    }
    
    // Responsive UI güncellemesi
    function updateResponsiveUI() {
        const actionButtons = document.querySelectorAll('.action-button');
        const applyCodeButtons = document.querySelectorAll('.apply-code-btn');
        
        if (state.isMobileView) {
            // Mobil görünüm için UI değişiklikleri
            actionButtons.forEach(btn => {
                btn.setAttribute('aria-label', btn.querySelector('span').textContent);
            });
            
            applyCodeButtons.forEach(btn => {
                // Apply Code yerine sadece "Uygula" göster
                if (btn.textContent === 'Apply Code') {
                    btn.textContent = 'Uygula';
                }
            });
        } else {
            // Masaüstü görünüm için UI değişiklikleri
            actionButtons.forEach(btn => {
                btn.removeAttribute('aria-label');
            });
            
            applyCodeButtons.forEach(btn => {
                // "Uygula" yerine tekrar "Apply Code" göster
                if (btn.textContent === 'Uygula') {
                    btn.textContent = 'Apply Code';
                }
            });
        }
    }
    
    // Olay dinleyicilerini ayarla
    function setupEventListeners() {
        if (!userInput || !sendButton) {
            console.error('Gerekli DOM elementleri bulunamadı');
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
                    
                    // Buton tıklandığında görsel geri bildirim
                    button.classList.add('active');
                    setTimeout(() => {
                        button.classList.remove('active');
                    }, 200);
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
                
                // Buton tıklandığında görsel geri bildirim
                btn.classList.add('active');
                setTimeout(() => {
                    btn.classList.remove('active');
                }, 200);
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
                
            case 'setWidth':
                // Panel genişliğini ayarla
                setPanelWidth(message.width);
                break;
                
            case 'focusInput':
                // Input alanına odaklan
                focusInput(message.placeholder);
                break;
                
            case 'applyCodeResult':
                // Kod uygulama sonucunu işle
                handleApplyCodeResult(message.success, message.fileName, message.error);
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
        
        // Mesaj ekle
        addMessage(text, 'user');
        
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
        
        // Kod blokları için Apply Code butonlarını aktif et
        setupApplyCodeButtons(messageDiv);
        
        return messageDiv;
    }
    
    // Apply Code butonlarını aktif et
    function setupApplyCodeButtons(container) {
        const applyButtons = container.querySelectorAll('.apply-code-btn');
        
        applyButtons.forEach(button => {
            // Eğer mobil görünümdeyse, buton metnini güncelle
            if (state.isMobileView && button.textContent === 'Apply Code') {
                button.textContent = 'Uygula';
            }
            
            button.addEventListener('click', function() {
                const code = this.getAttribute('data-code');
                const fileName = this.getAttribute('data-filename');
                
                if (code && fileName) {
                    // VS Code'a kod uygulama komutu gönder
                    vscode.postMessage({
                        command: 'applyCode',
                        fileName: fileName,
                        code: code
                    });
                    
                    // Butonu devre dışı bırak ve durumunu güncelle
                    this.disabled = true;
                    this.textContent = 'Uygulanıyor...';
                    
                    // Buton animasyonu ekle
                    this.classList.add('applying');
                }
            });
        });
    }
    
    // Markdown formatını işle
    function formatMarkdown(text) {
        // Kod bloklarını işle (``` ile sarılmış)
        let formattedText = text.replace(/```([a-z]*)(:[^\n]+)?\n([\s\S]*?)```/g, function(match, lang, fileName, code) {
            // Dosya adı var mı kontrol et
            let fileNameText = '';
            
            if (fileName) {
                fileNameText = fileName.substring(1); // İlk ':' karakterini kaldır
            }
            
            // Özel işlenmiş kod bloğu var mı?
            if (text.includes('<div class="code-block-container">')) {
                return match; // Zaten işlenmiş, olduğu gibi bırak
            }
            
            // Kod bloğunu oluştur
            return `<pre><code class="language-${lang || 'plaintext'}">${escapeHTML(code.trim())}</code></pre>`;
        });
        
        // Diğer markdown öğeleri
        formattedText = formattedText
            // Satır içi kod
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Kalın
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            // İtalik
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Paragraflar
            .replace(/\n\n/g, '</p><p>')
            // Listeler
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            // Linkler
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // Son işlemler
        formattedText = '<p>' + formattedText + '</p>';
        formattedText = formattedText.replace(/<\/p><p>/g, '</p>\n<p>');
        formattedText = formattedText.replace(/<li>(.+?)<\/li>/g, '<ul><li>$1</li></ul>');
        formattedText = formattedText.replace(/<\/ul>\s*<ul>/g, '');
        
        return formattedText;
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
        
        // Mesajlar konteynerini en alta kaydır
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Prism vurgulamasını uygula
        if (window.Prism) {
            const codeElements = messageElement.querySelectorAll('pre code');
            if (codeElements.length > 0) {
                codeElements.forEach(el => {
                    try {
                        Prism.highlightElement(el);
                    } catch (err) {
                        console.error('Kod vurgulama hatası:', err);
                    }
                });
            }
        }
        
        // Çok uzun mesajlar için "Devamını göster" düğmesi
        const messageContent = messageElement.querySelector('.message-content');
        if (messageContent && messageContent.offsetHeight > 400) {
            const showMoreButton = document.createElement('button');
            showMoreButton.className = 'show-more-btn';
            showMoreButton.textContent = 'Devamını Göster';
            
            // Başlangıçta içeriği kısalt
            messageContent.style.maxHeight = '400px';
            messageContent.style.overflow = 'hidden';
            
            // Düğme olayını ayarla
            showMoreButton.addEventListener('click', () => {
                if (messageContent.style.maxHeight === '400px') {
                    messageContent.style.maxHeight = 'none';
                    showMoreButton.textContent = 'Daha Az Göster';
                } else {
                    messageContent.style.maxHeight = '400px';
                    showMoreButton.textContent = 'Devamını Göster';
                    // Sayfayı mesajın başına kaydır
                    messageElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
            
            // Düğmeyi mesaj elementinin sonuna ekle
            messageElement.appendChild(showMoreButton);
        }
    }
    
    // Tüm mesajları temizle
    function clearMessages() {
        if (messagesContainer) {
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
        addMessage(`Hata: ${message}`, 'error');
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
    
    // Panel genişliğini ayarla
    function setPanelWidth(width) {
        if (!width || typeof width !== 'number') return;
        
        // Minimum genişliği koruma
        const minWidth = 300; // Daha küçük minimum genişlik
        const finalWidth = Math.max(width, minWidth);
        
        // CSS değişkenini güncelle
        document.documentElement.style.setProperty('--default-width', `${finalWidth}px`);
        
        // Responsive durumu tekrar kontrol et
        checkResponsiveLayout();
    }
    
    // Kod uygulama sonucunu işle
    function handleApplyCodeResult(success, fileName, error) {
        // Uygulama düğmelerini güncelle
        const applyButtons = document.querySelectorAll('.apply-code-btn.applying');
        
        applyButtons.forEach(button => {
            button.classList.remove('applying');
            
            // Dosya adı eşleşiyor mu kontrol et
            if (button.getAttribute('data-filename') === fileName) {
                button.disabled = false;
                
                if (success) {
                    button.textContent = 'Uygulandı';
                    button.classList.add('success');
                    
                    setTimeout(() => {
                        // Responsive görünüme göre buton metnini güncelle
                        if (state.isMobileView) {
                            button.textContent = 'Uygula';
                        } else {
                            button.textContent = 'Apply Code';
                        }
                        button.classList.remove('success');
                    }, 3000);
                } else {
                    // Responsive görünüme göre buton metnini güncelle
                    if (state.isMobileView) {
                        button.textContent = 'Uygula';
                    } else {
                        button.textContent = 'Apply Code';
                    }
                }
            }
        });
        
        if (success) {
            // Başarılı uygulama
            showNotification(`Kod başarıyla uygulandı: ${fileName}`, 'success');
        } else {
            // Hata durumu
            showNotification(`Kod uygulanırken hata: ${error || 'Bilinmeyen hata'}`, 'error');
        }
    }
    
    // Bildirim göster
    function showNotification(message, type = 'info') {
        // Eski bildirimleri temizle
        const oldNotifications = document.querySelectorAll('.notification');
        oldNotifications.forEach(n => {
            if (n.classList.contains('hide')) {
                n.remove();
            }
        });
        
        // Mesajı kısalt (mobil görünümde daha kısa mesajlar)
        let displayMessage = message;
        if (state.isMobileView && message.length > 50) {
            const fileName = message.match(/:\s([^:]+)$/);
            if (fileName && fileName[1]) {
                // Eğer dosya adı varsa, mesajı kısalt
                displayMessage = message.substring(0, 30) + '...: ' + fileName[1];
            } else {
                displayMessage = message.substring(0, 40) + '...';
            }
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}-notification`;
        notification.textContent = displayMessage;
        
        // Bildirim kapat butonu
        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => {
            notification.classList.add('hide');
            setTimeout(() => notification.remove(), 300);
        });
        
        notification.appendChild(closeBtn);
        document.body.appendChild(notification);
        
        // 4 saniye sonra otomatik kapat
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
})();