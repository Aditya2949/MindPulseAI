import { useState, useEffect } from "react";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const palette = {
  bg: "#0d1117",
  surface: "#161b22",
  card: "#1c2333",
  accent: "#7c6af7",
  accentSoft: "#a78bfa",
  green: "#22c55e",
  yellow: "#facc15",
  red: "#f87171",
  text: "#e6edf3",
  muted: "#8b949e",
  border: "#30363d",
};

const moodEmojis = ["😔", "😟", "😐", "🙂", "😊"];
const moodLabels = ["Very Low", "Low", "Neutral", "Good", "Great"];

function getPulseColor(score) {
  if (score >= 80) return palette.green;
  if (score >= 50) return palette.yellow;
  return palette.red;
}

function CirclePulse({ score, label }) {
  const color = getPulseColor(score);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke={palette.border} strokeWidth="10" />
        <circle
          cx="65" cy="65" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        <text x="65" y="60" textAnchor="middle" fill={color} fontSize="26" fontWeight="700" fontFamily="monospace">
          {score}
        </text>
        <text x="65" y="78" textAnchor="middle" fill={palette.muted} fontSize="11" fontFamily="sans-serif">
          / 100
        </text>
      </svg>
      <span style={{ color: palette.muted, fontSize: 13 }}>{label}</span>
    </div>
  );
}

function Tag({ text, color }) {
  return (
    <span style={{
      background: color + "22",
      color: color,
      border: `1px solid ${color}44`,
      borderRadius: 20,
      padding: "3px 12px",
      fontSize: 12,
      fontWeight: 600,
    }}>{text}</span>
  );
}

export default function MindPulseAI() {
  const [tab, setTab] = useState("checkin");
  const [journalText, setJournalText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [mood, setMood] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [sleep, setSleep] = useState("");
  const [history, setHistory] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);

  useEffect(() => {
    // Load history from memory
    const saved = window._mindpulseHistory || [];
    setHistory(saved);
  }, []);

  async function analyzeEntry() {
    if (!journalText.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const prompt = `You are MindPulseAI, an empathetic mental health monitoring assistant. Analyze the following journal entry for emotional state, stress, and anxiety levels.

Journal Entry: "${journalText}"
Mood Rating: ${mood !== null ? moodLabels[mood] : "Not specified"}
Energy Level: ${energy !== null ? energy + "/5" : "Not specified"}
Sleep Hours: ${sleep || "Not specified"}

Respond ONLY with a valid JSON object (no markdown, no backticks) with this exact structure:
{
  "wellnessScore": <0-100 integer>,
  "stressLevel": <"Low"|"Moderate"|"High">,
  "anxietyLevel": <"Low"|"Moderate"|"High">,
  "emotionTags": [<3-5 emotion strings>],
  "summary": "<2-3 sentence empathetic summary of their emotional state>",
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>", "<actionable suggestion 3>"],
  "affirmation": "<one short uplifting affirmation>"
}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await response.json();
      const text = data.content.map(i => i.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);

      // Save to history
      const entry = {
        date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        score: parsed.wellnessScore,
        stress: parsed.stressLevel,
        anxiety: parsed.anxietyLevel,
        mood: mood !== null ? moodEmojis[mood] : "—",
        journal: journalText.slice(0, 60) + "...",
      };
      const newHistory = [entry, ...history].slice(0, 10);
      setHistory(newHistory);
      window._mindpulseHistory = newHistory;
      setCheckinDone(true);
    } catch (e) {
      setResult({ error: "Analysis failed. Please try again." });
    }
    setLoading(false);
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const systemPrompt = `You are MindPulseAI's empathetic mental wellness companion agent. You provide supportive, compassionate responses to help users manage stress, anxiety, and emotional wellbeing. Keep responses concise (2-4 sentences), warm, and actionable. Never diagnose. Always encourage professional help for serious concerns.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1000,
          system: systemPrompt,
          messages: newMessages,
        })
      });
      const data = await response.json();
      const aiText = data.content.map(i => i.text || "").join("");
      setChatMessages([...newMessages, { role: "assistant", content: aiText }]);
    } catch (e) {
      setChatMessages([...newMessages, { role: "assistant", content: "I'm here for you. Could you try again?" }]);
    }
    setChatLoading(false);
  }

  const levelColor = (level) => {
    if (level === "Low") return palette.green;
    if (level === "Moderate") return palette.yellow;
    return palette.red;
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: palette.bg,
      color: palette.text,
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: "0 0 40px 0"
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #1a1040 0%, #0d1117 100%)`,
        borderBottom: `1px solid ${palette.border}`,
        padding: "20px 24px 16px",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${palette.accent}, #c084fc)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18
          }}>🧠</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px" }}>MindPulseAI</div>
            <div style={{ fontSize: 11, color: palette.muted }}>Mental Wellness Agent</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: palette.surface, borderRadius: 10, padding: 4 }}>
          {[
            { id: "checkin", label: "Daily Check-in", icon: "📋" },
            { id: "chat", label: "Talk to AI", icon: "💬" },
            { id: "history", label: "My Journey", icon: "📈" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1,
              padding: "8px 4px",
              border: "none",
              borderRadius: 7,
              background: tab === t.id ? palette.accent : "transparent",
              color: tab === t.id ? "#fff" : palette.muted,
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: 11,
              cursor: "pointer",
              transition: "all 0.2s",
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>

        {/* DAILY CHECK-IN TAB */}
        {tab === "checkin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Greeting */}
            <div style={{
              background: `linear-gradient(135deg, #1a1040, #161b22)`,
              border: `1px solid ${palette.accent}33`,
              borderRadius: 14, padding: "16px 18px"
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>
                {new Date().getHours() < 12 ? "🌅 Good Morning" : new Date().getHours() < 17 ? "☀️ Good Afternoon" : "🌙 Good Evening"}
              </div>
              <div style={{ color: palette.muted, fontSize: 13 }}>
                How are you feeling today? Let's check in with your mental wellness.
              </div>
            </div>

            {/* Mood Selector */}
            <div style={{ background: palette.card, borderRadius: 14, padding: "16px 18px", border: `1px solid ${palette.border}` }}>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>How's your mood? *</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {moodEmojis.map((e, i) => (
                  <button key={i} onClick={() => setMood(i)} style={{
                    background: mood === i ? palette.accent + "33" : "transparent",
                    border: mood === i ? `2px solid ${palette.accent}` : `2px solid ${palette.border}`,
                    borderRadius: 12, padding: "10px 8px",
                    cursor: "pointer", transition: "all 0.15s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    flex: 1, margin: "0 3px",
                  }}>
                    <span style={{ fontSize: 22 }}>{e}</span>
                    <span style={{ fontSize: 9, color: palette.muted }}>{moodLabels[i]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Energy + Sleep */}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1, background: palette.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${palette.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>⚡ Energy</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setEnergy(n)} style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: energy >= n ? palette.accent : palette.surface,
                      border: `1px solid ${energy >= n ? palette.accent : palette.border}`,
                      color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, background: palette.card, borderRadius: 14, padding: "14px 16px", border: `1px solid ${palette.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>😴 Sleep (hrs)</div>
                <input
                  type="number" min="0" max="12" placeholder="e.g. 7"
                  value={sleep} onChange={e => setSleep(e.target.value)}
                  style={{
                    width: "100%", background: palette.surface, border: `1px solid ${palette.border}`,
                    borderRadius: 8, padding: "8px 10px", color: palette.text, fontSize: 14,
                    outline: "none", boxSizing: "border-box"
                  }}
                />
              </div>
            </div>

            {/* Journal */}
            <div style={{ background: palette.card, borderRadius: 14, padding: "16px 18px", border: `1px solid ${palette.border}` }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>📝 How are you feeling? Tell me more...</div>
              <textarea
                value={journalText}
                onChange={e => setJournalText(e.target.value)}
                placeholder="Write anything — stress at college, how your day went, what's on your mind... The AI agent will analyze it empathetically."
                rows={5}
                style={{
                  width: "100%", background: palette.surface,
                  border: `1px solid ${palette.border}`, borderRadius: 10,
                  padding: "12px", color: palette.text, fontSize: 14,
                  resize: "vertical", outline: "none", fontFamily: "inherit",
                  lineHeight: 1.6, boxSizing: "border-box"
                }}
              />
            </div>

            {/* Analyze Button */}
            <button onClick={analyzeEntry} disabled={loading || !journalText.trim()} style={{
              background: loading || !journalText.trim()
                ? palette.border
                : `linear-gradient(135deg, ${palette.accent}, #c084fc)`,
              color: "#fff", border: "none", borderRadius: 12,
              padding: "14px", fontWeight: 700, fontSize: 15,
              cursor: loading || !journalText.trim() ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}>
              {loading ? "🔄 Analyzing your wellness..." : "🧠 Analyze My Wellness"}
            </button>

            {/* Result */}
            {result && !result.error && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.5s ease" }}>

                {/* Score */}
                <div style={{
                  background: palette.card, borderRadius: 14, padding: "20px",
                  border: `1px solid ${palette.border}`, textAlign: "center"
                }}>
                  <CirclePulse score={result.wellnessScore} label="Wellness Score" />
                  <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                    <Tag text={`Stress: ${result.stressLevel}`} color={levelColor(result.stressLevel)} />
                    <Tag text={`Anxiety: ${result.anxietyLevel}`} color={levelColor(result.anxietyLevel)} />
                  </div>
                </div>

                {/* Emotions */}
                <div style={{ background: palette.card, borderRadius: 14, padding: "16px 18px", border: `1px solid ${palette.border}` }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: palette.muted }}>DETECTED EMOTIONS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {result.emotionTags?.map((e, i) => (
                      <Tag key={i} text={e} color={palette.accentSoft} />
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div style={{
                  background: `linear-gradient(135deg, #1a1040, #161b22)`,
                  borderRadius: 14, padding: "16px 18px",
                  border: `1px solid ${palette.accent}33`,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: palette.accentSoft }}>AI INSIGHT</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: palette.text }}>{result.summary}</p>
                </div>

                {/* Suggestions */}
                <div style={{ background: palette.card, borderRadius: 14, padding: "16px 18px", border: `1px solid ${palette.border}` }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: palette.muted }}>RECOMMENDED ACTIONS</div>
                  {result.suggestions?.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 8,
                        background: palette.accent + "33", color: palette.accentSoft,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>{i + 1}</div>
                      <span style={{ fontSize: 13, lineHeight: 1.6 }}>{s}</span>
                    </div>
                  ))}
                </div>

                {/* Affirmation */}
                <div style={{
                  background: `linear-gradient(135deg, #052e16, #0d1117)`,
                  border: `1px solid ${palette.green}33`,
                  borderRadius: 14, padding: "16px 18px", textAlign: "center"
                }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>✨</div>
                  <div style={{ color: palette.green, fontSize: 14, fontStyle: "italic", lineHeight: 1.6 }}>
                    "{result.affirmation}"
                  </div>
                </div>
              </div>
            )}

            {result?.error && (
              <div style={{ background: "#2d1515", border: `1px solid ${palette.red}33`, borderRadius: 12, padding: 14, color: palette.red, fontSize: 13 }}>
                {result.error}
              </div>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              background: palette.card, borderRadius: 14, padding: "14px 16px",
              border: `1px solid ${palette.border}`, fontSize: 13, color: palette.muted, lineHeight: 1.6
            }}>
              💬 Talk to your <strong style={{ color: palette.accentSoft }}>MindPulseAI Agent</strong> — share what's on your mind, ask for coping tips, or just vent. It's here to listen.
            </div>

            {/* Messages */}
            <div style={{
              minHeight: 300, maxHeight: 420, overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 10,
              padding: "4px 0"
            }}>
              {chatMessages.length === 0 && (
                <div style={{ textAlign: "center", color: palette.muted, fontSize: 13, marginTop: 40 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>
                  Start a conversation — I'm here to help.
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}>
                  <div style={{
                    maxWidth: "80%",
                    background: m.role === "user"
                      ? `linear-gradient(135deg, ${palette.accent}, #c084fc)`
                      : palette.card,
                    border: m.role === "assistant" ? `1px solid ${palette.border}` : "none",
                    borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    padding: "10px 14px",
                    fontSize: 13, lineHeight: 1.6,
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", gap: 6, padding: "4px 0" }}>
                  <div style={{
                    background: palette.card, border: `1px solid ${palette.border}`,
                    borderRadius: "14px 14px 14px 4px", padding: "10px 14px",
                    color: palette.muted, fontSize: 13,
                  }}>
                    🧠 Thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !chatLoading && sendChat()}
                placeholder="Type your message..."
                style={{
                  flex: 1, background: palette.card,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 10, padding: "12px 14px",
                  color: palette.text, fontSize: 14, outline: "none",
                }}
              />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{
                background: chatLoading || !chatInput.trim() ? palette.border : palette.accent,
                border: "none", borderRadius: 10, padding: "12px 16px",
                color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer",
              }}>→</button>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", color: palette.muted, marginTop: 60, fontSize: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
                No check-ins yet.<br />Complete your first daily check-in to start tracking!
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 600, fontSize: 14, color: palette.muted }}>YOUR WELLNESS JOURNEY</div>
                {history.map((h, i) => (
                  <div key={i} style={{
                    background: palette.card, borderRadius: 14, padding: "14px 16px",
                    border: `1px solid ${palette.border}`,
                    display: "flex", alignItems: "center", gap: 14
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: getPulseColor(h.score) + "22",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: getPulseColor(h.score) }}>{h.score}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{h.date} · {h.time}</span>
                        <span style={{ fontSize: 18 }}>{h.mood}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Tag text={`Stress: ${h.stress}`} color={levelColor(h.stress)} />
                        <Tag text={`Anxiety: ${h.anxiety}`} color={levelColor(h.anxiety)} />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  );
}
