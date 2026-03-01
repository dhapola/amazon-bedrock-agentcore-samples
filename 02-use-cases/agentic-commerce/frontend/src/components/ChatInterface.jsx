import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import './ChatInterface.css'

const Message = ({ message, index }) => {
  const isUser = message.role === 'user'
  
  return (
    <motion.div
      className={`message ${isUser ? 'message-user' : 'message-assistant'}`}
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        delay: index * 0.03,
        duration: 0.35,
        ease: [0.4, 0, 0.2, 1]
      }}
    >
      <div className="message-header">
        <span className="message-role">
          {isUser ? 'You' : 'Assistant'}
        </span>
        <span className="message-time">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="message-content">
        {isUser ? (
          message.content
        ) : (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        )}
      </div>
    </motion.div>
  )
}

const ChatInterface = ({ messages, onSendMessage }) => {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (input.trim() && !isSending) {
      const messageText = input
      setInput('')
      setIsTyping(true)
      setIsSending(true)
      
      try {
        await onSendMessage(messageText)
      } finally {
        setIsTyping(false)
        setIsSending(false)
      }
    }
  }

  return (
    <div className="chat-interface">
      <div className="messages-container">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <Message key={message.id} message={message} index={index} />
          ))}
        </AnimatePresence>
        
        {isTyping && (
          <motion.div
            className="typing-indicator"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <span className="typing-text">Thinking...</span>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <motion.form 
        className="input-container"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type something nice..."
            className="chat-input"
            autoFocus
          />
          <button type="submit" className="send-button" disabled={isSending || !input.trim()}>
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </motion.form>
    </div>
  )
}

export default ChatInterface
