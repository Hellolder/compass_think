# Cognitive Graph Q&A System (Fullstack)

> Python 后端 + ReactFlow 前端，实现 **问答即生成动态认知树**

---

## 一、项目结构

```
cognitive-graph/
├── backend/
│   ├── main.py
│   ├── cognitive_graph.py
│   ├── gpt_agent.py
│   └── requirements.txt
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── components/
            └── CognitiveGraphChat.jsx
```

---

## 二、Backend（Python / FastAPI）

### backend/requirements.txt

```txt
fastapi
uvicorn
pydantic
```

### backend/cognitive_graph.py

```python
from typing import Dict, List, Optional
from pydantic import BaseModel

class CognitiveNode(BaseModel):
    id: str
    label: str
    parent: Optional[str]
    depth: int
    children: List[str] = []

class CognitiveGraph:
    def __init__(self):
        self.nodes: Dict[str, CognitiveNode] = {
            'A': CognitiveNode(id='A', label='ROOT 问题', parent=None, depth=0, children=[])
        }
        self.current_node = 'A'

    def add_node(self, label: str) -> CognitiveNode:
        parent = self.current_node
        depth = self.nodes[parent].depth + 1
        node_id = f"{parent}.{len(self.nodes[parent].children)+1}"

        node = CognitiveNode(
            id=node_id,
            label=label,
            parent=parent,
            depth=depth,
            children=[]
        )
        self.nodes[node_id] = node
        self.nodes[parent].children.append(node_id)
        self.current_node = node_id
        return node
```

### backend/gpt_agent.py

```python
from cognitive_graph import CognitiveGraph

def ask_gpt(question: str, graph: CognitiveGraph):
    # ⚠️ 真实场景这里接 OpenAI / Azure / 本地模型
    answer = f"这是对问题『{question}』的解释"

    node = graph.add_node(question)

    return {
        'answer': answer,
        'graph_update': {
            'action': 'add_node',
            'node': {
                'id': node.id,
                'label': node.label,
                'parent': node.parent,
                'depth': node.depth
            }
        }
    }
```

### backend/main.py

```python
from fastapi import FastAPI, WebSocket
from cognitive_graph import CognitiveGraph
from gpt_agent import ask_gpt

app = FastAPI()
graph = CognitiveGraph()

@app.websocket('/ws/chat')
async def chat_ws(ws: WebSocket):
    await ws.accept()
    while True:
        question = await ws.receive_text()
        result = ask_gpt(question, graph)

        await ws.send_json({
            'type': 'chat',
            'answer': result['answer']
        })

        await ws.send_json({
            'type': 'graph_update',
            'payload': result['graph_update']
        })
```

### 启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## 三、Frontend（React + ReactFlow）

### frontend/package.json

```json
{
  "name": "cognitive-graph-frontend",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "reactflow": "^11.10.0"
  }
}
```

### frontend/vite.config.js

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

### frontend/src/main.jsx

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
```

### frontend/src/App.jsx

```jsx
import CognitiveGraphChat from './components/CognitiveGraphChat'

export default function App() {
  return <CognitiveGraphChat />
}
```

### frontend/src/components/CognitiveGraphChat.jsx

```jsx
import React, { useEffect, useState, useCallback } from 'react'
import ReactFlow, { useNodesState, useEdgesState, Background, Controls } from 'reactflow'
import 'reactflow/dist/style.css'

const initialNodes = [
  { id: 'A', data: { label: 'ROOT 问题' }, position: { x: 0, y: 0 }, style: { fontWeight: 'bold' } }
]

export default function CognitiveGraphChat() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

  const wsRef = React.useRef(null)

  useEffect(() => {
    wsRef.current = new WebSocket('ws://localhost:8000/ws/chat')
    wsRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'chat') {
        setMessages(m => [...m, { role: 'assistant', content: msg.answer }])
      }
      if (msg.type === 'graph_update') {
        applyGraphUpdate(msg.payload)
      }
    }
  }, [])

  const applyGraphUpdate = useCallback((update) => {
    if (update.action !== 'add_node') return
    setNodes(nds => [...nds, {
      id: update.node.id,
      data: { label: update.node.label },
      position: { x: Math.random()*600, y: Math.random()*400 },
      style: { border: update.node.depth >= 3 ? '2px solid red' : '1px solid #999' }
    }])

    setEdges(eds => [...eds, {
      id: `${update.node.parent}-${update.node.id}`,
      source: update.node.parent,
      target: update.node.id
    }])
  }, [])

  const send = () => {
    wsRef.current.send(input)
    setMessages(m => [...m, { role: 'user', content: input }])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '30%', padding: 12 }}>
        {messages.map((m, i) => <div key={i}><b>{m.role}:</b> {m.content}</div>)}
        <input value={input} onChange={e => setInput(e.target.value)} />
        <button onClick={send}>发送</button>
      </div>
      <div style={{ flex: 1 }}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
```

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

---

## 四、你已经具备的能力

- Python = **认知状态机 + meta-cognition 核心**
- ReactFlow = **实时思维可视化窗口**
- WebSocket = **对话即结构生长**

> 这不是 Demo，这是一个 **可扩展的认知系统原型**
