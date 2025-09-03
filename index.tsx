import { GoogleGenAI } from "@google/genai";

class AiGuiApp {
    private sidebarButtons: NodeListOf<HTMLButtonElement>;
    private contentPanels: NodeListOf<HTMLDivElement>;
    private logContent: HTMLElement;
    private geminiRunBtn: HTMLButtonElement;
    private geminiPrompt: HTMLTextAreaElement;
    private geminiResponse: HTMLElement;
    private executeButtons: NodeListOf<HTMLButtonElement>;
    
    private ai: GoogleGenAI | null = null;
    private isLoading = false;

    constructor() {
        this.sidebarButtons = document.querySelectorAll('.sidebar-button');
        this.contentPanels = document.querySelectorAll('.content-panel');
        this.logContent = document.getElementById('log-content')!;
        this.geminiRunBtn = document.getElementById('gemini-run') as HTMLButtonElement;
        this.geminiPrompt = document.getElementById('gemini-prompt') as HTMLTextAreaElement;
        this.geminiResponse = document.getElementById('gemini-response')!;
        this.executeButtons = document.querySelectorAll('.execute-btn');
        
        this.init();
    }

    private init() {
        this.log('info', 'AI Core Engine GUI Initialized.');
        try {
            this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            this.log('success', 'Gemini API client initialized successfully.');
        } catch (error) {
            this.log('error', `Failed to initialize Gemini API: ${error.message}`);
            this.geminiRunBtn.disabled = true;
            this.geminiPrompt.disabled = true;
            this.geminiPrompt.placeholder = "Gemini API key is missing or invalid.";
        }
        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.sidebarButtons.forEach(button => {
            button.addEventListener('click', () => this.switchMode(button.dataset.mode!));
        });

        this.geminiRunBtn.addEventListener('click', () => this.runGeminiPrompt());

        this.executeButtons.forEach(button => {
            button.addEventListener('click', () => this.simulateAction(button.dataset.action!));
        });

        document.getElementById('clear-log-btn')!.addEventListener('click', () => this.clearLog());
    }
    
    private clearLog() {
        this.logContent.innerHTML = '';
    }

    private switchMode(mode: string) {
        this.log('info', `Switching to mode: ${mode}`);
        
        this.sidebarButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.mode === mode);
        });

        this.contentPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${mode}`);
        });
    }

    private log(type: 'info' | 'success' | 'warn' | 'error', message: string) {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = message;
        this.logContent.appendChild(entry);
        this.logContent.scrollTop = this.logContent.scrollHeight;
    }

    private async runGeminiPrompt() {
        if (!this.ai || this.isLoading) return;

        const prompt = this.geminiPrompt.value.trim();
        if (!prompt) {
            this.log('warn', 'Prompt is empty. Please enter a prompt.');
            return;
        }

        this.log('info', `Executing prompt on gemini-2.5-flash...`);
        this.isLoading = true;
        this.geminiRunBtn.disabled = true;
        this.geminiResponse.textContent = '';

        try {
            const responseStream = await this.ai.models.generateContentStream({
                model: "gemini-2.5-flash",
                contents: prompt,
            });

            for await (const chunk of responseStream) {
                this.geminiResponse.textContent += chunk.text;
            }
            this.log('success', 'Gemini prompt executed successfully.');

        } catch (error) {
            const errorMessage = `Error executing Gemini prompt: ${error.message}`;
            this.log('error', errorMessage);
            this.geminiResponse.textContent = errorMessage;
        } finally {
            this.isLoading = false;
            this.geminiRunBtn.disabled = false;
        }
    }

    private simulateAction(action: string) {
        this.log('info', `Simulating action: ${action}`);
        switch(action) {
            case 'file':
                const filePath = (document.getElementById('file-input') as HTMLInputElement).value || '/path/to/dummy.txt';
                this.log('info', `Processing file: ${filePath}`);
                this.log('info', `Backup created for ${filePath}`);
                this.log('success', `File processing complete for ${filePath}`);
                break;
            case 'batch':
                const pattern = (document.getElementById('batch-input') as HTMLInputElement).value || '*.log';
                this.log('info', `Batch processing files with pattern: ${pattern}`);
                this.log('success', `Batch processing complete.`);
                break;
            case 'pipeline':
                const pipelineInput = (document.getElementById('pipeline-input') as HTMLInputElement).value || 'https://example.com:dummy.log';
                this.log('info', `Running pipeline for: ${pipelineInput}`);
                this.log('success', `Pipeline execution complete.`);
                break;
            case 'env':
                 const envOutput = document.getElementById('env-output')!;
                 envOutput.textContent = `Scanning environment...\n\nUSER=dev\nHOME=/home/dev\nSHELL=/bin/bash\nTERM=xterm-256color\n\nDisk Usage:\nFilesystem   Size  Used Avail Use% Mounted on\n/dev/sda1    100G   20G   80G  20% /\n\nScan complete.`;
                 this.log('success', 'Environment scan complete.');
                break;
            case 'agi':
                const folder = (document.getElementById('agi-folder') as HTMLInputElement).value || '/var/log';
                this.log('info', `Watching folder ${folder} for changes...`);
                this.log('warn', 'AGI Watcher is a simulation. No real file monitoring is active.');
                break;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AiGuiApp();
});
