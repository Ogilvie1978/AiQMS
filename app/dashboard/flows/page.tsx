'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type NodeType = 'start' | 'slut' | 'proces' | 'beslutning' | 'kontrol' | 'ccp'

type FlowNode = {
  id: string
  type: NodeType
  x: number
  y: number
  label: string
}

type FlowEdge = {
  id: string
  from: string
  to: string
  label?: string
}

type FlowData = {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

type SavedFlow = {
  id: string
  name: string
  data: FlowData
  updated_at: string
}

const NODE_STYLES: Record<NodeType, { bg: string; border: string; text: string; label: string }> = {
  start:      { bg: '#dcfce7', border: '#16a34a', text: '#15803d', label: 'Start' },
  slut:       { bg: '#fee2e2', border: '#dc2626', text: '#b91c1c', label: 'Slut' },
  proces:     { bg: '#dbeafe', border: '#2563eb', text: '#1d4ed8', label: 'Proces' },
  beslutning: { bg: '#fef9c3', border: '#ca8a04', text: '#92400e', label: 'Beslutning' },
  kontrol:    { bg: '#f3e8ff', border: '#9333ea', text: '#7e22ce', label: 'Kontrol' },
  ccp:        { bg: '#ffedd5', border: '#ea580c', text: '#9a3412', label: 'CCP' },
}

const NODE_W = 160
const NODE_H = 56
const CANVAS_W = 4000
const CANVAS_H = 4000
const ARROW_SIZE = 8

const uid = () => Math.random().toString(36).slice(2, 10)

// Get the point where a line from (fromX,fromY) hits the border of the node
function getBorderPoint(node: FlowNode, fromX: number, fromY: number) {
  const cx = node.x + NODE_W / 2
  const cy = node.y + NODE_H / 2
  const dx = fromX - cx
  const dy = fromY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const hw = NODE_W / 2 + 2
  const hh = NODE_H / 2 + 2
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}

// Draw arrowhead polygon at point (x,y) pointing in direction (angle radians)
function arrowHead(x: number, y: number, angle: number) {
  const a = ARROW_SIZE
  const b = ARROW_SIZE * 0.5
  // tip at (x,y), two base points perpendicular behind
  const tipX = x
  const tipY = y
  const baseX = x - Math.cos(angle) * a
  const baseY = y - Math.sin(angle) * a
  const p1x = baseX + Math.cos(angle + Math.PI / 2) * b
  const p1y = baseY + Math.sin(angle + Math.PI / 2) * b
  const p2x = baseX + Math.cos(angle - Math.PI / 2) * b
  const p2y = baseY + Math.sin(angle - Math.PI / 2) * b
  return `${tipX},${tipY} ${p1x},${p1y} ${p2x},${p2y}`
}

function renderEdge(fromNode: FlowNode, toNode: FlowNode, edgeId: string, label?: string) {
  const fromCx = fromNode.x + NODE_W / 2
  const fromCy = fromNode.y + NODE_H / 2
  const toCx = toNode.x + NODE_W / 2
  const toCy = toNode.y + NODE_H / 2

  // Start and end on node borders
  const start = getBorderPoint(fromNode, toCx, toCy)
  const end = getBorderPoint(toNode, fromCx, fromCy)

  // Pull end back slightly so arrowhead tip sits on border
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return null

  const ux = dx / len
  const uy = dy / len

  // Line ends just before the arrowhead tip
  const lineEndX = end.x - ux * ARROW_SIZE
  const lineEndY = end.y - uy * ARROW_SIZE

  // Midpoint for label
  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2

  // Angle for arrowhead
  const angle = Math.atan2(uy, ux)
  const arrowPts = arrowHead(end.x, end.y, angle)

  return (
    <g key={edgeId}>
      <line
        x1={start.x} y1={start.y}
        x2={lineEndX} y2={lineEndY}
        stroke="#6b7280"
        strokeWidth="1.5"
      />
      <polygon points={arrowPts} fill="#6b7280" />
      {label && (
        <text x={midX} y={midY - 6} textAnchor="middle" fontSize="11" fill="#6b7280">
          {label}
        </text>
      )}
    </g>
  )
}

export default function FlowsPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [edges, setEdges] = useState<FlowEdge[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState<{ id: string; value: string } | null>(null)
  const [savedFlows, setSavedFlows] = useState<SavedFlow[]>([])
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null)
  const [currentFlowName, setCurrentFlowName] = useState('Nyt flow')
  const [showFlowModal, setShowFlowModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [unsaved, setUnsaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null)
  const [didDrag, setDidDrag] = useState(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<SVGSVGElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      await loadFlows(user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadFlows = async (userId: string) => {
    const { data } = await supabase
      .from('flows')
      .select('id, name, data, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    setSavedFlows(data || [])
  }

  const svgCoords = (clientX: number, clientY: number) => {
    const svg = canvasRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const vb = svg.viewBox.baseVal
    return {
      x: (clientX - rect.left) * (vb.width / rect.width),
      y: (clientY - rect.top) * (vb.height / rect.height),
    }
  }

  const addNode = (type: NodeType) => {
    const n: FlowNode = {
      id: uid(), type,
      x: 300 + Math.random() * 400,
      y: 200 + Math.random() * 300,
      label: NODE_STYLES[type].label,
    }
    setNodes(prev => [...prev, n])
    setUnsaved(true)
  }

  const deleteSelected = () => {
    if (!selected) return
    setNodes(prev => prev.filter(n => n.id !== selected))
    setEdges(prev => prev.filter(e => e.from !== selected && e.to !== selected))
    setSelected(null)
    setUnsaved(true)
  }

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (didDrag) return
    if (connecting) {
      if (connecting !== nodeId) {
        const exists = edges.find(e => e.from === connecting && e.to === nodeId)
        if (!exists) {
          setEdges(prev => [...prev, { id: uid(), from: connecting, to: nodeId }])
          setUnsaved(true)
        }
      }
      setConnecting(null)
      return
    }
    setSelected(nodeId === selected ? null : nodeId)
  }

  const handleCanvasClick = () => {
    if (connecting) { setConnecting(null); return }
    setSelected(null)
  }

  const onMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    const { x, y } = svgCoords(e.clientX, e.clientY)
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    dragStart.current = { x: e.clientX, y: e.clientY }
    setDidDrag(false)
    setDragging({ id: nodeId, ox: x - node.x, oy: y - node.y })
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return
    if (dragStart.current) {
      const dx = Math.abs(e.clientX - dragStart.current.x)
      const dy = Math.abs(e.clientY - dragStart.current.y)
      if (dx > 4 || dy > 4) setDidDrag(true)
    }
    const { x, y } = svgCoords(e.clientX, e.clientY)
    setNodes(prev => prev.map(n =>
      n.id === dragging.id
        ? { ...n, x: Math.max(0, x - dragging.ox), y: Math.max(0, y - dragging.oy) }
        : n
    ))
  }, [dragging])

  const onMouseUp = useCallback(() => {
    if (dragging && didDrag) setUnsaved(true)
    setDragging(null)
    dragStart.current = null
    setTimeout(() => setDidDrag(false), 50)
  }, [dragging, didDrag])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const startEditLabel = (e: React.MouseEvent, node: FlowNode) => {
    e.stopPropagation()
    setEditLabel({ id: node.id, value: node.label })
  }

  const commitLabel = () => {
    if (!editLabel) return
    setNodes(prev => prev.map(n => n.id === editLabel.id ? { ...n, label: editLabel.value } : n))
    setEditLabel(null)
    setUnsaved(true)
  }

  const openSaveModal = () => {
    setSaveName(currentFlowName)
    setShowSaveModal(true)
  }

  const saveFlow = async () => {
    if (!user || !saveName.trim()) return
    setSaving(true)
    const flowData: FlowData = { nodes, edges }
    if (currentFlowId) {
      await supabase.from('flows').update({
        name: saveName.trim(), data: flowData,
        updated_at: new Date().toISOString(),
      }).eq('id', currentFlowId)
    } else {
      const { data } = await supabase.from('flows').insert({
        user_id: user.id, name: saveName.trim(), data: flowData,
      }).select().single()
      if (data) setCurrentFlowId(data.id)
    }
    setCurrentFlowName(saveName.trim())
    await loadFlows(user.id)
    setSaving(false); setSaved(true); setUnsaved(false); setShowSaveModal(false)
    setTimeout(() => setSaved(false), 3000)
  }

  const loadFlow = (flow: SavedFlow) => {
    setNodes(flow.data?.nodes || [])
    setEdges(flow.data?.edges || [])
    setCurrentFlowId(flow.id)
    setCurrentFlowName(flow.name)
    setUnsaved(false); setShowFlowModal(false); setSelected(null)
  }

  const deleteFlow = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Slet dette flow?')) return
    await supabase.from('flows').delete().eq('id', id)
    if (currentFlowId === id) {
      setNodes([]); setEdges([]); setCurrentFlowId(null); setCurrentFlowName('Nyt flow')
    }
    await loadFlows(user!.id)
  }

  const newFlow = () => {
    if (unsaved && !confirm('Du har ugemte ændringer. Fortsæt?')) return
    setNodes([]); setEdges([]); setCurrentFlowId(null)
    setCurrentFlowName('Nyt flow'); setUnsaved(false); setSelected(null)
  }

  const selectedNode = nodes.find(n => n.id === selected)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-sm text-gray-400">Indlæser...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* NAV */}
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700">← Dashboard</a>
          <div className="w-px h-4 bg-gray-200" />
          <span className="text-sm font-semibold text-gray-900">{currentFlowName}</span>
          {unsaved && <span className="text-xs text-amber-500">● Ugemte ændringer</span>}
          {saved && <span className="text-xs text-emerald-500">✓ Gemt</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={newFlow} className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">+ Nyt flow</button>
          <button onClick={() => setShowFlowModal(true)} className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">📂 Mine flows ({savedFlows.length})</button>
          <button onClick={openSaveModal} className="text-xs px-4 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700">Gem flow</button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">

        {/* TOOLBAR */}
        <div className="w-52 bg-white border-r border-gray-100 p-4 flex flex-col gap-4 flex-shrink-0 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tilføj element</p>
            <div className="flex flex-col gap-1.5">
              {(Object.keys(NODE_STYLES) as NodeType[]).map(type => (
                <button key={type} onClick={() => addNode(type)}
                  className="text-xs px-3 py-2 rounded-lg border text-left font-medium hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: NODE_STYLES[type].bg, borderColor: NODE_STYLES[type].border, color: NODE_STYLES[type].text }}>
                  {NODE_STYLES[type].label}
                </button>
              ))}
            </div>
          </div>

          {selectedNode && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Valgt</p>
              <div className="text-xs px-3 py-2 rounded-lg border font-medium mb-3"
                style={{ backgroundColor: NODE_STYLES[selectedNode.type].bg, borderColor: NODE_STYLES[selectedNode.type].border, color: NODE_STYLES[selectedNode.type].text }}>
                {selectedNode.label}
              </div>
              <div className="flex flex-col gap-1.5">
                <button onClick={() => setConnecting(selected)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${connecting === selected ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {connecting === selected ? '→ Klik på mål...' : '→ Forbind til...'}
                </button>
                <button onClick={deleteSelected}
                  className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                  🗑 Slet element
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Vejledning</p>
            <div className="text-xs text-gray-400 space-y-1.5">
              <p>• Klik element for at vælge</p>
              <p>• Træk for at flytte</p>
              <p>• Dobbeltklik for at redigere tekst</p>
              <p>• Brug "Forbind" for pile</p>
            </div>
          </div>
        </div>

        {/* CANVAS */}
        <div className="flex-1 overflow-auto bg-gray-100">
          <svg
            ref={canvasRef}
            width={CANVAS_W} height={CANVAS_H}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            onClick={handleCanvasClick}
            className="block"
            style={{ cursor: connecting ? 'crosshair' : 'default' }}
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />

            {/* Edges — rendered below nodes */}
            {edges.map(edge => {
              const fromNode = nodes.find(n => n.id === edge.from)
              const toNode = nodes.find(n => n.id === edge.to)
              if (!fromNode || !toNode) return null
              return renderEdge(fromNode, toNode, edge.id, edge.label)
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const style = NODE_STYLES[node.type]
              const isSelected = selected === node.id
              const isConnecting = connecting === node.id
              return (
                <g key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={e => handleNodeClick(e, node.id)}
                  onMouseDown={e => onMouseDown(e, node.id)}
                  onDoubleClick={e => startEditLabel(e, node)}
                  style={{ cursor: dragging?.id === node.id ? 'grabbing' : 'grab' }}
                >
                  <rect width={NODE_W} height={NODE_H} rx="8"
                    fill={style.bg}
                    stroke={isSelected || isConnecting ? '#0ea5e9' : style.border}
                    strokeWidth={isSelected || isConnecting ? 2.5 : 1.5}
                    filter={isSelected ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))' : undefined}
                  />
                  {editLabel?.id === node.id ? (
                    <foreignObject x="4" y="4" width={NODE_W - 8} height={NODE_H - 8}>
                      <input
                        // @ts-ignore
                        xmlns="http://www.w3.org/1999/xhtml"
                        autoFocus
                        value={editLabel.value}
                        onChange={e => setEditLabel(prev => prev ? { ...prev, value: e.target.value } : null)}
                        onBlur={commitLabel}
                        onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
                        style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', fontSize: '12px', fontWeight: 600, color: style.text, textAlign: 'center', outline: 'none' }}
                      />
                    </foreignObject>
                  ) : (
                    <text x={NODE_W / 2} y={NODE_H / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="600" fill={style.text}>
                      {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
                    </text>
                  )}
                  <text x={NODE_W - 6} y="10" textAnchor="end" fontSize="8" fill={style.border} opacity="0.5">
                    {style.label.toUpperCase()}
                  </text>
                </g>
              )
            })}

            {nodes.length === 0 && (
              <text x={CANVAS_W / 2} y={300} textAnchor="middle" fontSize="14" fill="#9ca3af">
                Tilføj elementer fra venstre panel for at bygge dit flow
              </text>
            )}
          </svg>
        </div>
      </div>

      {/* SAVE MODAL */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowSaveModal(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Gem flow</h2>
            <label className="block text-xs font-medium text-gray-600 mb-1">Navn på flow</label>
            <input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveFlow() }}
              placeholder="F.eks. Modtagekontrol, Pasteurisering..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4" />
            <div className="flex justify-between">
              <button onClick={() => setShowSaveModal(false)} className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Annuller</button>
              <button onClick={saveFlow} disabled={saving || !saveName.trim()} className="text-xs px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Gemmer...' : 'Gem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOWS MODAL */}
      {showFlowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowFlowModal(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Mine flows</h2>
              <button onClick={() => setShowFlowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {savedFlows.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">Ingen gemte flows endnu</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedFlows.map(flow => (
                    <div key={flow.id} onClick={() => loadFlow(flow)}
                      className={`flex items-center justify-between px-4 py-3 border rounded-xl cursor-pointer hover:shadow-sm transition-all ${currentFlowId === flow.id ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 hover:border-gray-200'}`}>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{flow.name}</div>
                        <div className="text-xs text-gray-400">
                          {flow.data?.nodes?.length || 0} elementer · Sidst ændret {new Date(flow.updated_at).toLocaleDateString('da-DK')}
                        </div>
                      </div>
                      <button onClick={e => deleteFlow(flow.id, e)}
                        className="text-xs px-2.5 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 ml-3 flex-shrink-0">
                        Slet
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
