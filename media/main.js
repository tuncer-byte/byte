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
    const fileContextElement = document.getElementById('fileContext');
    const agentToggle = document.getElementById('agentToggle');
    
    // Ayarlar Modalı Elementleri
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const settingsStatus = document.getElementById('settingsStatus');
    const defaultProviderSelect = document.getElementById('defaultProvider');
    
    // API Anahtarı Giriş Alanları
    const openaiApiKeyInput = document.getElementById('openaiApiKey');
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const localEndpointInput = document.getElementById('localEndpoint');
    const openaiModelSelect = document.getElementById('openaiModel');
    const geminiModelSelect = document.getElementById('geminiModel');
    const localModelSelect = document.getElementById('localModel');
    const saveHistoryCheckbox = document.getElementById('saveHistory');
    
    // Şifre Göster/Gizle Düğmeleri
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    
    // State tanımlamasına includeCurrentFile ekleyelim
    const state = {
        messages: [],
        currentFile: '',
        currentFilePath: '',
        agentEnabled: false,
        includeCurrentFile: false,
        settings: {
            provider: 'openai',
            saveHistory: true
        }
    };
    
    // Sayfa yüklendiğinde VS Code'a hazır olduğumuzu bildir
    window.addEventListener('load', () => {
        vscode.postMessage({ type: 'webviewReady' });
        
        // Agent durumunu kayıtlı durumdan al
        if (state.agentEnabled !== undefined) {
            agentToggle.checked = state.agentEnabled;
        }
        
        // Chill modu devre dışı olarak ayarla
        agentToggle.disabled = true;
        
        // Mevcut dosya bilgisini göster
        if (state.currentFile) {
            currentFileElement.textContent = state.currentFile;
        }
        
        // Kayıtlı ayarları yükle
        loadSettings();
    });
    
    // Şifre göster/gizle butonları için olay dinleyicisi
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', () => {
            const inputId = button.getAttribute('data-for');
            const inputElement = document.getElementById(inputId);
            
            if (inputElement.type === 'password') {
                inputElement.type = 'text';
                button.classList.add('show');
            } else {
                inputElement.type = 'password';
                button.classList.remove('show');
            }
        });
    });
    
    // Ayarlar modalını aç
    configureButton.addEventListener('click', () => {
        openSettingsModal();
    });
    
    // Ayarlar modalını kapat
    function closeSettingsModal() {
        settingsModal.classList.remove('active');
        setTimeout(() => {
            settingsModal.style.display = 'none';
        }, 300);
    }
    
    // Ayarlar modalını aç
    function openSettingsModal() {
        settingsModal.style.display = 'flex';
        setTimeout(() => {
            settingsModal.classList.add('active');
        }, 10);
        
        // Mevcut ayarları form alanlarına doldur
        fillSettingsForm();
        
        // Ollama modellerini getir
        fetchOllamaModels();
    }
    
    // Ollama modellerini getir
    async function fetchOllamaModels() {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            if (response.ok) {
                const data = await response.json();
                const models = data.models || [];
                
                // Local model seçim alanını güncelle
                updateLocalModelSelect(models);
            }
        } catch (error) {
            console.error('Ollama modelleri alınamadı:', error);
            // Hata durumunda varsayılan modelleri göster
            updateLocalModelSelect([]);
        }
    }
    
    // Local model seçim alanını güncelle
    function updateLocalModelSelect(models) {
        const localModelSelect = document.getElementById('localModel');
        localModelSelect.innerHTML = ''; // Mevcut seçenekleri temizle
        
        if (models.length === 0) {
            // Varsayılan modeller
            const defaultModels = [
                { name: 'llama2', label: 'Llama 2' },
                { name: 'codellama', label: 'CodeLlama' },
                { name: 'mistral', label: 'Mistral' },
                { name: 'phi', label: 'Phi' }
            ];
            
            defaultModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.label;
                localModelSelect.appendChild(option);
            });
        } else {
            // Ollama'dan gelen modeller
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                localModelSelect.appendChild(option);
            });
        }
        
        // Eğer kaydedilmiş bir model varsa onu seç
        if (state.settings.local.model) {
            localModelSelect.value = state.settings.local.model;
        }
    }
    
    // Ayarlar formuna mevcut ayarları doldur
    function fillSettingsForm() {
        // Genel ayarlar
        defaultProviderSelect.value = state.settings.defaultProvider;
        saveHistoryCheckbox.checked = state.settings.saveHistory;
        
        // OpenAI ayarları
        openaiApiKeyInput.value = state.settings.openai.apiKey || '';
        openaiModelSelect.value = state.settings.openai.model || 'gpt-3.5-turbo';
        
        // Gemini ayarları
        geminiApiKeyInput.value = state.settings.gemini.apiKey || '';
        geminiModelSelect.value = state.settings.gemini.model || 'gemini-1.5-flash';
        
        // Yerel ayarlar
        localEndpointInput.value = state.settings.local.endpoint || 'http://localhost:11434/api/generate';
        localModelSelect.value = state.settings.local.model || 'llama3';
        
        // API anahtarı durumlarını göster
        updateProviderStatus('openai', !!state.settings.openai.apiKey);
        updateProviderStatus('gemini', !!state.settings.gemini.apiKey);
    }
    
    // Sağlayıcı durum bilgisini güncelle
    function updateProviderStatus(provider, hasApiKey) {
        const statusElement = document.querySelector(`#${provider}Settings .provider-status`);
        if (statusElement) {
            if (hasApiKey) {
                statusElement.textContent = 'Yapılandırıldı';
                statusElement.classList.add('configured');
            } else {
                statusElement.textContent = 'API Anahtarı Gerekli';
                statusElement.classList.remove('configured');
            }
        }
    }
    
    // Kayıtlı ayarları yükle
    function loadSettings() {
        // VS Code'dan ayarları iste
        vscode.postMessage({ type: 'getSettings' });
    }
    
    // Ayarları kaydet
    function saveSettings() {
        // Form verilerini topla
        const settings = {
            defaultProvider: defaultProviderSelect.value,
            openai: {
                apiKey: openaiApiKeyInput.value,
                model: openaiModelSelect.value
            },
            gemini: {
                apiKey: geminiApiKeyInput.value,
                model: geminiModelSelect.value
            },
            local: {
                endpoint: localEndpointInput.value,
                model: localModelSelect.value
            },
            saveHistory: saveHistoryCheckbox.checked
        };
        
        // Ayarları state'e kaydet
        state.settings = settings;
        vscode.setState(state);
        
        // Ayarları VS Code'a gönder
        vscode.postMessage({
            type: 'saveSettings',
            settings: settings
        });
        
        // Kaydetme öncesi UI'yı güncelle
        settingsStatus.textContent = 'Ayarlar kaydediliyor...';
        settingsStatus.classList.remove('error');
        settingsStatus.classList.remove('success');
        settingsStatus.classList.add('show');
        
        // UI seçimini güncelle
        aiProviderSelect.value = settings.defaultProvider;
    }
    
    // Ayarlar başarıyla kaydedildiğinde
    function handleSettingsSaved() {
        // Başarılı mesajı göster
        settingsStatus.textContent = 'Ayarlar başarıyla kaydedildi!';
        settingsStatus.classList.add('success');
        
        // 2 saniye sonra modalı kapat
        setTimeout(() => {
            closeSettingsModal();
            settingsStatus.textContent = '';
            settingsStatus.classList.remove('show');
        }, 2000);
    }
    
    // Ayarlar kaydedilirken hata oluştuğunda
    function handleSettingsError(errorMessage) {
        // Hata mesajı göster
        settingsStatus.textContent = errorMessage;
        settingsStatus.classList.remove('success');
        settingsStatus.classList.add('error');
        settingsStatus.classList.add('show');
        
        // 5 saniye sonra mesajı gizle
        setTimeout(() => {
            settingsStatus.classList.remove('show');
        }, 5000);
    }
    
    // Ayarlar modalı butonları
    closeSettingsBtn.addEventListener('click', closeSettingsModal);
    cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    saveSettingsBtn.addEventListener('click', saveSettings);
    
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
        const userInput = document.getElementById('userInput');
        const message = userInput.value.trim();
        
        if (message) {
            // Kullanıcı mesajını ekle
            appendMessage('user', message);
            
            // Mesajı state'e kaydet
            state.messages.push({ role: 'user', content: message });
            
            // Yükleniyor göstergesini aç
            loadingIndicator.style.display = 'block';
            
            // VS Code'a gönder
            vscode.postMessage({
                type: 'sendMessage',
                message: message,
                includeCurrentFile: state.includeCurrentFile,
                currentFilePath: state.currentFilePath
            });
            
            // Input'u temizle
            userInput.value = '';
            
            // State'i güncelle
            vscode.setState(state);
        }
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
    
    // Yeni chat başlatma butonu
    document.querySelector('.new-chat').addEventListener('click', () => {
        vscode.postMessage({ type: 'clearChat' });
    });
    
    // Current file checkbox'ını dinleyelim
    const includeCurrentFileCheckbox = document.getElementById('includeCurrentFile');
    includeCurrentFileCheckbox.addEventListener('change', (e) => {
        state.includeCurrentFile = e.target.checked;
        vscode.setState(state);
    });
    
    // Mevcut dosya bilgisini güncelle
    function updateCurrentFile(fileName, filePath) {
        if (fileName && filePath) {
            state.currentFile = fileName;
            state.currentFilePath = filePath;
            currentFileElement.textContent = fileName;
            fileContextElement.style.display = 'block';
        } else {
            state.currentFile = '';
            state.currentFilePath = '';
            currentFileElement.textContent = '';
            fileContextElement.style.display = 'none';
            state.includeCurrentFile = false;
            includeCurrentFileCheckbox.checked = false;
        }
        vscode.setState(state);
    }
    
    // VS Code'dan gelen mesajları dinle
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'response':
                // Yapay zeka yanıtını işle
                console.log('AI response received');
                
                // Yükleniyor göstergesini gizle
                loadingIndicator.classList.remove('active');
                
                // Mesajı görüntüle
                appendMessage('assistant', message.content);
                
                // Mesaj state'e kaydedildiyse, state'i güncelle
                // (Mesaj state'e VS Code tarafından kaydediliyor, state güncellemesine gerek yok)
                
                break;
                
            case 'userMessage':
                // Kullanıcı mesajını ekle (Slash komut işlemi için)
                appendMessage('user', message.content);
                
                // Durumu güncelle
                state.messages.push({ role: 'user', content: message.content });
                vscode.setState(state);
                break;
                
            case 'loadingStart':
                // Yükleniyor göstergesini aç
                loadingIndicator.style.display = 'block';
                break;
                
            case 'providerChanged':
                // AI sağlayıcı değiştiğinde UI'yı güncelle
                console.log('Provider changed to:', message.provider);
                aiProviderSelect.value = message.provider;
                break;
                
            case 'error':
                // Hata mesajını işle
                console.error('Error from extension:', message.content);
                
                // Yükleniyor göstergesini gizle
                loadingIndicator.classList.remove('active');
                
                // Hata mesajını görüntüle
                const errorDiv = document.createElement('div');
                errorDiv.classList.add('error-message');
                errorDiv.textContent = `Hata: ${message.content}`;
                messagesContainer.appendChild(errorDiv);
                
                // Otomatik kaydır
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                break;
                
            case 'init':
                // WebView başlangıç durumu
                console.log('WebView init received:', message);
                
                // Mesaj geçmişini yükle
                if (message.messages) {
                    state.messages = message.messages;
                    messagesContainer.innerHTML = '';
                    loadMessages();
                }
                
                // Agent durumunu ayarla
                if (message.agentEnabled !== undefined) {
                    state.agentEnabled = message.agentEnabled;
                    agentToggle.checked = message.agentEnabled;
                }
                
                // Mevcut dosya bilgisini ayarla
                if (message.currentFile) {
                    updateCurrentFile(message.currentFile, message.currentFilePath);
                } else {
                    updateCurrentFile(null, null);
                }
                
                // Provider seçimini ayarla
                if (message.provider) {
                    aiProviderSelect.value = message.provider;
                }
                
                vscode.setState(state);
                break;
                
            case 'currentFileChanged':
                // Mevcut dosya değiştiğinde UI'yı güncelle
                if (message.filePath) {
                    const fileName = message.filePath.split(/[\\/]/).pop() || '';
                    updateCurrentFile(fileName, message.filePath);
                } else {
                    updateCurrentFile(null, null);
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
                            <h2>Welcome to Byte AI Assistant</h2>
                            <ul class="welcome-list">
                                <li>Configure AI providers (OpenAI, Gemini, Local models)</li>
                                <li>Use right-click menu for code operations</li>
                                <li>Explore advanced code analysis & generation</li>
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
                                    <li><span class="command">/docs</span> to create documentation</li>
                                    <li><span class="command">/optimize</span> to improve code performance</li>
                                </ul>
                            </div>
                            
                            <div class="right-click-features">
                                <h3>Right-click menu features</h3>
                                <p>Select any code and right-click to access:</p>
                                <ul>
                                    <li><strong>Generate Documentation</strong> - Create detailed docs from code</li>
                                    <li><strong>Optimize Code</strong> - Improve performance and readability</li>
                                    <li><strong>Add Comments</strong> - Add explanatory comments to code</li>
                                    <li><strong>Generate Unit Tests</strong> - Create tests for your code</li>
                                    <li><strong>Analyze Code Issues</strong> - Find and fix problems</li>
                                </ul>
                            </div>
                            
                            <div class="coffee-mode">
                                <h3>Chill mode</h3>
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
                
            case 'settingsSaved':
                // Ayarlar başarıyla kaydedilmiş
                if (message.success) {
                    handleSettingsSaved();
                }
                break;
                
            case 'settingsError':
                // Ayarlar kaydedilirken hata
                handleSettingsError(message.error);
                break;
                
            case 'settingsUpdated':
                // Ayarlar güncellendiğinde state'i güncelle
                if (message.settings) {
                    state.settings = message.settings;
                    vscode.setState(state);
                    
                    // UI'yı güncelle
                    fillSettingsForm();
                    aiProviderSelect.value = message.settings.defaultProvider;
                    
                    // API anahtarı durumu güncelle
                    updateProviderStatus('openai', !!message.settings.openai.apiKey);
                    updateProviderStatus('gemini', !!message.settings.gemini.apiKey);
                }
                break;
        }
    });
    
    // Sayfa yüklendiğinde mesajları göster
    loadMessages();
})();