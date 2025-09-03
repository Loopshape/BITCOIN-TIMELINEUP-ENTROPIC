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