// RegisterForm.jsx
import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase/firebase';
import { ref, set } from 'firebase/database';

// Basic validators
const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);
const validatePassword = (password) => password.length >= 6;

const RegisterForm = ({ switchToLogin, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!validateEmail(email)) {
      setError('Invalid email format');
      return;
    }
    if (!validatePassword(password)) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!username.trim()) {
      setError('Username cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (username) {
        await updateProfile(user, { displayName: username });
      }

      // Write user data to Realtime Database
      await set(ref(db, 'users/' + user.uid), {
        username,
        email,
        createdAt: Date.now(),
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="form-box register">
      <h2>Registration</h2>
      <form onSubmit={handleRegister}>
        {/* username input */}
        <div className="input-box">
          <span className="icon"><ion-icon name="person"></ion-icon></span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <label>Username</label>
        </div>

        {/* email input */}
        <div className="input-box">
          <span className="icon"><ion-icon name="mail"></ion-icon></span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label>Email</label>
        </div>

        {/* password input */}
        <div className="input-box">
          <span className="icon"><ion-icon name="lock"></ion-icon></span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label>Password</label>
        </div>

        <div className="remember-forgot">
          <label>
            <input type="checkbox" /> I agree to the terms & conditions
          </label>
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>

        <div className="login-register">
          <p>
            Already have an account?{' '}
            <a href="#" onClick={switchToLogin} className="login-link">
              Login
            </a>
          </p>
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;
