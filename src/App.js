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
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [encryptMessage, setEncryptMessage] = useState('');
  const [showDecryptModal, setShowDecryptModal] = useState(false);
  const [encryptedInput, setEncryptedInput] = useState('');
  const messagesEndRef = useRef(null);

  const BASE_URL = 'http://localhost:3001';
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to chat');
    });

    socket.on('joined', (data) => {
      setIsConnected(true);
      alert(`Welcome ${data.username}! ${data.hasKey ? 'Key loaded' : 'No key set'}`);
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
      alert('Enter username');
      return;
    }
    
    socket.emit('join', { username, key: sharedKey });
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    
    socket.emit('send-message', {
      text: message,
      encrypted: false
    });
    
    setMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEncrypt = async () => {
    if (!encryptMessage.trim() || !sharedKey.trim()) {
      alert('Enter message and set quantum key first');
      return;
    }

    try {
      const response = await axios.post(`${BASE_URL}/api/encrypt`, {
        message: encryptMessage,
        key: sharedKey
      });

      if (response.data.success) {
        // Send encrypted message
        socket.emit('send-message', {
          text: `🔐 ENCRYPTED MESSAGE\n${response.data.encrypted_hex.substring(0, 80)}...\n[Use Decrypt button to view]`,
          encrypted: true,
          encryptedHex: response.data.encrypted_hex
        });
        
        setEncryptMessage('');
        setShowEncryptModal(false);
        alert('✅ Message encrypted and sent!');
      } else {
        alert(`Encryption failed: ${response.data.error}`);
      }
    } catch (error) {
      alert('Encryption service not running. Start python service first.');
    }
  };

  const handleDecrypt = async () => {
    if (!encryptedInput.trim() || !sharedKey.trim()) {
      alert('Enter encrypted text and set quantum key first');
      return;
    }

    try {
      const response = await axios.post(`${BASE_URL}/api/decrypt`, {
        encrypted: encryptedInput,
        key: sharedKey
      });

      if (response.data.success) {
        alert(`✅ DECRYPTED MESSAGE:\n\n"${response.data.decrypted_message}"`);
        setShowDecryptModal(false);
        setEncryptedInput('');
      } else {
        alert(`Decryption failed: ${response.data.error}`);
      }
    } catch (error) {
      alert('Decryption service not running.');
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
      alert('✅ Key pasted!');
    } catch (err) {
      alert('Cannot read clipboard');
    }
  };

  if (!isConnected) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>🔐 Quantum Secure Chat</h1>
          
          <input
            type="text"
            placeholder="Username (Alice or Bob)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="username-input"
          />
          
          <div className="key-section">
            <h3>🔑 Paste Quantum Key</h3>
            <textarea
              value={sharedKey}
              onChange={(e) => setSharedKey(e.target.value)}
              placeholder="Paste key from terminal here..."
              rows="3"
              className="key-input"
            />
            <button onClick={handlePasteKey} className="paste-btn">
              📋 Paste from Clipboard
            </button>
          </div>
          
          <button onClick={joinChat} className="join-button">
            Join Chat
          </button>
          
          {/* <div className="instructions">
            <h3>🎯 Demo Instructions:</h3>
            <ol>
              <li><strong>Terminal:</strong> Run <code>python quantum-keygen.py</code></li>
              <li><strong>Terminal:</strong> Generate & copy quantum key</li>
              <li><strong>Here:</strong> Paste key & join as Alice</li>
              <li><strong>New window:</strong> Repeat steps 1-3 as Bob</li>
              <li><strong>Chat:</strong> Use Encrypt/Decrypt buttons</li>
            </ol>
          </div> */}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🔐 Quantum Chat - {username}</h1>
        <div className="header-buttons">
          <button onClick={() => setShowEncryptModal(true)} className="encrypt-btn">
            🔒 Encrypt
          </button>
          <button onClick={() => setShowDecryptModal(true)} className="decrypt-btn">
            🔓 Decrypt
          </button>
        </div>
      </header>

      <div className="chat-container">
        <div className="messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.username === username ? 'sent' : 'received'}`}>
              <div className="message-header">
                <span className="sender">{msg.username}</span>
                <span className="time">{formatTime(msg.timestamp)}</span>
              </div>
              <div className={`message-body ${msg.encrypted ? 'encrypted' : ''}`}>
                {msg.text}
                {msg.encrypted && (
                  <button 
                    className="copy-cipher"
                    onClick={() => {
                      navigator.clipboard.writeText(msg.encryptedHex);
                      alert('Ciphertext copied!');
                    }}
                  >
                    📋 Copy Ciphertext
                  </button>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type message..."
            rows="2"
          />
          <button onClick={sendMessage} disabled={!message.trim()}>
            Send
          </button>
        </div>
      </div>

      {/* Encrypt Modal */}
      {showEncryptModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>🔒 Encrypt Message</h2>
            <textarea
              value={encryptMessage}
              onChange={(e) => setEncryptMessage(e.target.value)}
              placeholder="Secret message..."
              rows="4"
            />
            <div className="modal-buttons">
              <button onClick={handleEncrypt} disabled={!encryptMessage.trim()}>
                Encrypt & Send
              </button>
              <button onClick={() => setShowEncryptModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decrypt Modal */}
      {showDecryptModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>🔓 Decrypt Message</h2>
            <textarea
              value={encryptedInput}
              onChange={(e) => setEncryptedInput(e.target.value)}
              placeholder="Paste encrypted hex..."
              rows="4"
            />
            <div className="modal-buttons">
              <button onClick={handleDecrypt} disabled={!encryptedInput.trim()}>
                Decrypt
              </button>
              <button onClick={() => setShowDecryptModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App;