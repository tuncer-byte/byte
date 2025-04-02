import * as vscode from 'vscode';
import { AIService } from '../services/ai';
import { ChatPanelProvider } from '../views/chat/types';

/**
 * Komut yöneticisi arabirimi
 */
export interface CommandManagerProvider {
    registerCommands(context: vscode.ExtensionContext): void;
}

/**
 * Komut işleyici arabirimi
 */
export interface CommandHandler {
    execute(context?: any): Promise<void>;
}

/**
 * Kod komut işleyici seçenekleri
 */
export interface CodeCommandOptions {
    title: string;
    successMessage: string;
    errorMessage: string;
    promptTemplate?: string;
}

/**
 * Kod komutları için parametre arabirimi
 */
export interface CodeCommandParams {
    code: string;
    languageId: string;
    fileName?: string;
}

/**
 * Kod komutları için sonuç arabirimi
 */
export interface CodeCommandResult {
    success: boolean;
    content?: string;
    error?: string;
} 