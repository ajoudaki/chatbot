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
import { styleUtils } from './styles/useTheme';

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

  if (index === editingIndex && item.role === 'user') {
    return (
      <Space direction="vertical" className="message-edit-container">
        <Input.TextArea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 6 }}
          className="message-edit-textarea"
        />
        <Space>
          <Button onClick={() => setEditingIndex(-1)}>Cancel</Button>
          <Button onClick={() => handleEdit(index, editContent)} type="primary">Send</Button>
        </Space>
      </Space>
    );
  }

  return (
    <div 
      className={styleUtils.classNames(
        'message-container',
        item.role === 'user' ? 'message-container--user' : 'message-container--assistant',
        isHovered && 'message-container--hovered'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className={styleUtils.classNames(
          'message-content',
          item.role === 'user' ? 'message-content--user' : 'message-content--assistant'
        )}
      >
        <Text className="message-text">{item.content}</Text>
      </div>
      {(isLastSystemMessage || isHovered) && (
        <Space className="message-actions">
          {item.role === 'user' && (
            <Tooltip title="Edit">
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                onClick={() => setEditingIndex(index)}
                className="action-button"
              />
            </Tooltip>
          )}
          <Tooltip title="Copy">
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => handleCopy(item.content)}
              className="action-button"
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
                  className="action-button"
                />
              </Tooltip>
              <Text className="sibling-counter">{`${currentSibling} / ${totalSiblings}`}</Text>
              <Tooltip title="Next version">
                <Button 
                  type="text" 
                  icon={<RightOutlined />} 
                  onClick={() => handleChangeActiveChild(index, 'next')}
                  disabled={currentSibling === totalSiblings}
                  className="action-button"
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
                  className="action-button"
                />
              </Tooltip>
              <Tooltip title="Regenerate">
                <Button 
                  type="text" 
                  icon={<SyncOutlined />} 
                  onClick={() => handleRegenerate(index)}
                  loading={isLoading}
                  className="action-button"
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
    <Space.Compact className="chat-input-container">
      <Input
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        onPressEnter={handleSubmit}
        placeholder="Type your message..."
        className="chat-input"
      />
      <Button
        type="primary"
        onClick={isRecording ? stopRecording : startRecording}
        icon={<AudioOutlined />}
        danger={isRecording}
        className={styleUtils.classNames(
          'audio-button',
          isRecording && 'audio-button--recording'
        )}
      />
        
      {audioBlob && (
        <Button
          onClick={isPlaying ? pauseRecording : playRecording}
          icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          className={styleUtils.classNames(
            'playback-button',
            isPlaying && 'playback-button--playing'
          )}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
      )}
      <Button 
        type="primary" 
        onClick={handleSubmit} 
        icon={<SendOutlined />} 
        loading={isLoading}
        className="send-button"
      />
    </Space.Compact>
  );
};