import * as vscode from 'vscode';
import { ChatPanelProvider } from '../views/chat/types';
import { AIService } from '../services/ai';
import { CommandManagerProvider } from './types';
import { ExplainCodeHandler, GenerateDocsHandler, RefactorCodeHandler } from './handlers/code-commands';
import { ConfigureAIHandler } from './handlers/config-commands';
import { AddCommentsHandler, FindIssuesHandler, GenerateTestsHandler, OptimizeCodeHandler } from './handlers/advanced-code-commands';

/**
 * Eklenti komutlarını yöneten ana sınıf
 */
export class CommandManager implements CommandManagerProvider {
    private explainCodeHandler: ExplainCodeHandler;
    private refactorCodeHandler: RefactorCodeHandler;
    private generateDocsHandler: GenerateDocsHandler;
    private configureAIHandler: ConfigureAIHandler;
    private optimizeCodeHandler: OptimizeCodeHandler;
    private addCommentsHandler: AddCommentsHandler;
    private findIssuesHandler: FindIssuesHandler;
    private generateTestsHandler: GenerateTestsHandler;
    
    constructor(
        private chatPanel: ChatPanelProvider,
        private aiService: AIService
    ) {
        // Komut işleyicileri oluştur
        this.explainCodeHandler = new ExplainCodeHandler(aiService);
        this.refactorCodeHandler = new RefactorCodeHandler(aiService);
        this.generateDocsHandler = new GenerateDocsHandler(aiService);
        this.configureAIHandler = new ConfigureAIHandler(aiService);
        this.optimizeCodeHandler = new OptimizeCodeHandler(aiService);
        this.addCommentsHandler = new AddCommentsHandler(aiService);
        this.findIssuesHandler = new FindIssuesHandler(aiService);
        this.generateTestsHandler = new GenerateTestsHandler(aiService);
    }
    
    /**
     * Tüm komutları kaydeder
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        // Sohbet panelini açma komutu
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.openChat', () => {
                vscode.commands.executeCommand('workbench.view.extension.ai-assistant');
            })
        );
        
        // Kod işleme komutları
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.explainCode', async () => {
                await this.explainCodeHandler.execute();
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.refactorCode', async () => {
                await this.refactorCodeHandler.execute();
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.generateDocs', async () => {
                await this.generateDocsHandler.execute();
            })
        );
        
        // AI yapılandırma komutu
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.configureAI', async () => {
                await this.configureAIHandler.execute();
            })
        );
        
        // Gelişmiş kod işleme komutları
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.optimizeCode', async () => {
                await this.optimizeCodeHandler.execute();
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.addComments', async () => {
                await this.addCommentsHandler.execute();
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.findIssues', async () => {
                await this.findIssuesHandler.execute();
            })
        );
        
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.generateTests', async () => {
                await this.generateTestsHandler.execute();
            })
        );
    }
}

export * from './types'; 