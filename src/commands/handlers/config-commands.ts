import * as vscode from 'vscode';
import { AIService, AIProvider } from '../../services/ai';
import { CommandHandler } from '../types';

/**
 * AI Konfigürasyon işleyicisi
 */
export class ConfigureAIHandler implements CommandHandler {
    constructor(private aiService: AIService) {}
    
    async execute(): Promise<void> {
        // AI sağlayıcı seçimi için Quick Pick
        const provider = await vscode.window.showQuickPick(
            [
                { label: 'OpenAI', description: 'GPT modelleri ile güçlü AI yanıtları' },
                { label: 'Google Gemini', description: 'Google\'ın Gemini AI modelleri' },
                { label: 'Anthropic', description: 'Claude modelleri' },
                { label: 'Yerel Model', description: 'Kendi sunucunuzda çalışan özel AI modeli' }
            ],
            {
                placeHolder: 'AI sağlayıcısını seçin',
                ignoreFocusOut: true
            }
        );
        
        if (!provider) {
            return;
        }
        
        // Seçilen sağlayıcıya göre yapılandırma penceresi göster
        switch (provider.label) {
            case 'OpenAI':
                const openaiKey = await vscode.window.showInputBox({
                    prompt: 'OpenAI API anahtarınızı girin',
                    password: true,
                    ignoreFocusOut: true,
                    placeHolder: 'sk-...'
                });
                
                if (openaiKey) {
                    await this.aiService.setOpenAIApiKey(openaiKey);
                    this.aiService.setProvider(AIProvider.OpenAI);
                    vscode.window.showInformationMessage('OpenAI yapılandırması tamamlandı.');
                }
                break;
                
            case 'Google Gemini':
                const geminiKey = await vscode.window.showInputBox({
                    prompt: 'Google Gemini API anahtarınızı girin',
                    password: true,
                    ignoreFocusOut: true
                });
                
                if (geminiKey) {
                    await this.aiService.setGeminiApiKey(geminiKey);
                    this.aiService.setProvider(AIProvider.Gemini);
                    vscode.window.showInformationMessage('Google Gemini yapılandırması tamamlandı.');
                }
                break;
                
            case 'Anthropic':
                const anthropicKey = await vscode.window.showInputBox({
                    prompt: 'Anthropic API anahtarınızı girin',
                    password: true,
                    ignoreFocusOut: true,
                    placeHolder: 'sk-ant-...'
                });
                
                if (anthropicKey) {
                    await this.aiService.setAnthropicApiKey(anthropicKey);
                    this.aiService.setProvider(AIProvider.Anthropic);
                    vscode.window.showInformationMessage('Anthropic yapılandırması tamamlandı.');
                }
                break;
                
            case 'Yerel Model':
                const localEndpoint = await vscode.window.showInputBox({
                    prompt: 'Yerel AI servis endpoint URL\'inizi girin',
                    value: vscode.workspace.getConfiguration('byte').get<string>('local.endpoint') || 'http://localhost:11434/api/generate',
                    ignoreFocusOut: true
                });
                
                const localModel = await vscode.window.showInputBox({
                    prompt: 'Kullanmak istediğiniz model adını girin',
                    value: vscode.workspace.getConfiguration('byte').get<string>('local.model') || 'llama3',
                    ignoreFocusOut: true
                });
                
                if (localEndpoint) {
                    await vscode.workspace.getConfiguration('byte').update('local.endpoint', localEndpoint, vscode.ConfigurationTarget.Global);
                    
                    if (localModel) {
                        await vscode.workspace.getConfiguration('byte').update('local.model', localModel, vscode.ConfigurationTarget.Global);
                    }
                    
                    this.aiService.setProvider(AIProvider.Local);
                    vscode.window.showInformationMessage('Yerel model yapılandırması tamamlandı.');
                }
                break;
        }
    }
} 