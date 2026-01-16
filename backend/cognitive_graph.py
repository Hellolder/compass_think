import uuid

class CognitiveNode:
    def __init__(self, label, parent=None, depth=0):
        self.id = str(uuid.uuid4())
        self.label = label
        self.parent = parent
        self.depth = depth


class CognitiveGraph:
    def __init__(self):
        self.nodes = {}

    def add_node(self, label, parent=None, node_id=None):
        """
        添加节点
        :param label: 节点标签
        :param parent: 父节点 ID
        :param node_id: 可选的节点 ID（如果不提供则自动生成 UUID）
        """
        if parent and parent in self.nodes:
            depth = self.nodes[parent].depth + 1
        else:
            depth = 0
            parent = None

        node = CognitiveNode(
            label=label,
            parent=parent,
            depth=depth
        )
        # 如果指定了 node_id，使用指定的 ID
        if node_id:
            node.id = node_id
        self.nodes[node.id] = node
        return node

    def get_node(self, node_id):
        """根据 ID 获取节点"""
        return self.nodes.get(node_id)

    def get_path_to_node(self, node_id):
        """获取从根节点到指定节点的路径（节点列表）"""
        path = []
        current_id = node_id
        while current_id:
            node = self.nodes.get(current_id)
            if not node:
                break
            path.insert(0, node)
            current_id = node.parent
        return path