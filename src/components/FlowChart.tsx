import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
  BackgroundVariant,
} from '@xyflow/react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ProcessInfo {
  title: string;
  description: string;
  sla: Record<string, string>;
}

interface FlowChartProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  processInfo: ProcessInfo;
}

export default function FlowChart({ initialNodes, initialEdges, processInfo }: FlowChartProps) {
  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const getExportFileName = (extension: 'png' | 'pdf') => {
    const slug = processInfo.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return `${slug}-${timestamp}.${extension}`;
  };

  const captureFlowChart = useCallback(async () => {
    if (!flowWrapperRef.current) {
      return null;
    }

    return html2canvas(flowWrapperRef.current, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });
  }, []);

  const exportAsPng = useCallback(async () => {
    const canvas = await captureFlowChart();
    if (!canvas) {
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = getExportFileName('png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [captureFlowChart, getExportFileName]);

  const exportAsPdf = useCallback(async () => {
    const canvas = await captureFlowChart();
    if (!canvas) {
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(dataUrl);
    const ratio = Math.min(pageWidth / imgProps.width, pageHeight / imgProps.height);
    const imgWidth = imgProps.width * ratio;
    const imgHeight = imgProps.height * ratio;
    const marginX = (pageWidth - imgWidth) / 2;
    const marginY = (pageHeight - imgHeight) / 2;

    pdf.addImage(dataUrl, 'PNG', marginX, marginY, imgWidth, imgHeight);
    pdf.save(getExportFileName('pdf'));
  }, [captureFlowChart, getExportFileName]);

  return (
    <div className="flex h-full">
      {/* Flow area */}
      <div className="flex-1 relative">
        <div className="flex items-center justify-end gap-2 px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={exportAsPng}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Export PNG
          </button>
          <button
            type="button"
            onClick={exportAsPdf}
            className="cursor-pointer rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Export PDF
          </button>
        </div>
        <div ref={flowWrapperRef} className="h-[calc(100%-3.5rem)] overflow-hidden rounded-3xl bg-white shadow-sm" style={{ minHeight: 0 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            attributionPosition="bottom-left"
          >
            <Controls position="bottom-right" />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              position="bottom-left"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}
            />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
          </ReactFlow>
        </div>
      </div>

      {/* Detail panel */}
      <div className="w-80 border-l border-gray-200 bg-white p-5 overflow-y-auto">
        {selectedNode ? (
          <div>
            <div className="mb-4">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Selected Step</span>
              <h3 className="text-lg font-semibold text-gray-900 mt-1">{String(selectedNode.data.label)}</h3>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Node ID</p>
                <p className="text-sm font-mono text-gray-700">{selectedNode.id}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-600 mb-1">Tip</p>
                <p className="text-sm text-blue-800">Click any node to see its details. Use scroll to zoom, drag to pan.</p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{processInfo.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{processInfo.description}</p>
            <div className="mb-4">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">SLA Targets</h4>
              <div className="space-y-2">
                {Object.entries(processInfo.sla).map(([level, time]) => (
                  <div key={level} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-gray-700">{level}</span>
                    <span className="text-sm font-semibold text-gray-900">{time}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Legend</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-200 border border-blue-400"></span> L1 Support</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-orange-200 border border-orange-400"></span> L2 Support</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-200 border border-red-400"></span> L3 / Critical</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-200 border border-green-400"></span> Resolution</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400"></span> Decision</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-indigo-200 border border-indigo-400"></span> Process Step</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
