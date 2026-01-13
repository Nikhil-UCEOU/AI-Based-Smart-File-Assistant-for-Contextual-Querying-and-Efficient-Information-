import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { chatService, Chat, ChatMessage, DocumentSource } from '../services/chatService';
import { documentService } from '../services/documentService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import { PrimaryButton } from '../components/ui/Button';
import FileUploadButton from '../components/ui/FileUploadButton';
import UploadProgress, { UploadFile } from '../components/ui/UploadProgress';

const ChatContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  display: flex;
  overflow: hidden;
`;

const Sidebar = styled.div<{ $isOpen: boolean }>`
  width: 280px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.2);
  padding: 20px;
  overflow-y: auto;
  flex-shrink: 0;
  
  /* Custom scrollbar for sidebar */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  }
  
  @media (max-width: 768px) {
    display: ${props => props.$isOpen ? 'block' : 'none'};
    position: absolute;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 1000;
    width: 100%;
    max-width: 320px;
  }
`;

const MainChat = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
`;

const ChatHeader = styled.div`
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ChatTitle = styled.h1`
  color: white;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  flex: 1;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  scroll-behavior: smooth;
  
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  }
`;

const MessageBubble = styled.div<{ $isUser: boolean }>`
  max-width: 80%;
  padding: 16px 20px;
  border-radius: 20px;
  word-wrap: break-word;
  
  ${props => props.$isUser ? `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    align-self: flex-end;
    margin-left: auto;
  ` : `
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    align-self: flex-start;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  `}
`;

const MessageContent = styled.div`
  line-height: 1.6;
  white-space: pre-wrap;
`;

const SourcesContainer = styled.div`
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
`;

const SourceItem = styled.div`
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 8px;
  padding: 8px 12px;
  margin: 4px 0;
  font-size: 0.85rem;
`;

const InputContainer = styled.div`
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
`;

const InputWrapper = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
  max-width: 1000px;
  margin: 0 auto;
`;

const InputActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-end;
`;

const MessageInput = styled.textarea`
  flex: 1;
  min-height: 50px;
  max-height: 150px;
  padding: 15px 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 25px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  font-size: 16px;
  resize: none;
  outline: none;
  transition: all 0.3s ease;
  
  &:focus {
    border-color: #667eea;
    box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
  }
  
  &::placeholder {
    color: #666;
  }
`;

const SendButton = styled(PrimaryButton)`
  min-width: 60px;
  height: 50px;
  border-radius: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ChatListItem = styled.div<{ $isActive: boolean }>`
  padding: 12px 16px;
  margin: 8px 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
    
    .delete-button {
      opacity: 1;
    }
  }
  
  ${props => props.$isActive && `
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
    
    .delete-button {
      opacity: 1;
    }
  `}
`;

const ChatItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const DeleteButton = styled.button`
  background: rgba(255, 59, 48, 0.8);
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.3s ease;
  margin-left: 8px;
  flex-shrink: 0;
  
  &:hover {
    background: rgba(255, 59, 48, 1);
    transform: scale(1.1);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const ChatItemTitle = styled.div`
  color: white;
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ChatItemDate = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
`;

const NewChatButton = styled(PrimaryButton)`
  width: 100%;
  margin-bottom: 20px;
`;

const MobileOverlay = styled.div<{ $isOpen: boolean }>`
  display: none;
  
  @media (max-width: 768px) {
    display: ${props => props.$isOpen ? 'block' : 'none'};
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }
`;

const EmptyStateContainer = styled.div`
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.1rem;
  margin-top: 50px;
  padding: 40px 20px;
  
  h2 {
    font-size: 2rem;
    margin-bottom: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  p {
    margin-bottom: 16px;
    line-height: 1.6;
  }
  
  .tips {
    font-size: 0.9rem;
    margin-top: 20px;
    opacity: 0.8;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 0.9rem;
  outline: none;
  transition: all 0.3s ease;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }
  
  &:focus {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
  }
`;

const QuickSearchButton = styled(PrimaryButton)`
  width: 100%;
  margin-bottom: 12px;
  font-size: 0.9rem;
  padding: 10px 16px;
`;

const DocumentCount = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  text-align: center;
  margin-bottom: 16px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
`;

const EmptyChatList = styled.div`
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  margin-top: 40px;
  padding: 20px;
  
  p {
    margin-bottom: 12px;
    line-height: 1.5;
  }
  
  .icon {
    font-size: 2rem;
    margin-bottom: 16px;
    opacity: 0.5;
  }
`;

const DashboardButton = styled(PrimaryButton)`
  margin-left: auto;
`;

const LoadingMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-style: italic;
`;

const LoadingDots = styled.div`
  display: flex;
  gap: 4px;
  
  span {
    width: 6px;
    height: 6px;
    background: #667eea;
    border-radius: 50%;
    animation: bounce 1.4s ease-in-out infinite both;
    
    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
    &:nth-child(3) { animation-delay: 0s; }
  }
  
  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }
`;

const MobileMenuButton = styled.button`
  display: none;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  @media (max-width: 768px) {
    display: block;
  }
`;

const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [documentCount, setDocumentCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadChats();
    loadDocumentCount();
  }, [user, navigate]);

  useEffect(() => {
    if (chatId) {
      loadChatMessages(parseInt(chatId));
    }
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    try {
      const userChats = await chatService.getUserChats();
      setChats(userChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
      showError('Failed to load chats');
    }
  };

  const loadDocumentCount = async () => {
    try {
      const documents = await documentService.getUserDocuments();
      setDocumentCount(documents.documents.length);
    } catch (error) {
      console.error('Failed to load document count:', error);
    }
  };

  const handleQuickSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/documents/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/documents/search');
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuickSearch();
    }
  };

  const loadChatMessages = async (id: number) => {
    try {
      const { chat, messages: chatMessages } = await chatService.getChatMessages(id);
      setCurrentChat(chat);
      setMessages(chatMessages);
    } catch (error) {
      console.error('Failed to load chat messages:', error);
      showError('Failed to load chat messages');
    }
  };

  const createNewChat = async () => {
    try {
      const newChat = await chatService.createChat();
      setChats(prev => [newChat, ...prev]);
      navigate(`/chat/${newChat.id}`);
    } catch (error) {
      console.error('Failed to create chat:', error);
      showError('Failed to create new chat');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    let activeChatId = currentChat?.id;
    
    // Create new chat if none exists
    if (!activeChatId) {
      try {
        const newChat = await chatService.createChat();
        setChats(prev => [newChat, ...prev]);
        setCurrentChat(newChat);
        activeChatId = newChat.id;
        navigate(`/chat/${newChat.id}`);
      } catch (error) {
        showError('Failed to create chat');
        return;
      }
    }

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await chatService.sendMessage(activeChatId, messageText);
      
      // Add both user and assistant messages
      setMessages(prev => [...prev, response.userMessage, response.assistantMessage]);
      
      // Update chat list if title changed
      if (messages.length === 0) {
        loadChats();
      }
      
    } catch (error: any) {
      console.error('Failed to send message:', error);
      showError(error.message || 'Failed to send message');
      setInputMessage(messageText); // Restore message on error
    } finally {
      setIsLoading(false);
    }
  };

  const deleteChat = async (chatId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent chat selection when clicking delete
    
    const chatToDelete = chats.find(chat => chat.id === chatId);
    const confirmMessage = `Are you sure you want to delete "${chatToDelete?.title || 'this chat'}"?\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await chatService.deleteChat(chatId);
      
      // Remove chat from local state
      setChats(prev => prev.filter(chat => chat.id !== chatId));
      
      // If we're currently viewing the deleted chat, navigate to main chat page
      if (currentChat?.id === chatId) {
        setCurrentChat(null);
        setMessages([]);
        navigate('/chat');
      }
      
      showSuccess('Chat deleted successfully');
    } catch (error) {
      console.error('Failed to delete chat:', error);
      showError('Failed to delete chat');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!user) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    // Initialize upload files state
    const initialFiles: UploadFile[] = Array.from(files).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading'
    }));
    
    setUploadFiles(initialFiles);

    // Add upload progress message to chat
    const uploadMessage: ChatMessage = {
      id: Date.now(),
      role: 'system' as any,
      content: `📤 Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`,
      timestamp: new Date().toISOString(),
      sources: []
    };
    setMessages(prev => [...prev, uploadMessage]);

    const uploadPromises = Array.from(files).map(async (file, index) => {
      try {
        // Update file status to uploading
        setUploadFiles(prev => prev.map((f, i) => 
          i === index ? { ...f, status: 'uploading' } : f
        ));

        const result = await documentService.uploadDocument(file);
        
        // Update file status to processing
        setUploadFiles(prev => prev.map((f, i) => 
          i === index ? { ...f, status: 'processing' } : f
        ));

        // Simulate processing time (the actual processing happens on the server)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update file status to complete
        setUploadFiles(prev => prev.map((f, i) => 
          i === index ? { ...f, status: 'complete' } : f
        ));

        // Update overall progress
        setUploadProgress(((index + 1) / files.length) * 100);

        return { success: true, result, fileName: file.name };
      } catch (error: any) {
        // Update file status to error
        setUploadFiles(prev => prev.map((f, i) => 
          i === index ? { ...f, status: 'error', error: error.message } : f
        ));
        
        return { success: false, error, fileName: file.name };
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      
      // Remove the upload progress message and add completion message
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== uploadMessage.id);
        const completionMessage: ChatMessage = {
          id: Date.now() + 1,
          role: 'system' as any,
          content: successCount > 0 
            ? `✅ Successfully uploaded ${successCount} document${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''}. You can now ask questions about your documents!`
            : `❌ Failed to upload documents. Please try again.`,
          timestamp: new Date().toISOString(),
          sources: []
        };
        return [...filtered, completionMessage];
      });
      
      if (successCount > 0) {
        showSuccess(
          `Successfully uploaded ${successCount} document${successCount > 1 ? 's' : ''}${
            failCount > 0 ? ` (${failCount} failed)` : ''
          }`
        );
        // Refresh document count
        loadDocumentCount();
      } else {
        showError('Failed to upload documents');
      }

      // Clear upload progress after a delay
      setTimeout(() => {
        setUploadFiles([]);
        setUploadProgress(0);
      }, 3000);

    } catch (error) {
      console.error('Upload error:', error);
      showError('Failed to upload documents');
      
      // Remove upload progress message and add error message
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== uploadMessage.id);
        const errorMessage: ChatMessage = {
          id: Date.now() + 1,
          role: 'system' as any,
          content: `❌ Upload failed. Please try again.`,
          timestamp: new Date().toISOString(),
          sources: []
        };
        return [...filtered, errorMessage];
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const renderSources = (sources: DocumentSource[] | string) => {
    let sourcesArray: DocumentSource[] = [];
    
    if (typeof sources === 'string') {
      try {
        sourcesArray = JSON.parse(sources);
      } catch (error) {
        console.error('Failed to parse sources:', error);
        return null;
      }
    } else {
      sourcesArray = sources || [];
    }
    
    if (!sourcesArray || sourcesArray.length === 0) return null;
    
    return (
      <SourcesContainer>
        <div style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '8px', color: '#666' }}>
          Sources ({sourcesArray.length}):
        </div>
        {sourcesArray.map((source, index) => (
          <SourceItem key={index}>
            <strong>{source.fileName}</strong> - {source.relevanceScore}% match
            <div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#666' }}>
              {source.preview}
            </div>
          </SourceItem>
        ))}
      </SourcesContainer>
    );
  };

  return (
    <ChatContainer>
      <AnimatedBackground />
      
      <MobileOverlay 
        $isOpen={isSidebarOpen} 
        onClick={() => setIsSidebarOpen(false)} 
      />
      
      <Sidebar $isOpen={isSidebarOpen}>
        <NewChatButton onClick={createNewChat} variant="primary">
          + New Chat
        </NewChatButton>
        
        {/* Document Search Section */}
        <SearchInput
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleSearchKeyPress}
        />
        
        <QuickSearchButton 
          onClick={handleQuickSearch}
          variant="secondary"
        >
          🔍 Search Documents
        </QuickSearchButton>
        
        {documentCount > 0 && (
          <DocumentCount>
            📄 {documentCount} document{documentCount !== 1 ? 's' : ''} uploaded
          </DocumentCount>
        )}
        
        {chats.length === 0 ? (
          <EmptyChatList>
            <div className="icon">💬</div>
            <p>No chats yet</p>
            <p>Create your first chat to get started!</p>
          </EmptyChatList>
        ) : (
          chats.map(chat => (
            <ChatListItem
              key={chat.id}
              $isActive={currentChat?.id === chat.id}
              onClick={() => {
                navigate(`/chat/${chat.id}`);
                setIsSidebarOpen(false);
              }}
            >
              <ChatItemContent>
                <ChatItemTitle>{chat.title}</ChatItemTitle>
                <ChatItemDate>{formatDate(chat.updatedAt)}</ChatItemDate>
              </ChatItemContent>
              <DeleteButton
                className="delete-button"
                onClick={(e) => deleteChat(chat.id, e)}
                title="Delete chat"
              >
                ×
              </DeleteButton>
            </ChatListItem>
          ))
        )}
      </Sidebar>

      <MainChat>
        <ChatHeader>
          <MobileMenuButton onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            ☰
          </MobileMenuButton>
          <ChatTitle>
            {currentChat?.title || 'AI Document Assistant'}
          </ChatTitle>
          <DashboardButton 
            onClick={() => navigate('/dashboard')} 
            variant="secondary"
          >
            Dashboard
          </DashboardButton>
        </ChatHeader>

        <MessagesContainer>
          {messages.length === 0 && !isLoading && (
            <EmptyStateContainer>
              <h2>Welcome to AI Document Assistant 🤖</h2>
              <p>Your intelligent companion for document analysis and information extraction.</p>
              <p className="tips">
                💡 Upload documents (PDF, DOCX, HTML, TXT) and ask: "What are the key points in this document?" or "Find information about specific topics"
              </p>
              <p className="tips" style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                <strong>Note:</strong> This is for document analysis and information extraction. Always verify important information from original sources.
              </p>
            </EmptyStateContainer>
          )}
          
          {messages.map(message => (
            <MessageBubble key={message.id} $isUser={message.role === 'user'}>
              <MessageContent>{message.content}</MessageContent>
              {message.role === 'assistant' && renderSources(message.sources)}
            </MessageBubble>
          ))}
          
          {/* Upload Progress Indicator */}
          {uploadFiles.length > 0 && (
            <UploadProgress
              files={uploadFiles}
              overallProgress={uploadProgress}
            />
          )}
          
          {isLoading && (
            <MessageBubble $isUser={false}>
              <LoadingMessage>
                AI is thinking
                <LoadingDots>
                  <span></span>
                  <span></span>
                  <span></span>
                </LoadingDots>
              </LoadingMessage>
            </MessageBubble>
          )}
          
          <div ref={messagesEndRef} />
        </MessagesContainer>

        <InputContainer>
          <InputWrapper>
            <MessageInput
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask questions about your documents..."
              disabled={isLoading}
            />
            <InputActions>
              <FileUploadButton
                onFileSelect={handleFileUpload}
                disabled={isUploading || isLoading}
              >
                {isUploading ? '⏳' : '📎'}
              </FileUploadButton>
              <SendButton
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                variant="primary"
              >
                {isLoading ? '...' : '→'}
              </SendButton>
            </InputActions>
          </InputWrapper>
        </InputContainer>
      </MainChat>
    </ChatContainer>
  );
};

export default ChatPage;