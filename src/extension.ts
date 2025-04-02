import * as vscode from 'vscode';
import { AIService } from './aiService';
import { ChatPanel } from './chatPanel';
import { CommandManager } from './commands';
import { InlineCodeChat } from './inlineCodeChat';


// Eklenti aktif edildiğinde çağrılır
export function activate(context: vscode.ExtensionContext) {
    console.log('Byte AI Asistanı aktif edildi!');
    
    // Ayarları oku
    const configuration = vscode.workspace.getConfiguration('byte');
    const provider = configuration.get<string>('provider') || 'openai';
    
    // AI Servisi oluştur
    const aiService = new AIService(context);
    
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
    
    // Terminal komutu çalıştırma özelliği ekle
    context.subscriptions.push(
        vscode.commands.registerCommand('byte.runInTerminal', (command: string) => {
            const terminal = vscode.window.createTerminal('Byte AI Terminal');
            terminal.show();
            terminal.sendText(command);
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