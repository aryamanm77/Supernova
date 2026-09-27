import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { initAuth } from "/auth.js";
import { initProgress } from "/progress.js";

const firebaseConfig = {
  apiKey: "AIzaSyDNYUfZPQooPb_nsWi9UKyD-7qrt_xtfis",
  authDomain: "supernova-31273.firebaseapp.com",
  projectId: "supernova-31273",
  storageBucket: "supernova-31273.firebasestorage.app",
  messagingSenderId: "1056660547126",
  appId: "1:1056660547126:web:cf01ceb1dd3076cae35a97",
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const chatWithTutor = httpsCallable(functions, "chatWithTutor");
const progress = initProgress(app);

// ---- DOM refs ----
const signinButtons = [document.getElementById("signin-button"), document.getElementById("signin-button-main")];
const avatarButton = document.getElementById("avatar-button");
const avatarImg = document.getElementById("avatar-img");
const streakBadge = document.getElementById("streak-badge");
const streakCountEl = document.getElementById("streak-count");
const signinGate = document.getElementById("signin-gate");
const scenarioPicker = document.getElementById("scenario-picker");
const chatEl = document.getElementById("chat");
const micBar = document.getElementById("mic-bar");
const micButton = document.getElementById("mic-button");
const micLabel = document.getElementById("mic-label");
const changeScenarioLink = document.getElementById("change-scenario");
const profilePanel = document.getElementById("profile-panel");
const closeProfileBtn = document.getElementById("close-profile");
const signoutButton = document.getElementById("signout-button");

// ---- State ----
let currentUser = null;
let currentScenario = null;
let history = [];
let micState = "idle";

// ---- Auth ----
const { signIn, signOutUser } = initAuth(app, onAuthChange);

signinButtons.forEach((btn) => btn.addEventListener("click", () => signIn().catch(console.error)));
signoutButton.addEventListener("click", () => signOutUser().catch(console.error));
avatarButton.addEventListener("click", () => openProfilePanel());
streakBadge.addEventListener("click", () => openProfilePanel());
closeProfileBtn.addEventListener("click", () => profilePanel.classList.add("hidden"));

async function onAuthChange(user) {
  currentUser = user;

  if (!user) {
    signinGate.classList.remove("hidden");
    scenarioPicker.classList.add("hidden");
    chatEl.classList.add("hidden");
    micBar.classList.add("hidden");
    avatarButton.classList.add("hidden");
    streakBadge.classList.add("hidden");
    signinButtons[0].classList.remove("hidden");
    return;
  }

  signinGate.classList.add("hidden");
  signinButtons[0].classList.add("hidden");
  avatarButton.classList.remove("hidden");
  avatarImg.src = user.photoURL || "";
  streakBadge.classList.remove("hidden");

  const profile = await progress.loadOrCreateProfile(user);
  streakCountEl.textContent = profile.streakCount;

  scenarioPicker.classList.remove("hidden");
}

// ---- Scenario selection ----
document.querySelectorAll(".scenario-card").forEach((card) => {
  card.addEventListener("click", () => {
    currentScenario = card.dataset.scenario;
    history = [];
    chatEl.innerHTML = "";
    scenarioPicker.classList.add("hidden");
    chatEl.classList.remove("hidden");
    micBar.classList.remove("hidden");
    changeScenarioLink.classList.remove("hidden");
  });
});

changeScenarioLink.addEventListener("click", () => {
  chatEl.classList.add("hidden");
  micBar.classList.add("hidden");
  scenarioPicker.classList.remove("hidden");
});

// ---- Profile panel ----
async function openProfilePanel() {
  if (!currentUser) return;
  const profile = await progress.getProfile(currentUser.uid);
  if (!profile) return;

  document.getElementById("profile-avatar").src = currentUser.photoURL || "";
  document.getElementById("profile-name").textContent = currentUser.displayName || "You";
  document.getElementById("profile-streak").textContent = profile.streakCount;
  document.getElementById("profile-level").textContent = profile.level;
  document.getElementById("profile-xp").textContent = profile.xp;
  document.getElementById("profile-conversations").textContent =
    `${profile.totalConversations} exchanges practiced`;
  streakCountEl.textContent = profile.streakCount;

  profilePanel.classList.remove("hidden");
}

// ---- Mic state ----
const LABELS = {
  idle: "Tap to speak",
  listening: "Listening…",
  thinking: "Nova is thinking…",
  speaking: "Nova is speaking…",
};

function setMicState(next) {
  micState = next;
  micLabel.textContent = LABELS[next];
  micButton.classList.toggle("listening", next === "listening");
  micButton.disabled = next === "thinking";
}

// ---- Speech recognition (STT) ----
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;

if (SpeechRecognition) {
  recognizer = new SpeechRecognition();
  recognizer.lang = "en-US";
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;

  recognizer.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript.trim()) handleUserSpeech(transcript.trim());
  };

  recognizer.onerror = () => setMicState("idle");
  recognizer.onend = () => {
    if (micState === "listening") setMicState("idle");
  };
} else {
  micLabel.textContent = "Speech recognition isn't supported in this browser — try Chrome.";
  micButton.disabled = true;
}

micButton.addEventListener("click", () => {
  if (micState !== "idle" || !recognizer) return;
  setMicState("listening");
  recognizer.start();
});

// ---- Speech synthesis (TTS) ----
function speak(text) {
  setMicState("speaking");
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.onend = () => setMicState("idle");
  utterance.onerror = () => setMicState("idle");
  window.speechSynthesis.speak(utterance);
}

// ---- Chat rendering ----
function addBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  chatEl.appendChild(bubble);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addCorrection(corrected, explanation) {
  const box = document.createElement("div");
  box.className = "correction";
  box.innerHTML = `<p class="fix">Try: "${corrected}"</p><p class="why">${explanation}</p>`;
  chatEl.appendChild(box);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// ---- Main turn handler ----
async function handleUserSpeech(text) {
  addBubble("user", text);
  setMicState("thinking");

  try {
    const result = await chatWithTutor({ message: text, history, scenario: currentScenario });
    const { reply, correction } = result.data;

    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: reply });
    history = history.slice(-20);

    if (correction?.hasError) {
      addCorrection(correction.corrected, correction.explanation);
    }

    addBubble("tutor", reply);
    speak(reply);

    if (currentUser) {
      const updated = await progress.recordTurn(currentUser.uid);
      streakCountEl.textContent = updated.streakCount;
    }
  } catch (err) {
    console.error("chatWithTutor failed:", err);
    addBubble("tutor", "Sorry, I had trouble understanding. Could you try again?");
    setMicState("idle");
  }
}

// ---- Service worker registration ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
