import React from 'react';
import { Modal, Form, Input, Switch } from 'antd';

const RequestMentoringModal = ({ open, onCancel, onSubmit, loading }) => {
    const [form] = Form.useForm();

    const handleOk = async () => {
        const values = await form.validateFields();
        await onSubmit(values);
        form.resetFields();
    };

    return (
        <Modal
            title="Request AI Mentoring"
            open={open}
            onCancel={onCancel}
            onOk={handleOk}
            okText="Generate"
            confirmLoading={loading}
        >
            <Form form={form} layout="vertical" initialValues={{ include_peer_reviews: true, include_tasks: true }}>
                <Form.Item name="context" label="Additional context">
                    <Input.TextArea rows={4} placeholder="What should the AI focus on?" />
                </Form.Item>
                <Form.Item name="include_peer_reviews" label="Include peer reviews" valuePropName="checked">
                    <Switch />
                </Form.Item>
                <Form.Item name="include_tasks" label="Include task progress" valuePropName="checked">
                    <Switch />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default RequestMentoringModal;
