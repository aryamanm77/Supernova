/**
 * Firebase Cloud Function: chatWithTutor
 *
 * Called from the Android app via Firebase Functions SDK (httpsCallable).
 * Takes the running conversation + the user's latest transcribed speech,
 * calls Groq's free Llama endpoint, and returns:
 *   - reply: natural spoken response (fed into TextToSpeech)
 *   - correction: { hasError, corrected, explanation } for on-screen feedback
 *
 * Setup:
 *   1. firebase functions:config:set groq.key="YOUR_GROQ_API_KEY"
 *      (or use Secret Manager / .env for 2nd-gen functions)
 *   2. cd functions && npm install
 *   3. firebase deploy --only functions
 */

const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant"; // fast + free-tier friendly; swap to 70b for better quality

const SYSTEM_PROMPT_BASE = `You are Nova, a warm, patient English speaking tutor.
The user is practicing spoken English out loud; their message was transcribed by
speech-to-text, so it may contain small recognition errors — infer intent kindly.

Always respond with STRICT JSON only, no markdown, no extra text, matching this shape:
{
  "reply": "<your natural, conversational spoken reply, 1-3 sentences>",
  "correction": {
    "hasError": <true|false>,
    "corrected": "<corrected version of the user's sentence, or empty string>",
    "explanation": "<one short, encouraging sentence explaining the fix, or empty string>"
  }
}

Rules:
- Keep "reply" short and natural — it will be read aloud by text-to-speech.
- Only set hasError true for real grammar/word-choice mistakes, not STT artifacts.
- Be encouraging. Never scold.`;

const SCENARIOS = {
  free_chat: "The conversation topic is open — chat naturally about anything.",
  job_interview: "Role-play a job interview. You are the interviewer; ask common interview questions one at a time and react to the user's answers realistically.",
  ordering_food: "Role-play a restaurant scene. You are the server; take the user's order, ask follow-up questions (drinks, sides), and respond as a real server would.",
  introducing_yourself: "Help the user practice introducing themselves — ask about their name, background, and interests, one question at a time, as a friendly new acquaintance would.",
  travel_checkin: "Role-play an airport or hotel check-in desk. You are the staff member; ask for the details a real check-in would need, one at a time.",
};

function buildSystemPrompt(scenario) {
  const scenarioText = SCENARIOS[scenario] || SCENARIOS.free_chat;
  return `${SYSTEM_PROMPT_BASE}\n\nScenario: ${scenarioText}`;
}

exports.chatWithTutor = onCall(
  { secrets: [GROQ_API_KEY], cors: true },
  async (request) => {
    const { message, history, scenario } = request.data || {};

    if (!message || typeof message !== "string") {
      throw new HttpsError("invalid-argument", "message (string) is required.");
    }

    // history: [{ role: "user" | "assistant", content: string }, ...]
    const safeHistory = Array.isArray(history) ? history.slice(-10) : [];

    const messages = [
      { role: "system", content: buildSystemPrompt(scenario) },
      ...safeHistory,
      { role: "user", content: message },
    ];

    let groqResponse;
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY.value()}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 300,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        functions.logger.error("Groq API error", errText);
        throw new HttpsError("internal", "Tutor is unavailable right now.");
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      groqResponse = JSON.parse(content);
    } catch (err) {
      functions.logger.error("chatWithTutor failed", err);
      throw new HttpsError("internal", "Failed to get a response from the tutor.");
    }

    return {
      reply: groqResponse.reply || "",
      correction: {
        hasError: !!groqResponse.correction?.hasError,
        corrected: groqResponse.correction?.corrected || "",
        explanation: groqResponse.correction?.explanation || "",
      },
    };
  }
);
