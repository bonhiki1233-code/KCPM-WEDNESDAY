import React from 'react';
import { Card, Typography } from 'antd';
import { BulbOutlined } from '@ant-design/icons';

const { Paragraph, Text, Title } = Typography;

const AIRecommendations = ({ suggestions, loading }) => {
    return (
        <Card
            title={<Title level={5} style={{ margin: 0 }}>AI Recommendations</Title>}
            style={{ borderRadius: 16 }}
            loading={loading}
        >
            {!suggestions ? (
                <Text type="secondary">Request AI analysis to see recommendations.</Text>
            ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                    {suggestions.split('\n').filter(Boolean).map((line, index) => (
                        <Card key={index} size="small" style={{ borderRadius: 12 }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <BulbOutlined style={{ color: '#faad14', marginTop: 2 }} />
                                <Paragraph style={{ marginBottom: 0 }}>{line}</Paragraph>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </Card>
    );
};

export default AIRecommendations;
