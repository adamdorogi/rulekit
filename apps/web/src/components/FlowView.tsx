import ReactFlow, { Background, Controls, Position, type Edge, type Node } from 'reactflow';
import Card from 'react-bootstrap/Card';

const style = { border: '1px solid #dee2e6', borderRadius: 4, padding: 10, width: 140, background: '#fff' };
const nodes = (version: number | null): Node[] => [
  { id: 'input', position: { x: 0, y: 110 }, sourcePosition: Position.Right, data: { label: 'HTTP Input' }, type: 'input', style },
  { id: 'rules', position: { x: 190, y: 110 }, sourcePosition: Position.Right, targetPosition: Position.Left, data: { label: version === null ? 'Ruleset (draft)' : 'Ruleset (v' + version + ')' }, style },
  { id: 'allow', position: { x: 380, y: 30 }, sourcePosition: Position.Right, targetPosition: Position.Left, data: { label: 'Allow' }, style },
  { id: 'review', position: { x: 380, y: 110 }, sourcePosition: Position.Right, targetPosition: Position.Left, data: { label: 'Review Queue' }, style },
  { id: 'deny', position: { x: 380, y: 190 }, sourcePosition: Position.Right, targetPosition: Position.Left, data: { label: 'Deny' }, style },
  { id: 'webhook', position: { x: 570, y: 110 }, targetPosition: Position.Left, data: { label: 'Webhook Endpoints' }, type: 'output', style },
];

const edges: Edge[] = [
  { id: 'in-rules', source: 'input', target: 'rules' },
  ...['allow', 'review', 'deny'].flatMap((id) => [
    { id: 'rules-' + id, source: 'rules', target: id },
    { id: id + '-webhook', source: id, target: 'webhook' },
  ]),
];

export default function FlowView({ version }: { version: number | null }) {
  return (
    <Card>
      <div className="flow-panel" aria-label="Project flow diagram">
        <ReactFlow nodes={nodes(version)} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}>
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </Card>
  );
}
