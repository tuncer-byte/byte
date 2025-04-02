import * as vscode from 'vscode';
import { CodeCommandParams, CodeCommandResult } from '../types';

/**
 * Editördeki seçili kodu alır
 */
export async function getSelectedCode(): Promise<CodeCommandParams | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Lütfen bir editör açın ve kod seçin.');
        return null;
    }
    
    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showWarningMessage('Lütfen işlem yapmak istediğiniz kodu seçin.');
        return null;
    }
    
    const code = editor.document.getText(selection);
    if (!code.trim()) {
        vscode.window.showWarningMessage('Seçili kod boş görünüyor.');
        return null;
    }
    
    return {
        code,
        languageId: editor.document.languageId,
        fileName: editor.document.fileName.split(/[\\/]/).pop()
    };
}

/**
 * İşlem sonucunu gösterir ve kullanıcıya seçenekler sunar
 */
export async function handleCommandResult(
    result: CodeCommandResult, 
    editor?: vscode.TextEditor, 
    selection?: vscode.Selection
): Promise<void> {
    if (!result.success || !result.content) {
        vscode.window.showErrorMessage(result.error || 'İşlem sırasında bir hata oluştu.');
        return;
    }

    // Kullanıcıya sonucu ne yapacağını sor
    const action = await vscode.window.showInformationMessage(
        'İşlem başarılı. Ne yapmak istersiniz?',
        'Mevcut Kodu Değiştir',
        'Yeni Dosyada Göster'
    );
    
    if (action === 'Mevcut Kodu Değiştir' && editor && selection) {
        // Seçili kodu düzenlenmiş kod ile değiştir
        await editor.edit(editBuilder => {
            editBuilder.replace(selection, extractCodeFromResponse(result.content || ''));
        });
        
        vscode.window.showInformationMessage('Kod başarıyla güncellendi.');
    } else if (action === 'Yeni Dosyada Göster' || !editor || !selection) {
        // Yeni dosyada göster
        const languageId = editor ? editor.document.languageId : 'plaintext';
        const doc = await vscode.workspace.openTextDocument({
            content: result.content,
            language: languageId
        });
        
        await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
    }
}

/**
 * Yanıttan kod parçasını çıkarır
 */
export function extractCodeFromResponse(response: string): string {
    // Markdown kod blokları içindeki kodu çıkarma
    const codeBlockRegex = /```(?:\w+)?\s*\n([\s\S]*?)\n```/g;
    const matches = [...response.matchAll(codeBlockRegex)];
    
    if (matches.length > 0) {
        // İlk kod bloğunu alıyoruz
        return matches[0][1].trim();
    }
    
    // Kod bloğu bulunamadıysa, yanıtın kendisini döndür
    return response.trim();
}

/**
 * İlerleme bildirimi ile işlem yapar
 */
export async function withProgressNotification<T>(
    title: string, 
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
): Promise<T> {
    const progressOptions: vscode.ProgressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: title,
        cancellable: false
    };
    
    return vscode.window.withProgress(progressOptions, task);
} 