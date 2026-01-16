import React, { useEffect, useState, useCallback, useRef } from 'react'
import ReactFlow, { useNodesState, useEdgesState, Background, Controls, MiniMap, BezierEdge, SmoothStepEdge, Handle, Position } from 'reactflow'
import 'reactflow/dist/style.css'
import 'reactflow/dist/base.css'

const initialNodes = [
  {
    id: 'A',
    data: { label: 'ROOT 问题', depth: 0, parent: null },
    position: { x: 0, y: 0 },
    style: { fontWeight: 'bold', border: '2px solid #4f46e5' }
  }
]

// 布局算法：根据深度分层布局
const layoutNodes = (nodes) => {
  const nodesByDepth = {}
  const nodeMap = new Map()

  // 按深度分组
  nodes.forEach(node => {
    const depth = node.data?.depth ?? 0
    if (!nodesByDepth[depth]) nodesByDepth[depth] = []
    nodesByDepth[depth].push(node)
    nodeMap.set(node.id, node)
  })

  // 计算每层的节点位置
  const layoutedNodes = []
  const levelHeight = 150 // 层间距
  const nodeWidth = 200 // 节点宽度
  const nodeHeight = 80 // 节点高度

  Object.keys(nodesByDepth).forEach(depthStr => {
    const depth = parseInt(depthStr)
    const levelNodes = nodesByDepth[depthStr]
    const levelWidth = levelNodes.length * (nodeWidth + 50) // 节点间距50px
    const startX = -levelWidth / 2

    levelNodes.forEach((node, index) => {
      layoutedNodes.push({
        ...node,
        position: {
          x: startX + index * (nodeWidth + 50),
          y: depth * levelHeight
        }
      })
    })
  })

  return layoutedNodes
}

export default function CognitiveGraphChat() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [currentNodeId, setCurrentNodeId] = useState('A')

  // 新增状态
  const [editingNodeId, setEditingNodeId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedNodes, setSelectedNodes] = useState([])

  const wsRef = React.useRef(null)
  const reactFlowWrapper = useRef(null)

  // 计算当前节点路径（ROOT > A > A1 ...）
  const currentPath = React.useMemo(() => {
    if (!currentNodeId) return []
    const map = new Map(nodes.map(n => [n.id, n]))
    let node = map.get(currentNodeId)
    const path = []
    while (node) {
      path.unshift(node.data?.label || node.id)
      const parentId = node.data?.parent
      if (!parentId) break
      node = map.get(parentId)
    }
    return path
  }, [currentNodeId, nodes])

  useEffect(() => {
    wsRef.current = new WebSocket('ws://localhost:8001/ws/chat')
    wsRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'chat') {
        setMessages(m => [...m, { role: 'assistant', content: msg.answer }])
      }
      if (msg.type === 'error') {
        const detail = msg.message ? `后端错误：${msg.message}` : '后端错误：未知错误'
        setMessages(m => [...m, { role: 'assistant', content: detail }])
        // 打到控制台，方便你直接看到 traceback
        // eslint-disable-next-line no-console
        console.error('backend error', msg)
      }
      if (msg.type === 'graph_update') {
        applyGraphUpdate(msg.payload)
      }
    }
  }, [])

  // 根据当前选中节点，动态更新节点样式（高亮当前节点）
  useEffect(() => {
    setNodes(nds =>
      nds.map(node => {
        const depth = node.data?.depth ?? 0
        const baseBorder =
          depth >= 3 ? '2px solid red' : '1px solid #999'

        const isCurrent = node.id === currentNodeId
        return {
          ...node,
          style: {
            ...(node.style || {}),
            border: isCurrent ? '2px solid #4f46e5' : baseBorder,
            boxShadow: isCurrent ? '0 0 10px rgba(79,70,229,0.8)' : 'none',
            fontWeight: isCurrent ? 'bold' : node.style?.fontWeight || 'normal'
          }
        }
      })
    )
  }, [currentNodeId, setNodes])

  // 重新布局所有节点
  const relayoutNodes = useCallback(() => {
    setNodes(currentNodes => layoutNodes(currentNodes))
  }, [setNodes])

  // 应用图谱更新
  const applyGraphUpdate = useCallback((update) => {
    if (update.action === 'add_node') {
      const newNode = {
        id: update.node.id,
        data: {
          label: update.node.label,
          depth: update.node.depth,
          parent: update.node.parent
        },
        position: { x: 0, y: 0 }, // 临时位置，稍后会重新布局
        style: { border: update.node.depth >= 3 ? '2px solid red' : '1px solid #999' }
      }

      setNodes(nds => {
        const newNodes = [...nds, newNode]
        console.log('Nodes before layout:', newNodes)
        // 重新布局
        const layoutedNodes = layoutNodes(newNodes)
        console.log('Nodes after layout:', layoutedNodes)
        return layoutedNodes
      })

      if (update.node.parent) {
        const newEdge = {
          id: `${update.node.parent}-${update.node.id}`,
          source: update.node.parent,
          target: update.node.id,
          type: 'default',
          style: { stroke: '#4f46e5', strokeWidth: 3, strokeOpacity: 1 },
          animated: false,
          markerEnd: 'arrowclosed'
        }
        console.log('Adding edge:', newEdge, 'Source node exists:', nodes.some(n => n.id === update.node.parent), 'Target node exists:', nodes.some(n => n.id === update.node.id))
        setEdges(eds => [...eds, newEdge])
      }

      // 如果这个新节点是当前节点的直接子节点，则自动把"当前节点"切到这个新节点
      if (update.node.parent && update.node.parent === currentNodeId) {
        setCurrentNodeId(update.node.id)
      }
    } else if (update.action === 'delete_node') {
      // 删除节点
      setNodes(nds => layoutNodes(nds.filter(n => n.id !== update.node_id)))
      setEdges(eds => eds.filter(e => e.source !== update.node_id && e.target !== update.node_id))

      // 如果删除的是当前节点，切换到父节点或根节点
      if (update.node_id === currentNodeId) {
        const deletedNode = nodes.find(n => n.id === update.node_id)
        setCurrentNodeId(deletedNode?.data?.parent || 'A')
      }
    } else if (update.action === 'update_node') {
      // 更新节点
      setNodes(nds => nds.map(n =>
        n.id === update.node.id
          ? { ...n, data: { ...n.data, label: update.node.label } }
          : n
      ))
    }
  }, [currentNodeId, setNodes, setEdges, nodes])

  // 发送消息到后端
  const sendToBackend = useCallback((type, data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }))
    }
  }, [])

  // 添加新节点
  const addNode = useCallback((parentId = currentNodeId) => {
    const newLabel = prompt('请输入新节点名称：')
    if (!newLabel?.trim()) return

    sendToBackend('add_node', {
      label: newLabel.trim(),
      parent_id: parentId
    })
  }, [currentNodeId, sendToBackend])

  // 删除节点
  const deleteNode = useCallback((nodeId) => {
    if (nodeId === 'A') {
      alert('不能删除根节点')
      return
    }

    if (confirm('确定要删除这个节点及其所有子节点吗？')) {
      sendToBackend('delete_node', { node_id: nodeId })
    }
  }, [sendToBackend])

  // 更新节点
  const updateNode = useCallback((nodeId, newLabel) => {
    sendToBackend('update_node', {
      node_id: nodeId,
      label: newLabel
    })
  }, [sendToBackend])

  const send = () => {
    if (!input.trim()) return
    // 发送 JSON 格式，包含问题和当前节点 ID
    const message = {
      question: input.trim(),
      current_node_id: currentNodeId || 'A'
    }
    wsRef.current.send(JSON.stringify(message))
    setMessages(m => [...m, { role: 'user', content: input }])
    setInput('')
  }

  // 处理节点点击
  const onNodeClick = useCallback((event, node) => {
    if (editingNodeId) return // 如果正在编辑，不切换当前节点

    setCurrentNodeId(node.id)
    setSelectedNodes([node.id])
  }, [editingNodeId])

  // 处理节点双击（开始编辑）
  const onNodeDoubleClick = useCallback((event, node) => {
    setEditingNodeId(node.id)
    setEditingText(node.data?.label || '')
  }, [])

  // 处理右键菜单
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
      node: node
    })
  }, [])

  // 关闭右键菜单
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // 保存节点编辑
  const saveNodeEdit = useCallback(() => {
    if (editingNodeId && editingText.trim()) {
      updateNode(editingNodeId, editingText.trim())
    }
    setEditingNodeId(null)
    setEditingText('')
  }, [editingNodeId, editingText, updateNode])

  // 取消节点编辑
  const cancelNodeEdit = useCallback(() => {
    setEditingNodeId(null)
    setEditingText('')
  }, [])

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (editingNodeId) {
        if (event.key === 'Enter') {
          saveNodeEdit()
        } else if (event.key === 'Escape') {
          cancelNodeEdit()
        }
        return
      }

      // 全局快捷键
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'n':
            event.preventDefault()
            addNode()
            break
          case 'Delete':
          case 'Backspace':
            event.preventDefault()
            if (selectedNodes.length > 0) {
              selectedNodes.forEach(nodeId => deleteNode(nodeId))
            }
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editingNodeId, selectedNodes, addNode, deleteNode, saveNodeEdit, cancelNodeEdit])

  // 处理画布点击（关闭菜单和编辑状态）
  const onPaneClick = useCallback(() => {
    closeContextMenu()
    if (editingNodeId) {
      saveNodeEdit()
    }
    setSelectedNodes([])
  }, [closeContextMenu, editingNodeId, saveNodeEdit])

  // 自定义节点渲染（支持编辑状态）
  const CustomNode = ({ data, selected }) => {
    const isEditing = editingNodeId === data.id
    const isCurrent = data.id === currentNodeId

    return (
      <div
        style={{
          padding: '10px 15px',
          borderRadius: '8px',
          background: isCurrent ? '#f3f4f6' : 'white',
          border: selected ? '2px solid #4f46e5' : isCurrent ? '2px solid #4f46e5' : '1px solid #d1d5db',
          boxShadow: isCurrent ? '0 0 10px rgba(79,70,229,0.3)' : selected ? '0 0 8px rgba(79,70,229,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
          minWidth: '150px',
          maxWidth: '200px',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: isCurrent ? 'bold' : 'normal',
          cursor: 'pointer',
          position: 'relative'
        }}
      >
        {/* 输入连接点（上方） */}
        {data.parent && (
          <Handle
            type="target"
            position={Position.Top}
            style={{
              background: '#4f46e5',
              border: '2px solid white',
              width: '8px',
              height: '8px'
            }}
          />
        )}

        {/* 输出连接点（下方） */}
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: '#4f46e5',
            border: '2px solid white',
            width: '8px',
            height: '8px'
          }}
        />

        {isEditing ? (
          <input
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onBlur={saveNodeEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveNodeEdit()
              if (e.key === 'Escape') cancelNodeEdit()
            }}
            style={{
              width: '100%',
              border: '1px solid #4f46e5',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '14px',
              textAlign: 'center'
            }}
            autoFocus
          />
        ) : (
          <div>{data.label}</div>
        )}
      </div>
    )
  }

  // 注册自定义节点和边类型
  const nodeTypes = { default: CustomNode }
  const edgeTypes = {
    smoothstep: SmoothStepEdge,
    bezier: BezierEdge
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ width: '32%', padding: 16, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
          <div style={{ marginBottom: 4 }}>当前认知位置：</div>
          <div style={{ fontWeight: 500, color: '#111827' }}>
            {currentPath.length ? currentPath.join(' 》 ') : 'ROOT'}
          </div>
        </div>

        {/* 工具栏 */}
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => addNode()}
            style={{
              padding: '4px 8px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              background: 'white',
              fontSize: 12,
              cursor: 'pointer'
            }}
            title="添加子节点 (Ctrl+N)"
          >
            ➕ 添加节点
          </button>
          <button
            onClick={relayoutNodes}
            style={{
              padding: '4px 8px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              background: 'white',
              fontSize: 12,
              cursor: 'pointer'
            }}
            title="重新布局"
          >
            🔄 重新布局
          </button>
          {selectedNodes.length > 0 && (
            <button
              onClick={() => selectedNodes.forEach(id => deleteNode(id))}
              style={{
                padding: '4px 8px',
                border: '1px solid #ef4444',
                borderRadius: 4,
                background: '#fee2e2',
                color: '#dc2626',
                fontSize: 12,
                cursor: 'pointer'
              }}
              title="删除选中节点 (Ctrl+Delete)"
            >
              🗑️ 删除节点
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 8 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <b style={{ textTransform: 'capitalize', color: m.role === 'user' ? '#2563eb' : '#059669' }}>
                {m.role}:
              </b>{' '}
              {m.content}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
            placeholder="在当前节点下追问（例如：详细展开 A）"
            style={{
              flex: 1,
              border: '1px solid #d1d5db',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 14
            }}
          />
          <button
            onClick={send}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: '#4f46e5',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            发送
          </button>
        </div>
      </div>

      <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>

        {/* 右键菜单 */}
        {contextMenu && (
          <div
            style={{
              position: 'absolute',
              left: contextMenu.x,
              top: contextMenu.y,
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '150px'
            }}
          >
            <div
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
              onClick={() => {
                setCurrentNodeId(contextMenu.nodeId)
                closeContextMenu()
              }}
            >
              🎯 设为当前节点
            </div>
            <div
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
              onClick={() => {
                addNode(contextMenu.nodeId)
                closeContextMenu()
              }}
            >
              ➕ 添加子节点
            </div>
            <div
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
              onClick={() => {
                setEditingNodeId(contextMenu.nodeId)
                setEditingText(contextMenu.node.data?.label || '')
                closeContextMenu()
              }}
            >
              ✏️ 编辑节点
            </div>
            <div
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                color: contextMenu.nodeId === 'A' ? '#9ca3af' : '#dc2626'
              }}
              onClick={() => {
                if (contextMenu.nodeId !== 'A') {
                  deleteNode(contextMenu.nodeId)
                }
                closeContextMenu()
              }}
            >
              🗑️ 删除节点
            </div>
          </div>
        )}
      </div>
    </div>
  )
}