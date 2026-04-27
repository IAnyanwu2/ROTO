//App.jsx
import './styles/App.css';;
import MainScene from './main.jsx';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import AuthWrapper from './Auth/AuthWrapper';
// import { AuthProvider, useAuth } from './Auth/AuthContext';

// --- TEMPORARY: Bypass auth for 3D scene testing ---
function App() {
  return (
    <div>
      <MainScene />
    </div>
  );
}

// --- ORIGINAL AUTH CODE (restore later) ---
// const Home = () => {
//   const { user, loading } = useAuth();
//   if (loading) return <p>Loading...</p>;
//   if (!user) return <Navigate to="/login" />;
//   return (
//     <div>
//       <h1>Welcome, {user.username}!</h1>
//       <MainScene />
//     </div>
//   );
// };
// const LoginPage = () => <AuthWrapper />;
// function App() {
//   return (
//     <AuthProvider>
//       <Router>
//         <Routes>
//           <Route path="/" element={<Home />} />
//           <Route path="/login" element={<LoginPage />} />
//           <Route path="/register" element={<LoginPage />} />
//         </Routes>
//       </Router>
//     </AuthProvider>
//   );
// }

export default App;

