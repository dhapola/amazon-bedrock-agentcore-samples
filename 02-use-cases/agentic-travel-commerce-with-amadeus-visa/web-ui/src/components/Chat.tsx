import { useState, useEffect, useRef, useMemo } from 'react'
import { invokeAgentCore, type ChatMessage, type SubagentStep } from '../services/awsCalls'
import { type Session, createSession, saveMessage } from '../services/bedrockSessionService'
import { submitFeedback } from '../services/feedbackService'
import { userProfileService } from '../services/userProfileService'
import { getCartItems, removeCartItems, type CartItem } from '../services/cartService'
import { createBooking } from '../services/bookingsService'
import { showToast } from '../utils/toast'
import { matchesAnyKeywordGroup, BUTTON_KEYWORDS } from '../utils/keywordMatcher'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import CardOnboarding from './CardOnboarding'
import PurchaseConfirmation from './PurchaseConfirmation'
import { VisaIframe } from './VisaIframe'
import EmptyState from './EmptyState'

// Component for rendering thinking content
const ThinkingSection = ({ thinkingContent }: { thinkingContent: string }) => {
  // Clean up the thinking content by removing extra spaces and newlines
  const cleanContent = thinkingContent
    .replace(/<thinking>/g, '') // Remove opening tag
    .replace(/<\/thinking>/g, '') // Remove closing tag
    .trim() // Remove leading/trailing whitespace
    .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
    .replace(/^\s+/gm, '') // Remove leading spaces from each line
    .replace(/\s+$/gm, '') // Remove trailing spaces from each line

  return (
    <div className="thinking-section">
      <details className="thinking-details">
        <summary className="thinking-summary">💭 Thinking...</summary>
        <div className="thinking-content">
          <div className="thinking-text">
            {cleanContent.split('\n').filter(line => line.trim()).map((line, index) => (
              <p key={index} className="thinking-paragraph">
                {line}
              </p>
            ))}
          </div>
        </div>
      </details>
    </div>
  )
}


// Component for rendering previous loops and subagent steps
const PreviousLoopsSection = ({ 
  previousLoops, 
  subagentSteps,
  currentSubagent
}: { 
  previousLoops?: string[];
  subagentSteps?: SubagentStep[];
  currentSubagent?: {
    name: string;
    input: string;
    tool?: string;
    content?: string;
  };
}) => {
  const hasLoops = previousLoops && previousLoops.length > 0;
  const hasSubagentSteps = subagentSteps && subagentSteps.length > 0;
  const hasCurrentSubagent = currentSubagent && currentSubagent.content;
  
  if (!hasLoops && !hasSubagentSteps && !hasCurrentSubagent) return null;

  const totalSteps = (previousLoops?.length || 0) + (subagentSteps?.length || 0) + (hasCurrentSubagent ? 1 : 0);

  return (
    <div className="previous-loops-section">
      <details className="previous-loops-details">
        <summary className="previous-loops-summary">
          🔄 Previous processing steps ({totalSteps})
        </summary>
        <div className="previous-loops-content">
          {/* Render previous loops */}
          {previousLoops?.map((loopContent, index) => (
            <div key={`loop-${index}`} className="previous-loop-item">
              <div className="previous-loop-header">Processing Step {index + 1}</div>
              <div className="previous-loop-content">
                <MarkdownRenderer content={loopContent} isAssistant={true} />
              </div>
            </div>
          ))}
          
          {/* Render completed subagent steps */}
          {subagentSteps?.map((step, index) => {
            return (
              <div key={`subagent-${index}`} className="previous-loop-item subagent-step">
                <div className="previous-loop-header">
                  🤖 {step.agentName}
                </div>
                <div className="subagent-input">
                  <strong>Input:</strong> {step.input}
                </div>
                <div className="previous-loop-content">
                  <MarkdownRenderer content={step.content} isAssistant={true} />
                </div>
              </div>
            );
          })}
          
          {/* Render current streaming subagent */}
          {currentSubagent && currentSubagent.content && (
            <div className="previous-loop-item subagent-step current-subagent">
              <div className="previous-loop-header">
                🤖 {currentSubagent.name} (streaming...)
              </div>
              <div className="subagent-input">
                <strong>Input:</strong> {currentSubagent.input}
              </div>
              <div className="previous-loop-content">
                <MarkdownRenderer content={currentSubagent.content} isAssistant={true} />
                <span className="streaming-cursor">|</span>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}

// Enhanced markdown renderer component
const MarkdownRenderer = ({ content, isAssistant = false }: { content: string; isAssistant?: boolean }) => {
  if (!content) return null

  // Clean up content for better rendering
  const processedContent = isAssistant ? content.trim() : content

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom heading renderer
          h1: ({ children }) => <h1 className="markdown-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="markdown-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="markdown-h3">{children}</h3>,
          h4: ({ children }) => <h4 className="markdown-h4">{children}</h4>,
          h5: ({ children }) => <h5 className="markdown-h5">{children}</h5>,
          h6: ({ children }) => <h6 className="markdown-h6">{children}</h6>,
          
          // Custom paragraph renderer
          p: ({ children }) => <p className="markdown-p">{children}</p>,
          
          // Custom list renderers
          ul: ({ children }) => <ul className="markdown-ul">{children}</ul>,
          ol: ({ children }) => <ol className="markdown-ol">{children}</ol>,
          li: ({ children }) => <li className="markdown-li">{children}</li>,
          
          // Custom code renderers
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match
            return isInline ? (
              <code className="markdown-inline-code" {...props}>
                {children}
              </code>
            ) : (
              <pre className="markdown-pre">
                <code className={`markdown-code ${className}`} {...props}>
                  {children}
                </code>
              </pre>
            )
          },
          
          // Custom blockquote renderer
          blockquote: ({ children }) => <blockquote className="markdown-blockquote">{children}</blockquote>,
          
          // Custom table renderers
          table: ({ children }) => <table className="markdown-table">{children}</table>,
          thead: ({ children }) => <thead className="markdown-thead">{children}</thead>,
          tbody: ({ children }) => <tbody className="markdown-tbody">{children}</tbody>,
          tr: ({ children }) => <tr className="markdown-tr">{children}</tr>,
          th: ({ children }) => <th className="markdown-th">{children}</th>,
          td: ({ children }) => <td className="markdown-td">{children}</td>,
          
          // Custom link renderer
          a: ({ href, children }) => (
            <a 
              href={href} 
              className="markdown-link" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          
          // Custom emphasis renderers
          strong: ({ children }) => <strong className="markdown-strong">{children}</strong>,
          em: ({ children }) => <em className="markdown-em">{children}</em>,
          
          // Custom horizontal rule
          hr: () => <hr className="markdown-hr" />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}

interface User {
  username: string
  email?: string
  userId: string
  name?: string
}

interface ChatProps {
  user: User
  onSignOut: () => void
  currentSession: Session | null
  sessions?: Session[]
  onSwitchSession?: (sessionId: string) => void
  getMessages: (sessionId: string) => Promise<ChatMessage[]>
  refreshSessions?: () => Promise<void>
  updateCurrentSession?: (session: Session) => void
  onMessagesUpdate?: (messages: ChatMessage[]) => void
  triggerMessage?: { message: string; timestamp: number }
  onNewChat?: () => void
  canStartNewChat?: boolean
  onCartUpdate?: () => void
}

const Chat = ({ user, currentSession, sessions = [], onSwitchSession, getMessages, refreshSessions, updateCurrentSession, onMessagesUpdate, onNewChat, canStartNewChat = true, onCartUpdate }: ChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string>('')
  const [showCommentBox, setShowCommentBox] = useState<string>('')
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackType, setFeedbackType] = useState<'up' | 'down' | null>(null)
  const [submittingFeedback, setSubmittingFeedback] = useState<string>('')
  const [messageFeedback, setMessageFeedback] = useState<Record<string, { feedback: 'up' | 'down', comment?: string }>>({})
  const [showCardForm, setShowCardForm] = useState(false)
  const [showPurchaseConfirmation, setShowPurchaseConfirmation] = useState(false)
  const [purchaseCartItems, setPurchaseCartItems] = useState<CartItem[]>([])
  const [visaIframeConfig, setVisaIframeConfig] = useState<any>(null)
  const [showSessionDropdown, setShowSessionDropdown] = useState(false)
  const [cardCheckResults, setCardCheckResults] = useState<Record<string, boolean>>({})
  const [hasCartItems, setHasCartItems] = useState(false)
  const [userExpressedPurchaseIntent, setUserExpressedPurchaseIntent] = useState(false)
  const [purchaseIntentMessageIndex, setPurchaseIntentMessageIndex] = useState<number>(-1)
  const [lastPurchaseTime, setLastPurchaseTime] = useState<number>(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sessionDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(event.target as Node)) {
        setShowSessionDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Notify parent when messages change
  useEffect(() => {
    if (onMessagesUpdate) {
      onMessagesUpdate(messages)
    }
  }, [messages, onMessagesUpdate])

  // Check card status for messages that need it (CONFIRM_PURCHASE keywords)
  useEffect(() => {
    const checkCardStatus = async () => {
      for (const message of messages) {
        if (message.role === 'assistant' && !message.isStreaming) {
          // Check if message has CONFIRM_PURCHASE keywords
          const hasPurchaseKeywords = matchesAnyKeywordGroup(message.content, BUTTON_KEYWORDS.CONFIRM_PURCHASE) ||
            (message.currentLoop && matchesAnyKeywordGroup(message.currentLoop, BUTTON_KEYWORDS.CONFIRM_PURCHASE))

          // Only check if we don't have a result yet and keywords match
          if (hasPurchaseKeywords && cardCheckResults[message.id] === undefined) {
            console.log(`[CARD CHECK] Message ${message.id}: Checking card status for user ${user.userId}`)
            try {
              const enrolledCard = await userProfileService.getEnrolledCard(user.userId)
              console.log(`[CARD CHECK] Message ${message.id}: enrolledCard result:`, enrolledCard) // nosemgrep
              const hasCard = !!enrolledCard
              console.log(`[CARD CHECK] Message ${message.id}: Setting hasCard = ${hasCard}`)
              setCardCheckResults(prev => ({
                ...prev,
                [message.id]: hasCard
              }))
            } catch (error) {
              console.error(`[CARD CHECK] Message ${message.id}: Error checking card status:`, error) // nosemgrep
              setCardCheckResults(prev => ({
                ...prev,
                [message.id]: false
              }))
            }
          }
        }
      }
    }

    checkCardStatus()
  }, [messages, user.userId, cardCheckResults])

  // Check if cart has items when messages with purchase keywords appear
  useEffect(() => {
    const checkCartItems = async () => {
      try {
        const items = await getCartItems(user.userId)
        setHasCartItems(items && items.length > 0)
      } catch (error) {
        console.error('Error checking cart items:', error)
        setHasCartItems(false)
      }
    }

    // Check cart whenever messages change (especially after purchase)
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === 'assistant') {
      const hasPurchaseKeywords = matchesAnyKeywordGroup(lastMessage.content, BUTTON_KEYWORDS.CONFIRM_PURCHASE) ||
        (lastMessage.currentLoop && matchesAnyKeywordGroup(lastMessage.currentLoop, BUTTON_KEYWORDS.CONFIRM_PURCHASE))

      if (hasPurchaseKeywords) {
        checkCartItems()
      }
    }
  }, [messages, user.userId])

  // Detect user purchase intent from their messages
  useEffect(() => {
    // Look at recent user messages (last 3) to detect purchase intent
    const recentUserMessages = messages
      .filter(m => m.role === 'user')
      .slice(-3)

    const hasRecentPurchaseIntent = recentUserMessages.some(msg =>
      matchesAnyKeywordGroup(msg.content, BUTTON_KEYWORDS.USER_PURCHASE_INTENT)
    )

    // Reset purchase intent if purchase was completed recently (within 30 seconds)
    const timeSinceLastPurchase = Date.now() - lastPurchaseTime
    if (timeSinceLastPurchase < 30000) {
      setUserExpressedPurchaseIntent(false)
      setPurchaseIntentMessageIndex(-1)
    } else {
      setUserExpressedPurchaseIntent(hasRecentPurchaseIntent)

      // Track the index of the message where user expressed purchase intent
      if (hasRecentPurchaseIntent) {
        const intentMessage = recentUserMessages.find(msg =>
          matchesAnyKeywordGroup(msg.content, BUTTON_KEYWORDS.USER_PURCHASE_INTENT)
        )
        if (intentMessage) {
          const intentIndex = messages.findIndex(m => m.id === intentMessage.id)
          setPurchaseIntentMessageIndex(intentIndex)
        }
      } else {
        setPurchaseIntentMessageIndex(-1)
      }
    }
  }, [messages, lastPurchaseTime])

  // Helper function to extract thinking content from message
  const extractThinkingContent = (content: string): { mainContent: string; thinkingContent?: string } => {
    const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g
    const matches = content.match(thinkingRegex)
    
    if (matches && matches.length > 0) {
      // Extract all thinking blocks
      const thinkingContent = matches.join('\n')
      // Remove thinking blocks from main content
      const mainContent = content.replace(thinkingRegex, '').trim()
      
      return {
        mainContent,
        thinkingContent
      }
    }
    
    return { mainContent: content }
  }

  // Load messages when switching sessions
  useEffect(() => {
    const loadMessages = async () => {
      if (currentSession && !currentSession.isTemporary) {
        // Load messages for existing (permanent) sessions
        try {
          const sessionMessages = await getMessages(currentSession.id)
          
          // Convert Bedrock messages to Chat messages
          const convertedMessages: ChatMessage[] = sessionMessages.map(msg => {
            
            // Extract thinking content for assistant messages
            if (msg.role === 'assistant') {
              const { mainContent, thinkingContent } = extractThinkingContent(msg.content)
              return {
                id: msg.id,
                role: msg.role as 'user' | 'assistant',
                content: mainContent,
                thinkingContent: thinkingContent
              }
            }
            
            return {
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
            }
          })
          
          setMessages(convertedMessages)
          console.log(`Loaded ${convertedMessages.length} messages from session ${currentSession.id}`)
          
        } catch (error) {
          console.error('Error loading session messages:', error)
          setMessages([])
        }
      } else if (!currentSession || currentSession.isTemporary) {
        // Clear messages for new conversations (no session or temporary session)
        setMessages([])
        console.log('Cleared messages for new conversation')
      }
    }
    
    loadMessages()
  }, [currentSession?.id, currentSession?.isTemporary, getMessages])

  // Auto-resize textarea based on content
  const autoResizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto'
    const lineHeight = 24 // Approximate line height in pixels
    const maxLines = 7
    const maxHeight = lineHeight * maxLines
    
    if (textarea.scrollHeight <= maxHeight) {
      textarea.style.height = `${textarea.scrollHeight}px`
      textarea.style.overflowY = 'hidden'
    } else {
      textarea.style.height = `${maxHeight}px`
      textarea.style.overflowY = 'auto'
    }
  }

  // Helper function to copy message content
  const copyToClipboard = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(''), 2000) // Clear after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  // Enhanced feedback handlers with visual state management
  const handleFeedback = async (messageId: string, feedback: 'up' | 'down') => {
    if (submittingFeedback === messageId) return // Prevent double submission
    
    setSubmittingFeedback(messageId)
    try {
      await submitFeedback(messageId, feedback, user.userId)
      console.log(`✅ Feedback submitted: ${feedback} for message ${messageId}`)
      
      // Update local feedback state to show visual indicator
      setMessageFeedback(prev => ({
        ...prev,
        [messageId]: { feedback }
      }))
      
    } catch (error) {
      console.error('❌ Error submitting feedback:', error)
    } finally {
      setSubmittingFeedback('')
    }
  }

  // Reserved for future use: allow users to provide comments with feedback
  // const handleFeedbackWithComment = (messageId: string, feedback: 'up' | 'down') => {
  //   setShowCommentBox(messageId)
  //   setFeedbackType(feedback) // Store the feedback type
  //   setFeedbackComment('')
  // }

  const cancelFeedback = () => {
    setShowCommentBox('')
    setFeedbackComment('')
    setFeedbackType(null)
  }

  const submitFeedbackWithComment = async () => {
    const messageId = showCommentBox
    if (!messageId || !feedbackType) return

    if (submittingFeedback === messageId) return // Prevent double submission

    setSubmittingFeedback(messageId)
    try {
      await submitFeedback(messageId, feedbackType, user.userId, feedbackComment)
      console.log('✅ Feedback with comment submitted successfully')

      // Update local feedback state to show visual indicator
      setMessageFeedback(prev => ({
        ...prev,
        [messageId]: { feedback: feedbackType, comment: feedbackComment }
      }))

      setShowCommentBox('')
      setFeedbackComment('')
      setFeedbackType(null)
    } catch (error) {
      console.error('❌ Error submitting feedback with comment:', error)
    } finally {
      setSubmittingFeedback('')
    }
  }

  // Purchase confirmation handlers
  const handleOpenPurchaseConfirmation = async () => {
    try {
      // Fetch cart items
      const items = await getCartItems(user.userId)
      if (!items || items.length === 0) {
        showToast.warning('Your cart is empty. Please add items before purchasing.')
        return
      }

      setPurchaseCartItems(items)
      setShowPurchaseConfirmation(true)
    } catch (error) {
      console.error('Error loading cart for purchase:', error)
      showToast.error('Failed to load cart items. Please try again.')
    }
  }

  const handlePurchaseComplete = async (result: any) => {
    setShowPurchaseConfirmation(false)
    setPurchaseCartItems([])

    // Clear card check cache to force re-check for future purchases
    setCardCheckResults({})

    // Mark cart as empty after purchase
    setHasCartItems(false)

    // Reset purchase intent and record purchase time
    setUserExpressedPurchaseIntent(false)
    setLastPurchaseTime(Date.now())

    console.log('✅ Purchase complete in Chat component')

    // Generate order ID
    const orderId = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${result.instructionId?.slice(-8) || 'XXXX'}`

    // Create booking records for purchased items
    if (result.cartItems && result.cartItems.length > 0) {
      for (const item of result.cartItems) {
        await createBooking(user.userId, orderId, {
          item_type: item.item_type || 'product',
          title: item.title,
          price: item.price,
          asin: item.asin,
          url: item.url,
          flight_id: item.details?.flight_id,
          origin: item.details?.origin,
          destination: item.details?.destination,
          departure_date: item.details?.departure_date,
          airline: item.details?.airline,
          hotel_id: item.details?.hotel_id,
          city_code: item.details?.city_code,
          rating: item.details?.rating,
          amenities: item.details?.amenities
        })
      }
      console.log(`📋 Created ${result.cartItems.length} booking records`)
    }

    // Remove only the purchased items from cart
    try {
      const asins: string[] = []
      const flight_ids: string[] = []
      const hotel_ids: string[] = []

      console.log('🛒 Processing cart items for removal:', result.cartItems)

      for (const item of result.cartItems) {
        console.log('🛒 Processing item:', {
          item_type: item.item_type,
          asin: item.asin,
          flight_id: item.details?.flight_id,
          hotel_id: item.details?.hotel_id,
          details: item.details
        })

        if (item.item_type === 'flight' && item.details?.flight_id) {
          flight_ids.push(item.details.flight_id)
        } else if (item.item_type === 'hotel' && item.details?.hotel_id) {
          hotel_ids.push(item.details.hotel_id)
        } else if (item.asin) {
          asins.push(item.asin)
        }
      }

      console.log('🛒 Identifiers to remove:', { asins, flight_ids, hotel_ids })
      await removeCartItems(user.userId, { asins, flight_ids, hotel_ids })
      console.log('🛒 Purchased items removed from cart')
    } catch (error) {
      console.error('Error removing purchased items from cart:', error)
    }

    // Refresh cart count
    if (onCartUpdate) {
      onCartUpdate()
    }

    // Send purchase confirmation to agent so it can acknowledge
    const purchaseSummary = `Purchase completed successfully! ${result.cartItems?.length || 0} items purchased for $${result.totalAmount}. Order ID: ${orderId}`

    // DO NOT add system message to UI - send directly to agent without showing in chat
    setLoading(true)

    try {
      let actualSessionId = currentSession?.id

      // Use existing session
      if (actualSessionId) {
        // Save system message to database (for agent context) but don't add to UI
        await saveMessage(actualSessionId, 'user', purchaseSummary)

        // Send to agent - agent's response will appear in UI
        const setAnswers = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
          setMessages(currentMessages => {
            const newMessages = updater(currentMessages)
            const lastMessage = newMessages[newMessages.length - 1]
            if (lastMessage &&
                lastMessage.role === 'assistant' &&
                !lastMessage.isStreaming &&
                lastMessage.status === 'complete' &&
                actualSessionId) {
              saveMessage(actualSessionId, 'assistant', lastMessage.content)
                .then(() => console.log('Saved purchase acknowledgment to AppSync'))
                .catch(error => console.error('Error saving acknowledgment:', error))
            }
            return newMessages
          })
        }

        await invokeAgentCore(
          purchaseSummary,
          user.userId,
          actualSessionId,
          setAnswers,
        )
      }
    } catch (error) {
      console.error('Error notifying agent of purchase:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchaseError = (error: string) => {
    setShowPurchaseConfirmation(false)
    setPurchaseCartItems([])
    // Show error toast for UI/system errors (not agent errors)
    showToast.error(`Purchase failed: ${error}. Please try again.`)
  }

  const handlePurchaseCancel = () => {
    setShowPurchaseConfirmation(false)
    setPurchaseCartItems([])
    // No toast needed - user just closed the modal
  }

  // Helper function to get status display text and icon
  const getStatusDisplay = (status?: string) => {
    if (!status) return null
    
    // Handle descriptive status strings
    if (status.toLowerCase().includes('preparing')) {
      return { text: status, icon: '🔄', className: 'status-preparing' }
    } else if (status.toLowerCase().includes('using tool') || status.toLowerCase().includes('using ')) {
      return { text: status, icon: '🔧', className: 'status-using-tool' }
    } else if (status.toLowerCase().includes('calling ')) {
      return { text: status, icon: '🤖', className: 'status-calling-subagent' }
    } else if (status.toLowerCase().includes('thinking')) {
      return { text: status, icon: '🧠', className: 'status-thinking' }
    } else if (status.toLowerCase() === 'complete') {
      return { text: status, icon: '✅', className: 'status-complete' }
    } else if (status.toLowerCase().includes('processing')) {
      return { text: status, icon: '⚙️', className: 'status-processing' }
    } else {
      // Default for any other status
      return { text: status, icon: '⚙️', className: 'status-default' }
    }
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e)
    }
  }

  // Programmatically send a message (used by quick action buttons)
  const handleSendMessage = (message: string) => {
    setInputMessage(message)
    // Trigger send after state update
    setTimeout(() => {
      const form = document.querySelector('.chat-input-form') as HTMLFormElement
      if (form) {
        form.requestSubmit()
      }
    }, 0)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inputMessage.trim() || loading) return

    const messageText = inputMessage.trim()
    setInputMessage('')
    
    // Reset textarea height after clearing message
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.overflowY = 'hidden'
    }

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
    }

    // Add user message to conversation history (maintain conversation)
    setMessages(prev => [...prev, userMessage])
    setLoading(true)

    let actualSessionId = currentSession?.id
    let isNewSession = false
    let assistantMessageSaved = false // Flag to prevent duplicate saves

    try {
      // Create new session ONLY if there's no current session at all
      if (!currentSession) {
        console.log('No current session found, creating new session...')
        // Use first 100 characters of user message as session title
        const sessionTitle = messageText.length > 100 
          ? messageText.substring(0, 100).trim() + '...'
          : messageText.trim()
        const newSession = await createSession(user.userId, sessionTitle)
        actualSessionId = newSession.id
        isNewSession = true
        console.log('Created new session:', actualSessionId)
        
        // Update the current session state immediately
        if (updateCurrentSession) {
          updateCurrentSession(newSession)
        }
      } else if (currentSession.isTemporary) {
        // If we have a temporary session, create a permanent one and use its ID
        console.log('Converting temporary session to permanent...')
        const sessionTitle = messageText.length > 100 
          ? messageText.substring(0, 100).trim() + '...'
          : messageText.trim()
        const newSession = await createSession(user.userId, sessionTitle)
        actualSessionId = newSession.id
        isNewSession = true
        console.log('Created permanent session:', actualSessionId)
        
        // Update the current session state immediately
        if (updateCurrentSession) {
          updateCurrentSession(newSession)
        }
      } else {
        // Use existing session
        actualSessionId = currentSession.id
        console.log('Using existing session:', actualSessionId)
      }

      // Save user message to AppSync
      if (actualSessionId) {
        try {
          await saveMessage(actualSessionId, 'user', messageText)
          console.log('Saved user message to AppSync')
        } catch (error) {
          console.error('Error saving user message:', error)
        }
      }

      // Enhanced function to update streaming response and handle completion
      const setAnswers = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
        setMessages(currentMessages => {
          const newMessages = updater(currentMessages)
          
          // Check if any assistant message just completed and hasn't been saved yet
          const lastMessage = newMessages[newMessages.length - 1]
          if (lastMessage && 
              lastMessage.role === 'assistant' && 
              !lastMessage.isStreaming && 
              lastMessage.status === 'complete' &&
              actualSessionId &&
              !assistantMessageSaved) {
            
            // Mark as saved to prevent duplicates
            assistantMessageSaved = true
            
            // Save the completed assistant message to AppSync
            saveMessage(actualSessionId, 'assistant', lastMessage.content)
              .then(() => console.log('Saved completed assistant message to AppSync'))
              .catch(error => console.error('Error saving completed assistant message:', error))
          }
          
          return newMessages
        })
      }

      // Call Agent Core with session ID
      console.log('Sending message with session ID:', actualSessionId)
      await invokeAgentCore(
        messageText,
        user.userId, // User ID
        actualSessionId || `session-${user.userId}-${Date.now()}`, // Use session ID
        setAnswers,
      )

      // Assistant message will be saved automatically when AgentCore completes
      // via the enhanced setAnswers callback above
      console.log('Assistant message will be saved when AgentCore signals completion')

      // If this was a new session, refresh sessions
      if (isNewSession && refreshSessions) {
        console.log('Refreshing sessions after creating new session...')
        // Refresh sessions with retry logic to ensure backend has processed the new session
        const refreshWithRetry = async (retries = 3, delay = 1000) => {
          for (let i = 0; i < retries; i++) {
            await new Promise(resolve => setTimeout(resolve, delay))
            try {
              await refreshSessions()
              console.log(`Session refresh attempt ${i + 1} completed`)
              break
            } catch (error) {
              console.error(`Session refresh attempt ${i + 1} failed:`, error) // nosemgrep
              if (i === retries - 1) {
                console.error('All session refresh attempts failed')
              }
            }
          }
        }
        refreshWithRetry()
      }

    } catch (error) {
      console.error('Error sending message:', error)
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
      // Assistant message saving is now handled in the setAnswers callback
      // when AgentCore signals completion - no duplicate saving needed here
    }
  }

  // Check if there are any assistant messages (for enabling New Chat button)
  const hasAssistantMessages = messages.some(m => m.role === 'assistant' && !m.isStreaming)

  // Memoize the last assistant message ID to prevent infinite re-renders
  const lastAssistantMessageId = useMemo(() => {
    const assistantMessages = messages.filter(m => m.role === 'assistant' && !m.isStreaming)
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].id : null
  }, [messages])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="modern-chat-container">
        <div
          className="modern-chat-messages modern-scroll-smooth"
          ref={messagesContainerRef}
        >
          {messages.length === 0 && (
            <EmptyState
              type="chat"
              title={`Hi ${user.name || user.username}!`}
              description="I'm your AI travel assistant. Ask me about destinations, flights, hotels, or anything travel-related!"
            />
          )}
          
          {messages.map((message) => {
            const statusDisplay = message.role === 'assistant' ? getStatusDisplay(message.status) : null
            const currentFeedback = messageFeedback[message.id]
            
            return (
              <div key={message.id} className={`modern-message ${message.role}`}>
                <div className="modern-message-content">
                  {/* Status Row Above Message Box for Assistant Messages */}
                  {statusDisplay && statusDisplay.className !== 'status-complete' && (
                    <div className={`message-status-row ${statusDisplay.className}`} style={{ marginBottom: 'var(--space-sm)' }}>
                      <span className="status-icon">{statusDisplay.icon}</span>
                      <span className="status-text">{statusDisplay.text}</span>
                    </div>
                  )}

                  <div className="modern-message-bubble">
                    {/* Message Header with Role and Timestamp - INSIDE bubble */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        color: message.role === 'assistant' ? '#8B5CF6' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ fontSize: '14px' }}>
                          {message.role === 'assistant' ? '🤖' : '👤'}
                        </span>
                        {message.role === 'assistant' ? 'ASSISTANT' : 'YOU'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.6875rem',
                          color: message.role === 'assistant' ? '#9CA3AF' : 'rgba(255, 255, 255, 0.7)',
                          fontWeight: 400
                        }}>
                          {new Date(message.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {/* Action buttons for assistant messages */}
                        {message.role === 'assistant' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => copyToClipboard(message.content, message.id)}
                              title="Copy message"
                              style={{
                                background: 'transparent',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                borderRadius: '6px',
                                padding: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#9CA3AF',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)'
                                e.currentTarget.style.color = '#8B5CF6'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)'
                                e.currentTarget.style.color = '#9CA3AF'
                              }}
                            >
                              {copiedMessageId === message.id ? (
                                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                                </svg>
                              )}
                            </button>

                            <button
                              onClick={() => handleFeedback(message.id, 'up')}
                              disabled={submittingFeedback === message.id}
                              title={currentFeedback?.feedback === 'up' ? 'You liked this response' : 'Good response'}
                              style={{
                                background: currentFeedback?.feedback === 'up' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                borderRadius: '6px',
                                padding: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: currentFeedback?.feedback === 'up' ? '#8B5CF6' : '#9CA3AF',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)'
                                e.currentTarget.style.color = '#8B5CF6'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)'
                                if (currentFeedback?.feedback !== 'up') {
                                  e.currentTarget.style.color = '#9CA3AF'
                                }
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/>
                              </svg>
                            </button>

                            <button
                              onClick={() => handleFeedback(message.id, 'down')}
                              disabled={submittingFeedback === message.id}
                              title={currentFeedback?.feedback === 'down' ? 'You disliked this response' : 'Poor response'}
                              style={{
                                background: currentFeedback?.feedback === 'down' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                borderRadius: '6px',
                                padding: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: currentFeedback?.feedback === 'down' ? '#8B5CF6' : '#9CA3AF',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)'
                                e.currentTarget.style.color = '#8B5CF6'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)'
                                if (currentFeedback?.feedback !== 'down') {
                                  e.currentTarget.style.color = '#9CA3AF'
                                }
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ transform: 'rotate(180deg)' }}>
                                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/>
                              </svg>
                            </button>

                            {!currentFeedback && (
                              <button
                                onClick={() => {
                                  setShowCommentBox(message.id)
                                  setFeedbackType(null)
                                  setFeedbackComment('')
                                }}
                                title="Add comment with feedback"
                                style={{
                                  background: 'transparent',
                                  border: '1px solid rgba(139, 92, 246, 0.3)',
                                  borderRadius: '6px',
                                  padding: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#9CA3AF',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)'
                                  e.currentTarget.style.color = '#8B5CF6'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)'
                                  e.currentTarget.style.color = '#9CA3AF'
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.5 1a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm5 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm5 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Render thinking section if present */}
                    {message.role === 'assistant' && message.thinkingContent && (
                      <div className="modern-thinking">
                        <details className="modern-thinking-details">
                          <summary className="modern-thinking-summary">💭 Thinking...</summary>
                          <div className="modern-thinking-content">
                            {message.thinkingContent.replace(/<\/?thinking>/g, '').trim().split('\n').filter(line => line.trim()).map((line, index) => (
                              <p key={index}>{line}</p>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                    
                    {/* Render previous loops and subagent steps section if present */}
                    {message.role === 'assistant' && ((message.previousLoops && message.previousLoops.length > 0) || (message.subagentSteps && message.subagentSteps.length > 0) || (message.currentSubagent && message.currentSubagent.content)) && (
                      <PreviousLoopsSection 
                        previousLoops={message.previousLoops} 
                        subagentSteps={message.subagentSteps}
                        currentSubagent={message.currentSubagent}
                      />
                    )}
                    
                    <div className="formatted-message">
                      <MarkdownRenderer 
                        content={message.currentLoop || message.content} 
                        isAssistant={message.role === 'assistant'} 
                      />
                      {message.isStreaming && (
                        <span className="streaming-cursor">|</span>
                      )}
                    </div>
                    
                    {/* Button Rendering Logic with Mutual Exclusion
                        Priority: CONFIRM_PURCHASE (if has card) > ADD_CARD (if no card OR check pending)
                        NEVER show both buttons at once
                        Only show buttons on the LAST assistant message */}
                    {(() => {
                      // Skip if not an assistant message or still streaming
                      if (message.role !== 'assistant' || message.isStreaming) return null

                      // Only show buttons on the last assistant message (using memoized value)
                      if (!lastAssistantMessageId || message.id !== lastAssistantMessageId) {
                        return null
                      }

                      // IMPORTANT: Only show buttons on messages that come AFTER user expressed purchase intent
                      // This prevents buttons from appearing on older messages before the user said "buy" / "checkout"
                      const currentMessageIndex = messages.findIndex(m => m.id === message.id)
                      if (purchaseIntentMessageIndex >= 0 && currentMessageIndex <= purchaseIntentMessageIndex) {
                        return null
                      }

                      // Check for keyword matches
                      const hasAddCardKeywords = matchesAnyKeywordGroup(message.content, BUTTON_KEYWORDS.ADD_CARD) ||
                        (message.currentLoop && matchesAnyKeywordGroup(message.currentLoop, BUTTON_KEYWORDS.ADD_CARD))

                      const hasPurchaseKeywords = matchesAnyKeywordGroup(message.content, BUTTON_KEYWORDS.CONFIRM_PURCHASE) ||
                        (message.currentLoop && matchesAnyKeywordGroup(message.currentLoop, BUTTON_KEYWORDS.CONFIRM_PURCHASE))

                      // Get card check result (undefined means check in progress or not started)
                      const hasCard = cardCheckResults[message.id]

                      // Debug logging
                      if (hasAddCardKeywords || hasPurchaseKeywords) {
                        console.log(`[BUTTON LOGIC] Message ${message.id}:`, {
                          hasAddCardKeywords,
                          hasPurchaseKeywords,
                          hasCard,
                          hasCartItems,
                          userExpressedPurchaseIntent,
                          cardCheckResults: cardCheckResults[message.id],
                          isLastAssistantMessage: true
                        })
                      }

                      // PRIORITY 1: CONFIRM_PURCHASE button
                      // ONLY show if: user expressed purchase intent AND agent confirms AND card exists AND cart has items
                      if (userExpressedPurchaseIntent && hasPurchaseKeywords && hasCard === true && hasCartItems) {
                        console.log(`[BUTTON LOGIC] Message ${message.id}: Showing CONFIRM_PURCHASE button`)
                        return (
                          <div style={{ marginTop: '1rem' }}>
                            <button
                              className="btn-confirm-purchase"
                              onClick={handleOpenPurchaseConfirmation}
                              style={{ width: 'auto', padding: '0.75rem 1.5rem' }}
                            >
                              ✅ Confirm Purchase
                            </button>
                          </div>
                        )
                      }

                      // PRIORITY 2: ADD_CARD button
                      // Show ONLY if:
                      // 1. User expressed purchase intent AND agent confirms AND no card AND cart has items
                      //    (User wants to buy but needs to add card first)
                      //
                      // NEVER show if:
                      // - User hasn't expressed purchase intent (no forcing card onboarding)
                      // - Cart is empty (likely post-purchase confirmation)
                      // - Purchase was just completed (within 30 seconds)
                      if (userExpressedPurchaseIntent && hasPurchaseKeywords && hasCard !== true && hasCartItems) {
                        console.log(`[BUTTON LOGIC] Message ${message.id}: Showing ADD_CARD button (userIntent=${userExpressedPurchaseIntent}, hasPurchaseKeywords=${hasPurchaseKeywords}, hasCard=${hasCard}, hasCartItems=${hasCartItems})`)
                        return (
                          <div style={{ marginTop: '1rem' }}>
                            <button
                              onClick={() => setShowCardForm(true)}
                              style={{
                                background: 'linear-gradient(135deg, #1668e3 0%, #1a1f71 100%)',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.2s',
                                width: 'auto'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)'
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 104, 227, 0.3)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = 'none'
                              }}
                            >
                              <span>💳</span>
                              <span>Add Visa Card with Secure Authentication</span>
                              <span>🔐</span>
                            </button>
                          </div>
                        )
                      }

                      // No button to show
                      console.log(`[BUTTON LOGIC] Message ${message.id}: No button to show`)
                      return null
                    })()}
                    
                    {/* Purchase Confirmation UI */}
                    {message.purchaseConfirmation && message.purchaseConfirmation.requires_confirmation && (
                      <div className="purchase-confirmation-card">
                        <div className="purchase-summary">
                          <h4>🛒 Confirm Purchase</h4>
                          <div className="purchase-details">
                            <div className="purchase-detail-row">
                              <span>Items:</span>
                              <strong>{message.purchaseConfirmation.items_count}</strong>
                            </div>
                            <div className="purchase-detail-row">
                              <span>Total:</span>
                              <strong>{message.purchaseConfirmation.total_amount}</strong>
                            </div>
                            <div className="purchase-detail-row">
                              <span>Payment:</span>
                              <strong>{message.purchaseConfirmation.payment_method}</strong>
                            </div>
                          </div>
                        </div>
                        <div className="purchase-actions">
                          <button 
                            className="btn-confirm-purchase"
                            onClick={() => handleSendMessage('Yes, confirm the purchase')}
                          >
                            ✓ Confirm Purchase
                          </button>
                          <button 
                            className="btn-cancel-purchase"
                            onClick={() => handleSendMessage('No, cancel the purchase')}
                          >
                            ✗ Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Minimal comment input for feedback */}
                {showCommentBox === message.id && (
                  <div className="minimal-comment-box">
                    <div className="minimal-feedback-selector">
                      <button
                        className={`minimal-feedback-btn ${feedbackType === 'up' ? 'active' : ''}`}
                        onClick={() => setFeedbackType('up')}
                        title="Helpful"
                      >
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10.9153 1.83987L11.2942 1.88772L11.4749 1.91507C13.2633 2.24201 14.4107 4.01717 13.9749 5.78225L13.9261 5.95901L13.3987 7.6719C13.7708 7.67575 14.0961 7.68389 14.3792 7.70608C14.8737 7.74486 15.3109 7.82759 15.7015 8.03323L15.8528 8.11819C16.5966 8.56353 17.1278 9.29625 17.3167 10.1475L17.347 10.3096C17.403 10.69 17.3647 11.0832 17.2835 11.5098C17.2375 11.7517 17.1735 12.0212 17.096 12.3233L16.8255 13.3321L16.4456 14.7276C16.2076 15.6001 16.0438 16.2356 15.7366 16.7305L15.595 16.9346C15.2989 17.318 14.9197 17.628 14.4866 17.8408L14.2982 17.9258C13.6885 18.1774 12.9785 18.1651 11.9446 18.1651H7.33331C6.64422 18.1651 6.08726 18.1657 5.63702 18.1289C5.23638 18.0962 4.87565 18.031 4.53936 17.8867L4.39679 17.8203C3.87576 17.5549 3.43916 17.151 3.13507 16.6553L3.013 16.4366C2.82119 16.0599 2.74182 15.6541 2.7044 15.1963C2.66762 14.7461 2.66827 14.1891 2.66827 13.5V11.667C2.66827 10.9349 2.66214 10.4375 2.77569 10.0137L2.83722 9.81253C3.17599 8.81768 3.99001 8.05084 5.01397 7.77639L5.17706 7.73928C5.56592 7.66435 6.02595 7.66799 6.66632 7.66799C6.9429 7.66799 7.19894 7.52038 7.33624 7.2803L10.2562 2.16995L10.3118 2.08792C10.4544 1.90739 10.6824 1.81092 10.9153 1.83987ZM7.33136 14.167C7.33136 14.9841 7.33714 15.2627 7.39386 15.4746L7.42999 15.5918C7.62644 16.1686 8.09802 16.6134 8.69171 16.7725L8.87042 16.8067C9.07652 16.8323 9.38687 16.835 10.0003 16.835H11.9446C13.099 16.835 13.4838 16.8228 13.7903 16.6963L13.8997 16.6465C14.1508 16.5231 14.3716 16.3444 14.5433 16.1221L14.6155 16.0166C14.7769 15.7552 14.8968 15.3517 15.1624 14.378L15.5433 12.9824L15.8079 11.9922C15.8804 11.7102 15.9368 11.4711 15.9769 11.2608C16.0364 10.948 16.0517 10.7375 16.0394 10.5791L16.0179 10.4356C15.9156 9.97497 15.641 9.57381 15.2542 9.31253L15.0814 9.20999C14.9253 9.12785 14.6982 9.06544 14.2747 9.03225C13.8477 8.99881 13.2923 8.99807 12.5003 8.99807C12.2893 8.99807 12.0905 8.89822 11.9651 8.72854C11.8398 8.55879 11.8025 8.33942 11.8646 8.13772L12.6556 5.56741L12.7054 5.36331C12.8941 4.35953 12.216 3.37956 11.1878 3.2178L8.49054 7.93948C8.23033 8.39484 7.81431 8.72848 7.33136 8.88967V14.167ZM3.99835 13.5C3.99835 14.2111 3.99924 14.7044 4.03058 15.0879C4.06128 15.4636 4.11804 15.675 4.19854 15.833L4.26886 15.959C4.44517 16.2466 4.69805 16.4808 5.0003 16.6348L5.13019 16.6905C5.27397 16.7419 5.46337 16.7797 5.74542 16.8028C5.97772 16.8217 6.25037 16.828 6.58722 16.8311C6.41249 16.585 6.27075 16.3136 6.1712 16.0215L6.10968 15.8194C5.99614 15.3956 6.00128 14.899 6.00128 14.167V9.00296C5.79386 9.0067 5.65011 9.01339 5.53741 9.02737L5.3587 9.06057C4.76502 9.21965 4.29247 9.66448 4.09601 10.2412L4.06085 10.3584C4.00404 10.5705 3.99835 10.8493 3.99835 11.667V13.5Z"></path>
                        </svg>
                      </button>
                      <button
                        className={`minimal-feedback-btn ${feedbackType === 'down' ? 'active' : ''}`}
                        onClick={() => setFeedbackType('down')}
                        title="Not helpful"
                      >
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{transform: 'rotate(180deg)'}}>
                          <path d="M10.9153 1.83987L11.2942 1.88772L11.4749 1.91507C13.2633 2.24201 14.4107 4.01717 13.9749 5.78225L13.9261 5.95901L13.3987 7.6719C13.7708 7.67575 14.0961 7.68389 14.3792 7.70608C14.8737 7.74486 15.3109 7.82759 15.7015 8.03323L15.8528 8.11819C16.5966 8.56353 17.1278 9.29625 17.3167 10.1475L17.347 10.3096C17.403 10.69 17.3647 11.0832 17.2835 11.5098C17.2375 11.7517 17.1735 12.0212 17.096 12.3233L16.8255 13.3321L16.4456 14.7276C16.2076 15.6001 16.0438 16.2356 15.7366 16.7305L15.595 16.9346C15.2989 17.318 14.9197 17.628 14.4866 17.8408L14.2982 17.9258C13.6885 18.1774 12.9785 18.1651 11.9446 18.1651H7.33331C6.64422 18.1651 6.08726 18.1657 5.63702 18.1289C5.23638 18.0962 4.87565 18.031 4.53936 17.8867L4.39679 17.8203C3.87576 17.5549 3.43916 17.151 3.13507 16.6553L3.013 16.4366C2.82119 16.0599 2.74182 15.6541 2.7044 15.1963C2.66762 14.7461 2.66827 14.1891 2.66827 13.5V11.667C2.66827 10.9349 2.66214 10.4375 2.77569 10.0137L2.83722 9.81253C3.17599 8.81768 3.99001 8.05084 5.01397 7.77639L5.17706 7.73928C5.56592 7.66435 6.02595 7.66799 6.66632 7.66799C6.9429 7.66799 7.19894 7.52038 7.33624 7.2803L10.2562 2.16995L10.3118 2.08792C10.4544 1.90739 10.6824 1.81092 10.9153 1.83987ZM7.33136 14.167C7.33136 14.9841 7.33714 15.2627 7.39386 15.4746L7.42999 15.5918C7.62644 16.1686 8.09802 16.6134 8.69171 16.7725L8.87042 16.8067C9.07652 16.8323 9.38687 16.835 10.0003 16.835H11.9446C13.099 16.835 13.4838 16.8228 13.7903 16.6963L13.8997 16.6465C14.1508 16.5231 14.3716 16.3444 14.5433 16.1221L14.6155 16.0166C14.7769 15.7552 14.8968 15.3517 15.1624 14.378L15.5433 12.9824L15.8079 11.9922C15.8804 11.7102 15.9368 11.4711 15.9769 11.2608C16.0364 10.948 16.0517 10.7375 16.0394 10.5791L16.0179 10.4356C15.9156 9.97497 15.641 9.57381 15.2542 9.31253L15.0814 9.20999C14.9253 9.12785 14.6982 9.06544 14.2747 9.03225C13.8477 8.99881 13.2923 8.99807 12.5003 8.99807C12.2893 8.99807 12.0905 8.89822 11.9651 8.72854C11.8398 8.55879 11.8025 8.33942 11.8646 8.13772L12.6556 5.56741L12.7054 5.36331C12.8941 4.35953 12.216 3.37956 11.1878 3.2178L8.49054 7.93948C8.23033 8.39484 7.81431 8.72848 7.33136 8.88967V14.167ZM3.99835 13.5C3.99835 14.2111 3.99924 14.7044 4.03058 15.0879C4.06128 15.4636 4.11804 15.675 4.19854 15.833L4.26886 15.959C4.44517 16.2466 4.69805 16.4808 5.0003 16.6348L5.13019 16.6905C5.27397 16.7419 5.46337 16.7797 5.74542 16.8028C5.97772 16.8217 6.25037 16.828 6.58722 16.8311C6.41249 16.585 6.27075 16.3136 6.1712 16.0215L6.10968 15.8194C5.99614 15.3956 6.00128 14.899 6.00128 14.167V9.00296C5.79386 9.0067 5.65011 9.01339 5.53741 9.02737L5.3587 9.06057C4.76502 9.21965 4.29247 9.66448 4.09601 10.2412L4.06085 10.3584C4.00404 10.5705 3.99835 10.8493 3.99835 11.667V13.5Z"></path>
                        </svg>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Add a comment (optional)..."
                      className="minimal-comment-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          submitFeedbackWithComment()
                        } else if (e.key === 'Escape') {
                          cancelFeedback()
                        }
                      }}
                      autoFocus
                    />
                    <div className="minimal-comment-actions">
                      <button onClick={cancelFeedback} className="minimal-cancel-btn">✕</button>
                      <button 
                        onClick={submitFeedbackWithComment}
                        disabled={!feedbackType || submittingFeedback === message.id}
                        className="minimal-submit-btn"
                      >
                        ✓
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-4 py-2">
          <form onSubmit={sendMessage}>
            <div
              className="flex items-stretch bg-neutral-800 rounded-xl transition-all"
              style={{
                border: '1px solid rgba(139, 92, 246, 0.2)',
                boxShadow: 'none'
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.6)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.3)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.2)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <textarea
                ref={textareaRef}
                className="flex-1 px-4 py-3 bg-transparent text-gray-200 text-base outline-none resize-none placeholder-gray-500"
                style={{ border: 'none' }}
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value)
                  autoResizeTextarea(e.target)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type something nice..."
                disabled={loading}
                rows={1}
              />
              <button
                type="submit"
                className="px-6 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0 font-medium"
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
                  margin: '4px',
                  marginLeft: '0'
                }}
                onMouseEnter={(e) => {
                  if (!loading && inputMessage.trim()) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)'
                }}
                disabled={!inputMessage.trim() || loading}
                title={loading ? 'Processing...' : 'Send message'}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </div>
                ) : (
                  <span>Send ✨</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {showCardForm && (
        <div className="card-onboarding-overlay">
          <div className="card-onboarding-form" style={{ maxWidth: '450px', padding: '2rem' }}>
            <CardOnboarding
              userEmail={user.email || `${user.username}@example.com`}
              onComplete={async (result) => {
                console.log('✅ Card onboarding complete:', result)

                try {
                  // Save card to user profile in DynamoDB with VIC session IDs
                  await userProfileService.addPaymentCard(user.userId, {
                    vProvisionedTokenId: result.vProvisionedTokenId,
                    lastFour: result.lastFour,
                    type: result.type,
                    expirationDate: result.expirationDate,
                    cardholderName: result.cardholderName,
                    isPrimary: true,
                    // VIC session IDs needed for purchase flow
                    consumerId: result.consumerId,
                    clientDeviceId: result.clientDeviceId,
                    clientReferenceId: result.clientReferenceId
                  })
                  console.log('💳 Card saved to user profile with VIC session IDs')

                  // Show success toast
                  showToast.success(`Card successfully added: ${result.type} ending in ${result.lastFour}`)
                  setShowCardForm(false)

                  // Clear card check cache to force re-check of all messages
                  // This will cause existing messages with purchase keywords to re-check card status
                  // and update from ADD_CARD button to CONFIRM_PURCHASE button
                  console.log('🔄 Clearing card check cache to force button update')
                  setCardCheckResults({})

                } catch (error) {
                  console.error('❌ Error saving card to profile:', error)
                  // Show error toast
                  showToast.error(`Card added but failed to save to profile: ${result.type} ending in ${result.lastFour}`)
                  setShowCardForm(false)
                }
              }}
              onSkip={() => setShowCardForm(false)}
            />
          </div>
        </div>
      )}

      {showPurchaseConfirmation && (
        <PurchaseConfirmation
          userEmail={user.email || `${user.username}@example.com`}
          userId={user.userId}
          cartItems={purchaseCartItems}
          onComplete={handlePurchaseComplete}
          onError={handlePurchaseError}
          onCancel={handlePurchaseCancel}
        />
      )}

      {visaIframeConfig && (
        <div className="card-onboarding-overlay">
          <div className="card-onboarding-form" style={{ maxWidth: '800px' }}>
            <div className="card-form-header">
              <h3>🔒 Secure Visa Verification</h3>
              <button className="close-btn" onClick={() => setVisaIframeConfig(null)}>×</button>
            </div>
            <VisaIframe
              config={visaIframeConfig}
              onTokenReceived={(token) => {
                handleSendMessage(`Complete Visa onboarding with token: ${token}`)
                setVisaIframeConfig(null)
              }}
              onError={(error) => {
                console.error('Visa iframe error:', error)
                setVisaIframeConfig(null)
                setShowCardForm(true)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default Chat
