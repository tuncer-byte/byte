import * as vscode from 'vscode';
import { AIService } from './aiService';
import { ChatPanel } from './chatPanel';
import { CommandManager } from './commands';

// Eklenti aktif edildiğinde çağrılır
export function activate(context: vscode.ExtensionContext) {
    console.log('Byte AI Asistanı aktif edildi!');
    
    // AI Servisi oluştur
    const aiService = new AIService(context);
    
    // Sohbet paneli oluştur
    const chatPanel = new ChatPanel(context.extensionUri, aiService);
    
    // WebView paneliyle kaydol
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ChatPanel.viewType,
            chatPanel
        )
    );
    
    // Komut yöneticisi oluştur ve komutları kaydet
    const commandManager = new CommandManager(chatPanel, aiService);
    commandManager.registerCommands(context);
    
    // ChatPanel'e CommandManager'ı bağla (slash komutlarını işleyebilmesi için)
    chatPanel.setCommandManager(commandManager);
    
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