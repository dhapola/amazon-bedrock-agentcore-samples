import { useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatInterface from './components/ChatInterface'
import { useAuth } from './hooks/useAuth'
import './App.css'

function App() {
  const { user, token, signOut } = useAuth()
  
  const [metrics, setMetrics] = useState({
    toolsInvoked: 127,
    tokensConsumed: 45823,
    totalCost: 2.34,
    latency: { min: 120, max: 3450, avg: 890 }
  })

  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', content: 'Hey there! 👋 How can I help you today?', timestamp: new Date() }
  ])

  const handleSendMessage = async (content) => {
    const startTime = Date.now()
    
    const userMessage = {
      id: messages.length + 1,
      role: 'user',
      content,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    
    // Create placeholder for streaming assistant message
    const assistantMessageId = messages.length + 2
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, assistantMessage])
    
    let accumulatedContent = ''
    let tokensUsed = 0
    
    try {
      const apiUrl = import.meta.env.VITE_AGENTCORE_API_URL || 
        'https://bedrock-agentcore.us-west-2.amazonaws.com/runtimes/arn%3Aaws%3Abedrock-agentcore%3Aus-west-2%3A074598462996%3Aruntime%2Fagentic_commerce-0zCJ7G3TUX/invocations'
      
      // Call AgentCore API with streaming and dynamic auth token
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: content,
          user_id: user?.profile?.email || 'user-' + Date.now()
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      // Read the streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })
        
        // Process complete SSE messages (lines ending with \n)
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer
        
        for (const line of lines) {
          // Parse SSE format: "data: content"
          if (line.startsWith('data: ')) {
            let content = line.slice(6) // Remove "data: " prefix
            
            // Skip empty data lines
            if (content.trim()) {
              try {
                // Try to parse as JSON string (handles escaped characters)
                content = JSON.parse(content)
              } catch (e) {
                // If not JSON, use as-is
              }
              
              // Accumulate content
              accumulatedContent += content
              
              // Update the assistant message in real-time
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              )
            }
          }
        }
        
        // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
        tokensUsed = Math.ceil((content.length + accumulatedContent.length) / 4)
      }
      
      const endTime = Date.now()
      const latency = endTime - startTime
      
      // Update metrics after streaming completes
      setMetrics(prev => ({
        toolsInvoked: prev.toolsInvoked + 1,
        tokensConsumed: prev.tokensConsumed + tokensUsed,
        totalCost: prev.totalCost + (tokensUsed * 0.00001), // Rough cost estimate
        latency: {
          min: Math.min(prev.latency.min, latency),
          max: Math.max(prev.latency.max, latency),
          avg: Math.floor((prev.latency.avg + latency) / 2)
        }
      }))
      
    } catch (error) {
      console.error('Error calling AgentCore:', error)
      
      // Update the assistant message with error
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: 'Sorry, I encountered an error processing your request. Please try again.' }
            : msg
        )
      )
    }
  }

  return (
    <div className="app">
      <Sidebar metrics={metrics} user={user} onSignOut={signOut} />
      <ChatInterface messages={messages} onSendMessage={handleSendMessage} />
    </div>
  )
}

export default App
