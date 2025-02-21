import React, { useState, useEffect } from 'react';
import { Layout, Button, List, Typography, Space, Input, Tooltip } from 'antd';
import { 
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';

const { Sider } = Layout;
const { Text } = Typography;

const ChatNavigation = ({ chats, onNewChat, onUpdateChatName, onDeleteChat }) => {
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingName, setEditingName] = useState('');
  
  const navigate = useNavigate();
  const { chatId } = useParams(); // Get chatId from URL

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleEditStart = (chat, e) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingName(chat.name);
  };

  const handleEditSubmit = (e) => {
    e.stopPropagation();
    if (editingName.trim()) {
      onUpdateChatName(editingName);
    }
    setEditingChatId(null);
  };

  const handleEditCancel = (e) => {
    e.stopPropagation();
    setEditingChatId(null);
  };

  const handleDelete = (chatId, e) => {
    e.stopPropagation();
    onDeleteChat(chatId);
    // If we're deleting the current chat, navigate to root
    if (chatId === window.location.pathname.split('/').pop()) {
      navigate('/');
    }
  };

  const handleChatSelect = (selectedChatId) => {
    navigate(`/chat/${selectedChatId}`);
  };

  const handleNewChatClick = () => {
    onNewChat();
    navigate('/'); // Navigate to root when starting new chat
  };

  const sortedChats = [...chats].sort((a, b) => 
    new Date(b.last_modified) - new Date(a.last_modified)
  );

  return (
    <Sider 
      width={300} 
      style={{ 
        background: '#fff',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden'
      }}
    >
      <div style={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px'
      }}>
        <Button 
          type="primary" 
          icon={<PlusCircleOutlined />} 
          onClick={handleNewChatClick}
          style={{ marginBottom: '20px' }}
        >
          New Chat
        </Button>
        <div style={{ 
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          marginRight: '-8px',
          paddingRight: '8px'
        }}>
          <List
            dataSource={sortedChats}
            renderItem={(chat) => (
              <List.Item 
                onClick={() => handleChatSelect(chat.id)}
                style={{ 
                  cursor: 'pointer',
                  backgroundColor: chat.id === chatId ? '#e6f7ff' : 'transparent',
                  padding: '10px',
                  borderRadius: '4px',
                  marginBottom: '8px'
                }}
              >
                <div style={{ width: '100%' }}>
                  {editingChatId === chat.id ? (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onPressEnter={handleEditSubmit}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      <Space>
                        <Button 
                          size="small" 
                          icon={<CheckOutlined />} 
                          onClick={handleEditSubmit}
                        />
                        <Button 
                          size="small" 
                          icon={<CloseOutlined />} 
                          onClick={handleEditCancel}
                        />
                      </Space>
                    </Space>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text ellipsis style={{ maxWidth: '60%' }}>
                          {chat.name || 'New Chat'}
                        </Text>
                        {chat.id === chatId && (
                          <Space>
                            <Tooltip title="Edit name">
                              <Button
                                type="text"
                                icon={<EditOutlined />}
                                onClick={(e) => handleEditStart(chat, e)}
                                size="small"
                              />
                            </Tooltip>
                            <Tooltip title="Delete chat">
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => handleDelete(chat.id, e)}
                                size="small"
                              />
                            </Tooltip>
                          </Space>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </List.Item>
            )}
          />
        </div>
      </div>
    </Sider>
  );
};

export default ChatNavigation;