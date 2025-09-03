import { GoogleGenAI } from "@google/genai";
import { GdmLiveAudioVisuals } from './visual';
import { gsap } from 'gsap';

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
    private currentMode = 'gemini';
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private visualizerElement: GdmLiveAudioVisuals | null = null;
    private analyserNode: AnalyserNode | null = null;
    private audioDataArray: Uint8Array | null = null;
    private animationFrameId: number | null = null;
    private isAudioReactive = false;

    // SVG Visualizer properties
    private coreAnimation: gsap.core.Timeline | null = null;
    private colorRadios: NodeListOf<HTMLInputElement>;
    private speedRadios: NodeListOf<HTMLInputElement>;
    private lightningDelayedCall: gsap.core.Tween | null = null;
    private svgCoreElements: Element[] = [];
    private svgShards: Element[] = [];
    private lightningElement: SVGElement | null = null;

    constructor() {
        this.sidebarButtons = document.querySelectorAll('.sidebar-button');
        this.contentPanels = document.querySelectorAll('.content-panel');
        this.logContent = document.getElementById('log-content')!;
        this.geminiRunBtn = document.getElementById('gemini-run') as HTMLButtonElement;
        this.geminiPrompt = document.getElementById('gemini-prompt') as HTMLTextAreaElement;
        this.geminiResponse = document.getElementById('gemini-response')!;
        this.executeButtons = document.querySelectorAll('.execute-btn');
        this.colorRadios = document.querySelectorAll('input[name="color"]');
        this.speedRadios = document.querySelectorAll('input[name="speed"]');
        
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
        this.initSvgVisuals();
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

        this.colorRadios.forEach(radio => radio.addEventListener('change', this.handleColorChange.bind(this)));
        this.speedRadios.forEach(radio => radio.addEventListener('change', this.handleSpeedChange.bind(this)));
    }
    
    private clearLog() {
        this.logContent.innerHTML = '';
    }

    private switchMode(mode: string) {
        if (this.currentMode === mode) return;

        // Stop audio stream if switching away from visualizer
        if (this.currentMode === 'visualizer' && this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
            this.log('info', 'Microphone stream stopped.');
            this.stopSvgAudioReaction();
        }

        this.log('info', `Switching to mode: ${mode}`);
        this.currentMode = mode;
        
        this.sidebarButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.mode === mode);
        });

        this.contentPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${mode}`);
        });

        if (mode === 'visualizer') {
            this.initAudioVisualizer();
        }
    }

    private async initAudioVisualizer() {
        if (this.mediaStream) return; // Already initialized

        this.visualizerElement = document.querySelector('gdm-live-audio-visuals');
        if (!this.visualizerElement) {
            this.log('error', 'Audio visualizer component not found.');
            return;
        }

        try {
            this.log('info', 'Requesting microphone access...');
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.log('success', 'Microphone access granted.');

            if (!this.audioContext) {
                this.audioContext = new AudioContext();
            }
            
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            
            // Setup analyser for SVG reaction
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 128;
            const bufferLength = this.analyserNode.frequencyBinCount;
            this.audioDataArray = new Uint8Array(bufferLength);
            source.connect(this.analyserNode);

            // Create a muted gain node to avoid feedback, as we only want to visualize
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0;
            this.analyserNode.connect(gainNode); // Connect analyser to gain
            gainNode.connect(this.audioContext.destination);

            this.visualizerElement.inputNode = source;
            this.visualizerElement.outputNode = gainNode;

            this.startSvgAudioReaction();

        } catch (err) {
            const errorMessage = `Could not get microphone access: ${err.message}`;
            this.log('error', errorMessage);
            const visualizerContainer = document.getElementById('visualizer-container');
            if(visualizerContainer) {
                visualizerContainer.innerHTML = `<p style="color: var(--accent-color-red);">${errorMessage}. Please allow access in browser settings.</p>`;
            }
        }
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

    private initSvgVisuals() {
        this.svgCoreElements = gsap.utils.toArray('.svg-core-element');
        this.svgShards = gsap.utils.toArray('.svg-shard');
        // FIX: Cast to 'unknown' first to resolve the SVGElement conversion error.
        this.lightningElement = document.getElementById('lightning') as unknown as SVGElement | null;

        gsap.set(this.svgShards, {
            transformOrigin: '50% 50%'
        });

        this.coreAnimation = gsap.timeline({ repeat: -1, yoyo: true });
        this.coreAnimation
            .to(this.svgCoreElements, {
                opacity: 0.7,
                duration: 2,
                stagger: 0.2,
                ease: 'power1.inOut'
            })
            .to(this.svgShards, {
                rotation: () => gsap.utils.random(-20, 20),
                x: () => gsap.utils.random(-10, 10),
                y: () => gsap.utils.random(-10, 10),
                opacity: 0.8,
                duration: 4,
                ease: 'power1.inOut'
            }, "<");

        this.triggerLightning();
    }

    private triggerLightning() {
        if (!this.lightningElement) return;
        const startPoint = { x: gsap.utils.random(50, 430), y: gsap.utils.random(50, 250) };
        const endPoint = { x: gsap.utils.random(50, 430), y: gsap.utils.random(50, 250) };
        let points = `${startPoint.x},${startPoint.y} `;
        const segments = gsap.utils.random(3, 6);
        for(let i=0; i < segments; i++) {
            points += `${gsap.utils.random(startPoint.x, endPoint.x)},${gsap.utils.random(startPoint.y, endPoint.y)} `
        }
        points += `${endPoint.x},${endPoint.y}`;

        this.lightningElement.setAttribute('points', points);
        
        gsap.fromTo(this.lightningElement, 
            { opacity: 1, strokeWidth: gsap.utils.random(1, 2.5) }, 
            {
                opacity: 0,
                duration: 0.5,
                ease: 'power2.out',
            }
        );

        if (!this.isAudioReactive) {
            this.lightningDelayedCall = gsap.delayedCall(gsap.utils.random(1, 4), () => this.triggerLightning());
        }
    }

    private startSvgAudioReaction() {
        this.isAudioReactive = true;
        if (this.lightningDelayedCall) {
            this.lightningDelayedCall.kill();
            this.lightningDelayedCall = null;
        }
        this.animationFrameId = requestAnimationFrame(() => this.updateSvgVisualsWithAudio());
    }

    private stopSvgAudioReaction() {
        this.isAudioReactive = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        const speedRadio = document.querySelector('input[name="speed"]:checked') as HTMLInputElement;
        const baseSpeed = speedRadio ? parseFloat(speedRadio.value) : 1;
        
        if (this.coreAnimation) {
            gsap.to(this.coreAnimation, { timeScale: baseSpeed, duration: 0.5 });
        }

        gsap.to([...this.svgCoreElements, ...this.svgShards], {
            scale: 1,
            duration: 0.5,
            ease: 'power1.out'
        });
        
        this.triggerLightning();
    }

    private updateSvgVisualsWithAudio() {
        if (!this.analyserNode || !this.audioDataArray || !this.isAudioReactive) return;

        this.analyserNode.getByteFrequencyData(this.audioDataArray);
        
        const averageVolume = this.audioDataArray.reduce((sum, value) => sum + value, 0) / this.audioDataArray.length;
        const normalizedVolume = averageVolume / 128.0;

        const bassFreqRange = Math.floor(this.audioDataArray.length * 0.2);
        const bass = this.audioDataArray.slice(0, bassFreqRange).reduce((s, v) => s + v, 0) / bassFreqRange || 0;
        const normalizedBass = bass / 128.0;

        const trebleFreqRange = this.audioDataArray.length - Math.floor(this.audioDataArray.length * 0.6);
        const treble = this.audioDataArray.slice(Math.floor(this.audioDataArray.length * 0.6)).reduce((s, v) => s + v, 0) / trebleFreqRange || 0;
        const normalizedTreble = treble / 128.0;
        
        if (this.coreAnimation) {
            const speedRadio = document.querySelector('input[name="speed"]:checked') as HTMLInputElement;
            const baseSpeed = speedRadio ? parseFloat(speedRadio.value) : 1;
            this.coreAnimation.timeScale(baseSpeed + normalizedVolume * 2);
        }

        gsap.to(this.svgCoreElements, {
            scale: 1 + normalizedBass * 0.25,
            duration: 0.05,
            ease: 'power1.out',
            transformOrigin: '50% 50%'
        });
        
        gsap.to(this.svgShards, {
            scale: 1 + normalizedVolume * 0.15,
            duration: 0.05,
            ease: 'power1.out'
        });

        if (this.lightningElement && normalizedTreble > 0.6 && Math.random() > 0.5) {
            this.triggerLightning();
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.updateSvgVisualsWithAudio());
    }

    private handleColorChange(e: Event) {
        const target = e.target as HTMLInputElement;
        const color = target.value;
        let hexColor, rgbaFill;

        switch (color) {
            case 'magenta':
                hexColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color-magenta').trim();
                break;
            case 'green':
                hexColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color-green').trim();
                break;
            default: // cyan
                hexColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color-cyan').trim();
        }

        rgbaFill = `rgba(${parseInt(hexColor.slice(1,3), 16)}, ${parseInt(hexColor.slice(3,5), 16)}, ${parseInt(hexColor.slice(5,7), 16)}, 0.3)`;

        gsap.to('.svg-core-element, .svg-shard', {
            stroke: hexColor,
            duration: 0.5
        });
        gsap.to('.svg-core-element, .svg-shard', {
            fill: rgbaFill,
            duration: 0.5
        });
    }

    private handleSpeedChange(e: Event) {
        if (!this.coreAnimation) return;
        const target = e.target as HTMLInputElement;
        const speed = parseFloat(target.value);
        if (!this.isAudioReactive) {
            gsap.to(this.coreAnimation, { timeScale: speed, duration: 0.5 });
        }
    }

}

document.addEventListener('DOMContentLoaded', () => {
    new AiGuiApp();
});