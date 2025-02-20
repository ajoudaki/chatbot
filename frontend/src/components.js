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
  DeleteOutlined,
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
