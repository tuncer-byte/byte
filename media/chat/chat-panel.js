(function() {
    // VS Code API'ye erişim
    const vscode = acquireVsCodeApi();
    
    // DOM Elementleri
    const messagesContainer = document.getElementById('messagesContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const typingIndicator = document.getElementById('typingIndicator');
    const aiProviderSelect = document.getElementById('aiProvider');
    const configureButton = document.getElementById('configureButton');
    const currentFileElement = document.getElementById('currentFile');
    const fileContextElement = document.getElementById('fileContext');
    const agentToggle = document.getElementById('agentToggle');
    const newChatButton = document.querySelector('.new-chat');
    const addFileButton = document.getElementById('addFileButton');
    const fileBadgesContainer = document.getElementById('fileBadgesContainer');
    
    // Komut Modalı Elementleri
    const commandModal = document.getElementById('commandModal');
    const commandInput = document.getElementById('commandInput');
    const closeCommandBtn = document.getElementById('closeCommandBtn');
    const commandSuggestions = document.getElementById('commandSuggestions');
    
    // Mini Komut Modalı Elementleri
    const commandMiniModal = document.getElementById('commandMiniModal');
    const commandMiniList = document.getElementById('commandMiniList');
    
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
    
    // Yükleniyor durumunu göster/gizle
    function toggleLoading(isLoading) {
        if (isLoading) {
            showLoadingIndicator();
        } else {
            hideLoadingIndicator();
        }
    }
    
    // Yükleniyor göstergesini göster
    function showLoadingIndicator() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
            loadingIndicator.classList.add('active');
            
            // Yeni 3 noktalı göstergeyi de göster
            if (typingIndicator) {
                typingIndicator.style.display = 'flex';
            }
            
            // Yanıt oluşturuluyor göstergesini göster
            const generatingIndicator = document.getElementById('generatingIndicator');
            if (generatingIndicator) {
                generatingIndicator.style.display = 'inline';
            }
            
            // Gönder butonunu devre dışı bırak
            if (sendButton) {
                sendButton.disabled = true;
                sendButton.classList.add('disabled');
            }
        }
    }
    
    // Yükleniyor göstergesini gizle
    function hideLoadingIndicator() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
            loadingIndicator.classList.remove('active');
            
            // Yeni 3 noktalı göstergeyi de gizle
            if (typingIndicator) {
                typingIndicator.style.display = 'none';
            }
            
            // Yanıt oluşturuluyor göstergesini gizle
            const generatingIndicator = document.getElementById('generatingIndicator');
            if (generatingIndicator) {
                generatingIndicator.style.display = 'none';
            }
            
            // Gönder butonunu tekrar etkinleştir
            if (sendButton) {
                sendButton.disabled = false;
                sendButton.classList.remove('disabled');
            }
        }
    }
    
    // Sayfa yüklendiğinde VS Code'a hazır olduğumuzu bildir
    window.addEventListener('load', () => {
        vscode.postMessage({ type: 'webviewReady' });
        
        // Agent durumunu kayıtlı durumdan al
        if (state.agentEnabled !== undefined) {
            agentToggle.checked = state.agentEnabled;
        }
        
        // Chill modu devre dışı olarak ayarla
        agentToggle.disabled = true;
        
        // Eğer mesaj geçmişi boşsa welcome mesajını göster
        if (!state.messages || state.messages.length === 0) {
            showWelcomeMessage();
        }
        
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
            
            if (inputElement) {
                // Şifre görünürlüğünü değiştir
                if (inputElement.type === 'password') {
                    // Şifreyi göster
                    inputElement.type = 'text';
                    button.classList.add('show');
                } else {
                    // Şifreyi gizle
                    inputElement.type = 'password';
                    button.classList.remove('show');
                }
                
                // Input alanına odaklan
                inputElement.focus();
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
        // Kaydetme butonu durumunu güncelle
        const saveButton = document.getElementById('saveSettingsBtn');
        const originalText = saveButton.textContent;
        saveButton.textContent = 'Kaydediliyor...';
        saveButton.disabled = true;
        saveButton.classList.add('saving');
        
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
        
        // 10 saniye sonra hala cevap alınamazsa timeout
        setTimeout(() => {
            if (saveButton.disabled) {
                saveButton.disabled = false;
                saveButton.textContent = originalText;
                saveButton.classList.remove('saving');
                settingsStatus.textContent = 'Ayarlar kaydedilemedi - zaman aşımı.';
                settingsStatus.classList.remove('success');
                settingsStatus.classList.add('error');
            }
        }, 10000);
    }
    
    // Ayarlar başarıyla kaydedildiğinde
    function handleSettingsSaved() {
        // Buton durumunu normal haline getir
        const saveButton = document.getElementById('saveSettingsBtn');
        saveButton.disabled = false;
        saveButton.textContent = 'Kaydet';
        saveButton.classList.remove('saving');
        
        // Başarılı mesajı göster
        settingsStatus.textContent = 'Ayarlar başarıyla kaydedildi!';
        settingsStatus.classList.remove('error');
        settingsStatus.classList.add('success');
        settingsStatus.classList.add('show');
        
        // UI'yı güncelle - dropdown için aktif provider değerini ayarla
        const currentProvider = state.settings.provider;
        aiProviderSelect.value = currentProvider;
        
        // Başlıktaki provider gösterimini güncelle
        updateProviderDisplayText(currentProvider);
        
        // 1.5 saniye sonra modalı kapat
        setTimeout(() => {
            closeSettingsModal();
            // Ek olarak 500ms sonra mesajı gizle
            setTimeout(() => {
                settingsStatus.classList.remove('show');
                // Modal kapandıktan sonra tekrar provider gösterimini güncelle
                updateProviderDisplayText(currentProvider);
            }, 500);
        }, 1500);
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
        
        // Önce HTML karakterlerini kaçışla, daha sonra markdown öğelerini HTML'e dönüştür
        let formattedText = escapeHtml(text);
        
        // Kod bloklarını işle - dil desteği ve syntax highlighting eklendi
        formattedText = formattedText.replace(/```(\w*)([\s\S]*?)```/g, function(match, language, code) {
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
            
            // Dil belirteci ve butonlar için üst kısım (header) oluştur
            const langBadge = language ? `<div class="code-language">${language}</div>` : '';
            let actionButtons = '';
            
            // Sadece AI mesajları için butonları göster
            if (role === 'assistant') {
                // Butonları oluştur - kod içeriğini direct olarak gönder back-ticks olmadan
                if (language === 'bash' || language === 'sh') {
                    actionButtons = `<button class="run-code-button" data-code="${code}">Run</button>`;
                } else if (language && language !== 'output' && language !== 'text' && language !== 'console') {
                    actionButtons = `<button class="apply-code-button" data-code="${code}">Apply</button>`;
                }
            }

            // Header'ı ve kod içeriğini birleştir - butonu sağ üst köşeye yerleştir
            return `<pre>${langBadge}<div style="position:absolute;top:0;right:0;z-index:10;">${actionButtons}</div><code${langClass}>${code}</code></pre>`;
        });
        
        // Satır içi kod
        formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Başlıklar
        formattedText = formattedText.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        formattedText = formattedText.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        formattedText = formattedText.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Kalın metinler
        formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // İtalik metinler
        formattedText = formattedText.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Sırasız listeler için düzeltilmiş yaklaşım
        let hasUnorderedList = formattedText.match(/^[\*\-] (.+)$/gm);
        if (hasUnorderedList) {
            let listContent = '';
            let inList = false;
            let lines = formattedText.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                let listMatch = line.match(/^[\*\-] (.+)$/);
                
                if (listMatch) {
                    if (!inList) {
                        listContent += '<ul>\n';
                        inList = true;
                    }
                    listContent += `<li>${listMatch[1]}</li>\n`;
                } else {
                    if (inList) {
                        listContent += '</ul>\n';
                        inList = false;
                    }
                    listContent += line + '\n';
                }
            }
            
            if (inList) {
                listContent += '</ul>\n';
            }
            
            formattedText = listContent;
        }
        
        // Sıralı listeler için düzeltilmiş yaklaşım
        let hasOrderedList = formattedText.match(/^\d+\. (.+)$/gm);
        if (hasOrderedList) {
            let listContent = '';
            let inList = false;
            let lines = formattedText.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                let listMatch = line.match(/^\d+\. (.+)$/);
                
                if (listMatch) {
                    if (!inList) {
                        listContent += '<ol>\n';
                        inList = true;
                    }
                    listContent += `<li>${listMatch[1]}</li>\n`;
                } else {
                    if (inList) {
                        listContent += '</ol>\n';
                        inList = false;
                    }
                    listContent += line + '\n';
                }
            }
            
            if (inList) {
                listContent += '</ol>\n';
            }
            
            formattedText = listContent;
        }
        
        // Paragrafları oluşturma - boş satırlarla ayrılmış paragraflar
        let paragraphs = formattedText.split(/\n\n+/);
        let result = '';
        
        paragraphs.forEach(p => {
            if (p.trim()) {
                // Eğer zaten HTML elementi içeriyorsa doğrudan ekle
                if (p.includes('<h') || p.includes('<ul') || p.includes('<ol') || 
                    p.includes('<pre') || p.includes('<code') || p.includes('<li')) {
                    result += p + '\n\n';
                } else {
                    // Satır içi satır sonlarını <br> ile değiştir
                    result += `<p>${p.replace(/\n/g, '<br>')}</p>\n\n`;
                }
            }
        });
        
        return result;
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
            // Welcome mesajının varlığını kontrol et ve koru
            const welcomeMessage = document.querySelector('#permanent-welcome');
            
            // Kullanıcı mesajını ekle, slash komutuysa vurgula
            appendMessage('user', message, message.startsWith('/'));
            
            // Mesajı state'e kaydet
            state.messages.push({ role: 'user', content: message });
            
            // Yükleniyor göstergesini aç
            showLoadingIndicator();
            
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
            
            // Welcome mesajının silinmesini önle - eğer silinmişse ve gerekiyorsa tekrar ekle
            if (!welcomeMessage) {
                showWelcomeMessage();
            }
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
    
    // Input için olay dinleyici - komutları izle ve mini modal göster/gizle
    userInput.addEventListener('input', function() {
        // Alanın yüksekliğini otomatik ayarla
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        
        const text = this.value.trim();
        
        // Eğer kullanıcı "/" yazıp daha fazla bir şey yazmamışsa, mini komut modalını göster
        if (text === '/') {
            showMiniCommandModal();
        } 
        // Eğer "/" ile başlayan ve devam eden bir komut yazıyorsa, mini komut modalını göstermeye devam et
        else if (text.startsWith('/')) {
            // Filtreleme yap
            filterMiniCommands(text.toLowerCase());
        } 
        // Eğer "/" ile başlamıyorsa veya boşsa, mini komut modalını gizle
        else {
            hideMiniCommandModal();
        }
        
        // Komutu anlık vurgula
        highlightInputCommand();
    });
    
    // Mini komutlarda filtreleme yap
    function filterMiniCommands(query) {
        const cmdItems = commandMiniList.querySelectorAll('.command-mini-item');
        
        // Eşleşen komutların olup olmadığını izle
        let hasMatches = false;
        
        cmdItems.forEach(item => {
            const cmdText = item.getAttribute('data-command').toLowerCase();
            // Eğer komut sorgu metniyle başlıyorsa veya içeriyorsa göster
            if (cmdText.startsWith(query) || cmdText.includes(query.substring(1))) {
                item.style.display = 'flex';
                hasMatches = true;
            } else {
                item.style.display = 'none';
            }
        });
        
        // Eğer hiç eşleşme yoksa modalı gizle
        if (!hasMatches) {
            hideMiniCommandModal();
        } else {
            // Eşleşme varsa modalı göster
            commandMiniModal.classList.add('active');
        }
    }
    
    // Input blur olunca mini modal modalını gizle
    userInput.addEventListener('blur', function(e) {
        // Eğer mini komut modalının bir elemanına tıklandıysa, gizleme
        if (e.relatedTarget && e.relatedTarget.closest('.command-mini-modal')) {
            return;
        }
        
        // Diğer durumlarda gizle
        setTimeout(() => {
            hideMiniCommandModal();
        }, 200);
    });
    
    // Mini komut modalına tıklandığında input'a odaklanma devam etsin
    commandMiniModal.addEventListener('mousedown', function(e) {
        // Olayın varsayılan davranışını engelle (focus'u değiştirmemesi için)
        e.preventDefault();
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
        if (e.key === '/' && document.activeElement !== commandInput) {
            // If we're already in the userInput field AND it's empty, open the command modal
            if (document.activeElement === userInput && userInput.value.trim() === '') {
                e.preventDefault();
                openCommandModal();
            } 
            // If we're not in any input field, open the command modal
            else if (document.activeElement !== userInput) {
                e.preventDefault();
                openCommandModal();
            }
        }
    });

    // Add a specific input event handler for userInput to detect slash at beginning
    userInput.addEventListener('input', function(e) {
        const text = this.value.trim();
        
        // If the user just typed a / at the start of an empty field
        if (text === '/') {
            // Clear the input field
            this.value = '';
            
            // Open the command modal
            openCommandModal();
        }
        
        // Always call the existing input handling function
        highlightInputCommand();
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
            // state.settings nesnesini kontrol et ve güncelle
            if (!state.settings) {
                console.log('State settings henüz yüklenmemiş');
                return;
            }
            
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
            console.log(`Provider için ayarlar bulunamadı: ${provider}`);
            return '';
        }
        
        // Eğer model özelliği yoksa boş string döndür
        const model = state.settings[provider]?.model;
        if (!model) {
            console.log(`Model değeri ${provider} için bulunamadı`, state.settings[provider]);
            return '';
        }
        
        console.log(`Aktif model bilgisi: ${provider} - ${model}`);
        
        // Daha kullanıcı dostu ve kısa model isimleri
        switch(model) {
            case 'gpt-3.5-turbo': return 'GPT-3.5';
            case 'gpt-4': return 'GPT-4';
            case 'gpt-4-turbo': return 'GPT-4T';
            case 'gemini-1.5-flash': return 'Gem-1.5F';
            case 'gemini-1.5-pro': return 'Gem-1.5P';
            case 'gemini-2.0-flash': return 'Gem-2.0F';
            case 'gemini-2.0-pro': return 'Gem-2.0P';
            case 'claude-3-opus': return 'Claude-3O';
            case 'claude-3-sonnet': return 'Claude-3S';
            case 'claude-3-haiku': return 'Claude-3H';
            // Yerel modeller için
            case 'llama3': return 'Llama-3';
            case 'llama2': return 'Llama-2';
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
        
        // Welcome mesajını ekle - bu fonksiyonu kullanarak welcome mesajını oluşturuyoruz
        showWelcomeMessage();
        
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

    // Welcome mesajını gösteren fonksiyon
    function showWelcomeMessage() {
        // Eğer hali hazırda welcome-message varsa, onu silme
        const existingWelcome = document.querySelector('.welcome-message');
        if (existingWelcome) {
            return; // Zaten welcome mesajı varsa, yenisini oluşturmaya gerek yok
        }

        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'welcome-message';
        // welcome-message için özel bir ID ekleyelim ki daha sonra bunu kolayca bulabilelim
        welcomeMessage.id = 'permanent-welcome';
        
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
        
        // Welcome mesajını container'ın en üstüne ekleyelim
        messagesContainer.insertBefore(welcomeMessage, messagesContainer.firstChild);
    }
    
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
            
            // Dosya bilgisini içeren div'i gizle - eğer dosya eklenmemişse
            const fileContextDiv = document.getElementById('fileContext');
            if (fileContextDiv) {
                if (!state.selectedFiles || state.selectedFiles.length === 0) {
                    fileContextDiv.style.display = 'none';
                    fileContextDiv.classList.remove('active-file');
                } else {
                    // Eğer eklenen dosyalar varsa, hala görünür kalmalı
                    fileContextDiv.style.display = 'flex';
                }
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
        
        // Welcome mesajının varlığını her mesaj alındığında kontrol et ve koru
        const preserveWelcome = () => {
            setTimeout(() => {
                // Welcome mesajını kontrol et
                if (!document.querySelector('#permanent-welcome')) {
                    console.log("Welcome mesajı kaybolmuş, tekrar ekleniyor...");
                    showWelcomeMessage();
                }
                
                // Current file bölümünü kontrol et ve gerekirse tekrar göster
                if (state.currentFile && state.currentFilePath) {
                    const fileContextDiv = document.getElementById('fileContext');
                    if (fileContextDiv && fileContextDiv.style.display === 'none') {
                        console.log("Current file bölümü görünmüyor, tekrar gösteriliyor...");
                        fileContextDiv.style.display = 'flex';
                        fileContextDiv.classList.add('active-file');
                        
                        // Current file içeriğini güncelle
                        currentFileElement.textContent = state.currentFile;
                        currentFileElement.title = state.currentFilePath;
                    }
                }
            }, 100);
        };
        
        switch (message.type) {
            case 'response':
                // Yapay zeka yanıtını işle
                console.log('AI response received');
                
                // Yükleniyor göstergesini gizle
                hideLoadingIndicator();
                
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
                
                // Welcome mesajını koru
                preserveWelcome();
                
                break;
                
            case 'setWidth':
                // Panel genişliğini ayarla
                if (message.width && typeof message.width === 'number') {
                    console.log(`Panel genişliği ayarlanıyor: ${message.width}px`);
                    // CSS değişkenini güncelle
                    document.documentElement.style.setProperty('--default-width', `${message.width}px`);
                    
                    // Chat container'ın minimum genişliğini ayarla
                    const chatContainer = document.querySelector('.chat-container');
                    if (chatContainer) {
                        chatContainer.style.minWidth = `${message.width}px`;
                    }
                }
                break;
                
            case 'userMessage':
                // Kullanıcı mesajını ekle (Slash komut işlemi için)
                appendMessage('user', message.content, message.isCommand);
                
                // Durumu güncelle
                state.messages.push({ role: 'user', content: message.content });
                vscode.setState(state);
                
                // Welcome mesajını koru
                preserveWelcome();
                
                break;
                
            case 'loadingStart':
                // Yükleniyor göstergesini aç
                showLoadingIndicator();
                
                // Welcome mesajını koru
                preserveWelcome();
                
                break;
                
            case 'loadingStop':
                // Yükleniyor göstergesini kapat
                hideLoadingIndicator();
                
                // Welcome mesajını koru
                preserveWelcome();
                
                break;
                
            case 'providerChanged':
                // AI sağlayıcı değiştiğinde UI'yı güncelle
                console.log('Provider changed to:', message.provider);
                aiProviderSelect.value = message.provider;
                
                // Welcome mesajını koru
                preserveWelcome();
                
                break;
                
            case 'error':
                // Hata mesajını işle
                console.error('Error from extension:', message.content);
                
                // Yükleniyor göstergesini gizle
                hideLoadingIndicator();
                
                // Hata mesajını görüntüle
                const errorDiv = document.createElement('div');
                errorDiv.classList.add('error-message');
                errorDiv.textContent = `Hata: ${message.content}`;
                messagesContainer.appendChild(errorDiv);
                
                // Otomatik kaydır
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
                // Welcome mesajını koru
                preserveWelcome();
                
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
                
                // Welcome mesajını koru
                preserveWelcome();
                
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
                if (message.messages && message.messages.length > 0) {
                    state.messages = message.messages;
                    messagesContainer.innerHTML = '';
                    
                    // Önce welcome mesajını göster, sonra diğer mesajları yükle
                    showWelcomeMessage();
                    loadMessages();
                } else {
                    // Mesaj geçmişi boşsa sadece welcome mesajını göster
                    messagesContainer.innerHTML = '';
                    showWelcomeMessage();
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
                    if (!state.settings.gemini) state.settings.gemini = {apiKey: '', model: 'gemini-1.5-pro'};
                    if (!state.settings.anthropic) state.settings.anthropic = {apiKey: '', model: 'claude-3-opus'};
                    if (!state.settings.local) state.settings.local = {endpoint: 'http://localhost:11434/api/generate', model: 'llama3'};
                    
                    // Başlıktaki provider gösterimini güncelle - doğru model bilgisini göstermek için
                    setTimeout(() => {
                        updateProviderDisplayText(message.provider);
                    }, 100);
                }
                
                vscode.setState(state);
                
                // Welcome mesajını koru
                preserveWelcome();
                
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

            case 'currentFileChanged':
                // Aktif dosya değiştiğinde
                if (message.filePath && message.filePath !== '') {
                    updateCurrentFile(message.fileName, message.filePath);
                } else {
                    // Eğer filePath boş ise veya undefined ise, updateCurrentFile fonksiyonunu boş değerlerle çağır
                    updateCurrentFile('', '');
                }
                break;

            case 'settingsError':
                // Ayarlar kaydedilirken hata oluştu
                if (message.error) {
                    handleSettingsError(message.error);
                }
                break;
                
            case 'settingsSaved':
                // Ayarlar başarıyla kaydedildi
                handleSettingsSaved();
                break;

            default:
                // Default case için de welcome mesajını koru
                preserveWelcome();
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

    // Bilinen komutlar array'i - her yerde kullanılabilir
    const knownCommands = [
        { command: '/code', desc: 'Kod üret veya bir özellik geliştir', icon: '💻' },
        { command: '/explain', desc: 'Kodu açıkla ve anlaşılmasını sağla', icon: '🔍' },
        { command: '/review', desc: 'Kod kalitesini değerlendir ve iyileştir', icon: '📝' },
        { command: '/refactor', desc: 'Kodu yeniden yapılandır', icon: '🔄' },
        { command: '/optimize', desc: 'Kodu optimize et', icon: '⚡' },
        { command: '/docs', desc: 'Kod için dokümantasyon oluştur', icon: '📚' },
        { command: '/tests', desc: 'Unit testler oluştur', icon: '🧪' },
        { command: '/help', desc: 'Komutlar hakkında yardım', icon: '❓' }
    ];

    // Mini komut modalını doldur ve göster
    function showMiniCommandModal() {
        // Önce listeyi temizle
        commandMiniList.innerHTML = '';
        
        // Komutları ekle
        knownCommands.forEach(cmd => {
            const item = document.createElement('div');
            item.className = 'command-mini-item';
            item.setAttribute('data-command', cmd.command);
            item.innerHTML = `<span class="command-icon">${cmd.icon}</span>${cmd.command}`;
            
            // Tıklama olayını ekle
            item.addEventListener('click', function() {
                // Komutu input'a yerleştir
                formatCommandInInput(cmd.command);
                // Mini modalı kapat
                hideMiniCommandModal();
            });
            
            commandMiniList.appendChild(item);
        });
        
        // Mini modalı göster
        commandMiniModal.classList.add('active');
    }
    
    // Mini komut modalını gizle
    function hideMiniCommandModal() {
        commandMiniModal.classList.remove('active');
    }
})();