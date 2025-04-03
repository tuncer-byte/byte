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
    const newChatButton = document.querySelector('.new-chat');
    const addFileButton = document.getElementById('addFileButton');
    const fileBadgesContainer = document.getElementById('fileBadgesContainer');
    
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
    
    // Komut modalı
    const commandModal = document.getElementById('commandModal');
    const commandInput = document.getElementById('commandInput');
    const closeCommandBtn = document.getElementById('closeCommandBtn');
    const commandSuggestions = document.getElementById('commandSuggestions');
    
    // Komut listesi
    const commands = {
        '/code': 'to generate new feature or fix bug',
        '/explain': 'file or selected code',
        '/review': 'code to recommend improvements',
        '/unittests': 'to generate unit tests'
    };
    
    // State tanımlamasına includeCurrentFile ekleyelim
    const state = {
        messages: [],
        currentFile: '',
        currentFilePath: '',
        agentEnabled: false,
        includeCurrentFile: false,
        selectedFiles: [], // Seçilen dosyaların listesini sakla
        recentFiles: [], // Son eklenen dosyaların listesi
        settings: {
            provider: 'gemini',
            defaultProvider: 'gemini',
            saveHistory: true,
            openai: {
                apiKey: '',
                model: 'gpt-3.5-turbo'
            },
            gemini: {
                apiKey: '',
                model: 'gemini-2.0-flash'
            },
            anthropic: {
                apiKey: '',
                model: 'claude-3-opus'
            },
            local: {
                endpoint: 'http://localhost:11434/api/generate',
                model: 'llama3'
            },
            autoSwitch: {
                enabled: false,
                maxCostPerDay: 1.0,
                preferredProvider: 'fastest'
            }
        }
    };
    
    // Otomatik geçiş ayarlarını yönet
    const autoSwitchCheckbox = document.getElementById('autoSwitch');
    const autoSwitchSettings = document.getElementById('autoSwitchSettings');
    const maxCostPerDay = document.getElementById('maxCostPerDay');
    const preferredProvider = document.getElementById('preferredProvider');
    
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
        
        // Ana AI sağlayıcı select'ine varsayılan değeri ata
        if (state.settings && state.settings.provider) {
            aiProviderSelect.value = state.settings.provider;
            // Provider display text'i güncelle
            updateProviderDisplayText(state.settings.provider);
        } else {
            aiProviderSelect.value = 'gemini'; // Varsayılan değer
            updateProviderDisplayText('gemini');
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
        defaultProviderSelect.value = state.settings.defaultProvider || 'gemini';
        saveHistoryCheckbox.checked = state.settings.saveHistory !== undefined ? state.settings.saveHistory : true;
        
        // OpenAI ayarları
        openaiApiKeyInput.value = state.settings.openai?.apiKey || '';
        openaiModelSelect.value = state.settings.openai?.model || 'gpt-3.5-turbo';
        
        // Gemini ayarları
        geminiApiKeyInput.value = state.settings.gemini?.apiKey || '';
        geminiModelSelect.value = state.settings.gemini?.model || 'gemini-2.0-flash';
        
        // Anthropic ayarları - eğer form alanları varsa
        const anthropicApiKeyInput = document.getElementById('anthropicApiKey');
        const anthropicModelSelect = document.getElementById('anthropicModel');
        if (anthropicApiKeyInput && anthropicModelSelect) {
            anthropicApiKeyInput.value = state.settings.anthropic?.apiKey || '';
            anthropicModelSelect.value = state.settings.anthropic?.model || 'claude-3-opus';
        }
        
        // Yerel ayarlar
        localEndpointInput.value = state.settings.local?.endpoint || 'http://localhost:11434/api/generate';
        localModelSelect.value = state.settings.local?.model || 'llama3';
        
        // Otomatik geçiş ayarları - önceden değeri yoksa varsayılan değerler ata
        autoSwitchCheckbox.checked = state.settings.autoSwitch?.enabled || false;
        maxCostPerDay.value = state.settings.autoSwitch?.maxCostPerDay || 1.0;
        preferredProvider.value = state.settings.autoSwitch?.preferredProvider || 'fastest';
        
        // Otomatik geçiş ayarları görünürlüğünü ayarla
        autoSwitchSettings.style.display = autoSwitchCheckbox.checked ? 'block' : 'none';
        
        // API anahtarı durumlarını göster
        updateProviderStatus('openai', !!state.settings.openai?.apiKey);
        updateProviderStatus('gemini', !!state.settings.gemini?.apiKey);
        if (document.querySelector('#anthropicSettings')) {
            updateProviderStatus('anthropic', !!state.settings.anthropic?.apiKey);
        }
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
        const settings = {
            provider: aiProviderSelect.value,
            defaultProvider: defaultProviderSelect.value,
            openai: {
                apiKey: openaiApiKeyInput.value,
                model: openaiModelSelect.value
            },
            gemini: {
                apiKey: geminiApiKeyInput.value,
                model: geminiModelSelect.value
            },
            anthropic: {
                apiKey: document.getElementById('anthropicApiKey')?.value || '',
                model: document.getElementById('anthropicModel')?.value || 'claude-3-opus'
            },
            local: {
                endpoint: localEndpointInput.value,
                model: localModelSelect.value
            },
            autoSwitch: {
                enabled: autoSwitchCheckbox.checked,
                maxCostPerDay: parseFloat(maxCostPerDay.value),
                preferredProvider: preferredProvider.value
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
        aiProviderSelect.value = settings.provider;
        updateProviderDisplayText(settings.provider);
    }
    
    // Ayarlar başarıyla kaydedildiğinde
    function handleSettingsSaved() {
        // Başarılı mesajı göster
        settingsStatus.textContent = 'Ayarlar başarıyla kaydedildi!';
        settingsStatus.classList.remove('error');
        settingsStatus.classList.add('success');
        settingsStatus.classList.add('show');
        
        // UI'yı güncelle
        updateProviderDisplayText(state.settings.provider);
        
        // 2 saniye sonra modalı kapat
        setTimeout(() => {
            closeSettingsModal();
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
            
            // Kod vurgulamasını uygula
            setTimeout(() => {
                try {
                    document.querySelectorAll('pre code').forEach((block) => {
                        if (!block.classList.contains('hljs')) {
                            hljs.highlightElement(block);
                        }
                    });
                } catch (error) {
                    console.error('Highlight.js error:', error);
                }
            }, 10);
        }
    }
    
    // Mesajı ekrana ekle
    function appendMessage(role, content, isCommand = false) {
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
        let formattedContent = formatMarkdown(content, role);
        
        // Eğer mesaj bir komutsa ve kullanıcı mesajıysa, komutu vurgula
        if (isCommand && role === 'user') {
            // Slash komutunu bul
            const commandMatch = content.match(/^(\/[a-z\-]+)(\s|$)/);
            if (commandMatch && commandMatch[1]) {
                const command = commandMatch[1];
                // Komutu vurgula
                formattedContent = formattedContent.replace(
                    command,
                    `<span class="highlighted-command">${command}</span>`
                );
            }
        }
        
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
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1-2 2v1"></path>
                </svg>
                <span>Copy</span>
            `;
            
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(content)
                    .then(() => {
                        copyButton.classList.add('copy-success');
                        copyButton.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <span>Copied!</span>
                        `;
                        
                        setTimeout(() => {
                            copyButton.classList.remove('copy-success');
                            copyButton.innerHTML = `
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1-2 2v1"></path>
                                </svg>
                                <span>Copy</span>
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
    function formatMarkdown(text, role = 'assistant') {
        if (!text) return '';
        
        // Kod bloklarını işle - dil desteği ve syntax highlighting eklendi
        text = text.replace(/```(\w*)([\s\S]*?)```/g, function(match, language, code) {
            // Dil belirteci yoksa varsayılan dilleri kontrol et
            if (!language || language === '') {
                // Kod içeriğine bakarak yaygın dilleri tespit et
                if (code.includes('function') || code.includes('const ') || code.includes('let ') || 
                    code.includes('var ') || code.includes('() =>') || code.includes('export ')) {
                    
                    // TypeScript veya JavaScript tespiti
                    if (code.includes('interface ') || code.includes('type ') || 
                        code.includes(':') || code.includes('<T>')) {
                        language = 'typescript';
                    } else {
                        language = 'javascript';
                    }
                } else if (code.includes('<!DOCTYPE') || code.includes('<html') || 
                           code.includes('</div>') || code.includes('<script>')) {
                    language = 'html';
                } else if (code.includes('import ') && code.includes('from ')) {
                    language = 'typescript';
                } else if (code.includes('{') && code.includes('}') && 
                          (code.includes('"') || code.includes("'"))) {
                    language = 'json';
                } else if (code.includes('class ') && code.includes('extends ')) {
                    language = 'typescript';
                } else {
                    language = '';
                }
            }
            
            const langClass = language ? ` class="language-${language}"` : '';
            const formattedCode = escapeHtml(code.trim());
            
            // Dil belirteci ve butonlar için üst kısım (header) oluştur
            const langBadge = language ? `<div class="code-language">${language}</div>` : '';
            let actionButtons = '';
            
            // Sadece AI mesajları için butonları göster
            if (role === 'assistant') {
                // Butonları oluştur - kod içeriğini direct olarak gönder back-ticks olmadan
                if (language === 'bash' || language === 'sh') {
                    actionButtons = `<button class="run-code-button" data-code="${escapeHtml(code.trim())}">Run</button>`;
                } else if (language && language !== 'output' && language !== 'text' && language !== 'console') {
                    actionButtons = `<button class="apply-code-button" data-code="${escapeHtml(code.trim())}">Apply</button>`;
                }
            }

            // Header'ı ve kod içeriğini birleştir - butonu sağ üst köşeye yerleştir
            const preElement = `<pre>${langBadge}<div style="position:absolute;top:0;right:0;z-index:10;">${actionButtons}</div><code${langClass}>${formattedCode}</code></pre>`;
            
            // Timeout'la highlight.js'yi çalıştır
            setTimeout(() => {
                try {
                    // Tüm <pre><code> bloklarını seç ve highlight.js uygula
                    document.querySelectorAll('pre code').forEach((block) => {
                        if (!block.classList.contains('hljs')) {
                            hljs.highlightElement(block);
                        }
                    });
                } catch (error) {
                    console.error('Highlight.js error:', error);
                }
            }, 0);
            
            return preElement;
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
            // Kullanıcı mesajını ekle, slash komutuysa vurgula
            appendMessage('user', message, message.startsWith('/'));
            
            // Mesajı state'e kaydet
            state.messages.push({ role: 'user', content: message });
            
            // Yükleniyor göstergesini aç
            loadingIndicator.classList.add('active');
            
            // VS Code'a gönder
            vscode.postMessage({
                type: 'sendMessage',
                message: message,
                includeCurrentFile: state.includeCurrentFile,
                currentFilePath: state.currentFilePath
            });
            
            // Input'u temizle
            userInput.value = '';
            userInput.style.height = 'auto';
            
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
    
    // Slash komutlarını anlık vurgulama fonksiyonu
    function highlightInputCommand() {
        const text = userInput.value;
        // Eğer slash ile başlıyorsa
        if (text.startsWith('/')) {
            // Komut metni (boşluğa kadar olan kısım)
            const commandPart = text.match(/^(\/[a-z\-]+)(\s|$)/);
            
            if (commandPart) {
                const command = commandPart[1];
                
                // Bilinen komutlar
                const knownCommands = ['/explain', '/review', '/refactor', '/docs', 
                                    '/generate-docs', '/documentation', '/optimize', 
                                    '/comments', '/add-comments', '/issues', '/analyze', 
                                    '/find-issues', '/tests', '/test', '/unittests', '/help'];
                
                // Eğer bilinen bir komutsa
                if (knownCommands.includes(command)) {
                    // Özel CSS sınıfı ekle
                    userInput.classList.add('has-command');
                    
                    // Özel CSS stil oluştur veya güncelle
                    let commandStyle = document.getElementById('command-highlight-style');
                    if (!commandStyle) {
                        commandStyle = document.createElement('style');
                        commandStyle.id = 'command-highlight-style';
                        document.head.appendChild(commandStyle);
                    }
                    
                    // İlk satırı turuncu yap ve arkaplanı hafif turuncu olsun
                    commandStyle.textContent = `
                        #userInput.has-command {
                            color: var(--foreground);
                        }
                        
                        #userInput.has-command::first-line {
                            color: #ff7d00;
                            font-weight: bold;
                        }
                    `;
                    return;
                }
            }
        }
        
        // Eğer slash komutu değilse veya bilinmeyen bir komutsa
        userInput.classList.remove('has-command');
        const commandStyle = document.getElementById('command-highlight-style');
        if (commandStyle) {
            commandStyle.textContent = '';
        }
    }

    // Textarea input event listener
    userInput.addEventListener('input', function() {
        // Alanın yüksekliğini otomatik ayarla
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        
        // Komutu anlık vurgula
        highlightInputCommand();
    });

    // Komut metnini input alanına formatlı bir şekilde yerleştir
    function formatCommandInInput(command) {
        userInput.value = '';
        userInput.focus();
        
        // Komut metnini giriş alanına ekle ve sonunda boşluk bırak
        userInput.value = command + ' ';
        
        // Textarea yüksekliğini güncelle
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
        
        // Komutu vurgula
        highlightInputCommand();
        
        // İmleci input sonuna yerleştir
        userInput.selectionStart = userInput.selectionEnd = userInput.value.length;
    }

    // Komut önerisine tıklama
    const suggestionItems = commandSuggestions.querySelectorAll('.command-suggestion-item');
    suggestionItems.forEach(item => {
        item.addEventListener('click', function() {
            const command = this.getAttribute('data-command');
            closeCommandModal();
            
            // Komut metinini formatlı bir şekilde yerleştir
            formatCommandInInput(command);
        });
    });

    // Slash tuşu dinleyicisi
    document.addEventListener('keydown', function(e) {
        if (e.key === '/' && document.activeElement !== commandInput && document.activeElement !== userInput) {
            e.preventDefault();
            openCommandModal();
        }
    });

    // Komut modalı kapatma butonu
    closeCommandBtn.addEventListener('click', closeCommandModal);

    // Komut modalı dışına tıklama
    window.addEventListener('click', function(e) {
        if (e.target === commandModal) {
            closeCommandModal();
        }
    });
    
    // AI sağlayıcı değiştirildiğinde
    aiProviderSelect.addEventListener('change', () => {
        const provider = aiProviderSelect.value;
        
        // UI'da provider dropdown etiketini güncelle
        updateProviderDisplayText(provider);
        
        // VS Code'a bildir
        vscode.postMessage({
            type: 'changeProvider',
            provider: provider
        });
    });
    
    // Sağlayıcı bilgisini dropdown üzerinde güncelle
    function updateProviderDisplayText(provider) {
        try {
            const modelName = getModelName(provider);
            const providerName = getProviderDisplayName(provider);
            
            console.log(`Updating provider display: ${providerName} - Model: ${modelName}`);
            
            // Provider adını ve aktif model adını göster
            const providerLabel = document.querySelector('.select-wrapper .selected-provider');
            if (providerLabel) {
                providerLabel.innerHTML = `${providerName}<span class="model-name">${modelName || 'Default'}</span>`;
            }
        } catch (error) {
            console.error('Provider display update error:', error);
        }
    }
    
    // Sağlayıcı adını daha kullanıcı dostu göster
    function getProviderDisplayName(provider) {
        switch (provider) {
            case 'openai': return 'OpenAI';
            case 'gemini': return 'Gemini';
            case 'anthropic': return 'Claude';
            case 'local': return 'Ollama';
            default: return provider;
        }
    }
    
    // Sağlayıcı için aktif model adını getir
    function getModelName(provider) {
        if (!state.settings || !state.settings[provider]) {
            return '';
        }
        
        // Eğer model özelliği yoksa boş string döndür
        const model = state.settings[provider]?.model;
        if (!model) {
            console.log(`Model değeri ${provider} için bulunamadı`, state.settings[provider]);
            return '';
        }
        
        // Daha kullanıcı dostu ve kısa model isimleri
        switch(model) {
            case 'gpt-3.5-turbo': return 'GPT-3.5';
            case 'gpt-4': return 'GPT-4';
            case 'gpt-4-turbo': return 'GPT-4T';
            case 'gemini-2.0-flash': return 'Gem-2.0F';
            case 'gemini-1.5-pro': return 'Gem-1.5P';
            case 'gemini-2.0-pro': return 'Gem-2.0P';
            case 'claude-3-opus': return 'Claude-3O';
            case 'claude-3-sonnet': return 'Claude-3S';
            // Yerel modeller için
            case 'llama3': return 'Llama-3';
            case 'codellama': return 'Code-Llama';
            case 'mistral': return 'Mistral';
            case 'phi': return 'Phi';
            // Bilinmeyen model ise kısaltma yap
            default: 
                // Model ismini maksimum 10 karakter olacak şekilde kısalt
                return model.length > 10 ? model.substring(0, 9) + '…' : model;
        }
    }
    
    // New Chat butonu için event listener
    newChatButton.addEventListener('click', () => {
        // Mesajları temizle
        messagesContainer.innerHTML = '';
        
        // Hoşgeldin mesajını göster
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'welcome-message';
        welcomeMessage.innerHTML = `
         
                <div class="assistant-message">
                    <div class="message-content">
                        <div class="welcome-header">
                            <h2>Welcome to Byte</h2>
                            <div class="welcome-subtitle">Your intelligent coding assistant</div>
                        </div>
                        
                        <div class="welcome-features">
                            <div class="feature-card">
                                <div class="feature-icon">•</div>
                                <div class="feature-text">Configure plugin settings</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon">•</div>
                                <div class="feature-text">Explore shortcuts</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon">•</div>
                                <div class="feature-text">Provide instructions for AI</div>
                            </div>
                        </div>
                        
                        <div class="assistant-intro">
                           
                            <p>Ask Byte anything to help you with your coding tasks or to learn something new.</p>
                        </div>
                        
                        <div class="quick-commands">
                            <h3>Quick Commands</h3>
                            <div class="command-list">
                                <div class="command-item">
                                    <span class="command">/code</span>
                                    <span class="command-desc">generate new feature or fix bug</span>
                                </div>
                                <div class="command-item">
                                    <span class="command">/explain</span>
                                    <span class="command-desc">explain file or selected code</span>
                                </div>
                                <div class="command-item">
                                    <span class="command">/review</span>
                                    <span class="command-desc">recommend code improvements</span>
                                </div>
                                <div class="command-item">
                                    <span class="command">/unittests</span>
                                 
                                    <span class="command-desc">generate unit tests</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="chill-mode">
                            <h3>Chill mode</h3>
                            <p>Enable to automatically apply changes and run safe commands</p>
                        </div>
                        
                    </div>
                </div>
            
        `;
        messagesContainer.appendChild(welcomeMessage);
        
        // State'i sıfırla - mesajları tamamen temizle
        state.messages = [];
        
        // Input alanını temizle
        userInput.value = '';
        
        // VS Code'a yeni sohbet başladığını ve mesaj geçmişini silmesini bildir
        vscode.postMessage({ 
            type: 'newChat',
            clearHistory: true
        });
        
        // LocalStorage'dan da tüm mesaj geçmişini temizle
        localStorage.removeItem('chatHistory');
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
            
            // Ekrandaki görüntüyü güncelle
            currentFileElement.textContent = fileName;
            currentFileElement.title = filePath; // Tam yolu tooltip olarak göster
            
            // Dosya bilgisini içeren div'i göster ve sınıfını güncelle
            const fileContextDiv = document.getElementById('fileContext');
            if (fileContextDiv) {
                fileContextDiv.style.display = 'flex';
                fileContextDiv.classList.add('active-file');
            }
        } else {
            state.currentFile = '';
            state.currentFilePath = '';
            
            // Ekrandaki görüntüyü temizle
            currentFileElement.textContent = '';
            currentFileElement.title = '';
            
            // Dosya bilgisini içeren div'i gizle
            const fileContextDiv = document.getElementById('fileContext');
            if (fileContextDiv) {
                fileContextDiv.style.display = 'none';
                fileContextDiv.classList.remove('active-file');
            }
            
            // Dosya dahil etme seçeneğini de kapat
            if (document.getElementById('includeCurrentFile')) {
                document.getElementById('includeCurrentFile').checked = false;
                state.includeCurrentFile = false;
            }
        }
        
        // State'i güncelle
        vscode.setState(state);
        
        // Dosya adını içeren tüm etiketleri güncelle
        updateAllFileLabels();
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
                
                // Kod vurgulamasını uygula
                setTimeout(() => {
                    try {
                        document.querySelectorAll('pre code').forEach((block) => {
                            if (!block.classList.contains('hljs')) {
                                hljs.highlightElement(block);
                            }
                        });
                    } catch (error) {
                        console.error('Highlight.js error:', error);
                    }
                }, 10);
                
                // Mesaj state'e kaydedildiyse, state'i güncelle
                // (Mesaj state'e VS Code tarafından kaydediliyor, state güncellemesine gerek yok)
                
                break;
                
            case 'userMessage':
                // Kullanıcı mesajını ekle (Slash komut işlemi için)
                appendMessage('user', message.content, message.isCommand);
                
                // Durumu güncelle
                state.messages.push({ role: 'user', content: message.content });
                vscode.setState(state);
                break;
                
            case 'loadingStart':
                // Yükleniyor göstergesini aç
                loadingIndicator.style.display = 'block';
                loadingIndicator.classList.add('active');
                break;
                
            case 'loadingStop':
                // Yükleniyor göstergesini kapat
                loadingIndicator.style.display = 'none';
                loadingIndicator.classList.remove('active');
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
                
            case 'highlightCommand':
                // Slash komutunu turuncu renge döndür
                if (message.command) {
                    console.log("highlightCommand mesajı alındı: ", message.command);
                    
                    const lastUserMessage = messagesContainer.querySelector('.user-message:last-child .message-content');
                    if (lastUserMessage) {
                        // Mevcut içeriği al
                        const content = lastUserMessage.innerHTML;
                        
                        // Komutun HTML'deki karşılığını bul
                        const commandText = message.command;
                        const escapedCommand = commandText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        
                        // Regex ile içeriği değiştir - tam olarak komutu eşleştir
                        const commandRegex = new RegExp(`(${escapedCommand})(?=\\s|<|$)`, 'g');
                        
                        const highlightedContent = content.replace(
                            commandRegex,
                            '<span class="highlighted-command">$1</span>'
                        );
                        
                        if (content !== highlightedContent) {
                            console.log('Command highlighted');
                            lastUserMessage.innerHTML = highlightedContent;
                        } else {
                            console.log('No match found for command in content');
                            console.log('Content:', content);
                            console.log('Command:', commandText);
                            console.log('RegExp:', commandRegex);
                            
                            // HTML olarak encode edilmiş içerikte de ara
                            const plainContent = lastUserMessage.textContent;
                            if (plainContent.includes(commandText)) {
                                // Doğrudan innerHTML olarak ayarla
                                const newContent = plainContent.replace(
                                    commandText,
                                    `<span class="highlighted-command">${commandText}</span>`
                                );
                                lastUserMessage.innerHTML = newContent;
                                console.log('Applied direct HTML replacement');
                            }
                        }
                    } else {
                        console.log('User message element not found');
                    }
                }
                break;
                
            case 'init':
                // WebView başlangıç durumu
                console.log('WebView init received:', message);
                
                // State'i güncelle
                if (message.settings) {
                    // Ayarlar varsa onları state'e aktar
                    state.settings = message.settings;
                }
                
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
                    state.settings.provider = message.provider;
                    aiProviderSelect.value = message.provider;
                    
                    // Provider modellerinin varsayılan olarak ayarlanmasını sağla
                    if (!state.settings.openai) state.settings.openai = {apiKey: '', model: 'gpt-3.5-turbo'};
                    if (!state.settings.gemini) state.settings.gemini = {apiKey: '', model: 'gemini-2.0-flash'};
                    if (!state.settings.anthropic) state.settings.anthropic = {apiKey: '', model: 'claude-3-opus'};
                    if (!state.settings.local) state.settings.local = {endpoint: 'http://localhost:11434/api/generate', model: 'llama3'};
                    
                    // Provider display text'i güncelle
                    updateProviderDisplayText(message.provider);
                }
                
                vscode.setState(state);
                break;
                
            case 'currentFileChanged':
                // Mevcut dosya değiştiğinde UI'yı güncelle
                if (message.filePath) {
                    const fileName = message.fileName || message.filePath.split(/[\\/]/).pop() || '';
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
                    // Ayarlar objesi içerisindeki undefined değerleri ile ilgilenmemek için
                    // mevcut state ile birleştir (Object.assign veya spread operatör ile)
                    state.settings = {...state.settings, ...message.settings};
                    vscode.setState(state);
                    
                    // Provider modellerinin ayarlanmış olduğunu kontrol et
                    if (!state.settings.openai) state.settings.openai = {apiKey: '', model: 'gpt-3.5-turbo'};
                    if (!state.settings.gemini) state.settings.gemini = {apiKey: '', model: 'gemini-2.0-flash'};
                    if (!state.settings.anthropic) state.settings.anthropic = {apiKey: '', model: 'claude-3-opus'};
                    if (!state.settings.local) state.settings.local = {endpoint: 'http://localhost:11434/api/generate', model: 'llama3'};
                    
                    // UI'yı güncelle
                    fillSettingsForm();
                    aiProviderSelect.value = state.settings.provider;
                    updateProviderDisplayText(state.settings.provider);
                    
                    // API anahtarı durumu güncelle
                    updateProviderStatus('openai', !!state.settings.openai.apiKey);
                    updateProviderStatus('gemini', !!state.settings.gemini.apiKey);
                    if (document.querySelector('#anthropicSettings')) {
                        updateProviderStatus('anthropic', !!state.settings.anthropic?.apiKey);
                    }
                }
                break;
                
            case 'loadSettings':
                loadSettings(message.settings);
                break;
                
            case 'updateProvider':
                aiProviderSelect.value = message.provider;
                break;
                
            case 'settingsMessage':
                // Ayarlar mesajı alındığında
                if (message.status === 'success') {
                    handleSettingsSaved();
                } else if (message.status === 'error') {
                    handleSettingsError(message.message);
                }
                break;

            case 'selectedFilesChanged':
                // Çoklu dosya seçildiğinde, dosyaları current-file bölümünde göster
                if (message.files && message.files.length > 0) {
                    // Seçilen dosyaları state'e kaydet
                    state.selectedFiles = message.files;
                    
                    // Seçilen dosyaları görüntüle
                    const selectedFilesContainer = document.getElementById('selectedFiles');
                    if (selectedFilesContainer) {
                        selectedFilesContainer.innerHTML = ''; // Önceki içeriği temizle
                        
                        // Dosya içeriğini göster
                        message.files.forEach(file => {
                            const fileItem = document.createElement('div');
                            fileItem.classList.add('file-item');
                            fileItem.title = file.filePath;
                            fileItem.innerHTML = `
                                <span class="current-file">${file.fileName}</span>
                            `;
                            selectedFilesContainer.appendChild(fileItem);
                        });
                        
                        // fileContext div'ini görünür yap
                        const fileContextElement = document.getElementById('fileContext');
                        if (fileContextElement) {
                            fileContextElement.style.display = 'flex';
                        }
                    }
                    
                    // State'i kaydet
                    vscode.setState(state);
                }
                break;

            case 'filesAdded':
                // Dosyalar eklendiğinde badge'leri oluştur
                if (message.files && message.files.length > 0) {
                    console.log('Files added:', message.files);
                    
                    // Seçilen dosyaları state'e ekle
                    message.files.forEach(file => {
                        // Eğer dosya zaten ekli değilse ekle
                        if (!state.selectedFiles.some(f => f.filePath === file.filePath)) {
                            state.selectedFiles.push(file);
                        }
                    });
                    
                    // Badge'leri güncelle
                    updateFileBadges(state.selectedFiles);
                    
                    // State'i güncelle
                    vscode.setState(state);
                }
                break;
                
            case 'filePickerResult':
                // Dosya seçici sonucu
                if (message.files && message.files.length > 0) {
                    console.log('File picker result:', message.files);
                    
                    // Her dosyayı ekle
                    message.files.forEach(file => {
                        addFileBadge(file.fileName, file.filePath);
                    });
                    
                    // State'i güncelle
                    vscode.setState(state);
                }
                break;
        }
    });
    
    // Komut modalını aç
    function openCommandModal() {
        commandModal.classList.add('active');
        commandInput.focus();
        commandInput.textContent = '/';
        placeCaretAtEnd(commandInput);
        
        // Önerileri göster
        commandSuggestions.style.display = 'flex';
    }

    // Komut modalını kapat
    function closeCommandModal() {
        commandModal.classList.remove('active');
        commandInput.textContent = '';
    }

    // İmleci contenteditable div'in sonuna yerleştir
    function placeCaretAtEnd(el) {
        el.focus();
        if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
            var range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    // Mevcut dosya bilgilerini bütün dosya etiketlerine güncelle
    function updateAllFileLabels() {
        const fileLabels = document.querySelectorAll('.current-file-label');
        if (fileLabels.length > 0 && state.currentFile) {
            fileLabels.forEach(label => {
                label.textContent = state.currentFile;
            });
        }
    }
    
    // Sayfa yüklendiğinde mesajları göster
    loadMessages();

    // CSS stillerini sayfaya ekle
    const customStyles = document.createElement('style');
    customStyles.textContent = `
        .highlighted-command {
            color: #ff7d00 !important;
            font-weight: bold;
            background-color: rgba(255, 125, 0, 0.1);
            padding: 2px 4px;
            border-radius: 3px;
            display: inline-block;
        }
        
        .user-message .message-content {
            white-space: pre-wrap;
            word-break: break-word;
        }
    `;
    document.head.appendChild(customStyles);

    // Kod butonları için event listener
    document.addEventListener('click', function(e) {
        // Run code butonları
        if (e.target.classList.contains('run-code-button')) {
            const code = e.target.getAttribute('data-code');
            if (code) {
                // VS Code'a mesaj gönder
                vscode.postMessage({
                    type: 'runCode',
                    code: code
                });
            }
        }
        
        // Apply code butonları
        if (e.target.classList.contains('apply-code-button')) {
            const code = e.target.getAttribute('data-code');
            if (code) {
                // VS Code'a mesaj gönder
                vscode.postMessage({
                    type: 'applyCode',
                    code: code
                });
            }
        }
    });

    // Komut girişi dinleyicisi
    commandInput.addEventListener('input', function() {
        const text = this.textContent;
        if (!text.startsWith('/')) {
            this.textContent = '/';
            placeCaretAtEnd(this);
        }
        
        // Komut önerilerini filtrele
        const query = text.toLowerCase().trim();
        const menuItems = commandSuggestions.querySelectorAll('.command-suggestion-item');
        
        menuItems.forEach(item => {
            const commandText = item.getAttribute('data-command').toLowerCase();
            if (query === '/' || commandText.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // Enter tuşu dinleyicisi
    commandInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const command = this.textContent.trim();
            closeCommandModal();
            
            // Komut metinini uygula
            formatCommandInInput(command);
        }
    });

    // Dosya Ekleme Butonu Tıklama Olayı
    addFileButton.addEventListener('click', () => {
        console.log("Dosya ekleme butonuna tıklandı!");
        // VS Code'a dosya seçme isteği gönder
        vscode.postMessage({
            type: 'openFilePicker'
        });
        console.log("openFilePicker mesajı gönderildi");
    });

    // Dosya badge'i oluşturma fonksiyonu
    function createFileBadge(fileName, filePath) {
        const badge = document.createElement('div');
        badge.className = 'file-badge';
        badge.title = filePath;
        badge.dataset.filePath = filePath;
        
        // Dosya uzantısını belirle ve simgeyi ayarla
        const fileExtension = fileName.split('.').pop().toLowerCase();
        let fileIcon = '📄';
        
        // Dosya türüne göre simge ata
        if (['js', 'ts', 'jsx', 'tsx'].includes(fileExtension)) {
            fileIcon = '📝';
        } else if (['json', 'xml', 'yaml', 'yml'].includes(fileExtension)) {
            fileIcon = '⚙️';
        } else if (['html', 'css', 'scss', 'less'].includes(fileExtension)) {
            fileIcon = '🎨';
        } else if (['md', 'txt', 'doc'].includes(fileExtension)) {
            fileIcon = '📄';
        } else if (['py', 'rb', 'php', 'java'].includes(fileExtension)) {
            fileIcon = '🔧';
        }
        
        badge.innerHTML = `
            <span class="file-badge-icon">${fileIcon}</span>
            <span class="file-badge-name">${fileName}</span>
            <button class="file-badge-remove" title="Dosyayı Kaldır">×</button>
        `;
        
        // Badge'i kaldırma işlemi
        const removeButton = badge.querySelector('.file-badge-remove');
        removeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            // Dosyayı state'den kaldır
            state.selectedFiles = state.selectedFiles.filter(file => file.filePath !== filePath);
            // Badge'i DOM'dan kaldır
            badge.remove();
            // State'i güncelle
            vscode.setState(state);
            // VS Code'a bildir
            vscode.postMessage({
                type: 'removeFile',
                filePath: filePath
            });
            // Eğer hiç dosya kalmadıysa, dosya alanını gizle
            updateFileArea();
        });
        
        return badge;
    }
    
    // Dosya badge'lerini güncelle
    function updateFileBadges(files) {
        if (!fileBadgesContainer) return;
        
        // Mevcut badge'leri temizle
        fileBadgesContainer.innerHTML = '';
        
        // Yeni badge'leri ekle
        if (files && files.length > 0) {
            // Her dosya için badge oluştur ve ekle
            files.forEach(file => {
                const badge = createFileBadge(file.fileName, file.filePath);
                fileBadgesContainer.appendChild(badge);
            });
        }
        
        // Dosya alanını güncelle
        updateFileArea();
    }
    
    // Dosya alanını güncelle (göster/gizle)
    function updateFileArea() {
        // Eğer state.selectedFiles yoksa veya boşsa, dosya alanını gizle
        if (!state.selectedFiles || state.selectedFiles.length === 0) {
            fileBadgesContainer.style.display = 'none';
        } else {
            fileBadgesContainer.style.display = 'flex';
        }
    }
    
    // Dosya eklendiğinde badge oluştur ve ekle
    function addFileBadge(fileName, filePath) {
        // Dosya zaten ekli mi kontrol et
        const isFileAlreadyAdded = state.selectedFiles.some(f => f.filePath === filePath);
        
        if (!isFileAlreadyAdded) {
            // State'e yeni dosyayı ekle
            const fileInfo = { fileName, filePath };
            state.selectedFiles.push(fileInfo);
            
            // Badge oluştur ve DOM'a ekle
            const badge = createFileBadge(fileName, filePath);
            fileBadgesContainer.appendChild(badge);
            
            // Dosya alanını göster
            fileBadgesContainer.style.display = 'flex';
            
            // State'i güncelle
            vscode.setState(state);
        }
    }
})();