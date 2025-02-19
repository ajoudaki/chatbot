import React, { useState } from 'react';
import { Dropdown, Button, Modal, Form, InputNumber, Select, message, Slider } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const MODEL_OPTIONS = [
  { label: 'DeepSeek-7B', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B' },
  { label: 'DeepSeek-14B', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B' },
  { label: 'DeepSeek-32B', value: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B' },
    {label: 'Llama-3.1-8B', value: 'meta-llama/Meta-Llama-3.1-8B-Instruct' },
    {label: 'Llama-3.2-3B', value: 'meta-llama/Llama-3.2-3B-Instruct' },
    {label: 'Qwen/Qwen2.5-14B', value: 'Qwen/Qwen2.5-14B-Instruct-1M' },
];

export const ModelSettings = ({ socket, currentConfig }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const showModal = () => {
    form.setFieldsValue(currentConfig);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      socket.emit('update_model_config', values);
      
      // Listen for response
      socket.once('model_config_updated', (response) => {
        setLoading(false);
        if (response.success) {
          message.success('Model settings updated successfully');
          setIsModalOpen(false);
        } else {
          message.error(response.error || 'Failed to update model settings');
        }
      });
    } catch (error) {
      setLoading(false);
      console.error('Validation failed:', error);
    }
  };

  const menu = (
    <div style={{ 
      padding: '16px',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
      width: '300px',
      border: '1px solid #f0f0f0',
      position: 'relative',
      zIndex: 1000
    }}>
      <Form 
        form={form} 
        layout="vertical" 
        initialValues={currentConfig}
        style={{ backgroundColor: '#ffffff' }}
      >
        <Form.Item
          label="Model"
          name="model_name"
          rules={[{ required: true }]}
        >
          <Select options={MODEL_OPTIONS} />
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
          />
        </Form.Item>

        <Form.Item className="mb-0" style={{ marginBottom: 0 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '8px',
            backgroundColor: '#ffffff'
          }}>
            <Button onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              Save Changes
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
      overlayStyle={{
        backgroundColor: '#ffffff',
        padding: 0,
      }}
      dropdownRender={menu => (
        <div style={{ backgroundColor: '#ffffff' }}>
          {menu}
        </div>
      )}
    >
      <Button icon={<SettingOutlined />} className="ml-2">
        Model Settings
      </Button>
    </Dropdown>
  );
};