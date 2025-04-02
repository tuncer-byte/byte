import * as vscode from 'vscode';
import { AIService } from '../../services/ai';
import { CommandManager } from '../../commands';

/**
 * Chat panel tipleri
 */
export interface ChatPanelState {
    agentEnabled: boolean;
    currentFile: string;
}

/**
 * WebView mesaj tipleri
 */
export interface WebViewMessage {
    type: string;
    [key: string]: any;
}

/**
 * Ayarlar mesajı durumları
 */
export type SettingsMessageStatus = 'success' | 'error' | 'info';

/**
 * Sohbet paneli için WebView sağlayıcı arayüzü
 */
export interface ChatPanelProvider extends vscode.WebviewViewProvider {
    setCommandManager(commandManager: CommandManager): void;
    isAgentEnabled(): boolean;
    dispose(): void;
}

/**
 * Slash Komut işleyici fonksiyon tipi
 */
export type SlashCommandHandler = (
    command: string, 
    parts: string[], 
    selectedText: string, 
    aiService: AIService, 
    view?: vscode.WebviewView
) => Promise<boolean>; 