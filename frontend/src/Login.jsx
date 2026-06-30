import React, { useState } from 'react';
import { Heart } from 'lucide-react';

export default function Login({ setUser }) {
  const [passcode, setPasscode] = useState('');
  const [username, setUsername] = useState('Đ'); // Allow user to choose who they are
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ passcode, username })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('chat_username', data.username);
        setUser(data.username);
      } else {
        setError('Mã không đúng, thử lại nha!');
      }
    } catch (err) {
      setError('Lỗi kết nối đến máy chủ.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-pink-50 relative overflow-hidden">
      {/* Decorative floating hearts */}
      <div className="absolute top-10 left-10 text-pink-300 animate-pulse"><Heart size={48} fill="currentColor" /></div>
      <div className="absolute bottom-20 right-20 text-pink-200 animate-bounce"><Heart size={64} fill="currentColor" /></div>
      <div className="absolute top-40 right-40 text-pink-400 opacity-50"><Heart size={32} fill="currentColor" /></div>

      <div className="bg-white p-8 rounded-3xl shadow-xl z-10 w-full max-w-md border border-pink-100">
        <div className="flex justify-center mb-6">
          <Heart size={48} className="text-pink-500" fill="currentColor" />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">Our Private Chat</h2>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bạn là ai?</label>
            <select 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-300 outline-none"
            >
              <option value="Đ">Đ</option>
              <option value="N">N</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mã bí mật</label>
            <input 
              type="password" 
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Nhập mã..."
              className="w-full px-4 py-3 border border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-300 outline-none transition-all"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button 
            type="submit" 
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg hover:shadow-xl"
          >
            Vào Chat
          </button>
        </form>
      </div>
    </div>
  );
}
