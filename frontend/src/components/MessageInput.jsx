import React, { useState, useRef } from 'react';
import { Button, Input, Space } from 'antd';
import { SendOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const MessageInput = ({ onSend, onTyping, disabled }) => {
    const [value, setValue] = useState('');
    const lastTypingRef = useRef(0);

    const handleSend = async () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        await onSend(trimmed);
        setValue('');
    };

    const handleChange = (event) => {
        const nextValue = event.target.value;
        setValue(nextValue);

        if (onTyping) {
            const now = Date.now();
            if (now - lastTypingRef.current > 1200) {
                onTyping();
                lastTypingRef.current = now;
            }
        }
    };

    return (
        <Space style={{ width: '100%' }} align="end">
            <TextArea
                value={value}
                onChange={handleChange}
                placeholder="Type your message..."
                autoSize={{ minRows: 1, maxRows: 4 }}
                onPressEnter={(event) => {
                    if (!event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                    }
                }}
                disabled={disabled}
            />
            <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                disabled={disabled}
            />
        </Space>
    );
};

export default MessageInput;
