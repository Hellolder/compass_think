import time
from openai import AsyncAzureOpenAI, AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential
from typing import Literal, Optional
import asyncio
from transformers import AutoTokenizer
import random
import json

class GPTClient:
    def __init__(
        self,
        api_key: str,
        model_or_deployment: str,
        mode: Literal["azure", "openai"] = "openai",
        api_base: Optional[str] = None,
        api_version: Optional[str] = None,
    ):
        self.mode = mode
        self.model_or_deployment = model_or_deployment

        if mode == "azure":
            if not api_base or not api_version:
                raise ValueError("Azure mode requires `api_base` and `api_version`.")
            self.client = AsyncAzureOpenAI(
                api_key=api_key,
                api_version=api_version,
                azure_endpoint=api_base,
            )
        else:
            self.client = AsyncOpenAI(
                api_key=api_key,
                base_url=api_base or "https://api.openai.com/v1"
            )

    def chat(self, system_prompt, user_input):
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ]
        response = self.client.chat.completions.create(
            model=self.model_or_deployment,
            messages=messages,
            temperature=0.7,
            max_tokens=512,
        )
        response_content = response.choices[0].message.content
        output_tokens = response.usage.completion_tokens
        input_tokens = response.usage.prompt_tokens

        return response_content, input_tokens, output_tokens

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def chat_async(self, system_prompt, user_input):
        t1 = time.time()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ]
        response = await self.client.chat.completions.create(
            model=self.model_or_deployment,
            messages=messages,
            temperature=0,
            top_p=0.1,
            max_tokens=16384
        )
        
        response_content = response.choices[0].message.content
        output_tokens = response.usage.completion_tokens
        input_tokens = response.usage.prompt_tokens
        t2 = time.time()
        print(f"耗时：{t2-t1}s")
        return response_content, input_tokens, output_tokens
    
    