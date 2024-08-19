import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, List, Typography, Layout, Space, message as antdMessage } from 'antd';
import { CopyOutlined, SendOutlined, RedoOutlined, EditOutlined, AudioOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';


const { Title, Text } = Typography;
const { Header, Content, Footer } = Layout;

const ChatbotClient = () => {
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
  const audioRef = useRef(null);

  useEffect(() => {
    const newSocket = io('/');
    setSocket(newSocket);

    newSocket.on('chat_history', (data) => {
      setMessages(data.messages);
    });

    newSocket.on('chat_update', (data) => {
      setMessages(data.messages);
      setIsLoading(false);
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

    const uploadAudio = async (audioBlob) => {
      console.log("Audio blob size:", audioBlob.size);
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
    
      try {
        const response = await fetch('/api/upload_audio', {
          method: 'POST',
          body: formData,
        });
    
        if (!response.ok) {
          throw new Error('Failed to upload audio');
        }
    
        const data = await response.json();
        return data.filename;
      } catch (error) {
        antdMessage.error('Failed to upload audio: ' + error.message);
        throw error;
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (inputMessage.trim() === '' && !audioBlob) return;
      
      setIsLoading(true);
      let messageContent = inputMessage;
    
      if (audioBlob) {
        try {
          // Generate a unique filename
          const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
          const randomId = uuidv4().split('-')[0]; // Using first part of UUID for brevity
          const filename = `audio_${timestamp}_${randomId}.webm`;
    
          const formData = new FormData();
          formData.append('audio', audioBlob, filename);
          
          const response = await fetch('/api/upload_audio', {
            method: 'POST',
            body: formData,
          });
    
          if (!response.ok) {
            throw new Error('Failed to upload audio');
          }
    
          const data = await response.json();
          const uploadedFilename = data.filename;
          messageContent = '';
    
          // Optionally, you can add transcription here if your backend supports it
          const transcriptionResponse = await fetch('/api/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filename: uploadedFilename }),
          });
          if (transcriptionResponse.ok) {
            const transcriptionData = await transcriptionResponse.json();
            messageContent = transcriptionData.text;
          }
    
        } catch (error) {
          console.error('Error uploading audio:', error);
          antdMessage.error('Failed to upload audio. Please try again.');
          setIsLoading(false);
          return;
        }
      }
    
      const newMessages = [...messages, { role: 'user', content: messageContent }];
      setMessages(newMessages);
      socket.emit('chat_message', { messages: newMessages });
      setInputMessage('');
      setAudioBlob(null);
      setIsLoading(false);
    };
  const handleContinue = () => {
    setIsLoading(true);
    socket.emit('continue_chat', { messages: messages });
  };

  const handleReset = () => {
    socket.emit('reset_chat');
    setMessages([]);
    antdMessage.success('Chat history reset');
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content)
      .then(() => antdMessage.success('Content copied to clipboard'))
      .catch(() => antdMessage.error('Failed to copy content'));
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditContent(messages[index].content);
  };

  const handleEditSubmit = () => {
    if (editContent.trim() === '') return;

    const updatedMessages = [...messages];
    updatedMessages[editingIndex].content = editContent;

    setMessages(updatedMessages);
    setEditingIndex(-1);
    setEditContent('');

    socket.emit('chat_message', { messages: updatedMessages.slice(0, editingIndex + 1) });
  };

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        sampleRate: 48000,  // Opus works well with this sample rate
        channelCount: 1,    // Mono for simplicity
        echoCancellation: false,
        noiseSuppression: false
      } 
    });
    
    const options = { mimeType: 'audio/webm;codecs=opus' };
    mediaRecorderRef.current = new MediaRecorder(stream, options);
    
    const audioChunks = [];

    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log("Audio blob size:", audioBlob.size);
      setAudioBlob(audioBlob);
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  } catch (error) {
    console.error('Failed to start recording:', error);
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
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Space>
              <Button onClick={() => setEditingIndex(-1)}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} type="primary">
                Submit Edit
              </Button>
            </Space>
          </div>
        </Space>
      );
    }

    return (
      <>
        <div
          style={{
            width: '95%',
            padding: '10px 15px',
            borderRadius: '20px',
            backgroundColor: item.role === 'user' ? '#1890ff' : '#f0f0f0',
            color: item.role === 'user' ? 'white' : 'black',
          }}
        >
          <Text style={{ color: item.role === 'user' ? 'white' : 'black', whiteSpace: 'pre-wrap' }}>
            {item.content}
          </Text>
        </div>
        <Space style={{ marginLeft: '10px' }}>
          {item.role === 'user' && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(index)}
            />
          )}
          <Button
            type="link"
            icon={<CopyOutlined />}
            onClick={() => handleCopy(item.content)}
          />
        </Space>
      </>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 20px' }}>
        <Title level={3}>Chatbot</Title>
      </Header>
      <Content style={{ padding: '20px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button onClick={handleReset}>Start New chat</Button>
          <div
            ref={chatContainerRef}
            style={{
              height: 'calc(100vh - 250px)',
              overflowY: 'auto',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              padding: '20px',
            }}
          >
            <List
              itemLayout="horizontal"
              dataSource={messages}
              renderItem={(item, index) => (
                <List.Item
                  style={{
                    justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start',
                    padding: '10px 0',
                  }}
                >
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
            <Button onClick={handleContinue} icon={<RedoOutlined />} loading={isLoading}>
              Continue
            </Button>
          </Space.Compact>
        </Space>
      </Content>
      <Footer style={{ textAlign: 'center' }}>Chatbot ©2024 Created by Your Name</Footer>
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
    </Layout>
  );
};

export default ChatbotClient;