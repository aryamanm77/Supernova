import {
  getFirestore, doc, getDoc, setDoc, updateDoc, increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const XP_PER_TURN = 10;
const XP_PER_LEVEL = 100;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, local-ish
}

function daysBetween(a, b) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b) - new Date(a)) / msPerDay);
}

export function initProgress(app) {
  const db = getFirestore(app);

  /** Called right after sign-in: creates the profile doc if new, updates streak. */
  async function loadOrCreateProfile(user) {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const today = todayKey();

    if (!snap.exists()) {
      const fresh = {
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        email: user.email || "",
        xp: 0,
        level: 1,
        streakCount: 1,
        lastActiveDate: today,
        totalConversations: 0,
        createdAt: today,
      };
      await setDoc(ref, fresh);
      return fresh;
    }

    const data = snap.data();
    const gap = daysBetween(data.lastActiveDate, today);

    let streakCount = data.streakCount || 0;
    if (gap === 1) {
      streakCount += 1; // practiced again the next day — streak continues
    } else if (gap > 1) {
      streakCount = 1; // missed a day — streak resets
    }
    // gap === 0 means already practiced today — leave streak as-is

    if (gap !== 0) {
      await updateDoc(ref, { streakCount, lastActiveDate: today });
    }

    return { ...data, streakCount, lastActiveDate: today };
  }

  /** Called after each completed AI turn. */
  async function recordTurn(uid) {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, {
      xp: increment(XP_PER_TURN),
      totalConversations: increment(1),
    });

    const snap = await getDoc(ref);
    const data = snap.data();
    const newLevel = Math.floor(data.xp / XP_PER_LEVEL) + 1;
    if (newLevel !== data.level) {
      await updateDoc(ref, { level: newLevel });
      return { ...data, level: newLevel, leveledUp: true };
    }
    return { ...data, leveledUp: false };
  }

  async function getProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  }

  return { loadOrCreateProfile, recordTurn, getProfile };
}
