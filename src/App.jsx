import { useState } from "react";
import {
    CLASSES, ENVIRONMENTS, THEMES, TONES, VILLAIN_TYPES,
    MAX_PLAYERS, MAX_TEXT_LENGTH, computeXpBudget,
} from "../shared/dnd.js";

// ─── Data Tables ──────────────────────────────────────────────────────────────
const CR_XP_MAP = [
    { cr: "0", n: 0, xp: 10 }, { cr: "1/8", n: 0.125, xp: 25 }, { cr: "1/4", n: 0.25, xp: 50 },
    { cr: "1/2", n: 0.5, xp: 100 }, { cr: "1", n: 1, xp: 200 }, { cr: "2", n: 2, xp: 450 },
    { cr: "3", n: 3, xp: 700 }, { cr: "4", n: 4, xp: 1100 }, { cr: "5", n: 5, xp: 1800 },
    { cr: "6", n: 6, xp: 2300 }, { cr: "7", n: 7, xp: 2900 }, { cr: "8", n: 8, xp: 3900 },
    { cr: "9", n: 9, xp: 5000 }, { cr: "10", n: 10, xp: 5900 }, { cr: "11", n: 11, xp: 7200 },
    { cr: "12", n: 12, xp: 8400 }, { cr: "13", n: 13, xp: 10000 }, { cr: "14", n: 14, xp: 11500 },
    { cr: "15", n: 15, xp: 13000 }, { cr: "16", n: 16, xp: 15000 }, { cr: "17", n: 17, xp: 18000 },
    { cr: "18", n: 18, xp: 20000 }, { cr: "19", n: 19, xp: 22000 }, { cr: "20", n: 20, xp: 25000 },
];

const DIFF_COLORS = { Easy: "#16a34a", Medium: "#2563eb", Hard: "#d97706", Deadly: "#dc2626" };
const TIER_LABELS = { 1: "Tier 1 — Local Heroes", 5: "Tier 2 — Heroes of the Realm", 11: "Tier 3 — Masters", 17: "Tier 4 — World Shapers" };

const D5E = "https://www.dnd5eapi.co/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTierLabel(lvl) {
    if (lvl >= 17) return TIER_LABELS[17];
    if (lvl >= 11) return TIER_LABELS[11];
    if (lvl >= 5) return TIER_LABELS[5];
    return TIER_LABELS[1];
}

function getBestCRNums(xpTarget) {
    let best = 0, bestDiff = Infinity;
    CR_XP_MAP.forEach((e, i) => {
        const d = Math.abs(e.xp - xpTarget);
        if (d < bestDiff) { bestDiff = d; best = i; }
    });
    const idxs = [];
    if (best > 0) idxs.push(best - 1);
    idxs.push(best);
    if (best < CR_XP_MAP.length - 1) idxs.push(best + 1);
    return idxs.map(i => CR_XP_MAP[i].n);
}

async function fetchMonsters(xpBudget) {
    const crNums = getBestCRNums(xpBudget / 3);
    const targets = crNums.slice(-2);
    let all = [];
    for (const cr of targets) {
        try {
            const r = await fetch(`${D5E}/monsters?challenge_rating=${cr}`);
            const d = await r.json();
            if (d.results?.length) {
                const picks = d.results.sort(() => Math.random() - 0.5).slice(0, 3);
                const details = await Promise.all(picks.map(m => fetch(`${D5E}/monsters/${m.index}`).then(r2 => r2.json())));
                all = [...all, ...details];
            }
        } catch { }
    }
    return all.slice(0, 5);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Stepper({ value, onChange, min = 1, max = 20 }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="sf-stepper" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
            <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Cinzel',serif", minWidth: 36, textAlign: "center", color: "#1a1d29" }}>{value}</span>
            <button className="sf-stepper" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
        </div>
    );
}

function Chip({ label, active, onClick }) {
    return (
        <div className={`sf-chip ${active ? "sf-chip-on" : "sf-chip-off"}`} onClick={onClick}>{label}</div>
    );
}

function SectionLabel({ children, color = "#a8832a" }) {
    return <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color, marginBottom: 12 }}>{children}</div>;
}

function Card({ children, style = {} }) {
    return <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5dfd3", padding: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", ...style }}>{children}</div>;
}

function ReadAloud({ text }) {
    return (
        <div style={{ background: "#f7f3eb", borderLeft: "4px solid #a8832a", padding: "14px 18px", borderRadius: "0 8px 8px 0", fontStyle: "italic", fontSize: 14, lineHeight: 1.75, color: "#3d3428" }}>
            {text}
        </div>
    );
}

function Badge({ children, bg, color }) {
    return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: bg, color }}>{children}</span>;
}

// ─── Output: Session Outline ──────────────────────────────────────────────────
function SessionTab({ data, form }) {
    const so = data.sessionOutline;
    if (!so) return null;
    return (
        <div className="sf-fadein">
            {/* Hook */}
            <div style={{ background: "#1a1d29", borderRadius: 16, padding: 28, marginBottom: 20 }}>
                <SectionLabel color="#c8a96e">Session Hook</SectionLabel>
                <p style={{ color: "#e8e5df", fontSize: 15, lineHeight: 1.8, margin: 0 }}>{so.hook}</p>
            </div>

            {/* Acts */}
            <SectionLabel>Three-Act Structure</SectionLabel>
            {so.acts?.map((act, i) => (
                <div key={i} style={{ borderLeft: "3px solid #c53131", padding: "16px 20px", background: "#fdf9f9", borderRadius: "0 12px 12px 0", marginBottom: 12 }}>
                    <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 13, color: "#c53131", marginBottom: 8 }}>{act.act}</div>
                    <p style={{ fontSize: 14, lineHeight: 1.65, margin: "0 0 12px", color: "#1a1d29" }}>{act.summary}</p>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Key Moment</div>
                    <p style={{ fontSize: 14, fontStyle: "italic", margin: "0 0 14px", color: "#4b5563" }}>{act.keyMoment}</p>
                    <ReadAloud text={act.readAloud} />
                </div>
            ))}

            {/* NPCs */}
            {so.npcs?.length > 0 && (
                <div style={{ marginTop: 28 }}>
                    <SectionLabel>Key NPCs</SectionLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
                        {so.npcs.map((npc, i) => (
                            <div key={i} style={{ border: "1px solid #e5dfd3", borderRadius: 12, padding: 16, background: "#fff" }}>
                                <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{npc.name}</div>
                                <Badge bg="#e8f0fb" color="#1d4ed8">{npc.role}</Badge>
                                <p style={{ fontSize: 13, color: "#4b5563", margin: "10px 0", lineHeight: 1.55 }}>{npc.personality}</p>
                                <div style={{ background: "#fef9e7", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                                    <span style={{ fontWeight: 700, color: "#92400e" }}>🔒 Secret: </span>
                                    <span style={{ color: "#78350f" }}>{npc.secret}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Plot Twist + Reward */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
                <div style={{ background: "#1a1d29", borderRadius: 14, padding: 22 }}>
                    <SectionLabel color="#c8a96e">⚡ Plot Twist</SectionLabel>
                    <p style={{ color: "#e8e5df", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{so.plotTwist}</p>
                </div>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: 22 }}>
                    <SectionLabel color="#166534">🏆 Reward</SectionLabel>
                    <p style={{ color: "#14532d", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{so.reward}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Stat Block ───────────────────────────────────────────────────────────────
function findMonsterDetails(monsterDetails, name) {
    if (!monsterDetails?.length || !name) return null;
    const n = name.toLowerCase().replace(/s\b/, "").trim();
    return monsterDetails.find(m => m.name.toLowerCase() === n)
        || monsterDetails.find(m => {
            const mn = m.name.toLowerCase();
            return n.includes(mn) || mn.includes(n);
        });
}

const abilityMod = score => Math.floor((score - 10) / 2);
const fmtMod = m => (m >= 0 ? `+${m}` : `${m}`);

function SBDivider() {
    return <div style={{ height: 1, background: "#7c2d12", margin: "10px 0", opacity: 0.4 }} />;
}

function StatBlock({ monster }) {
    if (!monster) return null;
    const ac = Array.isArray(monster.armor_class)
        ? monster.armor_class.map(a => `${a.value}${a.type ? ` (${a.type})` : ""}`).join(", ")
        : monster.armor_class;
    const speed = Object.entries(monster.speed || {})
        .map(([k, v]) => `${k} ${v}`).join(", ");
    const abilities = [
        ["STR", monster.strength], ["DEX", monster.dexterity], ["CON", monster.constitution],
        ["INT", monster.intelligence], ["WIS", monster.wisdom], ["CHA", monster.charisma],
    ];
    const saves = monster.proficiencies?.filter(p => p.proficiency.name.startsWith("Saving Throw:")) || [];
    const skills = monster.proficiencies?.filter(p => p.proficiency.name.startsWith("Skill:")) || [];
    const senses = monster.senses
        ? Object.entries(monster.senses).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ")
        : "";

    return (
        <div className="sf-statblock" style={{ background: "#fff", border: "1px solid #d4c5a0", borderRadius: 10, padding: "16px 18px", marginTop: 12 }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 15, fontWeight: 700, color: "#7c2d12" }}>{monster.name}</div>
            <div style={{ fontSize: 11, fontStyle: "italic", color: "#6b7280", marginTop: 2 }}>
                {monster.size} {monster.type}{monster.subtype ? ` (${monster.subtype})` : ""}, {monster.alignment}
            </div>
            <SBDivider />
            <div style={{ fontSize: 12, lineHeight: 1.7, color: "#1a1d29" }}>
                <div><strong style={{ color: "#7c2d12" }}>Armor Class</strong> {ac}</div>
                <div><strong style={{ color: "#7c2d12" }}>Hit Points</strong> {monster.hit_points}{monster.hit_dice ? ` (${monster.hit_dice})` : ""}</div>
                <div><strong style={{ color: "#7c2d12" }}>Speed</strong> {speed}</div>
            </div>
            <SBDivider />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6, textAlign: "center" }}>
                {abilities.map(([k, v]) => (
                    <div key={k}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#7c2d12" }}>{k}</div>
                        <div style={{ fontSize: 12 }}>{v} ({fmtMod(abilityMod(v))})</div>
                    </div>
                ))}
            </div>
            <SBDivider />
            <div style={{ fontSize: 12, lineHeight: 1.65 }}>
                {saves.length > 0 && (
                    <div><strong style={{ color: "#7c2d12" }}>Saving Throws</strong>{" "}
                        {saves.map(p => `${p.proficiency.name.replace("Saving Throw: ", "")} ${fmtMod(p.value)}`).join(", ")}
                    </div>
                )}
                {skills.length > 0 && (
                    <div><strong style={{ color: "#7c2d12" }}>Skills</strong>{" "}
                        {skills.map(p => `${p.proficiency.name.replace("Skill: ", "")} ${fmtMod(p.value)}`).join(", ")}
                    </div>
                )}
                {monster.damage_vulnerabilities?.length > 0 && <div><strong style={{ color: "#7c2d12" }}>Damage Vulnerabilities</strong> {monster.damage_vulnerabilities.join(", ")}</div>}
                {monster.damage_resistances?.length > 0 && <div><strong style={{ color: "#7c2d12" }}>Damage Resistances</strong> {monster.damage_resistances.join(", ")}</div>}
                {monster.damage_immunities?.length > 0 && <div><strong style={{ color: "#7c2d12" }}>Damage Immunities</strong> {monster.damage_immunities.join(", ")}</div>}
                {monster.condition_immunities?.length > 0 && <div><strong style={{ color: "#7c2d12" }}>Condition Immunities</strong> {monster.condition_immunities.map(c => c.name).join(", ")}</div>}
                {senses && <div><strong style={{ color: "#7c2d12" }}>Senses</strong> {senses}</div>}
                {monster.languages && <div><strong style={{ color: "#7c2d12" }}>Languages</strong> {monster.languages}</div>}
                <div><strong style={{ color: "#7c2d12" }}>Challenge</strong> {monster.challenge_rating} ({monster.xp?.toLocaleString()} XP)</div>
            </div>
            {monster.special_abilities?.length > 0 && (
                <>
                    <SBDivider />
                    {monster.special_abilities.map((a, i) => (
                        <div key={i} style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>
                            <strong><em>{a.name}.</em></strong> {a.desc}
                        </div>
                    ))}
                </>
            )}
            {monster.actions?.length > 0 && (
                <>
                    <SBDivider />
                    <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, color: "#7c2d12", marginBottom: 6 }}>Actions</div>
                    {monster.actions.map((a, i) => (
                        <div key={i} style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>
                            <strong><em>{a.name}.</em></strong> {a.desc}
                        </div>
                    ))}
                </>
            )}
            {monster.legendary_actions?.length > 0 && (
                <>
                    <SBDivider />
                    <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, color: "#7c2d12", marginBottom: 6 }}>Legendary Actions</div>
                    {monster.legendary_actions.map((a, i) => (
                        <div key={i} style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>
                            <strong><em>{a.name}.</em></strong> {a.desc}
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

// ─── Output: Encounter Builder ────────────────────────────────────────────────
function EncounterTab({ data, form, monsterDetails }) {
    const eb = data.encounterBuilder;
    if (!eb) return null;
    const diffColor = DIFF_COLORS[form.difficulty];
    return (
        <div className="sf-fadein">
            {/* Setup + Read-Aloud */}
            <Card style={{ marginBottom: 20 }}>
                <SectionLabel>Encounter Setup</SectionLabel>
                <p style={{ fontSize: 14, lineHeight: 1.7, margin: "0 0 16px" }}>{eb.setup}</p>
                <ReadAloud text={eb.readAloud} />
            </Card>

            {/* Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
                {[
                    { label: "XP Budget", value: eb.totalXp?.toLocaleString() },
                    { label: "Difficulty", value: form.difficulty },
                    { label: "Enemy Groups", value: eb.monsters?.length },
                ].map(({ label, value }) => (
                    <div key={label} style={{ background: "#fff", border: "1px solid #e5dfd3", borderRadius: 12, padding: "14px 18px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: diffColor }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Monsters */}
            <SectionLabel>Combat Roster</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                {eb.monsters?.map((m, i) => {
                    const details = findMonsterDetails(monsterDetails, m.name);
                    return (
                        <div key={i} className="sf-monster-card" style={{ border: "1px solid #e5dfd3", borderRadius: 14, padding: 20, background: "#faf8f5" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                                <div>
                                    <span style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 16 }}>
                                        {m.quantity > 1 ? `${m.quantity}× ` : ""}{m.name}
                                    </span>
                                    <span style={{ marginLeft: 10, fontSize: 12, color: "#9ca3af" }}>CR {m.cr}</span>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <Badge bg="#fee2e2" color="#991b1b">{m.role}</Badge>
                                    <Badge bg="#f3f4f6" color="#374151">{((m.xpEach || 0) * (m.quantity || 1)).toLocaleString()} XP</Badge>
                                </div>
                            </div>
                            <p style={{ fontSize: 13, fontStyle: "italic", color: "#6b7280", margin: "0 0 12px", lineHeight: 1.55 }}>{m.flavor}</p>
                            <div style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #e5dfd3" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#c53131" }}>Tactics: </span>
                                <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{m.tactics}</span>
                            </div>
                            <StatBlock monster={details} />
                        </div>
                    );
                })}
            </div>

            {/* Terrain */}
            <Card style={{ marginBottom: 14 }}>
                <SectionLabel color="#166534">🌿 Terrain Features</SectionLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {eb.terrainFeatures?.map((f, i) => (
                        <span key={i} style={{ background: "#dcfce7", color: "#166534", padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{f}</span>
                    ))}
                </div>
            </Card>

            {/* DM Tips */}
            <Card style={{ marginBottom: 14 }}>
                <SectionLabel color="#1d4ed8">💡 DM Tips</SectionLabel>
                {eb.dmTips?.map((tip, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.65, marginBottom: 8 }}>
                        <span style={{ color: "#c53131", fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>·</span>
                        <span style={{ color: "#374151" }}>{tip}</span>
                    </div>
                ))}
            </Card>

            {/* Morale + Aftermath */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "#fff8f0", border: "1px solid #fed7aa", borderRadius: 14, padding: 20 }}>
                    <SectionLabel color="#c2410c">🏳 Morale</SectionLabel>
                    <p style={{ color: "#431407", fontSize: 14, lineHeight: 1.65, margin: 0 }}>{eb.morale}</p>
                </div>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: 20 }}>
                    <SectionLabel color="#166534">📖 Aftermath</SectionLabel>
                    <p style={{ color: "#14532d", fontSize: 14, lineHeight: 1.65, margin: 0 }}>{eb.aftermath}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function SessionForge() {
    const [form, setForm] = useState({
        playerCount: 4, partyLevel: 5, classes: [],
        specialAbilities: "", difficulty: "Medium",
        environment: "Dungeon", theme: "Mixed",
        tone: "Heroic & Epic", villainType: "None", notes: "",
    });
    const [tab, setTab] = useState("session");
    const [loading, setLoading] = useState(false);
    const [output, setOutput] = useState(null);
    const [monsterDetails, setMonsterDetails] = useState([]);
    const [error, setError] = useState(null);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const toggleClass = cls => setForm(f => ({
        ...f,
        classes: f.classes.includes(cls) ? f.classes.filter(c => c !== cls) : [...f.classes, cls]
    }));

    const xpBudget = computeXpBudget(form.partyLevel, form.difficulty, form.playerCount);

    const generate = async () => {
        setLoading(true); setError(null); setOutput(null);
        try {
            const monsters = await fetchMonsters(xpBudget);
            setMonsterDetails(monsters);
            // The server builds the prompt from these fields; only short monster summaries are sent.
            const monsterSummaries = monsters.map(m => ({
                name: m.name,
                cr: m.challenge_rating,
                hp: m.hit_points,
                ac: Array.isArray(m.armor_class) ? m.armor_class[0]?.value : m.armor_class,
            }));

            const resp = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ form, monsters: monsterSummaries }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                const e = new Error(err.error || `Server error ${resp.status}`);
                e.status = resp.status;
                throw e;
            }
            const data = await resp.json();
            const text = data.text || "";
            const clean = text.replace(/```json|```/g, "").trim();
            setOutput(JSON.parse(clean));
            setTab("session");
        } catch (e) {
            console.error(e);
            if (e.status === 529 || e.status === 503) {
                setError("Anthropic's API is currently overloaded. Wait a moment and try again.");
            } else if (e.status === 429) {
                setError(e.message || "Rate limit hit. Wait a moment and try again.");
            } else if (e.status === 401) {
                setError("The server's API key is missing or invalid.");
            } else {
                setError(`Generation failed: ${e.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const diffColor = DIFF_COLORS[form.difficulty];

    return (
        <div style={{ minHeight: "100vh", background: "#f0ece4", fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif", color: "#1a1d29" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Source+Sans+3:ital,wght@0,300;0,400;0,600;1,400&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .sf-chip { cursor:pointer; padding:6px 14px; border-radius:20px; font-size:13px; font-weight:600; border:1.5px solid; transition:all 0.15s; user-select:none; }
        .sf-chip:hover { transform:translateY(-1px); }
        .sf-chip-on { background:#1a1d29; color:#fff; border-color:#1a1d29; }
        .sf-chip-off { background:#fff; color:#6b7280; border-color:#e5dfd3; }
        .sf-chip-off:hover { border-color:#9ca3af; color:#374151; }
        .sf-stepper { width:36px; height:36px; border-radius:8px; border:1.5px solid #e5dfd3; background:#fff; cursor:pointer; font-size:18px; font-weight:600; display:flex; align-items:center; justify-content:center; color:#1a1d29; transition:all 0.15s; }
        .sf-stepper:hover { border-color:#1a1d29; background:#1a1d29; color:#fff; }
        .sf-input { width:100%; padding:10px 14px; border:1.5px solid #e5dfd3; border-radius:8px; font-size:14px; font-family:inherit; background:#faf8f5; color:#1a1d29; outline:none; transition:border 0.15s; }
        .sf-input:focus { border-color:#1a1d29; }
        select.sf-input { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236b7280' d='M1 1l5 5 5-5'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 14px center; padding-right:36px; }
        .sf-diff { padding:9px 20px; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer; border:2px solid; transition:all 0.15s; }
        .sf-diff:hover { opacity:0.88; }
        .sf-tab { padding:10px 24px; font-weight:700; font-size:14px; cursor:pointer; border:none; border-bottom:3px solid transparent; background:transparent; color:#9ca3af; transition:all 0.15s; font-family:inherit; }
        .sf-tab-on { border-bottom-color:#c53131; color:#c53131; }
        .sf-tab:hover:not(.sf-tab-on) { color:#4b5563; }
        .sf-gen { width:100%; padding:18px; border-radius:14px; background:#1a1d29; color:#fff; font-family:'Cinzel',serif; font-size:16px; font-weight:700; letter-spacing:0.08em; border:none; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:12px; }
        .sf-gen:hover:not(:disabled) { background:#2d3148; transform:translateY(-2px); box-shadow:0 8px 24px rgba(26,29,41,0.22); }
        .sf-gen:disabled { opacity:0.6; cursor:not-allowed; }
        .sf-spinner { width:20px; height:20px; border:2.5px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:sf-spin 0.7s linear infinite; }
        @keyframes sf-spin { to { transform:rotate(360deg); } }
        .sf-fadein { animation:sf-fade 0.4s ease; }
        @keyframes sf-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .sf-xpbar { background:#e5dfd3; border-radius:20px; height:6px; overflow:hidden; margin-top:8px; }
        .sf-xpfill { height:100%; border-radius:20px; transition:width 0.4s; }
        .sf-tab-hidden { display:none; }
        .sf-page-break { height:0; }
        .sf-print-btn { position:absolute; top:0; right:0; padding:8px 16px; border-radius:8px; border:1.5px solid #1a1d29; background:#fff; color:#1a1d29; font-family:'Cinzel',serif; font-size:12px; font-weight:700; letter-spacing:0.08em; cursor:pointer; transition:all 0.15s; }
        .sf-print-btn:hover { background:#1a1d29; color:#fff; }
        @media print {
          @page { margin: 0.6in; }
          html, body { background:#fff !important; }
          .sf-no-print { display:none !important; }
          .sf-tab-hidden { display:block !important; }
          .sf-page-break { page-break-before:always; height:0; }
          .sf-statblock, .sf-monster-card { page-break-inside:avoid; break-inside:avoid; }
          .sf-fadein { animation:none !important; }
          .sf-output { margin-top:0 !important; }
        }
      `}</style>

            {/* ── Header ── */}
            <div className="sf-no-print" style={{ background: "#1a1d29", padding: "20px 32px", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 28 }}>⚔️</span>
                <div>
                    <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>Session Forge</div>
                    <div style={{ fontSize: 11, color: "#7b8db8", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>D&D 5e · 2024 Compatible · AI-Powered</div>
                </div>
                <div style={{ marginLeft: "auto", background: "rgba(200,169,110,0.12)", border: "1px solid rgba(200,169,110,0.28)", borderRadius: 8, padding: "5px 14px", color: "#c8a96e", fontSize: 12, fontWeight: 600 }}>
                    Prep smarter. Play better.
                </div>
            </div>

            <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px 60px" }}>

                {/* ══ FORM SECTION ══ */}

                {/* Card 1: The Party */}
                <div className="sf-no-print" style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5dfd3", padding: 28, marginBottom: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a8832a", marginBottom: 20 }}>
                        ⚔ The Party
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Number of Players</div>
                            <Stepper value={form.playerCount} onChange={v => set("playerCount", v)} min={1} max={MAX_PLAYERS} />
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Average Party Level</div>
                            <Stepper value={form.partyLevel} onChange={v => set("partyLevel", v)} min={1} max={20} />
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>{getTierLabel(form.partyLevel)}</div>
                        </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                            Classes in Party <span style={{ fontWeight: 400, color: "#9ca3af" }}>(select all that apply)</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {CLASSES.map(cls => (
                                <Chip key={cls} label={cls} active={form.classes.includes(cls)} onClick={() => toggleClass(cls)} />
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                            Notable Abilities or Context <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
                        </div>
                        <textarea className="sf-input" rows={2} maxLength={MAX_TEXT_LENGTH} style={{ resize: "vertical" }}
                            placeholder="e.g. Party has a Paladin aura; one PC is secretly cursed; last session ended on a cliffhanger..."
                            value={form.specialAbilities}
                            onChange={e => set("specialAbilities", e.target.value)} />
                    </div>
                </div>

                {/* Card 2: Session Settings */}
                <div className="sf-no-print" style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5dfd3", padding: 28, marginBottom: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a8832a", marginBottom: 20 }}>
                        🗺 Session Settings
                    </div>

                    {/* Difficulty */}
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Encounter Difficulty</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {["Easy", "Medium", "Hard", "Deadly"].map(d => {
                                const active = form.difficulty === d;
                                const c = DIFF_COLORS[d];
                                return (
                                    <button key={d} className="sf-diff"
                                        style={{ borderColor: c, background: active ? c : "#fff", color: active ? "#fff" : c }}
                                        onClick={() => set("difficulty", d)}>
                                        {d}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                            XP Budget: <strong style={{ color: diffColor }}>{xpBudget.toLocaleString()} XP</strong>
                            {" "}for {form.playerCount} players at level {form.partyLevel}
                        </div>
                        <div className="sf-xpbar">
                            <div className="sf-xpfill" style={{ width: `${Math.min(100, (xpBudget / 12700) * 100)}%`, background: diffColor }} />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 20 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Environment</div>
                            <select className="sf-input" value={form.environment} onChange={e => set("environment", e.target.value)}>
                                {ENVIRONMENTS.map(env => <option key={env}>{env}</option>)}
                            </select>
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Session Theme</div>
                            <select className="sf-input" value={form.theme} onChange={e => set("theme", e.target.value)}>
                                {THEMES.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Tone</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {TONES.map(t => (
                                <Chip key={t} label={t} active={form.tone === t} onClick={() => set("tone", t)} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Card 3: Villain & Notes */}
                <div className="sf-no-print" style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5dfd3", padding: 28, marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a8832a", marginBottom: 20 }}>
                        🐉 Antagonist & Notes
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Villain / Antagonist Type</div>
                            <select className="sf-input" value={form.villainType} onChange={e => set("villainType", e.target.value)}>
                                {VILLAIN_TYPES.map(v => <option key={v}>{v}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                            DM Notes <span style={{ fontWeight: 400, color: "#9ca3af" }}>(ongoing plot threads, player preferences, world state)</span>
                        </div>
                        <textarea className="sf-input" rows={3} maxLength={MAX_TEXT_LENGTH} style={{ resize: "vertical" }}
                            placeholder="e.g. The party is hunting a cult; avoid undead — one player's uncomfortable; the BBEG is secretly a fallen paladin..."
                            value={form.notes}
                            onChange={e => set("notes", e.target.value)} />
                    </div>
                </div>

                {/* ── Generate Button ── */}
                <button className="sf-gen sf-no-print" onClick={generate} disabled={loading}>
                    {loading
                        ? <><div className="sf-spinner" />Consulting the oracle...</>
                        : <>⚔ Forge This Session</>}
                </button>

                {error && (
                    <div className="sf-no-print" style={{ marginTop: 14, padding: "14px 18px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#991b1b", fontSize: 14 }}>
                        {error}
                    </div>
                )}

                {/* ══ OUTPUT SECTION ══ */}
                {output && (
                    <div style={{ marginTop: 40 }} className="sf-fadein sf-output">

                        {/* Output Header */}
                        <div style={{ textAlign: "center", marginBottom: 28, position: "relative" }}>
                            <button
                                className="sf-print-btn sf-no-print"
                                onClick={() => window.print()}
                                title="Print or save as PDF"
                            >🖨 Print</button>
                            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 24, fontWeight: 700, letterSpacing: "0.03em" }}>
                                {output.sessionOutline?.title}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                                <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: diffColor + "20", color: diffColor }}>
                                    {form.difficulty}
                                </span>
                                <span style={{ color: "#d1d5db" }}>·</span>
                                <span style={{ fontSize: 13, color: "#6b7280" }}>{form.environment}</span>
                                <span style={{ color: "#d1d5db" }}>·</span>
                                <span style={{ fontSize: 13, color: "#6b7280" }}>Lv {form.partyLevel} · {form.playerCount} Players</span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="sf-no-print" style={{ display: "flex", borderBottom: "1px solid #e5dfd3", marginBottom: 28 }}>
                            <button className={`sf-tab ${tab === "session" ? "sf-tab-on" : ""}`} onClick={() => setTab("session")}>
                                📜 Session Outline
                            </button>
                            <button className={`sf-tab ${tab === "encounter" ? "sf-tab-on" : ""}`} onClick={() => setTab("encounter")}>
                                ⚔️ Encounter Builder
                            </button>
                        </div>

                        <div className={`sf-tab-content ${tab === "session" ? "" : "sf-tab-hidden"}`}>
                            <SessionTab data={output} form={form} />
                        </div>
                        <div className="sf-page-break" />
                        <div className={`sf-tab-content ${tab === "encounter" ? "" : "sf-tab-hidden"}`}>
                            <EncounterTab data={output} form={form} monsterDetails={monsterDetails} />
                        </div>

                        {/* Re-generate nudge */}
                        <div className="sf-no-print" style={{ marginTop: 36, textAlign: "center" }}>
                            <button className="sf-gen" style={{ maxWidth: 320, margin: "0 auto" }} onClick={generate} disabled={loading}>
                                {loading ? <><div className="sf-spinner" />Regenerating...</> : <>↻ Regenerate Session</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
