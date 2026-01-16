import asyncio

from chatgpt import GPTClient
from prompts import get_cognitive_prompt


async def main():
    client = GPTClient(
        api_key="d8369e3c-fdfd-460c-8564-bb1ffe07700e",
        model_or_deployment="deepseek-v3-1-250821",
        mode="openai",
        api_base="https://ark.cn-beijing.volces.com/api/v3/",
    )

    system_prompt = get_cognitive_prompt("这是一个连通性测试，不需要拆解节点。")

    try:
        resp, in_tok, out_tok = await client.chat_async(
            system_prompt=system_prompt,
            user_input="请只回答一个字：好",
        )
        print("SUCCESS")
        print("response snippet:", resp[:100])
        print("input_tokens:", in_tok, "output_tokens:", out_tok)
    except Exception as e:
        import traceback

        print("ERROR:", repr(e))
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())

