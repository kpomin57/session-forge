import {
    CLASSES, DIFFICULTIES, ENVIRONMENTS, THEMES, TONES, VILLAIN_TYPES,
    MAX_PLAYERS, MAX_TEXT_LENGTH, computeXpBudget,
} from "../shared/dnd.js";

const MAX_MONSTERS = 8;
const MAX_MONSTER_NAME = 80;

// Validates the request body and returns a clean copy, or throws an Error with a user-facing message.
// Everything that ends up in the prompt passes through here, so the endpoint can't be used as a general Claude proxy.
export function validateRequest(body) {
    const { form, monsters } = body ?? {};
    if (!form || typeof form !== "object") throw new Error("form is required");

    const int = (v, min, max, name) => {
        if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
        return v;
    };
    const oneOf = (v, list, name) => {
        if (!list.includes(v)) throw new Error(`invalid ${name}`);
        return v;
    };
    const text = (v, name) => {
        if (v == null || v === "") return "";
        if (typeof v !== "string") throw new Error(`${name} must be text`);
        if (v.length > MAX_TEXT_LENGTH) throw new Error(`${name} must be ${MAX_TEXT_LENGTH} characters or fewer`);
        return v.trim();
    };

    if (!Array.isArray(form.classes) || form.classes.length > CLASSES.length) throw new Error("invalid classes");
    const clean = {
        playerCount: int(form.playerCount, 1, MAX_PLAYERS, "playerCount"),
        partyLevel: int(form.partyLevel, 1, 20, "partyLevel"),
        classes: [...new Set(form.classes.map(c => oneOf(c, CLASSES, "class")))],
        specialAbilities: text(form.specialAbilities, "specialAbilities"),
        difficulty: oneOf(form.difficulty, DIFFICULTIES, "difficulty"),
        environment: oneOf(form.environment, ENVIRONMENTS, "environment"),
        theme: oneOf(form.theme, THEMES, "theme"),
        tone: oneOf(form.tone, TONES, "tone"),
        villainType: oneOf(form.villainType, VILLAIN_TYPES, "villainType"),
        notes: text(form.notes, "notes"),
    };

    if (monsters != null && !Array.isArray(monsters)) throw new Error("monsters must be a list");
    const cleanMonsters = (monsters ?? []).slice(0, MAX_MONSTERS).map(m => {
        if (typeof m?.name !== "string" || !m.name.trim() || m.name.length > MAX_MONSTER_NAME) throw new Error("invalid monster name");
        const num = v => (Number.isFinite(v) && v >= 0 && v <= 1000 ? v : "?");
        return { name: m.name.trim(), cr: num(m.cr), hp: num(m.hp), ac: num(m.ac) };
    });

    return { form: clean, monsters: cleanMonsters };
}

export function buildPrompt(form, monsters) {
    const xpBudget = computeXpBudget(form.partyLevel, form.difficulty, form.playerCount);
    const monsterList = monsters.length
        ? "- " + monsters.map(m => `${m.name} (CR ${m.cr}, HP ${m.hp}, AC ${m.ac})`).join("\n- ")
        : "No monsters available from API — create appropriate ones";

    return `You are an expert Dungeon Master and adventure designer preparing a D&D 5e (2024 rules compatible) session.

PARTY: ${form.playerCount} players at level ${form.partyLevel}
Classes: ${form.classes.length ? form.classes.join(", ") : "Not specified"}
Special abilities/context: ${form.specialAbilities || "None"}

SESSION CONFIG:
- XP Budget: ${xpBudget.toLocaleString("en-US")} XP (${form.difficulty} difficulty)
- Environment: ${form.environment}
- Theme: ${form.theme}
- Tone: ${form.tone}
- Antagonist type: ${form.villainType}
- DM Notes: ${form.notes || "None"}

MONSTERS RETRIEVED FROM 5E API (use or adapt these):
${monsterList}

Respond ONLY with a valid JSON object — no markdown, no commentary, no code fences:
{
  "sessionOutline": {
    "title": "Evocative session title",
    "hook": "2-3 sentence compelling hook that immediately draws players in",
    "acts": [
      {
        "act": "Act 1 — The Setup",
        "summary": "What happens in this act and why it matters narratively",
        "keyMoment": "The pivotal scene or decision point of this act",
        "readAloud": "2-3 sentence evocative boxed text for the DM to read aloud"
      },
      {
        "act": "Act 2 — The Confrontation",
        "summary": "...", "keyMoment": "...", "readAloud": "..."
      },
      {
        "act": "Act 3 — The Resolution",
        "summary": "...", "keyMoment": "...", "readAloud": "..."
      }
    ],
    "npcs": [
      {
        "name": "NPC Name",
        "role": "Narrative role (Ally / Villain / Wild Card / Questgiver)",
        "personality": "2-3 traits plus one memorable quirk",
        "secret": "What they're hiding or what players could discover"
      }
    ],
    "plotTwist": "A dramatic optional twist the DM can deploy",
    "reward": "Suggested reward — XP notes, treasure, or story payoff"
  },
  "encounterBuilder": {
    "title": "Encounter name",
    "setup": "Tactical positioning — where enemies start, lighting, terrain",
    "readAloud": "4-5 sentence vivid scene-setting for when players arrive",
    "monsters": [
      {
        "name": "Monster name (use from API list if possible)",
        "quantity": 2,
        "cr": "CR value as string",
        "xpEach": 450,
        "role": "Tactical role: Skirmisher | Brute | Controller | Support | Boss",
        "tactics": "Specific tactical behavior — opening move, ability highlight, focus target logic",
        "flavor": "One vivid narrative sentence placing this creature in the scene"
      }
    ],
    "totalXp": ${xpBudget},
    "terrainFeatures": [
      "Tactically useful feature",
      "Environmental hazard or obstacle",
      "Atmospheric element"
    ],
    "dmTips": [
      "How to run this encounter at its best",
      "Pacing or spotlight tip",
      "How to reward clever thinking"
    ],
    "morale": "Conditions for enemies to flee, surrender, or fight to the death",
    "aftermath": "Narrative consequence — win or lose, what changes in the world?"
  }
}`;
}
