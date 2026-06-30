import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Chat from './Chat';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('chat_username');
    if (savedUser) {
      setUser(savedUser);
    }
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-white text-gray-800 font-sans">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login setUser={setUser} />} />
          <Route path="/" element={user ? <Chat username={user} /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
