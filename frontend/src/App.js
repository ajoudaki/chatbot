import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, List, Typography, Layout, Space, message as antdMessage } from 'antd';
import { 
  SendOutlined, 
  RedoOutlined, 
  EditOutlined, 
  CopyOutlined,
  AudioOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import io from 'socket.io-client';

const { Title, Text } = Typography;
const { Header, Content, Footer } = Layout;

const App = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editContent, setEditContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(new Audio());

  useEffect(() => {
    console.log('ChatbotClient: Initializing');
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected');
    });

    newSocket.on('chat_history', (data) => {
      console.log('Received chat history:', data.messages);
      setMessages(data.messages);
    });

    newSocket.on('chat_update', (data) => {
      console.log('Received chat update:', data);
      setMessages(data.messages);
      setIsLoading(data.type !== 'stop' && data.type !== 'navigation');
    });

    return () => {
      console.log('ChatbotClient: Cleaning up');
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inputMessage.trim() === '' && !audioBlob) return;

    setIsLoading(true);
    let messageContent = inputMessage;

    if (audioBlob) {
      try {
        const audioUrl = await uploadAudio(audioBlob);
        const transcription = await transcribeAudio(audioUrl);
        messageContent = transcription;
      } catch (error) {
        console.error('Error processing audio:', error);
        antdMessage.error('Failed to process audio. Please try again.');
        setIsLoading(false);
        return;
      }
    }

    socket.emit('chat', { message: messageContent });
    setInputMessage('');
    setAudioBlob(null);
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


  const handleEditSubmit = () => {
    if (editContent.trim() === '') return;
    
    socket.emit('edit', { 
      level: messages.length - editingIndex - 1, 
      message: editContent 
    });
    
    setEditingIndex(-1);
    setInputMessage(editContent);  // Set input message to edit content
    setIsLoading(true);
  };

  const handleChangeActiveChild = (index, direction) => {
    socket.emit('change_active_child', {
      level: messages.length - index - 1,
      direction: direction
    });
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content)
      .then(() => antdMessage.success('Content copied to clipboard'))
      .catch(() => antdMessage.error('Failed to copy content'));
  };

  const startRecording = async () => {
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
      antdMessage.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseRecording = () => {
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const handleReset = () => {
    socket.emit('reset_chat');
    setMessages([]);
    antdMessage.success('Chat history reset');
  };

    const renderMessage = (item, index) => {
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
              <Button onClick={handleEditSubmit} type="primary">Submit Edit</Button>
            </Space>
          </Space>
        );
      }
    
      const [currentSibling, totalSiblings] = item.sibling_info;
    
      return (
        <div style={{
          width: '95%',
          padding: '10px 15px',
          borderRadius: '20px',
          backgroundColor: item.role === 'user' ? '#1890ff' : '#f0f0f0',
          color: item.role === 'user' ? 'white' : 'black',
          position: 'relative',
        }}>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{item.content}</Text>
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
              <Button 
                type="link" 
                icon={<EditOutlined />} 
                onClick={() => {
                  setEditingIndex(index);
                  setEditContent(item.content);
                }} 
              />
            )}
            <Button type="link" icon={<CopyOutlined />} onClick={() => handleCopy(item.content)} />
            <Text>{`${currentSibling} / ${totalSiblings}`}</Text>
            <Button 
              type="link" 
              icon={<LeftOutlined />} 
              onClick={() => handleChangeActiveChild(index, 'prev')}
              disabled={currentSibling === 1}
            />
            <Button 
              type="link" 
              icon={<RightOutlined />} 
              onClick={() => handleChangeActiveChild(index, 'next')}
              disabled={currentSibling === totalSiblings}
            />
          </Space>
        </div>
      );
    };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 20px' }}>
        <Title level={3}>Chatbot</Title>
      </Header>
      <Content style={{ padding: '20px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button onClick={handleReset}>Start New Chat</Button>
          <div ref={chatContainerRef} style={{
            height: 'calc(100vh - 250px)',
            overflowY: 'auto',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            padding: '20px',
          }}>
            <List
              itemLayout="horizontal"
              dataSource={messages}
              renderItem={(item, index) => (
                <List.Item style={{
                  justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start',
                  padding: '10px 0',
                }}>
                  <div style={{ width: '95%', display: 'flex', justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {renderMessage(item, index)}
                  </div>
                </List.Item>
              )}
            />
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              ref={inputRef}
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
            <Button onClick={() => socket.emit('continue')} icon={<RedoOutlined />} loading={isLoading}>
              Continue
            </Button>
            <Button onClick={() => socket.emit('regenerate')} icon={<RedoOutlined />} loading={isLoading}>
              Regenerate
            </Button>
          </Space.Compact>
        </Space>
      </Content>
      <Footer style={{ textAlign: 'center' }}>Chatbot ©2024 Created by Amir Joudaki</Footer>
    </Layout>
  );
};

export default App;