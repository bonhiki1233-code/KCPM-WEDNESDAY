import React, { useState } from 'react';
import { Card, Form, InputNumber, Input, Button, Space } from 'antd';

const EvaluationForm = ({ onAdd }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        const values = await form.validateFields();
        setLoading(true);
        await onAdd(values);
        setLoading(false);
        form.resetFields();
    };

    return (
        <Card title="Add Criteria Score" style={{ borderRadius: 16 }}>
            <Form layout="vertical" form={form}>
                <Form.Item name="criteria_id" label="Criteria ID" rules={[{ required: true }]}
                >
                    <InputNumber style={{ width: '100%' }} min={1} />
                </Form.Item>
                <Form.Item name="score" label="Score (0-10)" rules={[{ required: true }]}
                >
                    <InputNumber style={{ width: '100%' }} min={0} max={10} step={0.5} />
                </Form.Item>
                <Form.Item name="comment" label="Comment">
                    <Input.TextArea rows={3} />
                </Form.Item>
                <Space>
                    <Button type="primary" onClick={handleSubmit} loading={loading}>Add</Button>
                </Space>
            </Form>
        </Card>
    );
};

export default EvaluationForm;
