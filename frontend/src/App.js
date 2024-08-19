import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Space, message, Spin, List, Typography } from 'antd';
import { MessageItem, ChatInput, ChatHistorySidebar } from './components';
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

  useEffect(() => {
    if (!socket) return;

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
        preview: chat.name, 
      }));
      setChatList(updatedChatList);
    });

    socket.on('error', (data) => {
      message.error(data.message);
    });

    socket.emit('list_chats');

    return () => {
      socket.off('chat_history');
      socket.off('chat_update');
      socket.off('chat_saved');
      socket.off('new_chat_started');
      socket.off('chat_list');
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

  const handleRegenerate = useCallback(() => {
    socket.emit('regenerate');
    setIsLoading(true);
    setIsChatSaved(false);
  }, [socket]);

  const getLastSystemMessageIndex = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return i;
      }
    }
    return -1;
  }, [messages]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 20px' }}>
        <Title level={3}>Chatbot</Title>
      </Header>
      <Layout>
        <ChatHistorySidebar 
          chatList={chatList} 
          onChatSelect={handleLoadChat} 
          onNewChat={handleNewChat}
          currentChatId={currentChatId}
        />
        <Content style={{ padding: '20px' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div ref={chatContainerRef} style={{
              height: 'calc(100vh - 200px)',
              overflowY: 'auto',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              padding: '20px',
            }}>
              {isLoading && <Spin style={{ display: 'block', textAlign: 'center' }} />}
              <List
                itemLayout="horizontal"
                dataSource={messages}
                renderItem={(item, index) => (
                  <List.Item style={{
                    justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start',
                    padding: '10px 0',
                  }}>
                    <div style={{ width: '95%', display: 'flex', justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
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
          </Space>
        </Content>
      </Layout>
      <Footer style={{ textAlign: 'center' }}>Chatbot ©2024 Created by Amir Joudaki</Footer>
    </Layout>
  );
};

export default App;