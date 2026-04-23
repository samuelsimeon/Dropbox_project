import {
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "/static/js/firebase-config.js";

const signupBtn = document.getElementById("signup-btn");
const messageBox = document.getElementById("auth-message");

function setMessage(message, isError = false) {
  messageBox.textContent = message;
  messageBox.style.color = isError ? "#b91c1c" : "#111827";
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    setMessage("Account created successfully. Redirecting...");
    setTimeout(() => {
      window.location.href = "/app";
    }, 1200);
  }
});

signupBtn.addEventListener("click", async () => {
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value.trim();

  if (!email || !password) {
    setMessage("Please enter your email and password.", true);
    return;
  }

  if (password.length < 6) {
    setMessage("Password must be at least 6 characters long.", true);
    return;
  }

  try {
    setMessage("Creating account...");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    setMessage(`Account created for ${userCredential.user.email}`);
  } catch (error) {
    setMessage(error.message, true);
    console.error("Signup error:", error);
  }
});