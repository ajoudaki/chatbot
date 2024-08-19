import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Input, List, Typography, Layout, Space, message, Tooltip, Spin } from 'antd';
import { 
  SendOutlined, 
  EditOutlined, 
  CopyOutlined, 
  AudioOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  LeftOutlined, 
  RightOutlined,
  SyncOutlined,
  PlusCircleOutlined,
  SaveOutlined
} from '@ant-design/icons';
import io from 'socket.io-client';

const { Title, Text } = Typography;
const { Header, Content, Footer, Sider } = Layout;

// Custom hook for managing socket connection
const useSocket = () => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => console.log('Socket connected'));

    return () => newSocket.close();
  }, []);

  return socket;
};

// Custom hook for managing audio recording and playback
const useAudio = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(new Audio());

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      const audioChunks = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      message.error('Failed to start recording');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const playRecording = useCallback(() => {
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [audioBlob]);

  const pauseRecording = useCallback(() => {
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  return { isRecording, audioBlob, isPlaying, startRecording, stopRecording, playRecording, pauseRecording, setAudioBlob };
};

// MessageItem component
// Updated MessageItem component
const MessageItem = ({ 
  item, 
  index, 
  isLastMessage,
  editingIndex, 
  setEditingIndex, 
  handleEdit, 
  handleCopy, 
  handleChangeActiveChild, 
  isLastSystemMessage, 
  handleContinue, 
  handleRegenerate, 
  isLoading 
}) => {
  const [editContent, setEditContent] = useState(item.content);
  const [currentSibling, totalSiblings] = item.sibling_info;
  const [isHovered, setIsHovered] = useState(false);

  const actionButtonStyle = {
    color: '#1890ff',
    padding: '4px',
    fontSize: '16px',
  };

  if (index === editingIndex && item.role === 'user') {
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input.TextArea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 6 }}
        />
        <Space>
          <Button onClick={() => setEditingIndex(-1)}>Cancel</Button>
          <Button onClick={() => handleEdit(index, editContent)} type="primary">Submit Edit</Button>
        </Space>
      </Space>
    );
  }

  return (
    <div 
      style={{
        width: '95%',
        padding: '10px 15px',
        borderRadius: '20px',
        backgroundColor: item.role === 'user' ? '#c0c0c0' : '#f0f0f0',
        color: item.role === 'user' ? 'white' : 'black',
        position: 'relative',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Text style={{ whiteSpace: 'pre-wrap' }}>{item.content}</Text>
      {(isLastMessage || isHovered) && (
        <Space 
          style={{
            position: 'absolute',
            bottom: '5px',
            right: '5px',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '10px',
            padding: '2px 5px',
          }}
        >
          {item.role === 'user' && (
            <Tooltip title="Edit">
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                onClick={() => setEditingIndex(index)}
                style={actionButtonStyle}
              />
            </Tooltip>
          )}
          <Tooltip title="Copy">
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => handleCopy(item.content)}
              style={actionButtonStyle}
            />
          </Tooltip>
          {totalSiblings > 1 && (
            <>
              <Tooltip title="Previous version">
                <Button 
                  type="text" 
                  icon={<LeftOutlined />} 
                  onClick={() => handleChangeActiveChild(index, 'prev')}
                  disabled={currentSibling === 1}
                  style={actionButtonStyle}
                />
              </Tooltip>
              <Text>{`${currentSibling} / ${totalSiblings}`}</Text>
              <Tooltip title="Next version">
                <Button 
                  type="text" 
                  icon={<RightOutlined />} 
                  onClick={() => handleChangeActiveChild(index, 'next')}
                  disabled={currentSibling === totalSiblings}
                  style={actionButtonStyle}
                />
              </Tooltip>
            </>
          )}
          {isLastSystemMessage && (
            <>
              <Tooltip title="Continue">
                <Button 
                  type="text" 
                  icon={<PlusCircleOutlined />} 
                  onClick={handleContinue}
                  loading={isLoading}
                  style={actionButtonStyle}
                />
              </Tooltip>
              <Tooltip title="Regenerate">
                <Button 
                  type="text" 
                  icon={<SyncOutlined />} 
                  onClick={handleRegenerate}
                  loading={isLoading}
                  style={actionButtonStyle}
                />
              </Tooltip>
            </>
          )}
        </Space>
      )}
    </div>
  );
};

                        

// ChatInput component
const ChatInput = ({ inputMessage, setInputMessage, handleSubmit, isLoading, audioControls }) => {
  const { isRecording, audioBlob, isPlaying, startRecording, stopRecording, playRecording, pauseRecording } = audioControls;

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        onPressEnter={handleSubmit}
        placeholder="Type your message..."
      />
      <Button
        type="primary"
        onClick={isRecording ? stopRecording : startRecording}
        icon={<AudioOutlined />}
        danger={isRecording}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </Button>
      {audioBlob && (
        <Button
          onClick={isPlaying ? pauseRecording : playRecording}
          icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
      )}
      <Button type="primary" onClick={handleSubmit} icon={<SendOutlined />} loading={isLoading}>
        Send
      </Button>
    </Space.Compact>
  );
};

// Updated ChatHistorySidebar component
const ChatHistorySidebar = ({ chatList, onChatSelect, onNewChat, currentChatId }) => {
  return (
    <Sider width={300} style={{ background: '#fff', padding: '20px' }}>
      <Button 
        type="primary" 
        icon={<PlusCircleOutlined />} 
        onClick={onNewChat}
        style={{ marginBottom: '20px', width: '100%' }}
      >
        New Chat
      </Button>
      <List
        dataSource={chatList}
        renderItem={(chat) => (
          <List.Item 
            onClick={() => onChatSelect(chat.id)}
            style={{ 
              cursor: 'pointer',
              backgroundColor: chat.id === currentChatId ? '#e6f7ff' : 'transparent',
              padding: '10px',
              borderRadius: '4px'
            }}
          >
            <Text ellipsis={true} style={{ width: '100%' }}>
              {chat.preview || 'New Chat'}
            </Text>
          </List.Item>
        )}
      />
    </Sider>
  );
};

// Main App component
const App = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [chatList, setChatList] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const chatContainerRef = useRef(null);
  const socket = useSocket();
  const audioControls = useAudio();

  // New state to track if the current chat has been saved
  const [isChatSaved, setIsChatSaved] = useState(false);

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
      
      // Auto-save after each update
      if (currentChatId && data.type === 'stop') {
        socket.emit('save_chat');
      }
    });

    socket.on('chat_saved', (data) => {
      console.log(`Chat saved successfully: ${data.filepath}`);
      setIsChatSaved(true);
      // Request updated chat list after saving
      socket.emit('list_chats');
    });

    socket.on('new_chat_started', (data) => {
      setCurrentChatId(data.chat_id);
      setIsChatSaved(false);
      message.success(`New chat started`);
      // Request updated chat list after starting a new chat
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

    // Request the list of chats when the component mounts
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

  // New effect to auto-save when the chat state changes
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
    setIsChatSaved(false);  // Mark the chat as unsaved after a new message
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
    setIsChatSaved(false);  // Mark the chat as unsaved after an edit
  };

  const handleChangeActiveChild = (index, direction) => {
    socket.emit('change_active_child', {
      level: messages.length - index - 1,
      direction: direction
    });
    setIsChatSaved(false);  // Mark the chat as unsaved after changing active child
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content)
      .then(() => message.success('Content copied to clipboard'))
      .catch(() => message.error('Failed to copy content'));
  };

  const handleNewChat = () => {
    socket.emit('new_chat');
    setIsChatSaved(false);  // Mark the new chat as unsaved
  };

  const handleLoadChat = (chatId) => {
    socket.emit('load_chat', { chat_id: chatId });
    setCurrentChatId(chatId);
    setIsChatSaved(true);  // Mark the loaded chat as saved
  };

  const handleContinue = useCallback(() => {
    socket.emit('continue');
    setIsLoading(true);
    setIsChatSaved(false);  // Mark the chat as unsaved when continuing
  }, [socket]);

  const handleRegenerate = useCallback(() => {
    socket.emit('regenerate');
    setIsLoading(true);
    setIsChatSaved(false);  // Mark the chat as unsaved when regenerating
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