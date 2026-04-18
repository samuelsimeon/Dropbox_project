import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const registerBtn = document.getElementById("register-btn");
const loginBtn = document.getElementById("login-btn");
const getMeBtn = document.getElementById("get-me-btn");
const output = document.getElementById("output");

let currentIdToken = null;

registerBtn.addEventListener("click", async () => {
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    currentIdToken = await userCredential.user.getIdToken();
    output.textContent = JSON.stringify({
      message: "Registration successful",
      uid: userCredential.user.uid,
      email: userCredential.user.email
    }, null, 2);
  } catch (error) {
    output.textContent = JSON.stringify({
      error: error.message
    }, null, 2);
  }
});

loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    currentIdToken = await userCredential.user.getIdToken();
    output.textContent = JSON.stringify({
      message: "Login successful",
      uid: userCredential.user.uid,
      email: userCredential.user.email
    }, null, 2);
  } catch (error) {
    output.textContent = JSON.stringify({
      error: error.message
    }, null, 2);
  }
});

getMeBtn.addEventListener("click", async () => {
  if (!currentIdToken) {
    output.textContent = JSON.stringify({
      error: "You must log in first"
    }, null, 2);
    return;
  }

  try {
    const response = await fetch("/me", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${currentIdToken}`
      }
    });

    const data = await response.json();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    output.textContent = JSON.stringify({
      error: error.message
    }, null, 2);
  }
});