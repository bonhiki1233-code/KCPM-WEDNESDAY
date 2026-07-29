import React from 'react';
import { Card, List, Typography, Tag } from 'antd';

const { Text } = Typography;

const GradesSummary = ({ summary }) => {
    if (!summary) {
        return (
            <Card title="Grades Summary" style={{ borderRadius: 16 }}>
                <Text type="secondary">No summary available.</Text>
            </Card>
        );
    }

    return (
        <Card title="Grades Summary" style={{ borderRadius: 16 }}>
            <div style={{ marginBottom: 12 }}>
                <Text strong>Final score:</Text> <Tag color="green">{summary.final_score?.toFixed?.(2) ?? summary.final_score}</Tag>
            </div>
            <List
                dataSource={summary.criteria_scores || []}
                renderItem={(item) => (
                    <List.Item>
                        <List.Item.Meta
                            title={item.criteria_name}
                            description={`Weight: ${item.weight} | Score: ${item.score}`}
                        />
                        <Tag>{item.weighted_score}</Tag>
                    </List.Item>
                )}
            />
        </Card>
    );
};

export default GradesSummary;
