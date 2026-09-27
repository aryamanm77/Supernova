import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export function initAuth(app, onChange) {
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  onAuthStateChanged(auth, (user) => onChange(user));

  return {
    signIn: () => signInWithPopup(auth, provider),
    signOutUser: () => signOut(auth),
  };
}
