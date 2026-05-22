import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BLOG_POSTS } from './blogData';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const getApiKey = () => {
  try { const k = import.meta.env.VITE_GROQ_API_KEY; if (k) return k; } catch (e) {}
  try { if (typeof process !== 'undefined' && process.env) return process.env.REACT_APP_GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || ''; } catch (e) {}
  return '';
};

const GROQ_API_KEY = getApiKey();
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_WORDS = 300;

// ── MODELS ───────────────────────────────────────────────────────────────────
const MODELS = [
  { id: 'openai/gpt-oss-120b',           label: 'GPT-OSS 120B',  sub: 'OpenAI · High reasoning · Default', badge: 'DEFAULT' },
  { id: 'llama3-70b-8192',               label: 'Llama 3 70B',   sub: 'Ultra-fast · Great all-rounder',    badge: 'FAST'    },
  { id: 'mixtral-8x7b-32768',            label: 'Mixtral 8x7B',  sub: 'High context window · 32k tokens',  badge: 'HIGH CTX'},
  { id: 'llama-3.1-8b-instant',          label: 'Llama 3.1 8B',  sub: 'Fastest · Good for quick drafts',   badge: 'QUICK'   },
  { id: 'gemma2-9b-it',                  label: 'Gemma 2 9B',    sub: 'Google · Instruction-tuned',        badge: 'GOOGLE'  },
  { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1',   sub: 'Reasoning specialist · Slower',     badge: 'REASON'  },
];

// Output display styles per model
const MODEL_OUTPUT_STYLES = {
  'openai/gpt-oss-120b': {
    name: 'GPT-OSS Premium',
    desc: 'Clean, spacious layout with generous line-height — GPT\'s signature readable style.',
    css: `.output-text { font-size: 15.5px; line-height: 1.85; letter-spacing: 0.01em; color: var(--text-primary); font-family: 'Montserrat', sans-serif; } .output-text strong { color: var(--accent); font-weight: 700; }`,
  },
  'llama3-70b-8192': {
    name: 'Llama Technical',
    desc: 'Monospace-accented, compact — reflects Llama\'s developer-focused character.',
    css: `.output-text { font-size: 14.5px; line-height: 1.7; font-family: 'Courier New', monospace; color: var(--text-primary); letter-spacing: -0.01em; } .output-text strong { color: #7dd3fc; font-weight: 700; }`,
  },
  'mixtral-8x7b-32768': {
    name: 'Mixtral Academic',
    desc: 'Wider prose width, academic serif feel — mirrors Mixtral\'s long-context, research-oriented nature.',
    css: `.output-text { font-size: 15px; line-height: 2; letter-spacing: 0.02em; color: var(--text-primary); font-family: Georgia, 'Times New Roman', serif; } .output-text strong { color: var(--accent); font-weight: 700; border-bottom: 1px solid rgba(211,184,154,0.3); }`,
  },
  'llama-3.1-8b-instant': {
    name: 'Llama Compact',
    desc: 'Dense and efficient — built for speed, matching the 8B model\'s quick, direct output style.',
    css: `.output-text { font-size: 13.5px; line-height: 1.55; letter-spacing: 0; color: var(--text-primary); font-family: 'Montserrat', sans-serif; } .output-text strong { color: var(--accent); font-weight: 700; }`,
  },
  'gemma2-9b-it': {
    name: 'Gemma Clean',
    desc: 'Google-inspired minimal style — crisp, light, and airy with subtle blue tones.',
    css: `.output-text { font-size: 15px; line-height: 1.8; letter-spacing: 0.015em; color: var(--text-primary); font-family: 'Montserrat', sans-serif; } .output-text strong { color: #60a5fa; font-weight: 600; }`,
  },
  'deepseek-r1-distill-llama-70b': {
    name: 'DeepSeek Reasoning',
    desc: 'Structured, numbered-list heavy — mirrors DeepSeek\'s methodical chain-of-thought style.',
    css: `.output-text { font-size: 14px; line-height: 1.75; letter-spacing: 0; color: var(--text-primary); font-family: 'Montserrat', sans-serif; } .output-text strong { color: #a78bfa; font-weight: 700; background: rgba(167,139,250,0.08); padding: 0 3px; border-radius: 3px; }`,
  },
};

// ── USE CASES ─────────────────────────────────────────────────────────────────
const USE_CASES = [
  { id: 'automatic',  label: 'Automatic',       icon: '◈', desc: 'Let the AI decide the best structure for your prompt.' },
  { id: 'code',       label: 'Code',             icon: '⌨', desc: 'Optimized for programming, debugging, and technical tasks.' },
  { id: 'reasoning',  label: 'Reasoning',        icon: '◎', desc: 'Best for logic, analysis, research, and problem-solving.' },
  { id: 'creative',   label: 'Creative',         icon: '✦', desc: 'Tuned for storytelling, writing, and creative generation.' },
  { id: 'strict',     label: 'Strictest Output', icon: '▣', desc: 'Maximum constraints — zero ambiguity, rigid format mandates.' },
];

const USE_CASE_ADDITIONS = {
  automatic: '',
  code: '\n\n## USE CASE: CODE\nPrioritize technical precision. Include language specification, edge case handling, error handling requirements, and expected I/O format. Format code blocks with proper syntax specification.',
  reasoning: '\n\n## USE CASE: REASONING\nStructure for step-by-step analytical thinking. Require the model to show its reasoning chain, validate assumptions, and present a final synthesized conclusion.',
  creative: '\n\n## USE CASE: CREATIVE\nEmphasize tone, voice, narrative arc, emotional resonance, and stylistic freedom. Include mood descriptors and allow model latitude on structure.',
  strict: '\n\n## USE CASE: STRICTEST OUTPUT\nApply absolute maximum constraint density. Explicit DO and DO NOT lists. Hard character/word counts. Exact section names. Failure conditions explicitly stated. Zero creative interpretation allowed.',
};

const OUTPUT_LENGTH_TOKENS = { compact: 1024, standard: 2048, detailed: 4096, exhaustive: 8192 };

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
const buildSystemPrompt = (style, strictness, useCase, expectedOutput) => `
You are a world-class Prompt Architect — a specialist who transforms vague user instructions into precision-engineered prompts used by Fortune 500 AI teams and leading researchers. Your rewrites are deployed in production systems that demand zero ambiguity, maximal model compliance, and consistently elite output.

## YOUR OBJECTIVE
Transform the user's raw input into a fully structured, production-ready prompt using the "${style}" framework at ${strictness}% constraint strength.
${expectedOutput ? `\n## EXPECTED OUTPUT CONTEXT\nThe user has described their expected output as follows — use this to calibrate precision, format, and scope:\n${expectedOutput}\n` : ''}
## FRAMEWORK SPECIFICATIONS

### "Structured" → Role / Context / Task / Constraints / Output Format
- Open with a clear ROLE declaration that primes the model's persona and expertise level
- Provide rich CONTEXT: domain, audience, tone register, and any implicit assumptions made explicit
- State the TASK with surgical precision — one primary directive, zero ambiguity
- List hard CONSTRAINTS (what to include, what to exclude, length, format, style, language level)
- Define the exact OUTPUT FORMAT the model should produce (sections, length, structure, examples if needed)

### "Conversational" → Chain-of-Thought Scaffolding
- Instruct the model to reason step-by-step before producing any output
- Break the task into numbered reasoning phases
- Include explicit checkpoints ("Before answering, verify that…")
- End with a synthesis directive to consolidate the chain into a final answer

### "Few-Shot" → In-Context Learning with Dynamic Placeholders
- Include 2–3 concise input→output example pairs that demonstrate the desired pattern
- Use [PLACEHOLDER] tokens to mark dynamic injection points
- Make the pattern and variance between examples instructive, not redundant
- End with the actual task formatted to match the demonstrated pattern

## CONSTRAINT CALIBRATION (${strictness}% strictness)
${strictness >= 80
  ? '- Apply maximum constraint density: explicit DO and DO NOT directives, hard word/section limits, format mandates, and failure conditions'
  : strictness >= 50
  ? '- Apply moderate constraints: clear boundaries with room for model judgment on stylistic choices'
  : '- Apply light-touch guidance: directional constraints only, preserve model creative latitude'}
${USE_CASE_ADDITIONS[useCase] || ''}

## OUTPUT RULES (NON-NEGOTIABLE)
- Output ONLY the final optimized prompt — no preamble, no meta-commentary, no explanation
- Use clean Markdown: headers (##), bold (**key terms**), bullet lists for constraints, code blocks for format specs
- Every line must earn its place — cut filler, maximize signal density
- The prompt must be self-contained: a model with zero prior context should execute it flawlessly
- Aim for the quality bar of prompts used in OpenAI's system cards and Anthropic's red-teaming evaluations
`.trim();

// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────
const LS = {
  history: 'po_history', settings: 'po_settings', useCase: 'po_useCase',
  outputLength: 'po_outputLength', isDark: 'po_isDark',
};
const lsGet = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const lsSet = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

// ── BLOG RENDERER ─────────────────────────────────────────────────────────────
function formatInline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="blog-inline-code">$1</code>');
}

function renderBlogContent(content) {
  const lines = content.split('\n');
  const elements = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('## ')) { elements.push(<h2 key={key++} className="blog-post-h2">{line.slice(3)}</h2>); }
    else if (line.startsWith('### ')) { elements.push(<h3 key={key++} className="blog-post-h3">{line.slice(4)}</h3>); }
    else if (line === '---') { elements.push(<hr key={key++} className="blog-post-hr" />); }
    else if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(<pre key={key++} className="blog-post-pre"><code>{codeLines.join('\n')}</code></pre>);
    } else if (line.startsWith('- ')) {
      const items = [line.slice(2)];
      while (i + 1 < lines.length && lines[i + 1].startsWith('- ')) { i++; items.push(lines[i].slice(2)); }
      elements.push(<ul key={key++} className="blog-post-ul">{items.map((item, idx) => <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />)}</ul>);
    } else if (line.trim() !== '') {
      elements.push(<p key={key++} className="blog-post-p" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />);
    }
    i++;
  }
  return elements;
}

// ── AI SHORTCUTS ──────────────────────────────────────────────────────────────
const AI_SHORTCUTS = [
  { name: 'Claude',    url: 'https://claude.ai',            favicon: 'https://claude.ai/favicon.ico' },
  { name: 'Gemini',   url: 'https://gemini.google.com',    favicon: 'https://www.gstatic.com/lamda/images/gemini_favicon_f069958c85030456e93de685481c559f160ea06.svg' },
  { name: 'DeepSeek', url: 'https://chat.deepseek.com',    favicon: 'https://chat.deepseek.com/favicon.svg' },
  { name: 'Grok',     url: 'https://grok.com',             favicon: 'https://grok.com/images/favicon-dark.svg' },
];

// ── PROMPT SCORER ─────────────────────────────────────────────────────────────
// Heuristic score 0–100 based on structural signals
function scorePrompt(text) {
  if (!text || text.trim().length < 10) return 0;
  let score = 20; // base
  if (/role|you are|act as/i.test(text)) score += 15;
  if (/##|###/.test(text)) score += 12;
  if (/constraint|do not|must not|limit|format/i.test(text)) score += 13;
  if (/output|result|return|provide/i.test(text)) score += 10;
  if (/context|background|audience|tone/i.test(text)) score += 10;
  if (text.split('\n').length > 4) score += 8;
  if (/\*\*(.*?)\*\*/.test(text)) score += 7;
  if (/- /.test(text)) score += 5;
  return Math.min(score, 100);
}

function ScoreBadge({ score, label }) {
  const color = score >= 75 ? '#4ade80' : score >= 45 ? '#D3B89A' : '#f87171';
  const bg = score >= 75 ? 'rgba(74,222,128,0.1)' : score >= 45 ? 'rgba(211,184,154,0.1)' : 'rgba(248,113,113,0.1)';
  const border = score >= 75 ? 'rgba(74,222,128,0.3)' : score >= 45 ? 'rgba(211,184,154,0.3)' : 'rgba(248,113,113,0.3)';
  const grade = score >= 75 ? 'Strong' : score >= 45 ? 'Moderate' : 'Weak';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{
        fontSize: '11px', fontWeight: 700, color, background: bg,
        border: `1px solid ${border}`, padding: '3px 10px', borderRadius: '20px',
        letterSpacing: '0.3px',
      }}>
        {score}/100 · {grade}
      </span>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [activeBlogPost, setActiveBlogPost] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimizedOutput, setOptimizedOutput] = useState('');
  const [streamBuffer, setStreamBuffer] = useState('');
  const [lastInput, setLastInput] = useState('');
  const [history, setHistory] = useState(() => lsGet(LS.history, []));
  const [expandedHistoryIds, setExpandedHistoryIds] = useState(new Set());
  const [toast, setToast] = useState({ show: false, message: '', isError: false });
  const [inputFocused, setInputFocused] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedUseCase, setSelectedUseCase] = useState(() => lsGet(LS.useCase, 'automatic'));
  const [outputLength, setOutputLength] = useState(() => lsGet(LS.outputLength, 'standard'));
  const [isDark, setIsDark] = useState(() => lsGet(LS.isDark, true));
  const [isMobile, setIsMobile] = useState(false);
  const [expectedOutput, setExpectedOutput] = useState('');
  const [copyFlash, setCopyFlash] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [streamStartTime, setStreamStartTime] = useState(null);
  const [tokensPerSec, setTokensPerSec] = useState(0);

  const [settings, setSettings] = useState(() => lsGet(LS.settings, {
    model: 'openai/gpt-oss-120b',
    style: 'Structured',
    strictness: 85,
  }));

  const abortRef = useRef(null);
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { userInput, activePage, isGenerating, optimizedOutput, lastInput, settings, selectedUseCase, outputLength, expectedOutput };
  });

  // Persist
  useEffect(() => { lsSet(LS.history, history); }, [history]);
  useEffect(() => { lsSet(LS.settings, settings); }, [settings]);
  useEffect(() => { lsSet(LS.useCase, selectedUseCase); }, [selectedUseCase]);
  useEffect(() => { lsSet(LS.outputLength, outputLength); }, [outputLength]);
  useEffect(() => { lsSet(LS.isDark, isDark); }, [isDark]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light'); }, [isDark]);
  useEffect(() => { const check = () => setIsMobile(window.innerWidth <= 600); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);

  // PWA
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPwaPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setPwaInstalled(true); setPwaPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handlePwaInstall = async () => {
    if (!pwaPrompt) return;
    pwaPrompt.prompt();
    const { outcome } = await pwaPrompt.userChoice;
    if (outcome === 'accepted') { setPwaInstalled(true); setPwaPrompt(null); showToast('App installed!'); }
  };

  // Loading step cycle (only while not yet streaming)
  const loadingSteps = [
    { label: 'Analyzing prompt structure...' },
    { label: 'Engineering constraints...' },
    { label: 'Calibrating output format...' },
    { label: 'Sending to gpt-oss-120b...' },
  ];
  useEffect(() => {
    let interval;
    if (isGenerating && !isStreaming) {
      setLoadingStep(0);
      interval = setInterval(() => setLoadingStep(prev => (prev + 1) % loadingSteps.length), 900);
    }
    return () => clearInterval(interval);
  }, [isGenerating, isStreaming]);

  const getWordCount = (str) => { const t = str.trim(); return t === '' ? 0 : t.split(/\s+/).length; };
  const getCharCount = (str) => str.length;
  const estimateTokens = (str) => Math.ceil(str.trim().split(/\s+/).length * 1.35);

  const handleInputChange = (e) => {
    let text = e.target.value;
    if (getWordCount(text) > MAX_WORDS) text = text.trim().split(/\s+/).slice(0, MAX_WORDS).join(' ') + ' ';
    setUserInput(text);
  };

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const copyText = (text) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1200);
      showToast('Copied to clipboard!');
    } catch { showToast('Failed to copy.', true); }
  };

  const downloadText = (text, ext) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `optimized-prompt.${ext}`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast(`Downloaded as .${ext}`);
  };

  // ── STREAMING API CALL ────────────────────────────────────────────────────
  const runOptimize = useCallback(async (inputText) => {
    if (!GROQ_API_KEY) { showToast('API key missing! Add VITE_GROQ_API_KEY to Vercel env.', true); return; }
    if (!inputText.trim()) { showToast('Please enter a prompt to optimize!', true); return; }
    if (stateRef.current.isGenerating) return;

    // Abort any previous stream
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const { settings: s, selectedUseCase: uc, outputLength: ol, expectedOutput: eo } = stateRef.current;

    setIsGenerating(true);
    setIsStreaming(false);
    setOptimizedOutput('');
    setStreamBuffer('');
    setLastInput(inputText);
    setTokenCount(0);
    setTokensPerSec(0);

    const maxTok = OUTPUT_LENGTH_TOKENS[ol] || 2048;
    const isGptOss = s.model === 'openai/gpt-oss-120b';

    const body = {
      model: s.model,
      messages: [
        { role: 'system', content: buildSystemPrompt(s.style, s.strictness, uc, eo) },
        { role: 'user', content: inputText.trim() },
      ],
      temperature: 1,
      max_completion_tokens: maxTok,
      top_p: 1,
      stream: true,
      ...(isGptOss ? { reasoning_effort: 'high' } : {}),
    };

    let fullText = '';
    let tokensSoFar = 0;

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const startTime = Date.now();
      setStreamStartTime(startTime);
      setIsStreaming(true);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              tokensSoFar += 1;
              const elapsed = (Date.now() - startTime) / 1000;
              setOptimizedOutput(fullText);
              setTokenCount(tokensSoFar);
              if (elapsed > 0.5) setTokensPerSec(Math.round(tokensSoFar / elapsed));
            }
          } catch { /* ignore parse errors on partial chunks */ }
        }
      }

      // Save to history
      const origWords = getWordCount(inputText);
      const optWords = getWordCount(fullText);
      const elapsed = (Date.now() - startTime) / 1000;
      const finalTps = elapsed > 0 ? Math.round(tokensSoFar / elapsed) : 0;

      setHistory(prev => [{
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
        original: inputText.trim(),
        optimized: fullText,
        origWords,
        optWords,
        useCase: uc,
        style: s.style,
        model: s.model,
        tps: finalTps,
        inputScore: scorePrompt(inputText),
        outputScore: scorePrompt(fullText),
      }, ...prev]);

      showToast(`Prompt optimized · ${finalTps} tok/s`);
    } catch (error) {
      if (error.name === 'AbortError') {
        showToast('Generation stopped.');
      } else {
        console.error('Groq API Error:', error);
        setOptimizedOutput('Error connecting to AI backend. Please check your API key setup on Vercel.');
        showToast('API connection failed', true);
      }
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
    }
  }, []);

  const handleOptimize = () => { if (!stateRef.current.isGenerating) runOptimize(stateRef.current.userInput); };
  const handleStop = () => { if (abortRef.current) abortRef.current.abort(); };
  const handleRedo = () => { const { lastInput: li, isGenerating: ig } = stateRef.current; if (!ig && li) { showToast('Re-running...'); runOptimize(li); } };

  // Keyboard shortcuts
  useEffect(() => {
    const kd = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') { e.preventDefault(); if (stateRef.current.activePage === 'home' && !stateRef.current.isGenerating) handleOptimize(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); handleRedo(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); if (stateRef.current.optimizedOutput) copyText(stateRef.current.optimizedOutput); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); if (stateRef.current.optimizedOutput) downloadText(stateRef.current.optimizedOutput, 'md'); }
      if (mod && e.key === 'Backspace') { e.preventDefault(); if (stateRef.current.activePage === 'home') { setUserInput(''); showToast('Input cleared'); } }
      if (mod && e.key === '.') { e.preventDefault(); if (stateRef.current.isGenerating) handleStop(); }
      if (mod && e.key === '1') { e.preventDefault(); setActivePage('home'); window.scrollTo(0, 0); }
      if (mod && e.key === '2') { e.preventDefault(); setActivePage('history'); window.scrollTo(0, 0); }
      if (mod && e.key === '3') { e.preventDefault(); setActivePage('settings'); window.scrollTo(0, 0); }
      if (mod && e.key === '4') { e.preventDefault(); setActivePage('blog'); setActiveBlogPost(null); window.scrollTo(0, 0); }
    };
    document.addEventListener('keydown', kd);
    return () => document.removeEventListener('keydown', kd);
  }, []);

  const toggleHistoryItem = (id) => {
    setExpandedHistoryIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const inputWords = getWordCount(userInput);
  const inputChars = getCharCount(userInput);
  const inputTokenEst = estimateTokens(userInput);
  const optWords = getWordCount(optimizedOutput);
  const inputScore = scorePrompt(userInput);
  const outputScore = scorePrompt(optimizedOutput);
  const selectedModelObj = MODELS.find(m => m.id === settings.model) || MODELS[0];
  const currentOutputStyle = MODEL_OUTPUT_STYLES[settings.model] || MODEL_OUTPUT_STYLES['openai/gpt-oss-120b'];

  const ThemeToggle = ({ inSettings = false }) => (
    <button className={`theme-toggle${inSettings ? ' theme-toggle--settings' : ''}`} onClick={() => setIsDark(d => !d)} title={isDark ? 'Light mode' : 'Dark mode'}>
      {isDark
        ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      }
    </button>
  );

  return (
    <div className="app-wrapper">
      <style>{globalCSS}</style>
      <style>{currentOutputStyle.css}</style>

      {/* Orbs */}
      <div className="corner-orb corner-orb-tl" />
      <div className="corner-orb corner-orb-tr" />
      <div className="orb orb-left" />
      <div className="orb orb-right" />
      <div className="orb orb-bottom-left" />

      {/* Toast */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.isError ? 'error' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        <span>{toast.message}</span>
      </div>

      {/* PWA Banner */}
      {pwaPrompt && !pwaInstalled && (
        <div className="pwa-banner">
          <div className="pwa-banner-content">
            <div className="pwa-banner-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <div className="pwa-banner-text">
              <span className="pwa-banner-title">Install Prompt Optimizer</span>
              <span className="pwa-banner-sub">Add to your home screen for instant access</span>
            </div>
          </div>
          <div className="pwa-banner-actions">
            <button className="pwa-btn-install" onClick={handlePwaInstall}>Install</button>
            <button className="pwa-btn-dismiss" onClick={() => setPwaPrompt(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Navbar */}
      <div className="header_container">
        <div className="logo_part1">PROMPT OPTIMIZER</div>
        <div className="nav_icons">
          {[
            { id: 'home',     title: 'Home (Ctrl+1)',     svg: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
            { id: 'history',  title: 'History (Ctrl+2)',  svg: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></> },
            { id: 'blog',     title: 'Blog (Ctrl+4)',     svg: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></> },
            { id: 'settings', title: 'Settings (Ctrl+3)', svg: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></> },
          ].map(({ id, title, svg }) => (
            <a key={id} className={`icon_link ${activePage === id ? 'active' : ''}`}
               onClick={() => { setActivePage(id); if (id === 'blog') setActiveBlogPost(null); window.scrollTo(0, 0); }}
               title={title}>
              <svg viewBox="0 0 24 24">{svg}</svg>
            </a>
          ))}
          {!isMobile && <ThemeToggle />}
          {pwaPrompt && !pwaInstalled && (
            <button className="pwa-nav-btn" onClick={handlePwaInstall} title="Install app">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ══ HOME ══════════════════════════════════════════════════════════════ */}
      <main className={`page ${activePage === 'home' ? 'active' : ''}`}>
        <h1 className="hero-header" aria-label="Write Better Prompts, instantly">
          {['Write', 'Better', 'Prompts,'].map((w, i) => (
            <span key={w} className="hero-word" style={{ animationDelay: `${0.1 + i * 0.15}s` }}>{w} </span>
          ))}
          <span className="hero-word instantly-text" style={{ animationDelay: '0.58s' }}>
            instantly<span className="underline-bar" />
          </span>
        </h1>

        {/* Input Card */}
        <div className="card">
          <div className="card-header-flex">
            <h2>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              INPUT PROMPT
            </h2>
            {/* Stats row: words / chars / tokens / score */}
            <div className="input-stats-row">
              <span className={`word-count ${inputWords >= MAX_WORDS ? 'limit-reached' : ''}`}>{inputWords}/{MAX_WORDS}w</span>
              {userInput.length > 0 && (
                <>
                  <span className="stat-pill">{inputChars} chars</span>
                  <span className="stat-pill">~{inputTokenEst} tok</span>
                  {inputWords > 5 && <ScoreBadge score={inputScore} label="Score:" />}
                </>
              )}
            </div>
          </div>

          <div className={`textarea-ring-wrapper ${inputFocused ? 'focused' : ''}`}>
            <textarea
              value={userInput}
              onChange={handleInputChange}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              className="prompt-input"
              placeholder="Type a simple prompt (e.g., 'Write a story about a brave astronaut')..."
            />
          </div>

          {/* Advanced Toggle */}
          <button className="advanced-toggle" onClick={() => setAdvancedOpen(o => !o)}>
            <span className="advanced-toggle-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9z"/></svg>
              Advanced Options
            </span>
            <span className="advanced-toggle-right">
              {selectedUseCase !== 'automatic' && <span className="advanced-badge">{USE_CASES.find(u => u.id === selectedUseCase)?.label}</span>}
              {expectedOutput && <span className="advanced-badge" style={{ background: 'rgba(96,165,250,0.1)', borderColor: 'rgba(96,165,250,0.4)', color: '#60a5fa' }}>Expected set</span>}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                   style={{ transition: 'transform 0.3s ease', transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>

          {/* Advanced Panel */}
          <div className={`advanced-panel ${advancedOpen ? 'open' : ''}`}>
            <div className="advanced-panel-inner">

              {/* Model selector */}
              <div className="adv-section">
                <div className="adv-section-label">Output Style · AI Model</div>
                <div className="model-grid">
                  {MODELS.map(m => (
                    <button key={m.id} className={`model-chip ${settings.model === m.id ? 'selected' : ''}`}
                            onClick={() => setSettings(s => ({ ...s, model: m.id }))}
                            title={MODEL_OUTPUT_STYLES[m.id]?.desc || m.sub}>
                      <div className="model-chip-top">
                        <span className="model-chip-label">{m.label}</span>
                        <span className="model-chip-badge">{m.badge}</span>
                      </div>
                      <span className="model-chip-sub">{m.sub}</span>
                    </button>
                  ))}
                </div>
                <p className="adv-hint">Active style: <strong>{currentOutputStyle.name}</strong> — {currentOutputStyle.desc}</p>
              </div>

              {/* Use case */}
              <div className="adv-section">
                <div className="adv-section-label">Use Case</div>
                <div className="usecase-grid">
                  {USE_CASES.map(uc => (
                    <button key={uc.id} className={`usecase-chip ${selectedUseCase === uc.id ? 'selected' : ''}`}
                            onClick={() => setSelectedUseCase(uc.id)} title={uc.desc}>
                      <span className="usecase-icon">{uc.icon}</span>
                      <span>{uc.label}</span>
                    </button>
                  ))}
                </div>
                <p className="adv-hint">{USE_CASES.find(u => u.id === selectedUseCase)?.desc}</p>
              </div>

              {/* Expected output */}
              <div className="adv-section">
                <div className="adv-section-label">Expected Output <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>— optional</span></div>
                <textarea className="expected-output-input" value={expectedOutput} onChange={e => setExpectedOutput(e.target.value)} rows={3}
                          placeholder="Describe what you expect the final output to look like — format, tone, length, specific requirements..." />
                <p className="adv-hint">Guides the optimizer to tailor structure toward your specific output goals.</p>
              </div>

              {/* Output length */}
              <div className="adv-section">
                <div className="adv-section-label">Output Length</div>
                <div className="length-grid">
                  {[
                    { id: 'compact',   label: 'Compact',    sub: '~1k tok'  },
                    { id: 'standard',  label: 'Standard',   sub: '~2k tok'  },
                    { id: 'detailed',  label: 'Detailed',   sub: '~4k tok'  },
                    { id: 'exhaustive',label: 'Exhaustive', sub: '~8k tok'  },
                  ].map(opt => (
                    <button key={opt.id} className={`length-chip ${outputLength === opt.id ? 'selected' : ''}`} onClick={() => setOutputLength(opt.id)}>
                      <span className="length-label">{opt.label}</span>
                      <span className="length-sub">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="action-row">
            {isGenerating ? (
              <button className="btn-stop" onClick={handleStop}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                Stop · Ctrl+.
              </button>
            ) : (
              <button className="btn-optimize" onClick={handleOptimize} title="Ctrl+Enter">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                Optimize
                <kbd className="btn-kbd">⌘↵</kbd>
              </button>
            )}
          </div>
        </div>

        {/* Output Card */}
        <div className="card">
          <div className="card-header-flex">
            <h2>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              OPTIMIZED EXPERT VERSION
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* Live stream stats */}
              {isStreaming && (
                <div className="stream-stats">
                  <span className="stream-dot" />
                  <span>{tokenCount} tok · {tokensPerSec} tok/s</span>
                </div>
              )}
              {optimizedOutput && !isGenerating && (
                <div className="word-count">{optWords}w</div>
              )}
              {lastInput && !isGenerating && (
                <button className="btn-redo" onClick={handleRedo} title="Ctrl+Shift+R">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>
                  Redo
                </button>
              )}
            </div>
          </div>

          {/* Score comparison */}
          {optimizedOutput && !isGenerating && inputWords > 5 && (
            <div className="score-row">
              <ScoreBadge score={inputScore} label="Before:" />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              <ScoreBadge score={outputScore} label="After:" />
              {outputScore > inputScore && (
                <span className="score-improvement">+{outputScore - inputScore} pts</span>
              )}
            </div>
          )}

          <div className="output-container">
            {/* Loading state (before first token) */}
            {isGenerating && !isStreaming && (
              <div className="loading-panel">
                <div className="loading-rings">
                  <div className="ring ring-1" /><div className="ring ring-2" /><div className="ring ring-3" />
                  <div className="ring-core">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D3B89A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                  </div>
                </div>
                <div className="loading-text-block">
                  <div className="loading-step-label" key={loadingStep}>{loadingSteps[loadingStep].label}</div>
                  <div className="loading-progress-bar"><div className="loading-progress-fill" /></div>
                  <div className="loading-model-tag">via {selectedModelObj.label} · reasoning_effort: high</div>
                </div>
              </div>
            )}

            {/* Streaming / done output */}
            {(isStreaming || (!isGenerating && optimizedOutput)) && (
              <div className={`output-text ${isStreaming ? 'streaming' : ''}`}>
                {optimizedOutput}
                {isStreaming && <span className="stream-cursor" />}
              </div>
            )}

            {/* Placeholder */}
            {!isGenerating && !isStreaming && !optimizedOutput && (
              <div className="output-text output-placeholder">
                The AI's optimized prompt structure will stream here in real-time...
              </div>
            )}

            {/* Export actions */}
            {optimizedOutput && !isGenerating && (
              <div className="output-actions">
                <div className="output-actions-label">Export</div>
                <div className="output-actions-row">
                  <button className={`btn-output-action ${copyFlash ? 'btn-flash' : ''}`} onClick={() => copyText(optimizedOutput)} title="Ctrl+Shift+C">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    {copyFlash ? '✓ Copied!' : 'Copy'}
                  </button>
                  <button className="btn-output-action" onClick={() => downloadText(optimizedOutput, 'txt')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    .txt
                  </button>
                  <button className="btn-output-action btn-output-action--accent" onClick={() => downloadText(optimizedOutput, 'md')} title="Ctrl+Shift+S">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    .md
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Shortcut Buttons */}
        <div className="ai-shortcuts-bar">
          <div className="ai-shortcuts-label">Use your prompt in</div>
          <div className="ai-shortcuts-row">
            {AI_SHORTCUTS.map(ai => (
              <a key={ai.name} href={ai.url} target="_blank" rel="noreferrer" className="ai-shortcut-btn" title={`Open ${ai.name}`}>
                <span className="ai-shortcut-favicon-wrap">
                  <img src={ai.favicon} alt={ai.name} className="ai-shortcut-favicon"
                       onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                  <span className="ai-shortcut-fallback" style={{ display: 'none' }}>{ai.name.charAt(0)}</span>
                </span>
                <span className="ai-shortcut-name">{ai.name}</span>
                <svg className="ai-shortcut-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ))}
          </div>
        </div>
      </main>

      {/* ══ HISTORY ═══════════════════════════════════════════════════════════ */}
      <main className={`page ${activePage === 'history' ? 'active' : ''}`}>
        <div className="history-controls">
          <div className="history-title-section">
            <h1>Optimized History</h1>
            <p>Track, inspect, and export previous optimized outputs. Saved locally.</p>
          </div>
          <button className="btn-clear" onClick={() => { setHistory([]); showToast('Cleared optimization logs.'); }}>Clear Logs</button>
        </div>
        <div className="history-list">
          {history.length === 0 ? (
            <div className="card no-history-state" style={{ opacity: 1, transform: 'none' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px', color: 'rgba(255,255,255,0.2)' }}><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>
              <p>No optimization logs yet. Try building your first prompt on the Home screen!</p>
            </div>
          ) : history.map(item => {
            const isExpanded = expandedHistoryIds.has(item.id);
            return (
              <div key={item.id} className={`history-item ${isExpanded ? 'expanded' : ''}`}>
                <div className="history-item-header" onClick={() => toggleHistoryItem(item.id)}>
                  <div className="header-left-group">
                    <span className="chevron-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                    <span className="history-preview-text">{item.original}</span>
                  </div>
                  <div className="history-meta">
                    {item.useCase && item.useCase !== 'automatic' && <span className="history-usecase-tag">{item.useCase}</span>}
                    {item.outputScore && <span className="history-score-tag">{item.outputScore}/100</span>}
                    {item.model && <span className="history-model-tag">{MODELS.find(m => m.id === item.model)?.label || item.model}</span>}
                    <span className="history-timestamp">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {item.timestamp}
                    </span>
                  </div>
                </div>
                <div className="history-item-content">
                  <div className="history-subgrid">
                    <div className="prompt-box">
                      <div className="prompt-box-header">
                        <div className="prompt-box-title">Baseline Input</div>
                        <div className="prompt-box-stats">{item.origWords}w · {item.inputScore ?? '—'}/100</div>
                      </div>
                      <div className="prompt-box-content">{item.original}</div>
                    </div>
                    <div className="prompt-box" style={{ borderColor: 'rgba(211,184,154,0.15)' }}>
                      <div className="prompt-box-header">
                        <div className="prompt-box-title" style={{ color: '#D3B89A' }}>Optimized Output</div>
                        <div className="prompt-box-stats" style={{ color: '#D3B89A', background: 'rgba(211,184,154,0.1)' }}>{item.optWords}w · {item.outputScore ?? '—'}/100</div>
                      </div>
                      <div className="prompt-box-content" style={{ color: 'var(--text-primary)' }}>{item.optimized}</div>
                    </div>
                  </div>
                  <div className="history-actions">
                    <button className="btn-copy" onClick={e => { e.stopPropagation(); copyText(item.optimized); }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      Copy
                    </button>
                    <button className="btn-copy" onClick={e => { e.stopPropagation(); downloadText(item.optimized, 'md'); }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      .md
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ══ BLOG ══════════════════════════════════════════════════════════════ */}
      <main className={`page ${activePage === 'blog' ? 'active' : ''}`}>
        {activeBlogPost ? (
          <div className="blog-post-view">
            <button className="blog-back-btn" onClick={() => { setActiveBlogPost(null); window.scrollTo(0, 0); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back to Blog
            </button>
            <div className="card blog-post-card" style={{ opacity: 1, transform: 'none' }}>
              <div className="blog-post-meta-bar">
                <span className="blog-category-tag">{activeBlogPost.category}</span>
                <span className="blog-meta-sep">·</span>
                <span className="blog-post-date">{activeBlogPost.date}</span>
                <span className="blog-meta-sep">·</span>
                <span className="blog-post-date">{activeBlogPost.readTime}</span>
              </div>
              <h1 className="blog-post-title">{activeBlogPost.title}</h1>
              <div className="blog-post-body">{renderBlogContent(activeBlogPost.content)}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="history-controls">
              <div className="history-title-section">
                <h1>The Prompt Lab</h1>
                <p>Insights, guides, and research on the art of prompt engineering.</p>
              </div>
            </div>
            <div className="blog-grid">
              {BLOG_POSTS.map(post => (
                <div key={post.id} className="blog-card card" style={{ opacity: 1, transform: 'none', cursor: 'pointer' }}
                     onClick={() => { setActiveBlogPost(post); window.scrollTo(0, 0); }}>
                  <div className="blog-card-top">
                    <span className="blog-category-tag">{post.category}</span>
                    <span className="blog-card-readtime">{post.readTime}</span>
                  </div>
                  <h2 className="blog-card-title">{post.title}</h2>
                  <p className="blog-card-excerpt">{post.excerpt}</p>
                  <div className="blog-card-footer">
                    <span className="blog-card-date">{post.date}</span>
                    <span className="blog-card-cta">
                      Read more
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* ══ SETTINGS ══════════════════════════════════════════════════════════ */}
      <main className={`page ${activePage === 'settings' ? 'active' : ''}`}>
        <div className="history-controls">
          <div className="history-title-section">
            <h1>Optimization Settings</h1>
            <p>All settings saved automatically to your browser.</p>
          </div>
        </div>

        {isMobile && (
          <div className="card" style={{ opacity: 1, transform: 'none' }}>
            <h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>APPEARANCE</h2>
            <div className="settings-container">
              <div className="settings-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'none', paddingBottom: 0 }}>
                <div><div className="settings-label"><span>Color Mode</span></div><p className="settings-desc">Switch between dark and light themes.</p></div>
                <ThemeToggle inSettings />
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"/></svg>AI MODEL ENGINE</h2>
          <div className="settings-container">
            <div className="settings-row">
              <div className="settings-label"><span>Default Model</span></div>
              <p className="settings-desc">Select the default model. GPT-OSS 120B uses reasoning_effort: high and max 8192 tokens via the Groq streaming API.</p>
              <select className="select-input" value={settings.model} onChange={e => setSettings(s => ({ ...s, model: e.target.value }))}>
                {MODELS.map(m => <option key={m.id} value={m.id}>{m.label} — {m.sub}</option>)}
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-label"><span>Optimization Framework</span></div>
              <p className="settings-desc">Controls how the structural system frameworks are shaped.</p>
              <select className="select-input" value={settings.style} onChange={e => setSettings(s => ({ ...s, style: e.target.value }))}>
                <option value="Structured">Role / Context / Constraints / Goal (Recommended)</option>
                <option value="Conversational">Step-by-Step Chain of Thought</option>
                <option value="Few-Shot">In-Context Learning (Adds dynamic placeholders)</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-label"><span>Constraint Strength</span><span className="value">{settings.strictness}%</span></div>
              <p className="settings-desc">High strictness applies explicit formatting directives and rigid constraint borders.</p>
              <input type="range" min="10" max="100" step="1" value={settings.strictness} onChange={e => setSettings(s => ({ ...s, strictness: parseInt(e.target.value) }))} className="slider-range" />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>KEYBOARD SHORTCUTS</h2>
          <div className="settings-container">
            {[
              { label: 'Optimize Prompt',   desc: 'Generate an optimized prompt.',                    key: 'Ctrl/Cmd + Enter'     },
              { label: 'Stop Generation',   desc: 'Abort the current streaming output.',              key: 'Ctrl/Cmd + .'         },
              { label: 'Redo Optimization', desc: 'Re-run last optimization with new randomness.',    key: 'Ctrl/Cmd + Shift + R' },
              { label: 'Copy Output',       desc: 'Copy the generated prompt from the Home page.',    key: 'Ctrl/Cmd + Shift + C' },
              { label: 'Save as .md',       desc: 'Download output as a Markdown file.',             key: 'Ctrl/Cmd + Shift + S' },
              { label: 'Clear Input',       desc: 'Erase your current draft.',                       key: 'Ctrl/Cmd + Backspace' },
              { label: 'Navigate Pages',    desc: 'Home (1), History (2), Settings (3), Blog (4).',  key: 'Ctrl/Cmd + 1–4'       },
            ].map((s, i, arr) => (
              <div key={s.label} className="settings-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...(i === arr.length - 1 ? { borderBottom: 'none', paddingBottom: 0 } : {}) }}>
                <div className="settings-label" style={{ display: 'block' }}>
                  <span>{s.label}</span>
                  <p className="settings-desc" style={{ marginTop: '4px' }}>{s.desc}</p>
                </div>
                <span className="shortcut-badge">{s.key}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>DATA MANAGEMENT</h2>
          <div className="settings-container">
            <div className="settings-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div className="settings-label"><span>Clear All Saved Data</span></div>
              <p className="settings-desc">Permanently deletes all history, settings, and preferences from your browser's local storage.</p>
              <button className="btn-clear" style={{ marginTop: '8px', alignSelf: 'flex-start' }} onClick={() => {
                Object.values(LS).forEach(k => { try { localStorage.removeItem(k); } catch {} });
                setHistory([]);
                setSettings({ model: 'openai/gpt-oss-120b', style: 'Structured', strictness: 85 });
                setSelectedUseCase('automatic');
                setOutputLength('standard');
                showToast('All local data cleared.');
              }}>Clear All Data</button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-links">
          <a href="https://github.com/NOTAM-bobk/Promots.Optimzed/tree/main" target="_blank" rel="noreferrer">Source Code</a>
          <a onClick={() => { setActivePage('blog'); setActiveBlogPost(null); window.scrollTo(0, 0); }} style={{ cursor: 'pointer' }}>Blog</a>
          <a href="#">About</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </footer>
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Oswald:wght@200;300;400;500&display=swap');

  :root, [data-theme="dark"] {
    --bg-base: #06070a;
    --bg-card: rgba(255,255,255,0.02);
    --bg-card-hover: rgba(255,255,255,0.04);
    --bg-advanced: rgba(0,0,0,0.25);
    --bg-chip: rgba(255,255,255,0.05);
    --bg-chip-hover: rgba(255,255,255,0.1);
    --bg-chip-selected: rgba(255,255,255,0.12);
    --bg-output-action: rgba(255,255,255,0.08);
    --bg-output-action-hover: rgba(211,184,154,0.15);
    --bg-prompt-box: rgba(0,0,0,0.25);
    --bg-select: rgba(0,0,0,0.3);
    --bg-nav: rgba(255,255,255,0.03);
    --border-card: rgba(255,255,255,0.05);
    --border-card-hover: rgba(255,255,255,0.1);
    --border-chip: rgba(255,255,255,0.1);
    --border-chip-selected: rgba(211,184,154,0.6);
    --border-nav: rgba(255,255,255,0.08);
    --border-select: rgba(255,255,255,0.15);
    --border-subtle: rgba(255,255,255,0.06);
    --text-primary: #f0f0f0;
    --text-secondary: rgba(255,255,255,0.6);
    --text-muted: rgba(255,255,255,0.35);
    --text-heading: #b5b5b5;
    --text-placeholder: rgba(255,255,255,0.3);
    --text-logo: #e0e0e0;
    --accent: #D3B89A;
    --accent-dim: rgba(211,184,154,0.55);
    --orb-opacity: 0.25;
    --corner-orb-opacity: 1;
    --toast-success-bg: rgba(140,155,129,0.95);
    --toast-success-color: #06070a;
    --shortcut-bg: rgba(255,255,255,0.1);
    --history-item-bg: rgba(255,255,255,0.02);
    --history-item-border: rgba(255,255,255,0.08);
    --word-count-bg: rgba(0,0,0,0.3);
    --word-count-border: rgba(255,255,255,0.08);
  }

  [data-theme="light"] {
    --bg-base: #f4f3ef;
    --bg-card: rgba(255,255,255,0.85);
    --bg-card-hover: rgba(255,255,255,0.95);
    --bg-advanced: rgba(0,0,0,0.04);
    --bg-chip: rgba(0,0,0,0.04);
    --bg-chip-hover: rgba(0,0,0,0.08);
    --bg-chip-selected: rgba(180,140,100,0.12);
    --bg-output-action: rgba(0,0,0,0.06);
    --bg-output-action-hover: rgba(180,140,100,0.15);
    --bg-prompt-box: rgba(0,0,0,0.04);
    --bg-select: rgba(255,255,255,0.9);
    --bg-nav: rgba(255,255,255,0.75);
    --border-card: rgba(0,0,0,0.07);
    --border-card-hover: rgba(0,0,0,0.14);
    --border-chip: rgba(0,0,0,0.12);
    --border-chip-selected: rgba(180,130,80,0.7);
    --border-nav: rgba(0,0,0,0.1);
    --border-select: rgba(0,0,0,0.18);
    --border-subtle: rgba(0,0,0,0.07);
    --text-primary: #1a1a1a;
    --text-secondary: rgba(0,0,0,0.65);
    --text-muted: rgba(0,0,0,0.4);
    --text-heading: #555;
    --text-placeholder: rgba(0,0,0,0.3);
    --text-logo: #333;
    --accent: #a0712e;
    --accent-dim: rgba(160,113,46,0.6);
    --orb-opacity: 0.1;
    --corner-orb-opacity: 0;
    --toast-success-bg: rgba(90,130,95,0.95);
    --toast-success-color: #fff;
    --shortcut-bg: rgba(0,0,0,0.08);
    --history-item-bg: rgba(255,255,255,0.7);
    --history-item-border: rgba(0,0,0,0.09);
    --word-count-bg: rgba(0,0,0,0.06);
    --word-count-border: rgba(0,0,0,0.1);
  }

  html, body { margin:0; padding:0; width:100%; min-height:100vh; background:var(--bg-base); transition:background 0.35s ease; }
  * { box-sizing:border-box; }

  .app-wrapper {
    min-height:100vh; background:var(--bg-base);
    overflow-x:hidden; font-family:'Montserrat',sans-serif;
    color:var(--text-primary); user-select:none;
    display:flex; flex-direction:column;
    transition:background 0.35s ease, color 0.35s ease;
  }

  /* ── ORBS ── */
  .corner-orb { position:fixed; width:420px; height:420px; border-radius:50%; pointer-events:none; z-index:0; opacity:var(--corner-orb-opacity); transition:opacity 0.35s ease; }
  .corner-orb-tl { top:-180px; left:-180px; background:radial-gradient(circle at 60% 60%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.07) 35%, transparent 70%); filter:blur(40px); animation:cornerPulseTL 9s ease-in-out infinite alternate; }
  .corner-orb-tr { top:-180px; right:-180px; background:radial-gradient(circle at 40% 60%, rgba(255,255,255,0.15) 0%, rgba(211,184,154,0.06) 35%, transparent 70%); filter:blur(40px); animation:cornerPulseTR 11s ease-in-out infinite alternate; }
  @keyframes cornerPulseTL { 0%{transform:scale(1) translate(0,0);opacity:.9} 50%{transform:scale(1.12) translate(20px,20px);opacity:1} 100%{transform:scale(.95) translate(-10px,10px);opacity:.8} }
  @keyframes cornerPulseTR { 0%{transform:scale(1) translate(0,0);opacity:.8} 50%{transform:scale(1.08) translate(-15px,15px);opacity:1} 100%{transform:scale(1.02) translate(5px,-5px);opacity:.85} }

  .orb { position:fixed; border-radius:50%; filter:blur(120px); z-index:0; opacity:var(--orb-opacity); pointer-events:none; }
  .orb-left { top:-150px; left:-150px; width:550px; height:550px; background:radial-gradient(circle,rgba(255,255,255,.9) 0%,rgba(211,184,154,.3) 60%,transparent 100%); animation:floatOrbLeft 12s infinite alternate ease-in-out; }
  .orb-right { top:-100px; right:-200px; width:650px; height:650px; background:radial-gradient(circle,rgba(255,255,255,.7) 0%,rgba(140,155,129,.3) 60%,transparent 100%); animation:floatOrbRight 16s infinite alternate ease-in-out; }
  .orb-bottom-left { bottom:-180px; left:-180px; width:500px; height:500px; background:radial-gradient(circle,rgba(255,255,255,1) 0%,rgba(220,220,255,.4) 55%,transparent 100%); animation:floatOrbBottomLeft 14s infinite alternate ease-in-out; }
  @keyframes floatOrbLeft { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(60px,40px) scale(1.15)} 100%{transform:translate(-20px,80px) scale(.9)} }
  @keyframes floatOrbRight { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(-80px,50px) scale(.85)} 100%{transform:translate(30px,-30px) scale(1.1)} }
  @keyframes floatOrbBottomLeft { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(50px,-40px) scale(1.1)} 100%{transform:translate(-30px,20px) scale(.92)} }

  /* ── NAVBAR ── */
  .header_container {
    position:fixed; top:4%; left:50%;
    transform:translate(-50%,-30px);
    width:85%; max-width:850px; min-width:300px; height:65px;
    background-color:var(--bg-nav); border-radius:50px;
    backdrop-filter:blur(25px); -webkit-backdrop-filter:blur(25px);
    border:1px solid var(--border-nav);
    box-shadow:0 10px 40px 0 rgba(0,0,0,.4);
    display:flex; justify-content:space-between; align-items:center; padding:0 35px;
    z-index:1000; opacity:0;
    animation:slideDownIn 1s cubic-bezier(.16,1,.3,1) forwards;
    animation-delay:.2s;
    transition:background .35s ease, border-color .35s ease;
  }
  .logo_part1 { color:var(--text-logo); font-family:'Oswald',sans-serif; font-size:14px; font-weight:300; letter-spacing:3px; white-space:nowrap; overflow:hidden; border-right:2px solid rgba(255,255,255,.75); width:0; animation:typewriter 2s steps(20) 1.2s forwards, blinkCursor .8s infinite, removeCursor .1s forwards 3.2s; }
  .nav_icons { display:flex; gap:20px; align-items:center; }
  .icon_link { color:var(--text-muted); display:flex; align-items:center; justify-content:center; text-decoration:none; transition:color .3s ease,transform .3s ease; cursor:pointer; position:relative; }
  .icon_link:hover, .icon_link.active { color:var(--accent); transform:translateY(-2px); }
  .icon_link.active::after { content:''; position:absolute; bottom:-8px; width:12px; height:2px; background-color:var(--accent); border-radius:10px; box-shadow:0 0 8px var(--accent); }
  .icon_link svg { width:21px; height:21px; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; fill:none; }
  .theme-toggle { background:var(--bg-chip); border:1px solid var(--border-chip); color:var(--text-secondary); width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .25s ease; flex-shrink:0; }
  .theme-toggle:hover { background:var(--bg-chip-hover); color:var(--accent); transform:translateY(-1px); }
  .theme-toggle svg { stroke:currentColor; }
  .theme-toggle--settings { width:44px; height:44px; border-radius:12px; }
  @media(max-width:600px) { .logo_part1{display:none} .header_container{justify-content:center} }

  /* ── PWA ── */
  .pwa-banner { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); width:calc(100% - 48px); max-width:560px; background:rgba(15,16,20,.96); border:1px solid rgba(211,184,154,.2); border-radius:20px; padding:16px 20px; display:flex; align-items:center; justify-content:space-between; gap:16px; z-index:1500; backdrop-filter:blur(20px); box-shadow:0 20px 50px rgba(0,0,0,.5); animation:bannerSlideUp .4s cubic-bezier(.16,1,.3,1) forwards; }
  [data-theme="light"] .pwa-banner { background:rgba(255,255,255,.97); border-color:rgba(160,113,46,.2); box-shadow:0 20px 50px rgba(0,0,0,.15); }
  @keyframes bannerSlideUp { from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  .pwa-banner-content { display:flex; align-items:center; gap:14px; flex:1; overflow:hidden; }
  .pwa-banner-icon { width:40px; height:40px; border-radius:12px; background:rgba(211,184,154,.12); border:1px solid rgba(211,184,154,.25); display:flex; align-items:center; justify-content:center; color:var(--accent); flex-shrink:0; }
  .pwa-banner-text { display:flex; flex-direction:column; gap:2px; overflow:hidden; }
  .pwa-banner-title { font-size:13px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pwa-banner-sub { font-size:11.5px; color:var(--text-secondary); }
  .pwa-banner-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .pwa-btn-install { background:var(--text-primary); color:var(--bg-base); border:none; padding:8px 18px; border-radius:20px; font-family:'Montserrat',sans-serif; font-weight:700; font-size:12px; cursor:pointer; transition:all .2s ease; white-space:nowrap; }
  .pwa-btn-install:hover { background:var(--accent); transform:translateY(-1px); }
  .pwa-btn-dismiss { background:transparent; border:1px solid var(--border-chip); color:var(--text-muted); width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .2s ease; }
  .pwa-btn-dismiss:hover { border-color:#f87171; color:#f87171; background:rgba(248,113,113,.1); }
  .pwa-nav-btn { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:50%; background:rgba(211,184,154,.1); border:1px solid rgba(211,184,154,.3); color:var(--accent); cursor:pointer; transition:all .2s ease; animation:pulseGlow 2s ease-in-out infinite; }
  .pwa-nav-btn:hover { background:rgba(211,184,154,.2); transform:translateY(-1px); }
  @keyframes pulseGlow { 0%,100%{box-shadow:0 0 0 0 rgba(211,184,154,.3)} 50%{box-shadow:0 0 0 4px rgba(211,184,154,.1)} }

  /* ── PAGES ── */
  .page { display:none; padding-top:130px; width:90%; max-width:800px; margin-left:auto; margin-right:auto; z-index:10; position:relative; flex:1; }
  .page.active { display:flex; flex-direction:column; gap:28px; animation:pageFadeUp .8s cubic-bezier(.16,1,.3,1) forwards; }

  /* ── HERO ── */
  .hero-header { text-align:center; font-size:2.2rem; font-weight:700; color:var(--text-primary); margin:0 0 10px; letter-spacing:-0.5px; line-height:1.3; }
  .hero-word { display:inline-block; opacity:0; filter:blur(12px); transform:translateY(-14px); animation:wordReveal .65s cubic-bezier(.16,1,.3,1) forwards; }
  .instantly-text { color:var(--text-muted); position:relative; }
  .underline-bar { position:absolute; left:0; bottom:-3px; width:100%; height:3px; background:var(--text-muted); border-radius:2px; transform:scaleX(0); transform-origin:left; animation:drawUnderline .6s ease-out 1.3s forwards; }
  @keyframes wordReveal { 0%{opacity:0;filter:blur(12px);transform:translateY(-14px)} 60%{filter:blur(2px)} 100%{opacity:1;filter:blur(0);transform:translateY(0)} }

  /* ── CARDS ── */
  .card { background:var(--bg-card); border:1px solid var(--border-card); border-radius:24px; padding:28px; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); box-shadow:0 15px 35px rgba(0,0,0,.3); transition:border-color .4s ease,box-shadow .4s ease,background .35s ease; opacity:0; transform:translateY(20px); }
  .page.active .card { animation:elementFadeUp .8s cubic-bezier(.16,1,.3,1) forwards; }
  .page.active .card:nth-child(2){animation-delay:.15s}
  .page.active .card:nth-child(3){animation-delay:.3s}
  .card:hover { border-color:var(--border-card-hover); box-shadow:0 20px 45px rgba(0,0,0,.4); }
  .card-header-flex { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:10px; }
  .card h2 { margin:0; font-size:13px; font-family:'Oswald',sans-serif; font-weight:400; letter-spacing:2px; color:var(--text-heading); display:flex; align-items:center; gap:10px; }
  .card h2 svg { color:var(--accent); }

  /* ── INPUT STATS ROW ── */
  .input-stats-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
  .word-count { font-size:11px; color:var(--text-muted); font-weight:600; background:var(--word-count-bg); padding:4px 10px; border-radius:20px; border:1px solid var(--word-count-border); white-space:nowrap; }
  .word-count.limit-reached { color:#f87171; border-color:rgba(248,113,113,.3); }
  .stat-pill { font-size:10.5px; color:var(--text-muted); font-weight:600; background:var(--word-count-bg); padding:4px 8px; border-radius:20px; border:1px solid var(--word-count-border); white-space:nowrap; }

  /* ── SCORE ROW ── */
  .score-row { display:flex; align-items:center; gap:10px; margin-bottom:16px; padding:12px 16px; background:var(--bg-advanced); border-radius:12px; border:1px solid var(--border-subtle); flex-wrap:wrap; }
  .score-improvement { font-size:11px; font-weight:700; color:#4ade80; background:rgba(74,222,128,.1); border:1px solid rgba(74,222,128,.25); padding:3px 10px; border-radius:20px; }

  /* ── STREAM STATS ── */
  .stream-stats { display:flex; align-items:center; gap:7px; font-size:11px; font-weight:700; color:var(--accent); background:rgba(211,184,154,.08); border:1px solid rgba(211,184,154,.2); padding:4px 10px; border-radius:20px; }
  .stream-dot { width:7px; height:7px; border-radius:50%; background:var(--accent); animation:streamPulse .8s ease-in-out infinite; flex-shrink:0; }
  @keyframes streamPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }

  /* ── TEXTAREA RING ── */
  .textarea-ring-wrapper { position:relative; border-radius:14px; transition:box-shadow .35s ease; }
  .textarea-ring-wrapper.focused { box-shadow:0 0 0 1.5px var(--accent-dim), 0 0 20px 3px rgba(211,184,154,.1); }
  .prompt-input { width:100%; height:120px; background:transparent; border:none; color:var(--text-primary); font-family:'Montserrat',sans-serif; font-size:16px; line-height:1.6; resize:none; outline:none; display:block; }
  .prompt-input::placeholder { color:var(--text-placeholder); transition:color .3s ease; }
  .prompt-input:focus::placeholder { color:var(--text-muted); }

  /* ── ADVANCED ── */
  .expected-output-input { width:100%; min-height:80px; background:rgba(0,0,0,.2); border:1px solid var(--border-chip); border-radius:12px; color:var(--text-primary); font-family:'Montserrat',sans-serif; font-size:13.5px; line-height:1.6; padding:12px 14px; resize:vertical; outline:none; display:block; transition:border-color .25s ease,box-shadow .25s ease; }
  .expected-output-input::placeholder { color:var(--text-placeholder); }
  .expected-output-input:focus { border-color:var(--accent-dim); box-shadow:0 0 0 1px rgba(211,184,154,.1); }
  [data-theme="light"] .expected-output-input { background:rgba(0,0,0,.04); }
  .advanced-toggle { display:flex; align-items:center; justify-content:space-between; width:100%; padding:12px 0; background:transparent; border:none; border-top:1px solid var(--border-subtle); color:var(--text-secondary); font-family:'Montserrat',sans-serif; font-size:12.5px; font-weight:600; letter-spacing:.3px; cursor:pointer; transition:color .2s ease; margin-top:14px; }
  .advanced-toggle:hover { color:var(--accent); }
  .advanced-toggle-left { display:flex; align-items:center; gap:8px; }
  .advanced-toggle-right { display:flex; align-items:center; gap:10px; }
  .advanced-badge { font-size:10px; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:1px; background:rgba(211,184,154,.1); border:1px solid var(--accent-dim); padding:3px 8px; border-radius:10px; }
  [data-theme="light"] .advanced-badge { background:rgba(160,113,46,.1); }
  .advanced-panel { max-height:0; overflow:hidden; transition:max-height .4s cubic-bezier(.16,1,.3,1); }
  .advanced-panel.open { max-height:1400px; }
  .advanced-panel-inner { background:var(--bg-advanced); border-radius:16px; padding:20px; margin-top:4px; border:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:22px; }
  .adv-section { display:flex; flex-direction:column; gap:10px; }
  .adv-section-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-muted); }
  .adv-hint { font-size:12px; color:var(--text-muted); margin:0; line-height:1.5; }
  .adv-hint strong { color:var(--accent); font-weight:600; }

  /* ── MODEL CHIPS ── */
  .model-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(165px,1fr)); gap:8px; }
  @media(max-width:520px){.model-grid{grid-template-columns:1fr 1fr}}
  .model-chip { display:flex; flex-direction:column; padding:10px 12px; background:var(--bg-chip); border:1px solid var(--border-chip); border-radius:12px; cursor:pointer; transition:all .2s ease; font-family:'Montserrat',sans-serif; text-align:left; gap:3px; }
  .model-chip:hover { background:var(--bg-chip-hover); }
  .model-chip.selected { background:var(--bg-chip-selected); border-color:var(--border-chip-selected); }
  .model-chip-top { display:flex; align-items:center; justify-content:space-between; gap:6px; }
  .model-chip-label { font-size:12.5px; font-weight:700; color:var(--text-primary); }
  .model-chip.selected .model-chip-label { color:var(--accent); }
  .model-chip-badge { font-size:9px; font-weight:700; letter-spacing:.8px; color:var(--text-muted); background:var(--bg-chip); padding:2px 6px; border-radius:6px; border:1px solid var(--border-chip); white-space:nowrap; }
  .model-chip.selected .model-chip-badge { color:var(--accent); background:rgba(211,184,154,.1); border-color:var(--accent-dim); }
  .model-chip-sub { font-size:10.5px; color:var(--text-muted); line-height:1.3; }

  /* ── USE CASE + LENGTH ── */
  .usecase-grid { display:flex; flex-wrap:wrap; gap:8px; }
  .usecase-chip { display:flex; align-items:center; gap:7px; padding:8px 14px; background:var(--bg-chip); border:1px solid var(--border-chip); border-radius:30px; color:var(--text-secondary); font-family:'Montserrat',sans-serif; font-size:12.5px; font-weight:600; cursor:pointer; transition:all .2s ease; white-space:nowrap; }
  .usecase-chip:hover { background:var(--bg-chip-hover); color:var(--text-primary); }
  .usecase-chip.selected { background:var(--bg-chip-selected); border-color:var(--border-chip-selected); color:var(--accent); box-shadow:0 0 12px rgba(211,184,154,.1); }
  .usecase-icon { font-size:13px; opacity:.8; }
  .length-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  @media(max-width:520px){.length-grid{grid-template-columns:repeat(2,1fr)}}
  .length-chip { display:flex; flex-direction:column; align-items:center; padding:10px 8px; background:var(--bg-chip); border:1px solid var(--border-chip); border-radius:12px; cursor:pointer; transition:all .2s ease; font-family:'Montserrat',sans-serif; }
  .length-chip:hover { background:var(--bg-chip-hover); }
  .length-chip.selected { background:var(--bg-chip-selected); border-color:var(--border-chip-selected); }
  .length-label { font-size:12.5px; font-weight:700; color:var(--text-primary); }
  .length-chip.selected .length-label { color:var(--accent); }
  .length-sub { font-size:10px; color:var(--text-muted); margin-top:3px; }

  /* ── ACTION ROW ── */
  .action-row { display:flex; justify-content:flex-end; align-items:center; margin-top:15px; border-top:1px solid var(--border-subtle); padding-top:15px; }
  .btn-optimize { background:var(--text-primary); color:var(--bg-base); border:none; padding:11px 24px; border-radius:30px; font-family:'Montserrat',sans-serif; font-weight:700; font-size:13px; letter-spacing:.5px; cursor:pointer; transition:all .3s cubic-bezier(.25,1,.5,1); display:flex; align-items:center; gap:8px; box-shadow:0 4px 15px rgba(0,0,0,.15); }
  .btn-optimize:hover { background:var(--accent); transform:translateY(-2px); box-shadow:0 6px 20px rgba(211,184,154,.25); }
  .btn-optimize:active { transform:translateY(0); }
  .btn-kbd { font-size:10px; opacity:.6; background:rgba(0,0,0,.2); padding:2px 6px; border-radius:5px; font-weight:600; letter-spacing:.5px; }
  .btn-stop { background:rgba(248,113,113,.12); color:#f87171; border:1px solid rgba(248,113,113,.3); padding:11px 24px; border-radius:30px; font-family:'Montserrat',sans-serif; font-weight:700; font-size:13px; letter-spacing:.5px; cursor:pointer; transition:all .2s ease; display:flex; align-items:center; gap:8px; }
  .btn-stop:hover { background:rgba(248,113,113,.22); border-color:rgba(248,113,113,.5); }

  /* ── LOADING ── */
  .loading-panel { display:flex; align-items:center; gap:28px; padding:24px 0 20px; }
  .loading-rings { position:relative; width:56px; height:56px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
  .ring { position:absolute; border-radius:50%; border:1.5px solid transparent; animation:spinRing linear infinite; }
  .ring-1 { width:56px; height:56px; border-top-color:rgba(211,184,154,.9); border-right-color:rgba(211,184,154,.3); animation-duration:1.1s; }
  .ring-2 { width:40px; height:40px; border-top-color:rgba(255,255,255,.5); border-left-color:rgba(255,255,255,.2); animation-duration:.8s; animation-direction:reverse; }
  .ring-3 { width:26px; height:26px; border-top-color:rgba(140,155,129,.8); animation-duration:1.5s; }
  .ring-core { position:absolute; display:flex; align-items:center; justify-content:center; animation:pulseCoreIcon 1.2s ease-in-out infinite; }
  .loading-text-block { flex:1; display:flex; flex-direction:column; gap:10px; }
  .loading-step-label { font-size:13.5px; font-weight:600; color:var(--accent); letter-spacing:.3px; animation:stepFadeIn .35s ease forwards; }
  .loading-progress-bar { width:100%; height:3px; background:rgba(255,255,255,.08); border-radius:4px; overflow:hidden; }
  .loading-progress-fill { height:100%; width:0%; background:linear-gradient(90deg,var(--accent-dim),var(--accent)); border-radius:4px; animation:progressSweep 3.6s ease-in-out infinite; }
  .loading-model-tag { font-size:11px; color:var(--text-muted); font-weight:500; }
  @keyframes spinRing{to{transform:rotate(360deg)}}
  @keyframes pulseCoreIcon{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
  @keyframes stepFadeIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
  @keyframes progressSweep{0%{width:0%}70%{width:85%}90%{width:92%}100%{width:98%}}

  /* ── OUTPUT ── */
  .output-container { position:relative; }
  .output-text { min-height:70px; color:var(--text-primary); font-size:15.5px; line-height:1.7; white-space:pre-wrap; transition:font-family .3s ease,line-height .3s ease,font-size .3s ease; }
  .output-text.streaming { }
  .output-placeholder { color:var(--text-placeholder); font-style:italic; font-family:'Montserrat',sans-serif !important; font-size:15.5px !important; line-height:1.7 !important; }
  .stream-cursor { display:inline-block; width:2px; height:1.1em; background:var(--accent); margin-left:2px; vertical-align:text-bottom; animation:cursorBlink .7s ease-in-out infinite; }
  @keyframes cursorBlink{0%,100%{opacity:1}50%{opacity:0}}

  /* ── OUTPUT ACTIONS ── */
  .output-actions { margin-top:18px; padding-top:15px; border-top:1px solid var(--border-subtle); }
  .output-actions-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-muted); margin-bottom:10px; }
  .output-actions-row { display:flex; gap:8px; flex-wrap:wrap; }
  .btn-output-action { display:flex; align-items:center; gap:6px; padding:8px 16px; background:var(--bg-output-action); border:1px solid var(--border-chip); color:var(--text-secondary); font-family:'Montserrat',sans-serif; font-size:12px; font-weight:700; border-radius:30px; cursor:pointer; transition:all .2s ease; letter-spacing:.3px; }
  .btn-output-action:hover { background:var(--bg-output-action-hover); border-color:var(--accent); color:var(--accent); }
  .btn-output-action--accent { border-color:var(--accent-dim); color:var(--accent); }
  .btn-output-action--accent:hover { background:rgba(211,184,154,.18); }
  .btn-flash { background:rgba(74,222,128,.15) !important; border-color:rgba(74,222,128,.5) !important; color:#4ade80 !important; }

  /* ── REDO ── */
  .btn-redo { display:flex; align-items:center; gap:6px; padding:5px 13px; background:var(--bg-chip); border:1px solid var(--border-chip); border-radius:20px; color:var(--text-secondary); font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:.3px; cursor:pointer; transition:all .2s ease; }
  .btn-redo:hover { background:rgba(211,184,154,.12); border-color:var(--accent-dim); color:var(--accent); }
  .btn-redo svg { transition:transform .4s ease; }
  .btn-redo:hover svg { transform:rotate(-360deg); }

  /* ── AI SHORTCUTS ── */
  .ai-shortcuts-bar { display:flex; flex-direction:column; align-items:center; gap:14px; padding:20px 0 8px; opacity:0; transform:translateY(10px); animation:elementFadeUp .8s cubic-bezier(.16,1,.3,1) .4s forwards; }
  .ai-shortcuts-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-muted); }
  .ai-shortcuts-row { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }
  .ai-shortcut-btn { display:flex; align-items:center; gap:8px; padding:10px 18px; background:var(--bg-card); border:1px solid var(--border-chip); border-radius:30px; color:var(--text-secondary); text-decoration:none; font-family:'Montserrat',sans-serif; font-size:12.5px; font-weight:600; transition:all .25s ease; }
  .ai-shortcut-btn:hover { border-color:var(--border-card-hover); background:var(--bg-chip-hover); color:var(--text-primary); transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,.2); }
  .ai-shortcut-favicon-wrap { width:18px; height:18px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .ai-shortcut-favicon { width:18px; height:18px; border-radius:4px; object-fit:contain; }
  .ai-shortcut-fallback { width:18px; height:18px; font-size:12px; font-weight:800; border-radius:4px; background:var(--bg-chip); align-items:center; justify-content:center; }
  .ai-shortcut-name { font-size:12.5px; }
  .ai-shortcut-arrow { opacity:0; transform:translate(-4px,4px); transition:opacity .2s ease,transform .2s ease; flex-shrink:0; }
  .ai-shortcut-btn:hover .ai-shortcut-arrow { opacity:.6; transform:translate(0,0); }

  /* ── HISTORY ── */
  .history-controls { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:5px; }
  .history-title-section h1 { margin:0; font-size:24px; font-weight:600; letter-spacing:1px; font-family:'Oswald',sans-serif; color:var(--text-primary); }
  .history-title-section p { margin:4px 0 0; font-size:13.5px; color:var(--text-secondary); }
  .btn-clear { background:transparent; border:1px solid var(--border-chip); color:var(--text-secondary); border-radius:30px; padding:8px 16px; font-size:12px; font-weight:600; cursor:pointer; transition:all .3s ease; font-family:'Montserrat',sans-serif; }
  .btn-clear:hover { border-color:#f87171; color:#f87171; background:rgba(248,113,113,.1); }
  .history-list { display:flex; flex-direction:column; gap:16px; }
  .history-item { display:flex; flex-direction:column; background:var(--history-item-bg); border:1px solid var(--history-item-border); border-radius:20px; overflow:hidden; transition:border-color .3s ease,box-shadow .3s ease; }
  .history-item:hover { border-color:var(--border-card-hover); box-shadow:0 10px 25px rgba(0,0,0,.15); }
  .history-item-header { display:flex; justify-content:space-between; align-items:center; padding:20px 24px; cursor:pointer; user-select:none; transition:background .2s ease; }
  .history-item-header:hover { background:var(--bg-chip-hover); }
  .header-left-group { display:flex; align-items:center; gap:14px; overflow:hidden; flex:1; margin-right:15px; }
  .chevron-icon { color:var(--text-muted); transition:transform .3s cubic-bezier(.25,1,.5,1),color .3s ease; flex-shrink:0; display:flex; align-items:center; }
  .history-item.expanded .chevron-icon { transform:rotate(180deg); color:var(--accent); }
  .history-preview-text { font-size:14.5px; font-weight:500; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .history-meta { display:flex; align-items:center; gap:8px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end; }
  .history-usecase-tag { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--accent); background:rgba(211,184,154,.1); border:1px solid var(--accent-dim); padding:3px 8px; border-radius:10px; }
  .history-score-tag { font-size:10px; font-weight:700; color:#4ade80; background:rgba(74,222,128,.08); border:1px solid rgba(74,222,128,.25); padding:3px 8px; border-radius:10px; }
  .history-model-tag { font-size:10px; font-weight:600; color:var(--text-muted); background:var(--bg-chip); border:1px solid var(--border-chip); padding:3px 8px; border-radius:10px; }
  .history-timestamp { font-size:11.5px; color:var(--text-muted); font-weight:600; white-space:nowrap; }
  .history-item-content { max-height:0; opacity:0; visibility:hidden; transition:max-height .4s cubic-bezier(.16,1,.3,1),opacity .3s ease,padding .3s ease; box-sizing:border-box; background:var(--bg-advanced); }
  .history-item.expanded .history-item-content { max-height:2000px; opacity:1; visibility:visible; padding:0 24px 24px; border-top:1px solid var(--border-subtle); }
  .history-subgrid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:20px; }
  @media(max-width:650px){.history-subgrid{grid-template-columns:1fr}}
  .prompt-box { background:var(--bg-prompt-box); border-radius:12px; padding:18px; border:1px solid var(--border-subtle); }
  .prompt-box-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  .prompt-box-title { font-size:11px; font-family:'Oswald',sans-serif; letter-spacing:1.5px; color:var(--text-muted); text-transform:uppercase; }
  .prompt-box-stats { font-size:10px; color:var(--text-muted); background:var(--bg-chip); padding:3px 8px; border-radius:10px; font-weight:600; }
  .prompt-box-content { font-size:14.5px; line-height:1.6; color:var(--text-primary); white-space:pre-wrap; }
  .history-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:18px; flex-wrap:wrap; }
  .btn-copy { background:var(--bg-output-action); border:1px solid var(--border-chip); color:var(--text-secondary); font-size:12px; font-weight:600; padding:8px 18px; border-radius:30px; cursor:pointer; transition:all .2s ease; font-family:'Montserrat',sans-serif; display:flex; align-items:center; gap:6px; }
  .btn-copy:hover { background:var(--bg-output-action-hover); border-color:var(--accent); color:var(--accent); }
  .no-history-state { text-align:center; padding:50px 28px; }
  .no-history-state p { color:var(--text-muted); font-size:14px; }

  /* ── BLOG ── */
  .blog-grid { display:flex; flex-direction:column; gap:20px; }
  .blog-card { transition:border-color .3s ease,box-shadow .3s ease,transform .3s ease !important; }
  .blog-card:hover { border-color:var(--border-card-hover) !important; box-shadow:0 20px 45px rgba(0,0,0,.4) !important; transform:translateY(-2px) !important; }
  .blog-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
  .blog-category-tag { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:var(--accent); background:rgba(211,184,154,.1); border:1px solid var(--accent-dim); padding:4px 10px; border-radius:20px; }
  [data-theme="light"] .blog-category-tag { background:rgba(160,113,46,.1); }
  .blog-card-readtime { font-size:11px; color:var(--text-muted); font-weight:600; }
  .blog-card-title { font-family:'Oswald',sans-serif; font-weight:400; font-size:22px; letter-spacing:1px; color:var(--text-primary); margin:0 0 10px; line-height:1.25; }
  .blog-card-excerpt { font-size:14px; color:var(--text-secondary); line-height:1.65; margin:0 0 18px; }
  .blog-card-footer { display:flex; align-items:center; justify-content:space-between; border-top:1px solid var(--border-subtle); padding-top:14px; }
  .blog-card-date { font-size:12px; color:var(--text-muted); font-weight:600; }
  .blog-card-cta { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:700; letter-spacing:.3px; color:var(--accent); transition:gap .2s ease; }
  .blog-card:hover .blog-card-cta { gap:8px; }
  .blog-post-view { display:flex; flex-direction:column; gap:20px; }
  .blog-back-btn { display:flex; align-items:center; gap:7px; background:transparent; border:1px solid var(--border-chip); color:var(--text-secondary); border-radius:30px; padding:8px 16px; font-size:12px; font-weight:600; cursor:pointer; font-family:'Montserrat',sans-serif; transition:all .2s ease; align-self:flex-start; }
  .blog-back-btn:hover { border-color:var(--accent); color:var(--accent); }
  .blog-post-card { opacity:1 !important; transform:none !important; }
  .blog-post-meta-bar { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
  .blog-meta-sep { color:var(--text-muted); font-size:12px; }
  .blog-post-date { font-size:12px; color:var(--text-muted); font-weight:600; }
  .blog-post-title { font-family:'Oswald',sans-serif; font-weight:400; font-size:28px; letter-spacing:1.5px; color:var(--text-primary); margin:0 0 28px; line-height:1.2; border-bottom:1px solid var(--border-subtle); padding-bottom:24px; }
  .blog-post-body { display:flex; flex-direction:column; gap:0; user-select:text; }
  .blog-post-h2 { font-family:'Oswald',sans-serif; font-weight:400; font-size:18px; letter-spacing:1.5px; text-transform:uppercase; color:var(--accent); margin:28px 0 14px; }
  .blog-post-h3 { font-size:15px; font-weight:700; color:var(--text-primary); margin:20px 0 10px; }
  .blog-post-p { font-size:15px; line-height:1.75; color:var(--text-secondary); margin:0 0 16px; }
  .blog-post-hr { border:none; border-top:1px solid var(--border-subtle); margin:24px 0; }
  .blog-post-ul { margin:0 0 16px 20px; padding:0; }
  .blog-post-ul li { font-size:14.5px; line-height:1.7; color:var(--text-secondary); margin-bottom:6px; }
  .blog-post-pre { background:rgba(0,0,0,.3); border:1px solid var(--border-chip); border-radius:12px; padding:16px 20px; font-size:13px; line-height:1.6; color:var(--accent); overflow-x:auto; margin:0 0 20px; font-family:'Courier New',monospace; }
  [data-theme="light"] .blog-post-pre { background:rgba(0,0,0,.05); }
  .blog-inline-code { background:rgba(211,184,154,.12); border:1px solid rgba(211,184,154,.2); color:var(--accent); padding:1px 6px; border-radius:5px; font-size:.9em; font-family:'Courier New',monospace; }

  /* ── SETTINGS ── */
  .settings-container { display:flex; flex-direction:column; gap:24px; }
  .settings-row { display:flex; flex-direction:column; gap:10px; padding-bottom:20px; border-bottom:1px solid var(--border-subtle); }
  .settings-row:last-child { border-bottom:none; padding-bottom:0; }
  .settings-label { font-size:13.5px; font-weight:600; color:var(--text-primary); display:flex; justify-content:space-between; }
  .settings-label span.value { color:var(--accent); }
  .settings-desc { font-size:12.5px; color:var(--text-secondary); margin:0; }
  .shortcut-badge { background:var(--shortcut-bg); padding:6px 12px; border-radius:8px; font-size:12px; font-weight:600; color:var(--accent); white-space:nowrap; margin-left:15px; flex-shrink:0; }
  .slider-range { -webkit-appearance:none; width:100%; height:6px; border-radius:5px; background:var(--bg-chip-hover); outline:none; margin-top:8px; }
  .slider-range::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:var(--text-primary); cursor:pointer; transition:background .2s ease,transform .2s ease; border:2px solid var(--bg-base); }
  .slider-range::-webkit-slider-thumb:hover { background:var(--accent); transform:scale(1.2); }
  .select-input { width:100%; padding:12px 14px; border-radius:12px; background:var(--bg-select); border:1px solid var(--border-select); color:var(--text-primary); font-family:'Montserrat',sans-serif; font-size:13.5px; outline:none; cursor:pointer; transition:border-color .3s ease; }
  .select-input:focus { border-color:var(--accent); }
  [data-theme="light"] .select-input option { background:#fff; color:#111; }

  /* ── FOOTER ── */
  .app-footer { text-align:center; padding:40px 20px; margin-top:40px; border-top:1px solid var(--border-subtle); }
  .footer-links { display:flex; justify-content:center; gap:25px; flex-wrap:wrap; }
  .footer-links a { color:var(--text-muted); text-decoration:none; font-size:12.5px; font-weight:500; transition:color .2s ease; cursor:pointer; }
  .footer-links a:hover { color:var(--accent); }

  /* ── TOAST ── */
  .toast { position:fixed; bottom:30px; left:50%; transform:translate(-50%,50px); background:var(--toast-success-bg); color:var(--toast-success-color); padding:12px 24px; border-radius:40px; font-size:12px; font-weight:700; letter-spacing:.5px; z-index:2000; display:flex; align-items:center; gap:10px; opacity:0; pointer-events:none; transition:transform .3s cubic-bezier(.175,.885,.32,1.275),opacity .3s ease; box-shadow:0 10px 30px rgba(0,0,0,.4); }
  .toast.error { background:rgba(248,113,113,.95); color:#fff; }
  .toast.show { transform:translate(-50%,0); opacity:1; }

  /* ── KEYFRAMES ── */
  @keyframes slideDownIn{to{opacity:1;transform:translate(-50%,0)}}
  @keyframes typewriter{to{width:180px}}
  @keyframes blinkCursor{from,to{border-color:transparent}50%{border-color:rgba(255,255,255,.75)}}
  @keyframes removeCursor{to{border-right:2px solid transparent}}
  @keyframes pageFadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
  @keyframes elementFadeUp{to{opacity:1;transform:translateY(0)}}
  @keyframes drawUnderline{to{transform:scaleX(1)}}
`;
