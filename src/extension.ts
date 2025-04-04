import * as vscode from 'vscode';
import * as path from 'path';
import { AIService } from './services/ai';
import { InlineCodeChat } from './views/inline-chat';
import { CommandManager } from './commands';
import { ChatPanel } from './views/chat';
import { ByteAIClient } from './panelClient';
import { InlineChatPanel } from './inlineChat';

// Genişlik sabitleri
const CHAT_PANEL_MIN_WIDTH = 400; // Pixel olarak ChatPanel genişliği
const INLINE_CHAT_MIN_WIDTH = 600; // Pixel olarak InlineChat genişliği

// Global terminal değişkeni
let byteTerminal: vscode.Terminal | undefined;

// Eklenti aktif edildiğinde çağrılır
export function activate(context: vscode.ExtensionContext) {
    console.log('Byte AI Asistanı aktif edildi!');
    
    // Ayarları oku
    const configuration = vscode.workspace.getConfiguration('byte');
    const provider = configuration.get<string>('provider') || 'openai';
    
    // AI Servisi oluştur
    const aiService = new AIService(context);
    
    // Byte AI Client oluştur
    const byteClient = new ByteAIClient();
    
    // Sohbet paneli oluştur ve genişlik değeriyle başlat
    const chatPanel = new ChatPanel(context.extensionUri, aiService, CHAT_PANEL_MIN_WIDTH);
    
    // Inline Kod Analizi oluştur ve genişlik değeriyle başlat
    const inlineCodeChat = new InlineCodeChat(context.extensionUri, aiService, INLINE_CHAT_MIN_WIDTH);
    
    // WebView paneliyle kaydol
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ChatPanel.viewType,
            chatPanel
        )
    );
    
    // Terminal komutlarını dinle
    vscode.window.onDidCloseTerminal(terminal => {
        if (terminal === byteTerminal) {
            byteTerminal = undefined;
        }
    });
    
    // Terminal komutu çalıştırma özelliği ekle
    context.subscriptions.push(
        vscode.commands.registerCommand('byte.runInTerminal', (command: string) => {
            // Eğer terminal yoksa oluştur
            if (!byteTerminal) {
                byteTerminal = vscode.window.createTerminal('Byte AI Terminal');
            }
            
            // Terminali göster ve komutu çalıştır
            byteTerminal.show();
            byteTerminal.sendText(command);
        })
    );
    
    // Komut yöneticisi oluştur ve komutları kaydet
    const commandManager = new CommandManager(chatPanel, aiService);
    commandManager.registerCommands(context);
    
    // ChatPanel'e CommandManager'ı bağla (slash komutlarını işleyebilmesi için)
    chatPanel.setCommandManager(commandManager);
    
    // Inline kod analizi için kısayol tuşu kaydet
    context.subscriptions.push(
        vscode.commands.registerCommand('byte.inlineCodeAnalysis', () => {
            inlineCodeChat.analyzeSelectedCode();
        })
    );
    
    // Inline kod analizi için kısayol tuşu kaydet (soru sorma)
    context.subscriptions.push(
        vscode.commands.registerCommand('byte.askQuestionAboutCode', () => {
            inlineCodeChat.askQuestionAboutCode();
        })
    );
    
    // InlineCodeChat'i context'e ekle
    context.subscriptions.push(inlineCodeChat);
    
    // Yeni InlineChatPanel'i açmak için komut
    context.subscriptions.push(
        vscode.commands.registerCommand('byte.openInlineChat', () => {
            InlineChatPanel.createOrShow(context.extensionUri, byteClient, INLINE_CHAT_MIN_WIDTH);
        })
    );
    
    // Yeni kod uygulama komutunu kaydet
    context.subscriptions.push(
        vscode.commands.registerCommand('byte.applyCode', async (fileName: string, code: string) => {
            try {
                // Dosya yolunu oluştur
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    throw new Error('Çalışma alanı bulunamadı');
                }
                
                const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
                
                // Dosyanın var olup olmadığını kontrol et
                try {
                    await vscode.workspace.fs.stat(filePath);
                    
                    // Dosya varsa içeriğini al ve kodu ekle
                    const document = await vscode.workspace.openTextDocument(filePath);
                    const edit = new vscode.WorkspaceEdit();
                    
                    // Tüm metni değiştir
                    const fullRange = new vscode.Range(
                        document.positionAt(0),
                        document.positionAt(document.getText().length)
                    );
                    
                    edit.replace(filePath, fullRange, code);
                    await vscode.workspace.applyEdit(edit);
                    
                    // Başarı mesajı göster
                    vscode.window.showInformationMessage(`Kod başarıyla uygulandı: ${fileName}`);
                    
                    // Dosyayı aç ve göster
                    const textDocument = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(textDocument);
                    
                } catch (fileError) {
                    // Dosya yoksa, oluşturmak için onay iste
                    const createOption = 'Dosyayı Oluştur';
                    const selection = await vscode.window.showWarningMessage(
                        `${fileName} dosyası mevcut değil. Oluşturmak ister misiniz?`,
                        { modal: true },
                        createOption
                    );
                    
                    if (selection === createOption) {
                        // Dosya yolundaki klasörleri oluştur
                        const dirname = path.dirname(fileName);
                        if (dirname && dirname !== '.') {
                            const dirPath = vscode.Uri.joinPath(workspaceFolder.uri, dirname);
                            try {
                                await vscode.workspace.fs.stat(dirPath);
                            } catch {
                                // Klasör yoksa oluştur
                                await vscode.workspace.fs.createDirectory(dirPath);
                            }
                        }
                        
                        // Yeni dosya oluştur ve içeriği yaz
                        const encoder = new TextEncoder();
                        await vscode.workspace.fs.writeFile(filePath, encoder.encode(code));
                        
                        // Başarı mesajı göster
                        vscode.window.showInformationMessage(`Dosya oluşturuldu ve kod uygulandı: ${fileName}`);
                        
                        // Dosyayı aç ve göster
                        const textDocument = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(textDocument);
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Kod uygulanırken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
            }
        })
    );
    
    // İlk çalıştırmada kullanıcıya hoş geldin mesajı göster
    const hasShownWelcome = context.globalState.get<boolean>('hasShownWelcome');
    if (!hasShownWelcome) {
        const message = 'Byte AI Asistanı kuruldu! Sohbet panelini açmak için sol kenar çubuğundaki Byte simgesine tıklayın.';
        const setupNowButton = 'AI Servisini Yapılandır';
        
        vscode.window.showInformationMessage(message, setupNowButton).then(selection => {
            if (selection === setupNowButton) {
                vscode.commands.executeCommand('byte.configureAI');
            }
        });
        
        context.globalState.update('hasShownWelcome', true);
    }
}

// Eklenti devre dışı bırakıldığında çağrılır
export function deactivate() {
    console.log('Byte AI Asistanı devre dışı bırakıldı!');
}