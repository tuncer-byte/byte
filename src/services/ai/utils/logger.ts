import * as vscode from 'vscode';

/**
 * AI servisi için loglama yardımcı sınıfı
 */
export class AILogger {
    private outputChannel: vscode.OutputChannel;
    
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel("Byte AI");
    }
    
    /**
     * Log mesajı oluşturur
     * @param message Log mesajı
     * @param error Hata durumu 
     */
    public log(message: string, error: boolean = false): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        
        this.outputChannel.appendLine(logMessage);
        
        if (error) {
            console.error(logMessage);
        } else {
            console.log(logMessage);
        }
    }
} 