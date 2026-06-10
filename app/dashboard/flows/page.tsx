'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type NodeType = 'indgaaende' | 'proces' | 'udgaaende' | 'kontrol' | 'ccp' | 'beslutning'

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
  version: number
  created_at: string
  updated_at: string
  naeste_revision: string | null
}

const NODE_CONFIG: Record<NodeType, { label: string; shape: string; fill: string; stroke: string; textColor: string }> = {
  indgaaende: { label: 'Indgående varer', shape: 'circle',        fill: '#ffffff', stroke: '#111827', textColor: '#111827' },
  proces:     { label: 'Proces',          shape: 'rect',          fill: '#ffffff', stroke: '#111827', textColor: '#111827' },
  udgaaende:  { label: 'Udgående varer',  shape: 'parallelogram', fill: '#ffffff', stroke: '#111827', textColor: '#111827' },
  kontrol:    { label: 'Kontrol',         shape: 'diamond',       fill: '#ffffff', stroke: '#111827', textColor: '#111827' },
  ccp:        { label: 'CCP',             shape: 'triangle',      fill: '#fff7ed', stroke: '#ea580c', textColor: '#9a3412' },
  beslutning: { label: 'Beslutning',      shape: 'diamond',       fill: '#fefce8', stroke: '#ca8a04', textColor: '#92400e' },
}

const NODE_W = 160
const NODE_H = 64
const CANVAS_W = 4000
const CANVAS_H = 4000
const ARROW_SIZE = 8

const uid = () => Math.random().toString(36).slice(2, 10)

function wrapText(text: string, maxChars = 13): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = (current + ' ' + word).trim()
    if (candidate.length <= maxChars) {
      current = candidate
    } else {
      if (current) lines.push(current)
      if (word.length > maxChars) {
        let rem = word
        while (rem.length > maxChars) {
          lines.push(rem.slice(0, maxChars))
          rem = rem.slice(maxChars)
        }
        current = rem
      } else {
        current = word
      }
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function renderShape(node: FlowNode, isSelected: boolean, isConnecting: boolean) {
  const cfg = NODE_CONFIG[node.type]
  const strokeColor = isSelected || isConnecting ? '#0ea5e9' : cfg.stroke
  const strokeWidth = isSelected || isConnecting ? 2.5 : 1.5
  const filter = isSelected ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' : undefined
  const lines = wrapText(node.label)
  const lineH = 16
  const textH = lines.length * lineH
  const textStartY = NODE_H / 2 - textH / 2 + lineH / 2
  const textEls = lines.map((line, i) => (
    <text key={i} x={NODE_W / 2} y={textStartY + i * lineH}
      textAnchor="middle" dominantBaseline="middle"
      fontSize="12" fontWeight="600" fill={cfg.textColor}>{line}</text>
  ))
  switch (cfg.shape) {
    case 'circle':
      return <><ellipse cx={NODE_W / 2} cy={NODE_H / 2} rx={NODE_W / 2} ry={NODE_H / 2} fill={cfg.fill} stroke={strokeColor} strokeWidth={strokeWidth} filter={filter} />{textEls}</>
    case 'parallelogram': {
      const skew = 16
      return <><polygon points={`${skew},0 ${NODE_W},0 ${NODE_W - skew},${NODE_H} 0,${NODE_H}`} fill={cfg.fill} stroke={strokeColor} strokeWidth={strokeWidth} filter={filter} />{textEls}</>
    }
    case 'diamond': {
      const mx = NODE_W / 2, my = NODE_H / 2
      return <><polygon points={`${mx},0 ${NODE_W},${my} ${mx},${NODE_H} 0,${my}`} fill={cfg.fill} stroke={strokeColor} strokeWidth={strokeWidth} filter={filter} />{textEls}</>
    }
    case 'triangle':
      return <><polygon points={`${NODE_W / 2},4 ${NODE_W - 4},${NODE_H - 4} 4,${NODE_H - 4}`} fill={cfg.fill} stroke={strokeColor} strokeWidth={strokeWidth} filter={filter} />{textEls}</>
    default:
      return <><rect width={NODE_W} height={NODE_H} rx="6" fill={cfg.fill} stroke={strokeColor} strokeWidth={strokeWidth} filter={filter} />{textEls}</>
  }
}

function getBorderPoint(node: FlowNode, fromX: number, fromY: number) {
  const cx = node.x + NODE_W / 2, cy = node.y + NODE_H / 2
  const dx = fromX - cx, dy = fromY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const hw = NODE_W / 2 + 2, hh = NODE_H / 2 + 2
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}

function arrowHead(x: number, y: number, angle: number) {
  const a = ARROW_SIZE, b = ARROW_SIZE * 0.5
  const baseX = x - Math.cos(angle) * a, baseY = y - Math.sin(angle) * a
  const p1x = baseX + Math.cos(angle + Math.PI / 2) * b, p1y = baseY + Math.sin(angle + Math.PI / 2) * b
  const p2x = baseX + Math.cos(angle - Math.PI / 2) * b, p2y = baseY + Math.sin(angle - Math.PI / 2) * b
  return `${x},${y} ${p1x},${p1y} ${p2x},${p2y}`
}

function renderEdge(fromNode: FlowNode, toNode: FlowNode, edgeId: string, label?: string) {
  const fromCx = fromNode.x + NODE_W / 2, fromCy = fromNode.y + NODE_H / 2
  const toCx = toNode.x + NODE_W / 2, toCy = toNode.y + NODE_H / 2
  const start = getBorderPoint(fromNode, toCx, toCy)
  const end = getBorderPoint(toNode, fromCx, fromCy)
  const dx = end.x - start.x, dy = end.y - start.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return null
  const ux = dx / len, uy = dy / len
  const lineEndX = end.x - ux * ARROW_SIZE, lineEndY = end.y - uy * ARROW_SIZE
  const midX = (start.x + end.x) / 2, midY = (start.y + end.y) / 2
  const angle = Math.atan2(uy, ux)
  return (
    <g key={edgeId}>
      <line x1={start.x} y1={start.y} x2={lineEndX} y2={lineEndY} stroke="#374151" strokeWidth="1.5" />
      <polygon points={arrowHead(end.x, end.y, angle)} fill="#374151" />
      {label && <text x={midX} y={midY - 6} textAnchor="middle" fontSize="11" fill="#6b7280">{label}</text>}
    </g>
  )
}

function Legend() {
  const items = [
    { shape: 'circle', label: 'Indgående varer', fill: '#ffffff', stroke: '#111827' },
    { shape: 'rect', label: 'Proces', fill: '#ffffff', stroke: '#111827' },
    { shape: 'parallelogram', label: 'Udgående varer', fill: '#ffffff', stroke: '#111827' },
    { shape: 'diamond', label: 'Kontrol / Beslutning', fill: '#ffffff', stroke: '#111827' },
    { shape: 'triangle', label: 'CCP', fill: '#fff7ed', stroke: '#ea580c' },
  ]
  const LW = 36, LH = 24
  return (
    <g transform="translate(30, 30)">
      <rect x="-10" y="-10" width="230" height={items.length * 32 + 20} rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1" filter="drop-shadow(0 1px 4px rgba(0,0,0,0.08))" />
      <text x="5" y="8" fontSize="10" fontWeight="700" fill="#6b7280" letterSpacing="0.05em">FORKLARING</text>
      {items.map((item, i) => {
        const y = i * 32 + 22
        let shapeEl
        if (item.shape === 'circle') shapeEl = <ellipse cx={LW/2} cy={LH/2} rx={LW/2-1} ry={LH/2-1} fill={item.fill} stroke={item.stroke} strokeWidth="1.5" />
        else if (item.shape === 'parallelogram') shapeEl = <polygon points={`5,0 ${LW},0 ${LW-5},${LH} 0,${LH}`} fill={item.fill} stroke={item.stroke} strokeWidth="1.5" />
        else if (item.shape === 'diamond') shapeEl = <polygon points={`${LW/2},0 ${LW},${LH/2} ${LW/2},${LH} 0,${LH/2}`} fill={item.fill} stroke={item.stroke} strokeWidth="1.5" />
        else if (item.shape === 'triangle') shapeEl = <polygon points={`${LW/2},2 ${LW-2},${LH-2} 2,${LH-2}`} fill={item.fill} stroke={item.stroke} strokeWidth="1.5" />
        else shapeEl = <rect width={LW} height={LH} rx="3" fill={item.fill} stroke={item.stroke} strokeWidth="1.5" />
        return (
          <g key={item.label} transform={`translate(5, ${y})`}>
            {shapeEl}
            <text x={LW+8} y={LH/2+1} fontSize="11" fill="#374151" dominantBaseline="middle">{item.label}</text>
          </g>
        )
      })}
    </g>
  )
}

// Mini SVG preview of a flow (scaled down)
function FlowPreview({ data }: { data: FlowData }) {
  if (!data?.nodes?.length) return (
    <div className="flex items-center justify-center h-full text-xs text-gray-400">Ingen elementer</div>
  )
  // Find bounding box
  const xs = data.nodes.map(n => n.x)
  const ys = data.nodes.map(n => n.y)
  const minX = Math.max(0, Math.min(...xs) - 20)
  const minY = Math.max(0, Math.min(...ys) - 20)
  const maxX = Math.max(...xs) + NODE_W + 20
  const maxY = Math.max(...ys) + NODE_H + 20
  const vw = maxX - minX
  const vh = maxY - minY

  return (
    <svg width="100%" height="100%" viewBox={`${minX} ${minY} ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
      <rect x={minX} y={minY} width={vw} height={vh} fill="#f9fafb" />
      {data.edges?.map(edge => {
        const fromNode = data.nodes.find(n => n.id === edge.from)
        const toNode = data.nodes.find(n => n.id === edge.to)
        if (!fromNode || !toNode) return null
        return renderEdge(fromNode, toNode, edge.id, edge.label)
      })}
      {data.nodes.map(node => (
        <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
          {renderShape(node, false, false)}
        </g>
      ))}
    </svg>
  )
}

function ShapeIcon({ type }: { type: NodeType }) {
  const size = 16
  const stroke = NODE_CONFIG[type].stroke
  switch (NODE_CONFIG[type].shape) {
    case 'circle': return <svg width={size} height={size} viewBox="0 0 16 16" className="flex-shrink-0"><ellipse cx="8" cy="8" rx="7" ry="7" fill="white" stroke={stroke} strokeWidth="1.5" /></svg>
    case 'parallelogram': return <svg width={size} height={size} viewBox="0 0 16 16" className="flex-shrink-0"><polygon points="4,0 16,0 12,16 0,16" fill="white" stroke={stroke} strokeWidth="1.5" /></svg>
    case 'diamond': return <svg width={size} height={size} viewBox="0 0 16 16" className="flex-shrink-0"><polygon points="8,0 16,8 8,16 0,8" fill="white" stroke={stroke} strokeWidth="1.5" /></svg>
    case 'triangle': return <svg width={size} height={size} viewBox="0 0 16 16" className="flex-shrink-0"><polygon points="8,1 15,15 1,15" fill="#fff7ed" stroke={stroke} strokeWidth="1.5" /></svg>
    default: return <svg width={size} height={size} viewBox="0 0 16 16" className="flex-shrink-0"><rect x="1" y="3" width="14" height="10" rx="2" fill="white" stroke={stroke} strokeWidth="1.5" /></svg>
  }
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
  const [showPreview, setShowPreview] = useState<SavedFlow | null>(null)
  const [saveName, setSaveName] = useState('')
  const [saveNaestRevision, setSaveNaestRevision] = useState('')
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
    const { data } = await supabase.from('flows')
      .select('id, name, data, version, created_at, updated_at, naeste_revision')
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
    const n: FlowNode = { id: uid(), type, x: 400 + Math.random() * 400, y: 300 + Math.random() * 300, label: NODE_CONFIG[type].label }
    setNodes(prev => [...prev, n])
    setUnsaved(true)
  }

  const deleteSelected = () => {
    if (!selected) return
    setNodes(prev => prev.filter(n => n.id !== selected))
    setEdges(prev => prev.filter(e => e.from !== selected && e.to !== selected))
    setSelected(null); setUnsaved(true)
  }

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (didDrag) return
    if (connecting) {
      if (connecting !== nodeId) {
        const exists = edges.find(e => e.from === connecting && e.to === nodeId)
        if (!exists) { setEdges(prev => [...prev, { id: uid(), from: connecting, to: nodeId }]); setUnsaved(true) }
      }
      setConnecting(null); return
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
    setNodes(prev => prev.map(n => n.id === dragging.id ? { ...n, x: Math.max(0, x - dragging.ox), y: Math.max(0, y - dragging.oy) } : n))
  }, [dragging])

  const onMouseUp = useCallback(() => {
    if (dragging && didDrag) setUnsaved(true)
    setDragging(null); dragStart.current = null
    setTimeout(() => setDidDrag(false), 50)
  }, [dragging, didDrag])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [onMouseMove, onMouseUp])

  const startEditLabel = (e: React.MouseEvent, node: FlowNode) => { e.stopPropagation(); setEditLabel({ id: node.id, value: node.label }) }
  const commitLabel = () => {
    if (!editLabel) return
    setNodes(prev => prev.map(n => n.id === editLabel.id ? { ...n, label: editLabel.value } : n))
    setEditLabel(null); setUnsaved(true)
  }

  const saveFlow = async () => {
    if (!user || !saveName.trim()) return
    setSaving(true)
    const flowData: FlowData = { nodes, edges }
    if (currentFlowId) {
      const cur = savedFlows.find(f => f.id === currentFlowId)
      const newVersion = (cur?.version || 1) + 1
      await supabase.from('flows').update({
        name: saveName.trim(),
        data: flowData,
        version: newVersion,
        naeste_revision: saveNaestRevision || null,
        updated_at: new Date().toISOString(),
      }).eq('id', currentFlowId)
    } else {
      const { data } = await supabase.from('flows').insert({
        user_id: user.id,
        name: saveName.trim(),
        data: flowData,
        version: 1,
        naeste_revision: saveNaestRevision || null,
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
    setUnsaved(false); setShowFlowModal(false); setShowPreview(null); setSelected(null)
  }

  const deleteFlow = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Slet dette flow?')) return
    await supabase.from('flows').delete().eq('id', id)
    if (currentFlowId === id) { setNodes([]); setEdges([]); setCurrentFlowId(null); setCurrentFlowName('Nyt flow') }
    await loadFlows(user!.id)
  }

  const newFlow = () => {
    if (unsaved && !confirm('Du har ugemte ændringer. Fortsæt?')) return
    setNodes([]); setEdges([]); setCurrentFlowId(null)
    setCurrentFlowName('Nyt flow'); setUnsaved(false); setSelected(null)
  }

  const printFlow = (flow: SavedFlow) => {
    const w = window.open('', '_blank')
    if (!w) return

    // Build bounding box for SVG
    const flowNodes = flow.data?.nodes || []
    const flowEdges = flow.data?.edges || []
    let vbStr = `0 0 800 600`
    if (flowNodes.length) {
      const xs = flowNodes.map(n => n.x)
      const ys = flowNodes.map(n => n.y)
      const minX = Math.max(0, Math.min(...xs) - 30)
      const minY = Math.max(0, Math.min(...ys) - 30)
      const maxX = Math.max(...xs) + NODE_W + 30
      const maxY = Math.max(...ys) + NODE_H + 30
      vbStr = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
    }

    // Build SVG content as string
    const edgesStr = flowEdges.map(edge => {
      const fromNode = flowNodes.find(n => n.id === edge.from)
      const toNode = flowNodes.find(n => n.id === edge.to)
      if (!fromNode || !toNode) return ''
      const fromCx = fromNode.x + NODE_W / 2, fromCy = fromNode.y + NODE_H / 2
      const toCx = toNode.x + NODE_W / 2, toCy = toNode.y + NODE_H / 2
      const start = getBorderPoint(fromNode, toCx, toCy)
      const end = getBorderPoint(toNode, fromCx, fromCy)
      const dx = end.x - start.x, dy = end.y - start.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 1) return ''
      const ux = dx / len, uy = dy / len
      const lineEndX = end.x - ux * ARROW_SIZE, lineEndY = end.y - uy * ARROW_SIZE
      const angle = Math.atan2(uy, ux)
      const a = ARROW_SIZE, b = ARROW_SIZE * 0.5
      const baseX = end.x - Math.cos(angle) * a, baseY = end.y - Math.sin(angle) * a
      const p1x = baseX + Math.cos(angle + Math.PI / 2) * b, p1y = baseY + Math.sin(angle + Math.PI / 2) * b
      const p2x = baseX + Math.cos(angle - Math.PI / 2) * b, p2y = baseY + Math.sin(angle - Math.PI / 2) * b
      return `<line x1="${start.x}" y1="${start.y}" x2="${lineEndX}" y2="${lineEndY}" stroke="#374151" stroke-width="1.5"/>
<polygon points="${end.x},${end.y} ${p1x},${p1y} ${p2x},${p2y}" fill="#374151"/>`
    }).join('\n')

    const nodesStr = flowNodes.map(node => {
      const cfg = NODE_CONFIG[node.type]
      const lines = wrapText(node.label)
      const lineH = 16
      const textH = lines.length * lineH
      const textStartY = node.y + NODE_H / 2 - textH / 2 + lineH / 2
      const textEls = lines.map((line, i) =>
        `<text x="${node.x + NODE_W / 2}" y="${textStartY + i * lineH}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" fill="${cfg.textColor}">${line}</text>`
      ).join('\n')

      let shapeEl = ''
      if (cfg.shape === 'circle') {
        shapeEl = `<ellipse cx="${node.x + NODE_W / 2}" cy="${node.y + NODE_H / 2}" rx="${NODE_W / 2}" ry="${NODE_H / 2}" fill="${cfg.fill}" stroke="${cfg.stroke}" stroke-width="1.5"/>`
      } else if (cfg.shape === 'parallelogram') {
        const sk = 16
        shapeEl = `<polygon points="${node.x + sk},${node.y} ${node.x + NODE_W},${node.y} ${node.x + NODE_W - sk},${node.y + NODE_H} ${node.x},${node.y + NODE_H}" fill="${cfg.fill}" stroke="${cfg.stroke}" stroke-width="1.5"/>`
      } else if (cfg.shape === 'diamond') {
        const mx = node.x + NODE_W / 2, my = node.y + NODE_H / 2
        shapeEl = `<polygon points="${mx},${node.y} ${node.x + NODE_W},${my} ${mx},${node.y + NODE_H} ${node.x},${my}" fill="${cfg.fill}" stroke="${cfg.stroke}" stroke-width="1.5"/>`
      } else if (cfg.shape === 'triangle') {
        shapeEl = `<polygon points="${node.x + NODE_W / 2},${node.y + 4} ${node.x + NODE_W - 4},${node.y + NODE_H - 4} ${node.x + 4},${node.y + NODE_H - 4}" fill="${cfg.fill}" stroke="${cfg.stroke}" stroke-width="1.5"/>`
      } else {
        shapeEl = `<rect x="${node.x}" y="${node.y}" width="${NODE_W}" height="${NODE_H}" rx="6" fill="${cfg.fill}" stroke="${cfg.stroke}" stroke-width="1.5"/>`
      }
      return shapeEl + '\n' + textEls
    }).join('\n')

    w.document.write(`<!DOCTYPE html><html><head><title>${flow.name}</title>
    <style>
      @page { margin: 15mm; size: A4 landscape; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #111; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 16px; }
      .header .title { font-size: 18px; font-weight: 700; }
      .header .meta { text-align: right; font-size: 11px; color: #6b7280; }
      .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
      .meta-item { background: #f9fafb; border-radius: 6px; padding: 8px 12px; }
      .meta-item .label { font-size: 10px; color: #9ca3af; margin-bottom: 2px; }
      .meta-item .value { font-size: 12px; font-weight: 600; color: #111; }
      .diagram { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; }
      .footer { margin-top: 12px; padding-top: 10px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
    </style></head><body>
    <div class="header">
      <div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:2px">FLOWDIAGRAM · AiQMS</div>
        <div class="title">${flow.name}</div>
      </div>
      <div class="meta">
        <div>Version ${flow.version || 1}</div>
        <div style="margin-top:2px">${flow.data?.nodes?.length || 0} elementer</div>
      </div>
    </div>
    <div class="meta-grid">
      <div class="meta-item"><div class="label">Oprettet</div><div class="value">${flow.created_at ? new Date(flow.created_at).toLocaleDateString('da-DK') : '—'}</div></div>
      <div class="meta-item"><div class="label">Sidst redigeret</div><div class="value">${new Date(flow.updated_at).toLocaleDateString('da-DK')}</div></div>
      <div class="meta-item"><div class="label">Version</div><div class="value">${flow.version || 1}</div></div>
      <div class="meta-item"><div class="label">Næste revision</div><div class="value">${flow.naeste_revision ? new Date(flow.naeste_revision).toLocaleDateString('da-DK') : '—'}</div></div>
    </div>
    <svg class="diagram" viewBox="${vbStr}" preserveAspectRatio="xMidYMid meet" style="max-height:400px">
      ${edgesStr}
      ${nodesStr}
    </svg>
    <div class="footer">
      <span>${flow.name} · Version ${flow.version || 1}</span>
      <span>Udskrevet ${new Date().toLocaleDateString('da-DK')}</span>
    </div>
    </body></html>`)
    w.document.close()
    w.print()
  }

  const selectedNode = nodes.find(n => n.id === selected)

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-sm text-gray-400">Indlæser...</div></div>

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
          <button onClick={() => {
            const cur = savedFlows.find(f => f.id === currentFlowId)
            setSaveName(currentFlowName)
            setSaveNaestRevision(cur?.naeste_revision || '')
            setShowSaveModal(true)
          }} className="text-xs px-4 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700">Gem flow</button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-52 bg-white border-r border-gray-100 p-4 flex flex-col gap-4 flex-shrink-0 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tilføj element</p>
            <div className="flex flex-col gap-1.5">
              {(Object.keys(NODE_CONFIG) as NodeType[]).map(type => (
                <button key={type} onClick={() => addNode(type)}
                  className="text-xs px-3 py-2 rounded-lg border text-left font-medium hover:opacity-80 transition-opacity flex items-center gap-2"
                  style={{ backgroundColor: '#f9fafb', borderColor: NODE_CONFIG[type].stroke, color: NODE_CONFIG[type].textColor }}>
                  <ShapeIcon type={type} />
                  {NODE_CONFIG[type].label}
                </button>
              ))}
            </div>
          </div>

          {selectedNode && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Valgt</p>
              <div className="text-xs px-3 py-2 rounded-lg border font-medium mb-3 flex items-center gap-2"
                style={{ borderColor: NODE_CONFIG[selectedNode.type].stroke, color: NODE_CONFIG[selectedNode.type].textColor }}>
                <ShapeIcon type={selectedNode.type} />
                {selectedNode.label}
              </div>
              <div className="flex flex-col gap-1.5">
                <button onClick={() => setConnecting(selected)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${connecting === selected ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {connecting === selected ? '→ Klik på mål...' : '→ Forbind til...'}
                </button>
                <button onClick={deleteSelected} className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">🗑 Slet element</button>
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

        <div className="flex-1 overflow-auto bg-gray-100">
          <svg ref={canvasRef} width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            onClick={handleCanvasClick} className="block" style={{ cursor: connecting ? 'crosshair' : 'default' }}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />
            <Legend />
            {edges.map(edge => {
              const fromNode = nodes.find(n => n.id === edge.from)
              const toNode = nodes.find(n => n.id === edge.to)
              if (!fromNode || !toNode) return null
              return renderEdge(fromNode, toNode, edge.id, edge.label)
            })}
            {nodes.map(node => {
              const isSelected = selected === node.id
              const isConnecting = connecting === node.id
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}
                  onClick={e => handleNodeClick(e, node.id)}
                  onMouseDown={e => onMouseDown(e, node.id)}
                  onDoubleClick={e => startEditLabel(e, node)}
                  style={{ cursor: dragging?.id === node.id ? 'grabbing' : 'grab' }}>
                  {editLabel?.id === node.id ? (
                    <>
                      <rect width={NODE_W} height={NODE_H} rx="6" fill="white" stroke="#0ea5e9" strokeWidth="2" />
                      <foreignObject x="4" y="4" width={NODE_W - 8} height={NODE_H - 8}>
                        <input
                          // @ts-ignore
                          xmlns="http://www.w3.org/1999/xhtml"
                          autoFocus value={editLabel.value}
                          onChange={e => setEditLabel(prev => prev ? { ...prev, value: e.target.value } : null)}
                          onBlur={commitLabel}
                          onKeyDown={e => { if (e.key === 'Enter') commitLabel() }}
                          style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', fontSize: '12px', fontWeight: 600, color: '#111827', textAlign: 'center', outline: 'none' }} />
                      </foreignObject>
                    </>
                  ) : renderShape(node, isSelected, isConnecting)}
                </g>
              )
            })}
            {nodes.length === 0 && (
              <text x={CANVAS_W / 2} y={400} textAnchor="middle" fontSize="14" fill="#9ca3af">
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
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Navn på flow</label>
                <input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveFlow() }}
                  placeholder="F.eks. Modtagekontrol, Pasteurisering..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Næste revisionsdato</label>
                <input type="date" value={saveNaestRevision} onChange={e => setSaveNaestRevision(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => setShowSaveModal(false)} className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Annuller</button>
              <button onClick={saveFlow} disabled={saving || !saveName.trim()} className="text-xs px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Gemmer...' : 'Gem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOWS LIST MODAL */}
      {showFlowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowFlowModal(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Mine flows</h2>
              <button onClick={() => setShowFlowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {savedFlows.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">Ingen gemte flows endnu</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedFlows.map(flow => {
                    const overdue = flow.naeste_revision && new Date(flow.naeste_revision) < new Date()
                    return (
                      <div key={flow.id}
                        className={`flex items-center justify-between px-4 py-3 border rounded-xl hover:shadow-sm transition-all ${currentFlowId === flow.id ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 hover:border-gray-200'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-800">{flow.name}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">v{flow.version || 1}</span>
                            {overdue && <span className="text-xs text-red-500">⚠️ Revision overskredet</span>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span>📅 Oprettet: {flow.created_at ? new Date(flow.created_at).toLocaleDateString('da-DK') : '—'}</span>
                            <span>✏️ Redigeret: {new Date(flow.updated_at).toLocaleDateString('da-DK')}</span>
                            {flow.naeste_revision && <span className={overdue ? 'text-red-500' : ''}>🔄 Næste revision: {new Date(flow.naeste_revision).toLocaleDateString('da-DK')}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <button onClick={() => { setShowPreview(flow); setShowFlowModal(false) }}
                            className="text-xs px-2.5 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                            👁 Preview
                          </button>
                          <button onClick={() => loadFlow(flow)}
                            className="text-xs px-2.5 py-1 border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50">
                            Åbn
                          </button>
                          <button onClick={e => deleteFlow(flow.id, e)}
                            className="text-xs px-2.5 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                            Slet
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowPreview(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{showPreview.name}</h2>
                <span className="text-xs text-gray-400">Version {showPreview.version || 1} · {showPreview.data?.nodes?.length || 0} elementer</span>
              </div>
              <button onClick={() => setShowPreview(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {/* Meta info */}
            <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b border-gray-100">
              {[
                { label: 'Oprettet', value: showPreview.created_at ? new Date(showPreview.created_at).toLocaleDateString('da-DK') : '—' },
                { label: 'Sidst redigeret', value: new Date(showPreview.updated_at).toLocaleDateString('da-DK') },
                { label: 'Version', value: `v${showPreview.version || 1}` },
                { label: 'Næste revision', value: showPreview.naeste_revision ? new Date(showPreview.naeste_revision).toLocaleDateString('da-DK') : '—' },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                  <div className="text-sm font-semibold text-gray-800">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Preview SVG */}
            <div className="px-6 py-4" style={{ height: '400px' }}>
              <FlowPreview data={showPreview.data} />
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
              <button onClick={() => printFlow(showPreview)}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                🖨️ Print diagram
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowPreview(null)}
                  className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Luk</button>
                <button onClick={() => loadFlow(showPreview)}
                  className="text-xs px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                  Åbn og rediger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
