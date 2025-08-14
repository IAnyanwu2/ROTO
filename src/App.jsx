//App.jsx
import './styles/App.css';;
import MainScene from './main.jsx';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthWrapper from './Auth/AuthWrapper';
import { AuthProvider, useAuth } from './Auth/AuthContext';

// Home page component (protected route)
const Home = () => {
  const { user, loading } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div>
      <h1>Welcome, {user.username}!</h1>
      <MainScene /> {/* Your 3D scene or main app content */}
    </div>
  );
};

// Login page component (shows AuthWrapper with popup)
const LoginPage = () => <AuthWrapper />;

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<LoginPage />} /> {/* optional */}
          {/* Add more routes here */}
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
