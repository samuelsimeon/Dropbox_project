import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCy2WJWoY0y5IczmhTcS_2l3Kq9cZAHNew",
  authDomain: "cloud-dropbox-assignment.firebaseapp.com",
  projectId: "cloud-dropbox-assignment",
  storageBucket: "cloud-dropbox-assignment.firebasestorage.app",
  messagingSenderId: "619773314837",
  appId: "1:619773314837:web:37fd0c7e1472b2657f8b1c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };