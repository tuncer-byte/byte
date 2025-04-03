import * as vscode from 'vscode';
import * as path from 'path';
import { AIService } from './services/ai';
import { InlineCodeChat } from './views/inline-chat';
import { CommandManager } from './commands';
import { ChatPanel } from './views/chat';
import { ByteAIClient } from './client';
import { InlineChatPanel } from './inlineChat';

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
    
    // Sohbet paneli oluştur
    const chatPanel = new ChatPanel(context.extensionUri, aiService);
    
    // Inline Kod Analizi oluştur
    const inlineCodeChat = new InlineCodeChat(context.extensionUri, aiService);
    
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
            InlineChatPanel.createOrShow(context.extensionUri, byteClient);
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