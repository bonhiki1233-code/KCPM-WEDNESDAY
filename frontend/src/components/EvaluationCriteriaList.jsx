import React from 'react';
import { Card, Slider, Input, Button, Space, Typography } from 'antd';

const { Text } = Typography;

const EvaluationCriteriaList = ({ criteriaScores, onChange, onSave }) => {
    return (
        <Card title="Criteria Scores" style={{ borderRadius: 16 }}>
            {criteriaScores.length === 0 ? (
                <Text type="secondary">No criteria scores yet.</Text>
            ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                    {criteriaScores.map((item, index) => (
                        <Card key={`${item.criteria_id}-${index}`} size="small" style={{ borderRadius: 12 }}>
                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                <Text strong>{item.criteria_name || `Criteria #${item.criteria_id}`}</Text>
                                <Slider
                                    min={0}
                                    max={10}
                                    step={0.5}
                                    value={item.score ?? 0}
                                    onChange={(value) => onChange(index, { score: value })}
                                />
                                <Input.TextArea
                                    rows={2}
                                    placeholder="Comment"
                                    value={item.comment || ''}
                                    onChange={(event) => onChange(index, { comment: event.target.value })}
                                />
                                <Button onClick={() => onSave(item)} type="primary">
                                    Save
                                </Button>
                            </Space>
                        </Card>
                    ))}
                </Space>
            )}
        </Card>
    );
};

export default EvaluationCriteriaList;
