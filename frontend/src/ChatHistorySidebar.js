import React, { useState } from 'react';
import { Layout, Button, List, Typography, Space, Input, Tooltip } from 'antd';
import { 
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { styleUtils } from './styles/useTheme';

const { Sider } = Layout;
const { Text } = Typography;

const ChatNavigation = ({ 
  chats, 
  currentChatId,
  onNewChat,
  onChatSelect,
  onUpdateChatName, 
  onDeleteChat 
}) => {
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingName, setEditingName] = useState('');

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
  };

  const sortedChats = [...chats].sort((a, b) => 
    new Date(b.last_modified) - new Date(a.last_modified)
  );

  return (
    <Sider width={300} className="chat-nav-sider">
      <div className="chat-nav-container">
        <Button 
          type="primary" 
          icon={<PlusCircleOutlined />} 
          onClick={onNewChat}
          className="new-chat-button"
        >
          New Chat
        </Button>
        <div className="chat-list-wrapper scrollable">
          <List
            dataSource={sortedChats}
            renderItem={(chat) => (
              <List.Item 
                onClick={() => onChatSelect(chat.id)}
                className={styleUtils.classNames(
                  'chat-list-item',
                  chat.id === currentChatId && 'chat-list-item--active'
                )}
              >
                <div className="chat-item-content">
                  {editingChatId === chat.id ? (
                    <Space direction="vertical" className="chat-edit-container">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onPressEnter={handleEditSubmit}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="chat-edit-input"
                      />
                      <Space>
                        <Button 
                          size="small" 
                          icon={<CheckOutlined />} 
                          onClick={handleEditSubmit}
                          className="edit-action-button"
                        />
                        <Button 
                          size="small" 
                          icon={<CloseOutlined />} 
                          onClick={handleEditCancel}
                          className="edit-action-button"
                        />
                      </Space>
                    </Space>
                  ) : (
                    <div className="chat-info">
                      <div className="chat-header">
                        <Text ellipsis className="chat-title">
                          {chat.name || 'New Chat'}
                        </Text>
                        {chat.id === currentChatId && (
                          <Space className="chat-actions">
                            <Tooltip title="Edit name">
                              <Button
                                type="text"
                                icon={<EditOutlined />}
                                onClick={(e) => handleEditStart(chat, e)}
                                size="small"
                                className="chat-action-button"
                              />
                            </Tooltip>
                            <Tooltip title="Delete chat">
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => handleDelete(chat.id, e)}
                                size="small"
                                className="chat-action-button"
                              />
                            </Tooltip>
                          </Space>
                        )}
                      </div>
                      <Text className="chat-timestamp">
                        {formatDate(chat.last_modified)}
                      </Text>
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