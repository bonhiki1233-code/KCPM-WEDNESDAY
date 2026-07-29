import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

const TypingIndicator = ({ users }) => {
    if (!users || users.length === 0) {
        return null;
    }

    const label = users.length === 1 ? 'Someone is typing...' : 'Multiple people are typing...';

    return (
        <div style={{ padding: '4px 12px' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
        </div>
    );
};

export default TypingIndicator;
