def get_cognitive_prompt(context_info: str = ""):
    """生成认知拆解提示词，可包含当前节点上下文"""
    base_prompt = """
你是一个认知拆解助手。

任务：
1. 回答用户问题
2. 同时将问题拆解为「认知节点」

{context}

输出格式必须是 JSON（不要输出多余文字，只输出 JSON）：

{{
  "answer": "给用户看的自然语言回答",
  "nodes": [
    {{
      "label": "子问题 / 子认知点",
      "parent": "父节点ID（如果有上下文，使用上下文中的当前节点ID）"
    }}
  ]
}}

重要规则：
- 必须输出 JSON 格式，不要有任何解释文字
- nodes 数组至少包含 1 个节点（即使问题很简单也要拆解）
- 如果提供了当前节点上下文，新节点的 parent 应该设置为当前节点 ID
- label 要简洁明确，描述一个子问题或子认知点
- 如果这是第一个问题（没有上下文），parent 可以为 null 或 "A"
"""
    
    if context_info:
        return base_prompt.format(context=context_info)
    else:
        return base_prompt.format(context="这是第一个问题，从根节点开始拆解。")