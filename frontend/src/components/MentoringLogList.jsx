import React from 'react';
import { Card, List, Typography, Tag } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;

const MentoringLogList = ({ logs, onSelect }) => {
    return (
        <Card title="Mentoring Logs" style={{ borderRadius: 16 }}>
            <List
                dataSource={logs}
                locale={{ emptyText: 'No logs yet' }}
                renderItem={(log) => (
                    <List.Item onClick={() => onSelect?.(log)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
                        <List.Item.Meta
                            title={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Text strong>Log #{log.log_id}</Text>
                                    {log.ai_suggestions && <Tag color="blue">AI</Tag>}
                                </div>
                            }
                            description={
                                <Text type="secondary">
                                    {dayjs(log.meeting_date || log.created_at).format('DD/MM/YYYY HH:mm')}
                                </Text>
                            }
                        />
                    </List.Item>
                )}
            />
        </Card>
    );
};

export default MentoringLogList;
