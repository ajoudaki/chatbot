import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Space, message, Spin, List, Typography, Modal } from 'antd';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { MessageItem, ChatInput } from './components';
import { ModelSettings } from './ModelSettings';
import ChatNavigation from './ChatHistorySidebar';
import { useSocket, useAudio } from './hooks';
import { useTheme, styleUtils } from './styles/useTheme';
import './styles/global.css';

const { Title } = Typography;
const { Header, Content } = Layout;

// Wrapper component to handle routing
const AppWrapper = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/chat/:chatId" element={<App />} />
      </Routes>
    </Router>
  );
};

const App = () => {
  useTheme('light');
  
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelConfigLoading, setModelConfigLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [chatList, setChatList] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isChatSaved, setIsChatSaved] = useState(false);
  const chatContainerRef = useRef(null);
  const socket = useSocket();
  const audioControls = useAudio();
  const navigate = useNavigate();
  const { chatId } = useParams();

  const [modelConfig, setModelConfig] = useState({
    model_name: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
    generation_length: 512,
    temperature: 0.7,
    top_p: 0.95
  });

  useEffect(() => {
    if (socket && chatId && chatId !== currentChatId) {
      handleLoadChat(chatId);
    }
  }, [socket, chatId]);

  useEffect(() => {
    if (!socket) return;

    socket.on('model_config_updated', (data) => {
      setModelConfigLoading(false);
      if (data.success) {
        setModelConfig(data.config);
        message.success('Model settings updated successfully');
      } else {
        message.error(data.error || 'Failed to update model settings');
      }
    });

    socket.on('chat_history', (data) => {
      setMessages(data.messages);
      setIsChatSaved(true);
    });

    socket.on('chat_update', (data) => {
      setMessages(data.messages);
      setIsLoading(data.type !== 'stop' && data.type !== 'navigation');
      
      if (currentChatId && data.type === 'stop') {
        socket.emit('save_chat');
      }
    });

    socket.on('chat_saved', (data) => {
      setIsChatSaved(true);
      socket.emit('list_chats');
    });

    socket.on('new_chat_started', (data) => {
      setCurrentChatId(data.chat_id);
      setIsChatSaved(false);
      message.success('New chat started');
      socket.emit('list_chats');
      navigate(`/chat/${data.chat_id}`);
    });

    socket.on('chat_list', (data) => {
      const updatedChatList = data.chats.map(chat => ({
        id: chat.id,
        name: chat.name,
        last_modified: chat.last_modified,
        preview: chat.name,
      }));
      setChatList(updatedChatList);
    });

    socket.on('chat_deleted', (data) => {
      if (data.success) {
        if (currentChatId === data.chat_id) {
          setCurrentChatId(null);
          setMessages([]);
          navigate('/');
        }
        message.success('Chat deleted successfully');
        socket.emit('list_chats');
      } else {
        message.error(data.error || 'Failed to delete chat');
      }
    });

    socket.on('error', (data) => {
      message.error(data.message);
    });

    socket.emit('list_chats');

    return () => {
      socket.off('model_config_updated');
      socket.off('chat_history');
      socket.off('chat_update');
      socket.off('chat_saved');
      socket.off('new_chat_started');
      socket.off('chat_list');
      socket.off('chat_deleted');
      socket.off('error');
    };
  }, [socket, currentChatId, navigate]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (currentChatId && messages.length > 0 && !isChatSaved) {
      socket.emit('save_chat');
    }
  }, [messages, currentChatId, isChatSaved, socket]);

  const handleUpdateModelSettings = (values) => {
    setModelConfigLoading(true);
    socket.emit('update_model_config', values);
  };

  const handleDeleteChat = (chatId) => {
    Modal.confirm({
      title: 'Delete Chat',
      content: 'Are you sure you want to delete this chat? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        console.log('Attempting to delete chat:', chatId);
        socket.emit('delete_chat', { chat_id: chatId });
      },
    });
  };

  const handleChatNameEdit = (newName) => {
    if (!currentChatId) return;
    socket.emit('edit_chat_name', { name: newName });
    setIsChatSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inputMessage.trim() === '' && !audioControls.audioBlob) return;

    setIsLoading(true);
    let messageContent = inputMessage;

    if (audioControls.audioBlob) {
      try {
        const audioUrl = await uploadAudio(audioControls.audioBlob);
        messageContent = await transcribeAudio(audioUrl);
      } catch (error) {
        console.error('Error processing audio:', error);
        message.error('Failed to process audio. Please try again.');
        setIsLoading(false);
        return;
      }
    }

    socket.emit('chat', { message: messageContent });
    setInputMessage('');
    audioControls.setAudioBlob(null);
    setIsChatSaved(false);
  };

  const uploadAudio = async (blob) => {
    const formData = new FormData();
    const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
    formData.append('audio', file);
  
    const response = await fetch('/api/upload_audio', {
      method: 'POST',
      body: formData,
    });
  
    if (!response.ok) {
      throw new Error('Failed to upload audio');
    }
  
    const data = await response.json();
    return data.filename;
  };

  const transcribeAudio = async (filename) => {
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename }),
    });

    if (!response.ok) {
      throw new Error('Failed to transcribe audio');
    }

    const data = await response.json();
    return data.text;
  };

  const handleEdit = (index, editContent) => {
    socket.emit('edit', { 
      level: messages.length - index - 1, 
      message: editContent 
    });
    
    setEditingIndex(-1);
    setInputMessage(editContent);
    setIsLoading(true);
    setIsChatSaved(false);
  };

  const handleChangeActiveChild = (index, direction) => {
    socket.emit('change_active_child', {
      level: messages.length - index - 1,
      direction: direction
    });
    setIsChatSaved(false);
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content)
      .then(() => message.success('Content copied to clipboard'))
      .catch(() => message.error('Failed to copy content'));
  };

  const handleNewChat = () => {
    socket.emit('new_chat');
    setIsChatSaved(false);
    navigate('/');
  };

  const handleLoadChat = (chatId) => {
    socket.emit('load_chat', { chat_id: chatId });
    setCurrentChatId(chatId);
    setIsChatSaved(true);
    navigate(`/chat/${chatId}`);
  };

  const handleContinue = useCallback(() => {
    socket.emit('continue');
    setIsLoading(true);
    setIsChatSaved(false);
  }, [socket]);

  const handleRegenerate = useCallback((index) => {
    socket.emit('regenerate', {
      level: messages.length - index - 1
    });
    setIsLoading(true);
    setIsChatSaved(false);
  }, [socket, messages]);

  const getLastSystemMessageIndex = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return i;
      }
    }
    return -1;
  }, [messages]);

  return (
    <Layout className={styleUtils.classNames('app-layout')}>
      <Header className="app-header">
        <Title level={3}>Local Chatbot</Title>
        <ModelSettings 
          currentConfig={modelConfig}
          onUpdateSettings={handleUpdateModelSettings}
          isConfigLoading={modelConfigLoading}
        />
      </Header>
      <Layout className={styleUtils.classNames('main-layout')}>
        <ChatNavigation 
          chats={chatList}
          currentChatId={currentChatId}
          onChatSelect={handleLoadChat}
          onNewChat={handleNewChat}
          onUpdateChatName={handleChatNameEdit}
          onDeleteChat={handleDeleteChat}
        />
        <Layout>
          <Content className="main-content">
            <div ref={chatContainerRef} className={styleUtils.classNames('chat-container', 'scrollable')}>
              {isLoading && <Spin className="loading-spinner" />}
              <List
                itemLayout="horizontal"
                dataSource={messages}
                className="message-list"
                renderItem={(item, index) => (
                  <List.Item style={{ border: "none", padding: "5px" }}>
                    <MessageItem
                      item={item}
                      index={index}
                      editingIndex={editingIndex}
                      setEditingIndex={setEditingIndex}
                      handleEdit={handleEdit}
                      handleCopy={handleCopy}
                      handleChangeActiveChild={handleChangeActiveChild}
                      isLastSystemMessage={index === getLastSystemMessageIndex()}
                      handleContinue={handleContinue}
                      handleRegenerate={handleRegenerate}
                      isLoading={isLoading}
                    />
                  </List.Item>
                )}
              />
            </div>
            <ChatInput
              inputMessage={inputMessage}
              setInputMessage={setInputMessage}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              audioControls={audioControls}
            />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default AppWrapper;