import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Space, message, Spin, List, Typography, Modal } from 'antd';
import { MessageItem, ChatInput, ChatHistorySidebar } from './components';
import { ModelSettings } from './ModelSettings';
import { useSocket, useAudio } from './hooks';

const { Title } = Typography;
const { Header, Content, Footer } = Layout;

const App = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [chatList, setChatList] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isChatSaved, setIsChatSaved] = useState(false);
  const chatContainerRef = useRef(null);
  const socket = useSocket();
  const audioControls = useAudio();
    
  const [modelConfig, setModelConfig] = useState({
    model_name: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
    generation_length: 512,
    temperature: 0.7,
    top_p: 0.95
  });

  useEffect(() => {
    if (!socket) return;

    socket.on('model_config_updated', (data) => {
      if (data.success) {
        setModelConfig(data.config);
        message.success('Model settings updated successfully');
      } else {
        message.error(data.error || 'Failed to update model settings');
      }
    });

    socket.on('chat_history', (data) => {
      console.log('Received chat history:', data.messages);
      setMessages(data.messages);
      setIsChatSaved(true);
    });

    socket.on('chat_update', (data) => {
      console.log('Received chat update:', data);
      setMessages(data.messages);
      setIsLoading(data.type !== 'stop' && data.type !== 'navigation');
      
      if (currentChatId && data.type === 'stop') {
        socket.emit('save_chat');
      }
    });

    socket.on('chat_saved', (data) => {
      console.log(`Chat saved successfully: ${data.filepath}`);
      setIsChatSaved(true);
      socket.emit('list_chats');
    });

    socket.on('new_chat_started', (data) => {
      setCurrentChatId(data.chat_id);
      setIsChatSaved(false);
      message.success(`New chat started`);
      socket.emit('list_chats');
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
  }, [socket, currentChatId]);

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
          
          // Add error handling
          socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            message.error('Connection error while trying to delete chat');
          });
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
    formData.append('audio', blob, 'audio.webm');

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
  };

  const handleLoadChat = (chatId) => {
    socket.emit('load_chat', { chat_id: chatId });
    setCurrentChatId(chatId);
    setIsChatSaved(true);
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
      <Layout style={{ minHeight: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
        <Header style={{ 
          background: '#fff', 
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '64px',
          position: 'fixed',
          width: '100%',
          top: 0,
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <Title level={3}>Local Chatbot</Title>
          <ModelSettings 
            socket={socket} 
            currentConfig={modelConfig}
          />
        </Header>
        <Layout style={{ marginTop: '64px', height: 'calc(100vh - 64px)' }}>
          <ChatHistorySidebar 
            chatList={chatList} 
            onChatSelect={handleLoadChat} 
            onNewChat={handleNewChat}
            currentChatId={currentChatId}
            onUpdateChatName={handleChatNameEdit}
            onDeleteChat={handleDeleteChat}
          />
          <Layout>
            <Content style={{ 
              padding: '12px',
              height: 'calc(100vh - 64px)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div ref={chatContainerRef} style={{
                flex: 1,
                overflowY: 'auto',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '12px'
              }}>
                {isLoading && <Spin style={{ display: 'block', textAlign: 'center', marginBottom: '8px' }} />}
                <List
                  itemLayout="horizontal"
                  dataSource={messages}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '4px' 
                  }}
                  renderItem={(item, index) => (
                    <List.Item style={{
                      justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start',
                      padding: '4px 0',
                      margin: 0
                    }}>
                      <div style={{ 
                        width: '95%', 
                        display: 'flex', 
                        justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start'
                      }}>
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
                      </div>
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

export default App;