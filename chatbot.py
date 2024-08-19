import torch
import transformers
from transformers import AutoConfig
import logging

logger = logging.getLogger(__name__)

class ChatBot:
    def __init__(self, model_id="meta-llama/Meta-Llama-3.1-8B-Instruct"):
        self.model_id = model_id
        self.config = AutoConfig.from_pretrained(model_id)
        self.config.use_flash_attention_2 = True
        self.pipeline = transformers.pipeline(
            "text-generation",
            config=self.config,
            model=self.model_id,
            model_kwargs={"torch_dtype": torch.bfloat16},
            device_map="auto",
        )
        self.model = self.pipeline.model
        self.tokenizer = self.pipeline.tokenizer
        self.chat_history = self.initialize_chat_history()

    def initialize_chat_history(self):
        return [
            {"role": "system", "content": "You are an obedient assistant following user direction."},
        ]

    def generate_response(self, messages):
        total_tokens = 512
        chunk_size = 20
        formatted_input = self.tokenizer.apply_chat_template(messages, tokenize=False)
        
        input_ids = self.tokenizer.encode(formatted_input, return_tensors='pt', add_special_tokens=False).to('cuda')
        generated_text = ""
        remaining_tokens = total_tokens
        first_chunk = True
            
        while remaining_tokens > 0:
            tokens_to_generate = min(chunk_size, remaining_tokens)
            with torch.no_grad():
                output = self.model.generate(
                    input_ids, 
                    max_new_tokens=tokens_to_generate, 
                    do_sample=True, 
                    pad_token_id=self.tokenizer.eos_token_id)
            
            new_tokens = output[0, input_ids.shape[1]:]
            chunk_text = self.tokenizer.decode(new_tokens, skip_special_tokens=True)
            
            if first_chunk:
                chunk_text = chunk_text.lstrip("assistant").lstrip()
                first_chunk = False
            
            logger.debug(f"Generated chunk: {chunk_text}")
            
            generated_text += chunk_text
            messages[-1]["content"] = generated_text
            
            yield messages  # Yield the updated messages for each chunk
            
            if self.tokenizer.eos_token_id in new_tokens.tolist():
                break
            input_ids = output
            remaining_tokens -= tokens_to_generate

        logger.debug(f"Full response streamed: {generated_text}")

    def handle_message(self, messages):
        if not messages:
            return

        self.chat_history = messages
        self.chat_history.append({"role": "assistant", "content": ""})
        return self.generate_response(self.chat_history)

    def handle_continue(self, messages):
        if not messages:
            return

        self.chat_history = messages
        if self.chat_history[-1]['role'] != 'assistant':
            self.chat_history.append({"role": "assistant", "content": ""})
        return self.generate_response(self.chat_history)

    def reset_chat(self):
        self.chat_history = self.initialize_chat_history()
        return self.chat_history