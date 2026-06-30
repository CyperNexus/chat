import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Heart, Send, LogOut, ChevronDown, Smile, Reply, X, Palette, Copy } from 'lucide-react';
import Picker from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';

const socket = io();

const THEMES = {
  pink: { 
    id: 'pink', name: 'Hồng Lãng Mạn',
    bg: 'bg-pink-50/30', 
    header: 'bg-white', 
    border: 'border-pink-100', 
    textPrimary: 'text-pink-500', 
    myMsgBg: 'bg-pink-500 text-white', 
    theirMsgBg: 'bg-white text-gray-800 border-pink-100',
    iconBg: 'bg-pink-100'
  },
  romantic_hearts: {
    id: 'romantic_hearts', name: 'Trái Tim Nổi',
    bg: "bg-pink-50/50 bg-cover bg-center bg-no-repeat bg-fixed",
    bgImage: "url('/romantic_hearts.png')",
    header: 'bg-white/90 backdrop-blur-sm', 
    border: 'border-pink-200', 
    textPrimary: 'text-pink-500', 
    myMsgBg: 'bg-pink-500 text-white', 
    theirMsgBg: 'bg-white/90 text-gray-800 border-pink-200',
    iconBg: 'bg-pink-100'
  },
  sky: { 
    id: 'sky', name: 'Xanh Bầu Trời',
    bg: 'bg-sky-50/50', 
    header: 'bg-white', 
    border: 'border-sky-100', 
    textPrimary: 'text-sky-500', 
    myMsgBg: 'bg-sky-500 text-white', 
    theirMsgBg: 'bg-white text-gray-800 border-sky-100',
    iconBg: 'bg-sky-100'
  },
  polka_dots: {
    id: 'polka_dots', name: 'Chấm Bi Xanh',
    bg: "bg-sky-50/80 bg-fixed",
    bgImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='2' fill='%237dd3fc' fill-opacity='0.8'/%3E%3C/svg%3E\")",
    header: 'bg-white/90 backdrop-blur-sm', 
    border: 'border-sky-200', 
    textPrimary: 'text-sky-500', 
    myMsgBg: 'bg-sky-500 text-white', 
    theirMsgBg: 'bg-white/90 text-gray-800 border-sky-200',
    iconBg: 'bg-sky-100'
  },
  purple: { 
    id: 'purple', name: 'Tím Thủy Chung',
    bg: 'bg-purple-50/50', 
    header: 'bg-white', 
    border: 'border-purple-100', 
    textPrimary: 'text-purple-500', 
    myMsgBg: 'bg-purple-500 text-white', 
    theirMsgBg: 'bg-white text-gray-800 border-purple-100',
    iconBg: 'bg-purple-100'
  },
  dark: { 
    id: 'dark', name: 'Đêm Yên Tĩnh',
    bg: 'bg-gray-900 text-gray-100', 
    header: 'bg-gray-800', 
    border: 'border-gray-700', 
    textPrimary: 'text-gray-300', 
    myMsgBg: 'bg-gray-700 text-white', 
    theirMsgBg: 'bg-gray-800 text-gray-200 border-gray-700',
    iconBg: 'bg-gray-700'
  },
  starry_night: {
    id: 'starry_night', name: 'Đêm Đầy Sao',
    bg: "bg-gray-900 text-gray-100 bg-cover bg-center bg-no-repeat bg-fixed",
    bgImage: "url('/starry_night.png')",
    header: 'bg-gray-900/90 backdrop-blur-sm', 
    border: 'border-gray-700', 
    textPrimary: 'text-blue-300', 
    myMsgBg: 'bg-blue-600 text-white', 
    theirMsgBg: 'bg-gray-800/90 text-gray-200 border-gray-700',
    iconBg: 'bg-gray-800'
  }
};

export default function Chat({ username }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [partnerStatus, setPartnerStatus] = useState({ status: 'offline', customText: '', nickname: '' });
  const [myCustomText, setMyCustomText] = useState('');
  const [myNickname, setMyNickname] = useState('');
  const [daysTogether, setDaysTogether] = useState(0);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showNicknameInput, setShowNicknameInput] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [currentThemeId, setCurrentThemeId] = useState('pink');
  
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const messagesEndRef = useRef(null);
  const listRef = useRef(null);

  const partnerName = username === 'Đ' ? 'N' : 'Đ';
  const statusOptions = ['Đang làm việc', 'Đi ngủ', 'Giận rồi 😤', 'Vui vẻ 🥰', 'Buồn 😢', 'Thoải mái', 'Đang ăn'];
  const reactionOptions = ['❤️', '😂', '😢', '😡', '👍'];

  useEffect(() => {
    socket.emit('join', username);

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.start_date) {
          const start = new Date(data.start_date);
          const now = new Date();
          const diffTime = Math.abs(now - start);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          setDaysTogether(diffDays);
        }
        if (data.global_theme && THEMES[data.global_theme]) {
          setCurrentThemeId(data.global_theme);
        }
      });

    const fetchMessages = async () => {
      const res = await fetch('/api/messages?offset=0');
      const data = await res.json();
      setMessages(data);
      if (data.length < 15) setHasMore(false);
      scrollToBottom();
    };
    fetchMessages();

    socket.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(scrollToBottom, 100);

      // Show notification if backgrounded and not from me
      if (document.hidden && msg.sender !== username && Notification.permission === 'granted') {
        const title = partnerStatus.nickname ? `${partnerStatus.nickname} (${msg.sender})` : msg.sender;
        new Notification(title, { body: msg.text || 'Đã gửi một tin nhắn' });
      }
    });

    socket.on('message_updated', (updatedMsg) => {
      setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
    });

    socket.on('reaction_updated', ({ id, reactions }) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, reactions } : m));
    });
    
    socket.on('message_recalled', ({ id }) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_recalled: 1 } : m));
    });

    socket.on('user_status', (statuses) => {
      if (statuses[partnerName]) {
        setPartnerStatus(statuses[partnerName]);
      }
      if (statuses[username]) {
        setMyCustomText(statuses[username].customText);
        setMyNickname(statuses[username].nickname);
      }
    });

    socket.on('theme_updated', (themeId) => {
      if (THEMES[themeId]) setCurrentThemeId(themeId);
    });

    const heartbeatInterval = setInterval(() => {
      socket.emit('heartbeat');
    }, 30000);

    return () => {
      socket.off('new_message');
      socket.off('message_updated');
      socket.off('reaction_updated');
      socket.off('message_recalled');
      socket.off('user_status');
      socket.off('theme_updated');
      clearInterval(heartbeatInterval);
    };
  }, [username, partnerName, partnerStatus.nickname]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    socket.emit('send_message', { 
      sender: username, 
      text: inputText,
      reply_to_id: replyingTo ? replyingTo.id : null 
    });
    
    setInputText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
  };

  const updateStatus = (text) => {
    socket.emit('update_custom_status', { username, text });
    setShowStatusMenu(false);
  };

  const changeTheme = (id) => {
    socket.emit('update_theme', id);
    setShowThemePicker(false);
  };

  const saveNickname = (e) => {
    e.preventDefault();
    socket.emit('update_nickname', { username, nickname: myNickname });
    setShowNicknameInput(false);
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    const container = listRef.current;
    const previousScrollHeight = container ? container.scrollHeight : 0;

    const res = await fetch(`/api/messages?offset=${messages.length}`);
    const data = await res.json();
    
    if (data.length > 0) {
      setMessages(prev => [...data, ...prev]);
      if (data.length < 15) setHasMore(false);
      
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - previousScrollHeight;
        }
        setIsLoadingMore(false);
      });
    } else {
      setHasMore(false);
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop < 50) {
      loadMoreMessages();
    }
  };

  const onEmojiClick = (emojiObject) => {
    setInputText(prev => prev + emojiObject.emoji);
  };

  const addReaction = (messageId, emoji) => {
    socket.emit('add_reaction', { messageId, emoji, username });
  };
  
  const recallMessage = (messageId) => {
    socket.emit('recall_message', { messageId, username });
  };

  const t = THEMES[currentThemeId];
  const isDark = currentThemeId === 'dark' || currentThemeId === 'starry_night';

  return (
    <div 
      className={`flex flex-col h-screen ${t.bg} transition-colors duration-500`}
      style={t.bgImage ? { backgroundImage: t.bgImage } : {}}
    >
      {/* Header */}
      <header className={`${t.header} px-3 py-3 md:px-6 md:py-4 shadow-sm flex items-center justify-between border-b ${t.border} z-10 transition-colors duration-500`}>
        <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
          <div className="relative flex-shrink-0">
            <div className={`w-12 h-12 ${t.iconBg} rounded-full flex items-center justify-center ${t.textPrimary} font-bold text-xl shadow-inner`}>
              {partnerName.charAt(0)}
            </div>
            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 ${isDark ? 'border-gray-800' : 'border-white'} ${partnerStatus.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          </div>
          <div className="min-w-0">
            <h1 className={`font-bold ${isDark ? 'text-gray-100' : 'text-gray-800'} text-lg truncate`}>
              {partnerStatus.nickname ? `${partnerStatus.nickname} (${partnerName})` : partnerName}
            </h1>
            <div className="flex items-center gap-2">
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} truncate max-w-[120px]`}>{partnerStatus.customText || 'Đang offline'}</p>
              <div className={`flex items-center gap-1 ${t.textPrimary} text-[10px] md:hidden flex-shrink-0`}>
                <Heart className="w-3 h-3 animate-pulse" fill="currentColor" />
                <span className="font-bold">{daysTogether}</span>d
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center flex-shrink-0 mx-2">
          <div className={`flex items-center gap-1 ${t.textPrimary}`}>
            <Heart className="w-5 h-5 animate-pulse" fill="currentColor" />
            <span className="font-bold text-xl">{daysTogether}</span>
            <span className="text-sm font-medium">ngày</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 relative flex-shrink-0">
          
          <div className="relative">
            <button 
              onClick={() => setShowThemePicker(!showThemePicker)}
              className={`p-1.5 md:p-2 ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
            >
              <Palette className="w-5 h-5 md:w-5 md:h-5" />
            </button>
            {showThemePicker && (
              <div className={`absolute top-10 right-0 ${t.header} shadow-lg rounded-xl border ${t.border} py-2 w-40 z-20`}>
                {Object.values(THEMES).map(themeOpt => (
                  <button 
                    key={themeOpt.id} 
                    onClick={() => changeTheme(themeOpt.id)} 
                    className={`block w-full text-left px-4 py-2 text-sm ${currentThemeId === themeOpt.id ? 'font-bold' : ''} ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                  >
                    {themeOpt.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-right flex flex-col items-end">
            {showNicknameInput ? (
              <form onSubmit={saveNickname} className="flex items-center gap-1">
                <input 
                  autoFocus
                  type="text"
                  value={myNickname}
                  onChange={(e) => setMyNickname(e.target.value)}
                  placeholder="Biệt danh..."
                  className={`text-xs px-2 py-1 border rounded w-20 md:w-32 ${isDark ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
                />
                <button type="submit" className={`text-xs ${t.textPrimary}`}>OK</button>
              </form>
            ) : (
              <p 
                onClick={() => setShowNicknameInput(true)}
                className={`text-xs md:text-sm font-semibold cursor-pointer hover:opacity-80 truncate max-w-[60px] md:max-w-[120px]`}
              >
                {myNickname || username}
              </p>
            )}

            <button 
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className={`text-[10px] md:text-xs ${t.textPrimary} flex items-center gap-0.5 opacity-80 hover:opacity-100 transition mt-0.5`}
            >
              <span className="truncate max-w-[60px] md:max-w-[100px]">{myCustomText || 'Trạng thái'}</span> <ChevronDown className="w-3 h-3" />
            </button>
            {showStatusMenu && (
              <div className={`absolute top-10 right-0 ${t.header} shadow-lg rounded-xl border ${t.border} py-2 w-40 z-20`}>
                {statusOptions.map(opt => (
                  <button key={opt} onClick={() => updateStatus(opt)} className={`block w-full text-left px-4 py-2 text-sm ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('chat_username');
              window.location.reload();
            }}
            className={`p-1.5 md:p-2 ${isDark ? 'text-gray-400 hover:text-red-400' : 'text-gray-400 hover:text-red-500'} transition-colors`}
          >
            <LogOut className="w-5 h-5 md:w-5 md:h-5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-6" 
        ref={listRef}
        onScroll={handleScroll}
      >
        <AnimatePresence>
          {messages.map((msg) => {
            const isMe = msg.sender === username;
            
            let reactionsObj = {};
            try {
              if (msg.reactions) reactionsObj = JSON.parse(msg.reactions);
            } catch(e) {}

            const msgTime = new Date(msg.timestamp + (msg.timestamp.includes('Z') ? '' : 'Z')).getTime();
            const isRecallable = isMe && (Date.now() - msgTime <= 5 * 60 * 1000);

            if (msg.is_recalled) {
              return (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  layout
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`rounded-2xl px-4 py-2 border border-gray-300 italic opacity-60 text-sm ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'} ${isMe ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                    {msg.sender} đã thu hồi một tin nhắn
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                layout
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className="group relative flex flex-col max-w-[70%]">
                  
                  {/* Reaction Button (Hover) */}
                  <div className={`absolute top-0 ${isMe ? '-left-14 md:-left-12' : '-right-14 md:-right-12'} opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 md:gap-1 z-10 ${t.header} shadow-md rounded-full p-2 md:p-1`}>
                    {reactionOptions.map(emoji => (
                      <button key={emoji} onClick={() => addReaction(msg.id, emoji)} className="hover:scale-125 transition-transform text-xl md:text-sm">
                        {emoji}
                      </button>
                    ))}
                    <button onClick={() => setReplyingTo(msg)} className="hover:scale-125 transition-transform text-gray-500 p-1 flex justify-center title='Trả lời'">
                      <Reply className="w-5 h-5 md:w-3.5 md:h-3.5" />
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(msg.text)} className="hover:scale-125 transition-transform text-gray-500 p-1 flex justify-center" title='Copy'>
                      <Copy className="w-5 h-5 md:w-3.5 md:h-3.5" />
                    </button>
                    {isRecallable && (
                      <button onClick={() => recallMessage(msg.id)} className="hover:scale-125 transition-transform text-red-500 p-1 flex justify-center title='Thu hồi'" title="Thu hồi">
                        <X className="w-5 h-5 md:w-3.5 md:h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Replied Message Bubble */}
                  {msg.reply_to_text && (
                    <div className={`text-sm md:text-xs mb-1 p-2 md:p-2 rounded-lg opacity-80 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                      <span className="font-bold">{msg.reply_to_sender}: </span>
                      {msg.reply_is_recalled ? <i>Tin nhắn đã bị thu hồi</i> : (msg.reply_to_text.substring(0, 50) + (msg.reply_to_text.length > 50 ? '...' : ''))}
                    </div>
                  )}

                  {/* Main Bubble */}
                  <div className={`rounded-2xl px-5 py-3 md:px-4 md:py-2 shadow-sm relative border ${isMe ? t.myMsgBg + ' rounded-br-none border-transparent' : t.theirMsgBg + ' rounded-bl-none'}`}>
                    {msg.type === 'video' && msg.media_url ? (
                      <div className="mb-2">
                        <video src={msg.media_url} controls className="rounded-lg max-h-96 w-auto" />
                      </div>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words text-lg md:text-base" dangerouslySetInnerHTML={{ __html: msg.text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="underline">$&</a>') }}></p>
                    <div className={`text-xs md:text-[10px] mt-1 text-right opacity-70`}>
                      {new Date(msg.timestamp + (msg.timestamp.includes('Z') ? '' : 'Z')).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>

                  {/* Reactions Display */}
                  {Object.keys(reactionsObj).length > 0 && (
                    <div className={`flex gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(reactionsObj).map(([emoji, users]) => (
                        <div key={emoji} className={`${t.header} border ${t.border} text-sm md:text-xs rounded-full px-2 py-1 md:px-1.5 md:py-0.5 shadow-sm`}>
                          {emoji} {users.length > 1 ? users.length : ''}
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <footer className={`${t.header} p-4 border-t ${t.border} relative z-20 transition-colors duration-500`}>
        
        {/* Reply Preview */}
        <AnimatePresence>
          {replyingTo && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`absolute bottom-full left-0 right-0 ${isDark ? 'bg-gray-800' : 'bg-gray-50'} border-t ${t.border} px-6 py-2 flex justify-between items-center`}
            >
              <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} truncate`}>
                <span className={`font-bold mr-2 ${t.textPrimary}`}>Đang trả lời {replyingTo.sender}:</span>
                {replyingTo.text}
              </div>
              <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-red-500">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Emoji Picker Popover */}
        {showEmojiPicker && (
          <div className="absolute bottom-full right-4 mb-2 shadow-2xl">
            <Picker onEmojiClick={onEmojiClick} theme={isDark ? 'dark' : 'light'} />
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto items-center">
          <button 
            type="button" 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`text-gray-400 ${t.hoverBtn} p-2 md:p-2 transition-colors`}
          >
            <Smile className="w-8 h-8 md:w-6 md:h-6" />
          </button>
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhắn nhủ điều gì đó..."
            className={`flex-1 ${isDark ? 'bg-gray-700 text-white border-gray-600 focus:bg-gray-800' : 'bg-gray-50 text-gray-900 border-gray-200 focus:bg-white'} border rounded-full px-6 py-4 md:py-3 text-lg md:text-base focus:outline-none focus:ring-2 transition-all`}
          />
          <button 
            type="submit"
            className={`${t.myMsgBg} rounded-full w-14 h-14 md:w-12 md:h-12 flex items-center justify-center transition-transform hover:scale-105 shadow-md flex-shrink-0`}
          >
            <Send className="w-6 h-6 md:w-5 md:h-5" />
          </button>
        </form>
      </footer>
    </div>
  );
}
