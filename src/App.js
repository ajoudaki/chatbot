import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, List, Typography, Layout, Space, message as antdMessage } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Header, Content, Footer } = Layout;

const ChatApp = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  const handleSend = async () => {
    if (isLoading) return;
    if (!inputValue.trim()) return;

    const newMessage = { role: 'user', content: inputValue };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: inputValue }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      let botResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        const data = chunk;
        botResponse += data;
        setMessages((prevMessages) => {
          const newMessages = [...prevMessages];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant') {
            lastMessage.content = botResponse;
          } else {
            newMessages.push({ role: 'assistant', content: botResponse });
          }
          return newMessages;
        });
        if (chunk.length == 0) break;
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: 'system', content: `An error occurred: ${error.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.status === 'success') {
        setMessages([{ role: 'system', content: 'Chat has been reset. Start a new conversation!' }]);
      } else {
        throw new Error('Chat reset failed');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages([{ role: 'system', content: `Failed to reset chat: ${error.message}` }]);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        antdMessage.success('Copied to clipboard!');
      },
      (err) => {
        antdMessage.error('Failed to copy!');
        console.error('Could not copy text: ', err);
      }
    );
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 20px' }}>
        <Title level={3}>Chatbot</Title>
      </Header>
      <Content style={{ padding: '20px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button onClick={handleReset}>Reset Chat</Button>
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
              renderItem={(item) => (
                <List.Item
                  onClick={() => handleCopy(item.content)}
                  style={{
                    justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '10px 15px',
                      borderRadius: '20px',
                      backgroundColor: item.role === 'user' ? 'blue' : 'gray',
                      color: 'white',
                    }}
                  >
                    <Text style={{ color: 'white', whiteSpace: 'pre-wrap' }}>{item.content}</Text> 
                  <Button
                    type="link"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopy(item.content)}
                    style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  </div>
                </List.Item>
              )}
            />
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={handleSend}
              placeholder="Type your message..."
            />
            <Button type="primary" onClick={handleSend} loading={isLoading}>
              Send
            </Button>
          </Space.Compact>
        </Space>
      </Content>
      <Footer style={{ textAlign: 'center' }}>Chatbot ©2024 Created by Amir Joudaki</Footer>
    </Layout>
  );
};

export default ChatApp;
