import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';

const socket = io('http://localhost:3001');

function App() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [sharedKey, setSharedKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [decryptKey, setDecryptKey] = useState('');
  const [notification, setNotification] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const messagesEndRef = useRef(null);

  const showPopup = (message) => {
    setNotification(message);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to chat');
    });

    socket.on('joined', (data) => {
      setIsConnected(true);
      showPopup(`Welcome ${data.username}! ${data.hasKey ? 'Key loaded' : 'No key set'}`);
    });

    socket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('user-joined', (data) => {
      console.log(`${data.username} joined`);
    });

    socket.on('user-left', (data) => {
      console.log(`${data.username} left`);
    });

    return () => {
      socket.off('connect');
      socket.off('joined');
      socket.off('new-message');
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const joinChat = () => {
    if (!username.trim()) {
      showPopup('Enter username');
      return;
    }
    
    socket.emit('join', { username, key: sharedKey });
  };

  const sendMessage = (encrypted = false) => {
    if (!message.trim()) return;
    
    if (encrypted && !sharedKey.trim()) {
      showPopup('Set quantum key first to encrypt messages');
      return;
    }

    if (encrypted) {
      handleEncrypt();
    } else {
      socket.emit('send-message', {
        text: message,
        encrypted: false
      });
      setMessage('');
    }
  };

  const handleEncrypt = async () => {
    if (!message.trim() || !sharedKey.trim()) {
      showPopup('Enter message and set quantum key first');
      return;
    }

    try {
      const response = await axios.post('http://localhost:3001/api/encrypt', {
        message: message,
        key: sharedKey
      });

      if (response.data.success) {
           socket.emit('send-message', {
          text: `🔐 ENCRYPTED MESSAGE\n${response.data.encrypted_hex.substring(0, 80)}...\n[Click to decrypt]`,
          encrypted: true,
          encryptedHex: response.data.encrypted_hex
        });
        
        setMessage('');
      } else {
        showPopup(`Encryption failed: ${response.data.error}`);
      }
    } catch (error) {
      showPopup('Encryption service not running. Start python service first.');
    }
  };

  const handleMessageClick = (msg) => {
    if (msg.encrypted) {
      setSelectedMessage(msg);
      setShowKeyModal(true);
      setDecryptKey(sharedKey);
    }
  };

  const handleDecrypt = async () => {
    if (!decryptKey.trim() || !selectedMessage) return;

    try {
      const response = await axios.post('http://localhost:3001/api/decrypt', {
        encrypted: selectedMessage.encryptedHex,
        key: decryptKey
      });

      if (response.data.success) {
        // Update the message in the messages array to show decrypted content
        setMessages(prev => prev.map(msg => 
          msg.id === selectedMessage.id 
            ? {
                ...msg, 
                text: `🔓 DECRYPTED: ${response.data.decrypted_message}`,
                encrypted: false,
                decrypted: true
              }
            : msg
        ));
        
        setShowKeyModal(false);
        setSelectedMessage(null);
        setDecryptKey('');
      } else {
        showPopup(`Decryption failed: ${response.data.error}`);
      }
    } catch (error) {
      showPopup('Decryption service not running.');
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setSharedKey(text.trim());
      showPopup('✅ Key pasted!');
    } catch (err) {
      showPopup('Cannot read clipboard');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isConnected) {
    return (
      <div className="login-container">
        <div className="quantum-panel">
          <div className="panel-border">
            <div className="panel-content">
              <h1 className="quantum-title">ENTER YOUR NAME</h1>
              
              <input
                type="text"
                placeholder="ENTER YOUR NAME..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="quantum-input"
              />
              
              <div className="key-section">
                <textarea
                  value={sharedKey}
                  onChange={(e) => setSharedKey(e.target.value)}
                  placeholder="Paste quantum key here..."
                  rows="3"
                  className="quantum-key-input"
                />
                <button onClick={handlePasteKey} className="quantum-btn secondary">
                  PASTE KEY
                </button>
              </div>
              
              <div className="quantum-actions">
                <button onClick={joinChat} className="quantum-btn primary">
                  YES
                </button>
                <button onClick={() => window.close()} className="quantum-btn secondary">
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="quantum-header">
        <div className="header-glow">
          <h1>QUANTUM CHAT - {username.toUpperCase()}</h1>
        </div>
      </header>

      <div className="chat-container">
        <div className="messages-panel">
          <div className="messages">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`quantum-message ${msg.username === username ? 'sent' : 'received'} ${msg.encrypted ? 'encrypted-msg' : ''}`}
                onClick={() => handleMessageClick(msg)}
              >
                <div className="message-header">
                  <span className="sender">{msg.username}</span>
                  <span className="time">{formatTime(msg.timestamp)}</span>
                </div>
                <div className="message-body">
                  {msg.text}
                </div>
                {msg.encrypted && (
                  <div className="encrypted-indicator">
                    🔐 ENCRYPTED - CLICK TO DECRYPT
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="input-panel">
          <div className="input-container">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="TYPE MESSAGE..."
              rows="2"
              className="quantum-message-input"
            />
            <div className="send-actions">
              <button 
                onClick={() => sendMessage(false)} 
                disabled={!message.trim()}
                className="quantum-btn send-normal"
              >
                SEND
              </button>
              <button 
                onClick={() => sendMessage(true)} 
                disabled={!message.trim()}
                className="quantum-btn send-encrypt"
              >
                ENCRYPT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Decrypt Key Modal */}
      {showKeyModal && (
        <div className="quantum-modal">
          <div className="quantum-panel small">
            <div className="panel-border">
              <div className="panel-content">
                <h2>ENTER DECRYPTION KEY</h2>
                <textarea
                  value={decryptKey}
                  onChange={(e) => setDecryptKey(e.target.value)}
                  placeholder="Enter key to decrypt..."
                  rows="3"
                  className="quantum-key-input blur-key"
                />
                <div className="quantum-actions">
                  <button onClick={handleDecrypt} className="quantum-btn primary">
                    DECRYPT
                  </button>
                  <button onClick={() => setShowKeyModal(false)} className="quantum-btn secondary">
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Popup */}
      {showNotification && (
        <div className="notification-popup">
          <div className="notification-content">
            {notification}
          </div>
        </div>
      )}
    </div>
  )
}

export default App;