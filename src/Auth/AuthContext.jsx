// AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);  // will hold { uid, email, username }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snapshot = await get(ref(db, 'users/' + firebaseUser.uid));
          const userData = snapshot.exists() ? snapshot.val() : {};
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: userData.username || firebaseUser.displayName || '',
          });
        } catch (error) {
          console.error('Error fetching user data:', error.message);
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, username: '' });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const value = { user, loading, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};