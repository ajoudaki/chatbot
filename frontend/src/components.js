import React, { useState } from 'react';
import { Button, Input, List, Typography, Layout, Space, Tooltip } from 'antd';
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
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { Header, Content, Footer, Sider } = Layout;

export const MessageItem = ({ 
  item, 
  index, 
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
        marginBottom: '20px',
        position: 'relative',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        style={{
          padding: '10px 15px',
          borderRadius: '20px',
          backgroundColor: item.role === 'user' ? '#c0c0c0' : '#f0f0f0',
          color: item.role === 'user' ? 'white' : 'black',
        }}
      >
        <Text style={{ whiteSpace: 'pre-wrap' }}>{item.content}</Text>
      </div>
      {(isLastSystemMessage || isHovered) && (
        <Space 
          style={{
            position: 'absolute',
            bottom: '-15px',
            right: '5px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '10px',
            padding: '5px 10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1,
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
          {(isLastSystemMessage || (item.role === "assistant" && isHovered)) && (
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
                  onClick={() => handleRegenerate(index)}
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

export const ChatInput = ({ inputMessage, setInputMessage, handleSubmit, isLoading, audioControls }) => {
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

export const ChatHistorySidebar = ({ 
  chatList, 
  onChatSelect, 
  onNewChat, 
  currentChatId,
  onUpdateChatName 
}) => {
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingName, setEditingName] = useState('');

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

  // Sort chats by last_modified date
  const sortedChatList = [...chatList].sort((a, b) => {
    return new Date(b.last_modified) - new Date(a.last_modified);
  });

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
        dataSource={sortedChatList}
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
                    <Text ellipsis style={{ maxWidth: '80%' }}>
                      {chat.name || 'New Chat'}
                    </Text>
                    {chat.id === currentChatId && (
                      <Tooltip title="Edit name">
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          onClick={(e) => handleEditStart(chat, e)}
                          size="small"
                        />
                      </Tooltip>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {formatDate(chat.last_modified)}
                  </Text>
                </div>
              )}
            </div>
          </List.Item>
        )}
      />
    </Sider>
  );
};
