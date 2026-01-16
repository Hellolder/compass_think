from cognitive_graph import CognitiveGraph
from prompts import get_cognitive_prompt
import json
import re
from chatgpt import GPTClient

def extract_json_from_text(text: str):
    """从文本中提取 JSON（即使前后有额外文字）"""
    # 先尝试直接解析
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass
    
    # 尝试找到第一个 { ... } 块
    match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    
    # 如果都失败，返回 None
    return None

async def ask_gpt(question: str, graph: CognitiveGraph, client: GPTClient, current_node_id: str = None):
    # 处理根节点初始化：如果 current_node_id 是 'A' 但 graph 中没有，创建一个根节点
    if current_node_id == 'A' and not graph.get_node('A'):
        graph.add_node(label='ROOT 问题', parent=None, node_id='A')
    
    # 获取当前节点上下文
    context_info = ""
    if current_node_id:
        current_node = graph.get_node(current_node_id)
        if current_node:
            path = graph.get_path_to_node(current_node_id)
            path_labels = [n.label for n in path]
            context_info = f"""
当前认知上下文：
- 当前节点：{current_node.label}
- 路径：{' > '.join(path_labels)}
- 当前节点 ID：{current_node_id}

请在当前节点下继续拆解，新节点的 parent 应该设置为：{current_node_id}
"""
    
    system_prompt = get_cognitive_prompt(context_info)

    response_text, _, _ = await client.chat_async(
        system_prompt=system_prompt,
        user_input=question
    )

    # 改进的 JSON 解析：从文本中提取 JSON
    data = extract_json_from_text(response_text)
    
    if data is None:
        # 如果完全无法解析，降级处理
        data = {
            "answer": response_text,
            "nodes": []
        }

    # 如果没有 nodes，尝试至少生成一个节点
    if not data.get("nodes") and data.get("answer"):
        # 如果当前有节点上下文，至少生成一个子节点
        if current_node_id:
            data["nodes"] = [{
                "label": data.get("answer", question)[:50] + "...",
                "parent": current_node_id
            }]

    updates = []
    for node in data.get("nodes", []):
        # 如果节点没有指定 parent，且当前有上下文，则使用当前节点作为 parent
        parent = node.get("parent")
        if not parent and current_node_id:
            parent = current_node_id
        
        gnode = graph.add_node(
            label=node["label"],
            parent=parent
        )
        updates.append({
            "id": gnode.id,
            "label": gnode.label,
            "parent": gnode.parent,
            "depth": gnode.depth
        })
    return {
        "answer": data.get("answer", ""),
        "graph_updates": updates
    }
