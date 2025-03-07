// ModelSettings.js
import React, { useState } from 'react';
import { Dropdown, Button, Form, Select, Slider } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const MODEL_OPTIONS = [
  { label: 'DeepSeek-7B', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B' },
  { label: 'DeepSeek-14B', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B' },
  { label: 'DeepSeek-32B', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B' },
  { label: 'Qwen/Qwen2.5-14B', value: 'Qwen/Qwen2.5-14B-Instruct-1M' },
  { label: 'Llama-3.1-8B', value: 'meta-llama/Llama-3.1-8B-Instruct' },
  { label: 'Llama-3.2-3B', value: 'meta-llama/Llama-3.2-3B-Instruct' },
  { label: 'Llama-3.3-70B', value: 'meta-llama/Llama-3.3-70B-Instruct'},
  { label: 'Mistral-24B', value: 'mistralai/Mistral-Small-24B-Instruct-2501'},
];

export const ModelSettings = ({ currentConfig, onUpdateSettings, isConfigLoading }) => {
  const [form] = Form.useForm();
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onUpdateSettings(values);
      setIsDropdownVisible(false);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setIsDropdownVisible(false);
  };

  const menu = (
    <div className="settings-dropdown">
      <Form 
        form={form} 
        layout="vertical" 
        initialValues={currentConfig}
        className="settings-form"
      >
        <Form.Item
          label="Model"
          name="model_name"
          rules={[{ required: true }]}
        >
          <Select 
            options={MODEL_OPTIONS}
            className="settings-select"
            disabled={isConfigLoading}
          />
        </Form.Item>

        <Form.Item
          label="Generation Length"
          name="generation_length"
          rules={[{ required: true }]}
          tooltip="Maximum number of tokens to generate (1-4096)"
        >
          <Slider
            min={1}
            max={4096}
            step={1}
            marks={{
              1: '1',
              1024: '1024',
              2048: '2048',
              4096: '4096'
            }}
            className="settings-slider"
            disabled={isConfigLoading}
          />
        </Form.Item>

        <Form.Item
          label="Temperature"
          name="temperature"
          rules={[{ required: true }]}
          tooltip="Higher values make output more random (0.0-2.0)"
        >
          <Slider
            min={0}
            max={2}
            step={0.1}
            marks={{
              0: '0',
              1: '1',
              2: '2'
            }}
            className="settings-slider"
            disabled={isConfigLoading}
          />
        </Form.Item>

        <Form.Item
          label="Top P"
          name="top_p"
          rules={[{ required: true }]}
          tooltip="Nucleus sampling threshold (0.0-1.0)"
        >
          <Slider
            min={0}
            max={1}
            step={0.05}
            marks={{
              0: '0',
              0.5: '0.5',
              1: '1'
            }}
            className="settings-slider"
            disabled={isConfigLoading}
          />
        </Form.Item>

        <Form.Item className="settings-actions">
          <div className="settings-buttons">
            <Button onClick={handleCancel} disabled={isConfigLoading}>
              Cancel
            </Button>
            <Button 
              type="primary" 
              onClick={handleSubmit} 
              loading={isConfigLoading}
              disabled={isConfigLoading}
            >
              {isConfigLoading ? 'Loading Model...' : 'Save Changes'}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </div>
  );

  return (
    <Dropdown 
      overlay={menu} 
      trigger={['click']}
      placement="bottomRight"
      className="settings-dropdown-container"
      visible={isDropdownVisible}
      onVisibleChange={setIsDropdownVisible}
    >
      <Button 
        icon={<SettingOutlined />} 
        className="settings-trigger-button"
        loading={isConfigLoading}
      />
    </Dropdown>
  );
};