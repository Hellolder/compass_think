from fastapi import FastAPI, WebSocket
from cognitive_graph import CognitiveGraph
from gpt_agent import ask_gpt
from chatgpt import GPTClient
import json
import traceback

app = FastAPI()
graph = CognitiveGraph()


client = GPTClient(
        api_key="d8369e3c-fdfd-460c-8564-bb1ffe07700e",
        model_or_deployment="deepseek-v3-1-250821",
        mode="openai",
        api_base="https://ark.cn-beijing.volces.com/api/v3/",
)


@app.websocket("/ws/chat")
async def chat_ws(ws: WebSocket):
    await ws.accept()

    while True:
        raw_message = await ws.receive_text()

        # 尝试解析 JSON，如果失败则当作纯文本问题
        try:
            message_data = json.loads(raw_message)
            question = message_data.get("question", raw_message)
            current_node_id = message_data.get("current_node_id")
        except json.JSONDecodeError:
            # 兼容旧格式：纯文本
            question = raw_message
            current_node_id = None

        # 处理不同的消息类型
        if message_data.get("type") == "add_node":
            # 前端请求添加节点
            label = message_data.get("label", "")
            parent_id = message_data.get("parent_id")

            if label and parent_id:
                # 创建新节点
                new_node = graph.add_node(label=label, parent=parent_id)

                # 返回节点信息给前端
                await ws.send_json({
                    "type": "graph_update",
                    "payload": {
                        "action": "add_node",
                        "node": {
                            "id": new_node.id,
                            "label": new_node.label,
                            "parent": new_node.parent,
                            "depth": new_node.depth
                        }
                    }
                })
            continue

        elif message_data.get("type") == "delete_node":
            # 前端请求删除节点
            node_id = message_data.get("node_id")

            if node_id and node_id != "A":  # 不允许删除根节点
                # 删除节点及其所有子节点
                nodes_to_delete = []
                edges_to_delete = []

                def collect_nodes_to_delete(current_id):
                    if current_id in graph.nodes:
                        nodes_to_delete.append(current_id)
                        # 递归删除子节点
                        for node_id, node in graph.nodes.items():
                            if node.parent == current_id:
                                collect_nodes_to_delete(node_id)

                collect_nodes_to_delete(node_id)

                # 从图中删除节点
                for node_id in nodes_to_delete:
                    if node_id in graph.nodes:
                        del graph.nodes[node_id]

                # 发送删除通知给前端
                for deleted_node_id in nodes_to_delete:
                    await ws.send_json({
                        "type": "graph_update",
                        "payload": {
                            "action": "delete_node",
                            "node_id": deleted_node_id
                        }
                    })
            continue

        elif message_data.get("type") == "update_node":
            # 前端请求更新节点
            node_id = message_data.get("node_id")
            new_label = message_data.get("label", "")

            if node_id and new_label and node_id in graph.nodes:
                graph.nodes[node_id].label = new_label

                # 发送更新通知给前端
                await ws.send_json({
                    "type": "graph_update",
                    "payload": {
                        "action": "update_node",
                        "node": {
                            "id": node_id,
                            "label": new_label,
                            "parent": graph.nodes[node_id].parent,
                            "depth": graph.nodes[node_id].depth
                        }
                    }
                })
            continue

        # 处理普通的问答消息
        try:
            result = await ask_gpt(question, graph, client, current_node_id=current_node_id)
        except Exception as e:
            # 把后端错误返回给前端，方便定位"模型没返回/调用失败/解析失败"等问题
            await ws.send_json({
                "type": "error",
                "message": str(e),
                "traceback": traceback.format_exc()
            })
            continue

        # 1️⃣ 发回答
        await ws.send_json({
            "type": "chat",
            "answer": result["answer"]
        })

        # 2️⃣ 发多个图更新
        for update in result["graph_updates"]:
            await ws.send_json({
                "type": "graph_update",
                "payload": {
                    "action": "add_node",
                    "node": update
                }
            })


'''
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
'''