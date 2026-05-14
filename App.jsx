import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Zap, Play, Pause, RotateCcw, Send, MessageSquare } from 'lucide-react';

export default function GPUSchedulerDashboard() {
  // Simulation state
  const [isRunning, setIsRunning] = useState(false);
  const [simTime, setSimTime] = useState(0);
  const [smStates, setSmStates] = useState(Array(8).fill({ busy: false, fault: false, job: null }));
  const [signals, setSignals] = useState({
    clk: 0, rst_n: 1, job_valid: 0, job_prio: 0,
    sm_dispatch: 0, sm_done: 0, sm_fault: 0,
    active_jobs: 0, fifo_full: 0, hb_active: 0xFF
  });
  
  // Waveform history
  const [waveformData, setWaveformData] = useState([]);
  const canvasRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  
  // AI Chat state
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'GPU Scheduler AI Assistant ready. Ask me about the design, synthesis results, or presentation tips!' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const chatEndRef = useRef(null);

  const openaiApiKey = process.env.REACT_APP_OPENAI_API_KEY;
  const anthropicApiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
  const aiProviderLabel = anthropicApiKey
    ? 'Claude Sonnet 4'
    : openaiApiKey
    ? 'OpenAI gpt-3.5-turbo'
    : 'Local assistant';

  const fallbackAIResponse = (userMsg) => {
    const prompt = userMsg.toLowerCase();
    if (prompt.includes('priority')) {
      return 'Priority dispatch in this scheduler gives the next available SM the highest-priority job first, while lower priorities wait in the FIFO. This means critical work is moved forward quickly, while fairness is preserved by using separate priority queues.';
    }
    if (prompt.includes('heartbeat') || prompt.includes('fault')) {
      return 'The heartbeat watchdog monitors SM liveness. If an SM fails to toggle its heartbeat within the 256-cycle timeout, the scheduler flags an sm_fault and triggers recovery logic to prevent stale jobs from blocking the system.';
    }
    if (prompt.includes('waveform') || prompt.includes('analyze')) {
      return 'The waveform viewer shows the clock toggling each cycle and tracks job_valid, dispatch, done, and FIFO pressure. When job_valid is high, the scheduler may dispatch a new job to idle SMs. The active_jobs count rises as jobs are accepted, and fifo_full indicates back-pressure when dispatch cannot keep up.';
    }
    if (prompt.includes('synth')) {
      return 'Synthesis trade-offs are usually area versus frequency. Higher frequency often requires more pipeline stages and buffering, which increases area; lower area saves gates but may reduce maximum clock rate. This design targets 100 MHz while keeping area modest.';
    }
    if (prompt.includes('critical path')) {
      return 'The critical path is likely in the scheduler arbitration or FIFO selection logic, where priority comparison and SM ready signals must settle before dispatch. Simplifying comparisons or adding registers can reduce path delay.';
    }
    if (prompt.includes('mentor')) {
      return 'For mentor presentations, focus on the scheduler architecture, how priority queues and heartbeat detection improve reliability, and the key synthesis results: 138.9 MHz target frequency with low gate count and efficient area usage.';
    }
    return 'I am running as a local assistant fallback. Ask about priority dispatch, heartbeat/fault logic, waveform behavior, synthesis trade-offs, or critical path optimization.';
  };

  // Quick action prompts
  const quickActions = [
    { label: 'Priority dispatch', prompt: 'Explain how priority-based job dispatch works in this scheduler' },
    { label: 'sm_fault logic', prompt: 'How does the heartbeat timeout fault detection work?' },
    { label: 'Read waveform', prompt: 'Analyze the current waveform and explain what\'s happening' },
    { label: 'Synth tradeoffs', prompt: 'What are the synthesis trade-offs between area and frequency?' },
    { label: 'Heartbeat FSM', prompt: 'Explain the heartbeat monitoring state machine' },
    { label: 'Mentor tips', prompt: 'Give me tips for presenting this design to my mentor' },
    { label: 'FIFO pressure', prompt: 'How does the back-pressure mechanism work when FIFOs are full?' },
    { label: 'Critical path', prompt: 'What is the critical path in this design and how can it be optimized?' }
  ];

  // Simulation engine
  useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      setSimTime(t => t + 1);
      
      // Toggle clock
      setSignals(prev => {
        const newClk = prev.clk === 0 ? 1 : 0;
        const newSignals = { ...prev, clk: newClk };
        
        // On rising edge, update logic
        if (newClk === 1) {
          // Random job submission
          if (Math.random() > 0.7) {
            newSignals.job_valid = 1;
            newSignals.job_prio = Math.floor(Math.random() * 4);
          } else {
            newSignals.job_valid = 0;
          }
          
          // Random SM completion
          newSignals.sm_done = Math.floor(Math.random() * 256);
          
          // Update SM states
          const newSmStates = [...smStates];
          for (let i = 0; i < 8; i++) {
            if (newSignals.sm_done & (1 << i)) {
              newSmStates[i] = { ...newSmStates[i], busy: false, job: null };
            }
            // Random dispatch
            if (!newSmStates[i].busy && Math.random() > 0.8) {
              newSmStates[i] = { 
                busy: true, 
                fault: false, 
                job: `0x${Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase()}`
              };
              newSignals.sm_dispatch |= (1 << i);
            }
          }
          setSmStates(newSmStates);
          
          // Count active jobs
          newSignals.active_jobs = newSmStates.filter(s => s.busy).length;
          
          // FIFO full simulation
          newSignals.fifo_full = Math.random() > 0.95 ? 1 : 0;
        }
        
        return newSignals;
      });
      
      // Add to waveform history
      setWaveformData(prev => {
        const newData = [...prev, { ...signals, time: simTime }];
        return newData.slice(-200); // Keep last 200 samples
      });
      
      setScrollOffset(prev => prev + 1);
      
    }, 50); // 20Hz update
    
    return () => clearInterval(interval);
  }, [isRunning, simTime, signals, smStates]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length < 2) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear with grid
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#1a2332';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    const signalNames = ['clk', 'rst_n', 'job_valid', 'job_prio', 'sm_dispatch', 'sm_done', 'sm_fault', 'active_jobs', 'fifo_full', 'hb_active'];
    const colors = ['#00ff88', '#00d4ff', '#ffaa00', '#ff6b9d', '#a78bfa', '#fbbf24', '#ef4444', '#10b981', '#f59e0b', '#6366f1'];
    const rowHeight = height / signalNames.length;
    
    // Draw signals
    signalNames.forEach((name, idx) => {
      const y = idx * rowHeight;
      
      // Signal label
      ctx.fillStyle = '#64748b';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(name, 5, y + 15);
      
      // Waveform
      ctx.strokeStyle = colors[idx];
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const startIdx = Math.max(0, waveformData.length - 100);
      const visibleData = waveformData.slice(startIdx);
      
      visibleData.forEach((sample, i) => {
        const x = 120 + (i * (width - 140) / 100);
        let value = sample[name];
        
        // Normalize value for display
        if (name === 'job_prio') value = value / 3;
        else if (name === 'sm_dispatch' || name === 'sm_done' || name === 'hb_active') value = value > 0 ? 1 : 0;
        else if (name === 'active_jobs') value = value / 8;
        
        const waveY = y + rowHeight - (value * (rowHeight - 10)) - 5;
        
        if (i === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      });
      
      ctx.stroke();
    });
    
    // Time marker
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText(`T=${simTime}ns`, width - 80, 20);
    
  }, [waveformData, simTime, scrollOffset]);

  // AI Chat function
  const sendMessageToAI = async (userMsg) => {
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setIsAILoading(true);

    const context = `You are an AI assistant helping with a GPU chip fabrication scheduler project. Here's the current state:\n\n**Design Specs:**\n- 8 Streaming Multiprocessors (SMs)\n- 4-priority FIFO queue (0=low, 3=critical)\n- Heartbeat watchdog with 256-cycle timeout\n- 100 MHz target clock\n- Post-synthesis: 138.9 MHz, 2,939 gates, 14,695 GE area\n\n**Current Simulation:**\n- Time: ${simTime}ns\n- Active Jobs: ${signals.active_jobs}\n- FIFO Full: ${signals.fifo_full ? 'YES' : 'NO'}\n- SM States: ${smStates.map((s, i) => `SM${i}:${s.busy ? 'BUSY' : 'IDLE'}${s.fault ? '(FAULT)' : ''}`).join(', ')}\n\n**RTL Modules:**\n1. scheduler_top.sv - Main scheduler with priority FIFOs\n2. scheduler_tb.sv - Testbench with 5 test cases\n\nUser question: ${userMsg}\n\nProvide a technical, mentor-presentation-ready response.`;

    try {
      let aiResponse;

      if (openaiApiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: context },
              { role: 'user', content: userMsg },
            ],
            max_tokens: 800,
          }),
        });
        const data = await response.json();
        aiResponse = data.choices?.[0]?.message?.content || 'Error: no response from OpenAI.';
      } else if (anthropicApiKey) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anthropicApiKey}`,
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: context }],
            max_tokens_to_sample: 1000,
          }),
        });
        const data = await response.json();
        aiResponse = data?.completion || data?.content?.find(item => item.type === 'text')?.text || 'Error: no response from Anthropic.';
      } else {
        aiResponse = fallbackAIResponse(userMsg);
      }

      setMessages([...newMessages, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      const fallback = fallbackAIResponse(userMsg);
      setMessages([...newMessages, {
        role: 'assistant',
        content: `Remote AI failed: ${error.message}. Using local assistant fallback instead.\n\n${fallback}`,
      }] );
    } finally {
      setIsAILoading(false);
      setInputMessage('');
    }
  };

  const handleQuickAction = (prompt) => {
    sendMessageToAI(prompt);
  };

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      sendMessageToAI(inputMessage);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const injectFault = (smId) => {
    setSmStates(prev => {
      const newStates = [...prev];
      newStates[smId] = { ...newStates[smId], fault: true };
      return newStates;
    });
    setSignals(prev => ({ ...prev, sm_fault: prev.sm_fault | (1 << smId) }));
  };

  const resetSim = () => {
    setSimTime(0);
    setSmStates(Array(8).fill({ busy: false, fault: false, job: null }));
    setSignals({
      clk: 0, rst_n: 1, job_valid: 0, job_prio: 0,
      sm_dispatch: 0, sm_done: 0, sm_fault: 0,
      active_jobs: 0, fifo_full: 0, hb_active: 0xFF
    });
    setWaveformData([]);
    setScrollOffset(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-slate-100 font-['Space_Grotesk',sans-serif] p-6">
      {/* Header */}
      <div className="mb-6 border-b-2 border-emerald-400/30 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              GPU Chip Scheduler
            </h1>
            <p className="text-slate-400 mt-1 font-mono text-sm">
              8-SM Priority Dispatch • HB Watchdog • Live Analysis
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-slate-800/50 px-4 py-2 rounded-lg border border-emerald-400/30">
              <span className="text-xs text-slate-400 font-mono">SIM TIME</span>
              <div className="text-2xl font-bold text-emerald-400 font-mono">{simTime}ns</div>
            </div>
            <div className="bg-slate-800/50 px-4 py-2 rounded-lg border border-cyan-400/30">
              <span className="text-xs text-slate-400 font-mono">ACTIVE</span>
              <div className="text-2xl font-bold text-cyan-400 font-mono">{signals.active_jobs}/8</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* LEFT PANEL: Simulation */}
        <div className="space-y-6">
          {/* Waveform Viewer */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Live Waveform Monitor
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsRunning(!isRunning)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    isRunning 
                      ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-400/50' 
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-400/50'
                  }`}
                >
                  {isRunning ? <><Pause className="w-4 h-4 inline mr-2" />Pause</> : <><Play className="w-4 h-4 inline mr-2" />Run</>}
                </button>
                <button
                  onClick={resetSim}
                  className="px-4 py-2 rounded-lg font-semibold bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 border border-slate-600/50 transition-all"
                >
                  <RotateCcw className="w-4 h-4 inline mr-2" />Reset
                </button>
              </div>
            </div>
            <canvas
              ref={canvasRef}
              width={800}
              height={400}
              className="w-full rounded-lg border border-slate-700/50 shadow-2xl"
            />
          </div>

          {/* SM Status Grid */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
            <h2 className="text-lg font-bold text-cyan-400 mb-4">SM Status Grid</h2>
            <div className="grid grid-cols-4 gap-3">
              {smStates.map((sm, idx) => (
                <div
                  key={idx}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    sm.fault
                      ? 'bg-red-500/10 border-red-500/50 shadow-lg shadow-red-500/20'
                      : sm.busy
                      ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800/30 border-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm font-mono">SM{idx}</span>
                    {sm.fault && <AlertCircle className="w-4 h-4 text-red-400 animate-pulse" />}
                  </div>
                  <div className={`text-xs font-mono ${
                    sm.fault ? 'text-red-400' : sm.busy ? 'text-emerald-400' : 'text-slate-500'
                  }`}>
                    {sm.fault ? 'FAULT' : sm.busy ? 'BUSY' : 'IDLE'}
                  </div>
                  {sm.job && (
                    <div className="text-xs font-mono text-slate-400 mt-1 truncate">
                      {sm.job}
                    </div>
                  )}
                  <button
                    onClick={() => injectFault(idx)}
                    className="mt-2 w-full text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-400/30 transition-all"
                  >
                    Inject Fault
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Status Indicators */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border-2 transition-all ${
              signals.fifo_full
                ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800/30 border-slate-700/50'
            }`}>
              <div className="text-sm text-slate-400 font-mono mb-1">FIFO STATUS</div>
              <div className={`text-xl font-bold font-mono ${
                signals.fifo_full ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {signals.fifo_full ? 'FULL' : 'READY'}
              </div>
            </div>
            <div className="p-4 rounded-lg border-2 bg-slate-800/30 border-slate-700/50">
              <div className="text-sm text-slate-400 font-mono mb-1">JOB PRIORITY</div>
              <div className="text-xl font-bold font-mono text-cyan-400">
                {signals.job_valid ? `P${signals.job_prio}` : '--'}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: AI Chat */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 flex flex-col h-[calc(100vh-12rem)]">
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-700/50">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-purple-400">AI Design Assistant</h2>
            <span className="text-xs text-slate-500 font-mono ml-auto">{aiProviderLabel}</span>
          </div>

          {/* Quick Actions */}
          <div className="mb-4">
            <div className="text-xs text-slate-400 mb-2 font-mono">QUICK ACTIONS</div>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAction(action.prompt)}
                  disabled={isAILoading}
                  className="px-3 py-2 text-xs rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all disabled:opacity-50 font-mono text-left"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-cyan-500/10 border border-cyan-500/30 ml-8'
                    : 'bg-purple-500/10 border border-purple-500/30 mr-8'
                }`}
              >
                <div className="text-xs text-slate-400 mb-1 font-mono">
                  {msg.role === 'user' ? 'YOU' : 'AI ASSISTANT'}
                </div>
                <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ))}
            {isAILoading && (
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 mr-8">
                <div className="text-xs text-slate-400 mb-1 font-mono">AI ASSISTANT</div>
                <div className="text-sm text-slate-200">
                  <span className="inline-block animate-pulse">Analyzing...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask about the design..."
              disabled={isAILoading}
              className="flex-1 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400/50 focus:ring-2 focus:ring-purple-400/20 transition-all disabled:opacity-50 font-mono text-sm"
            />
            <button
              onClick={handleSendMessage}
              disabled={isAILoading || !inputMessage.trim()}
              className="px-6 py-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-400/50 transition-all disabled:opacity-50 font-semibold"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-slate-500 font-mono">
        SystemVerilog RTL • 138.9 MHz • 2,939 Gates • 14,695 GE Area • 5 Test Cases PASSED
      </div>
    </div>
  );
}