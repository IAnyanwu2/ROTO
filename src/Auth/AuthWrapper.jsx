import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import { useAuth } from './AuthContext';

const AuthWrapper = () => {
  const { user, logout } = useAuth();
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const handleToggle = () => setIsLogin((prev) => !prev);
  const closePopup = () => setIsPopupVisible(false);

  return (
    <>
      <header>
        <h2 className="logo">Any-an-wu</h2>
        <nav className="navigation">
          <a href="#">Home</a>
          <a href="#">Services</a>
          <a href="#">About Us</a>
          <a href="#">Contact</a>
          {!user ? (
            <button onClick={() => setIsPopupVisible(true)} className="btnLogin-popup">
              Login
            </button>
          ) : (
            <>
              <span className="user-welcome">Welcome, {user.username}</span>
              <button onClick={logout} className="btnLogout">Logout</button>
            </>
          )}
        </nav>
      </header>

      {isPopupVisible && (
        <div className="wrapper active-popup">
          <span
            role="button"
            aria-label="Close"
            tabIndex={0}
            className="icon-close"
            onClick={closePopup}
            onKeyDown={(e) => { if (e.key === 'Enter') closePopup(); }}
          >
            &times;
          </span>
          {isLogin ? (
            <LoginForm switchToRegister={handleToggle} onSuccess={closePopup} />
          ) : (
            <RegisterForm switchToLogin={handleToggle} onSuccess={closePopup} />
          )}
        </div>
      )}
    </>
  );
};

export default AuthWrapper;