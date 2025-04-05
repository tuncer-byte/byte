import * as vscode from 'vscode';

/**
 * Hata tipi
 */
export enum ErrorType {
    Syntax = 'syntax',
    Runtime = 'runtime',
    Compilation = 'compilation',
    Dependency = 'dependency',
    Configuration = 'configuration',
    Unknown = 'unknown'
}

/**
 * Hata çözüm metodu
 */
export enum SolutionType {
    QuickFix = 'quickFix',
    CodeChange = 'codeChange',
    Installation = 'installation',
    Configuration = 'configuration',
    Explanation = 'explanation'
}

/**
 * Tespit edilen hata
 */
export interface DetectedError {
    message: string;
    errorType: ErrorType;
    stack?: string;
    relatedFiles?: string[];
    lineNumber?: number;
    columnNumber?: number;
    source?: string;
}

/**
 * Hata çözümü
 */
export interface ErrorSolution {
    type: SolutionType;
    description: string;
    codeChanges?: {
        fileName: string;
        changes: {
            range: vscode.Range;
            replacementText: string;
        }[];
    }[];
    commandToRun?: string;
    packageToInstall?: string;
    configChanges?: {
        file: string;
        changes: {
            key: string;
            value: any;
        }[];
    }[];
}

/**
 * Bug finder servisinin durumu
 */
export interface BugFinderState {
    lastErrors: DetectedError[];
    errorHistory: {
        timestamp: number;
        error: DetectedError;
        solution?: ErrorSolution;
    }[];
    isMonitoring: boolean;
} 