import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "/static/js/firebase-config.js";

const loginBtn = document.getElementById("login-btn");
const messageBox = document.getElementById("auth-message");

function setMessage(message, isError = false) {
  messageBox.textContent = message;
  messageBox.style.color = isError ? "#b91c1c" : "#111827";
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    setMessage("Login successful. Redirecting...");
    setTimeout(() => {
      window.location.href = "/app";
    }, 800);
  }
});

loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!email || !password) {
    setMessage("Please enter your email and password.", true);
    return;
  }

  try {
    setMessage("Signing in...");
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    setMessage(error.message, true);
    console.error("Login error:", error);
  }
});