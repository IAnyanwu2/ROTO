// src/firebase/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC-fE4ELjNK9lv9VQ1AZWqM1Z3t-aGcUUQ",
  authDomain: "roto-e6b1e.firebaseapp.com",
  projectId: "roto-e6b1e",
  storageBucket: "roto-e6b1e.appspot.com",
  messagingSenderId: "135158055865",
  appId: "1:135158055865:web:cec9d0a92b541328982c68"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export { auth, db };