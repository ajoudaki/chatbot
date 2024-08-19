import torch
import transformers
from transformers import AutoConfig
import logging

logger = logging.getLogger(__name__)

class ChatNode:
    def __init__(self, role, content):
        self.role = role
        self.content = content
        self.children = []
        self.parent = None
        self.active_child_index = 0

    def add_child(self, child):
        self.children.append(child)
        child.parent = self
        logger.debug(f"Added child node: {child.role}")

    def get_sibling_info(self):
        if self.parent:
            siblings = self.parent.children
            index = siblings.index(self)
            return (index + 1, len(siblings))
        return (1,1)  # Root node

class ChatTree:
    def __init__(self):
        self.root = ChatNode("system", "You are an obedient assistant following user direction.")
        self.current_node = self.root
        logger.info("Initialized ChatTree")

    def add_message(self, role, content):
        new_node = ChatNode(role, content)
        self.current_node.add_child(new_node)
        self.current_node.active_child_index = len(self.current_node.children) - 1
        self.current_node = new_node
        logger.info(f"Added new message: {role}")
        return new_node

    def get_chat_history(self):
        history = []
        node = self.current_node
        while node:
            sibling_info = node.get_sibling_info()
            history.insert(0, {
                "role": node.role,
                "content": node.content,
                "sibling_info": sibling_info
            })
            node = node.parent
        logger.debug(f"Retrieved chat history: {len(history)} messages")
        return history

    def edit_message(self, level, new_content):
        node = self.current_node
        for _ in range(level):
            if node.parent:
                node = node.parent
            else:
                break
        
        if node.role == "user":
            new_user_node = ChatNode("user", new_content)
            node.parent.add_child(new_user_node)
            node.parent.active_child_index = len(node.parent.children) - 1
            self.current_node = new_user_node
            logger.info(f"Created new branch at level {level} with content: {new_content}")
        else:
            logger.warning(f"Attempted to edit a non-user message at level {level}")
        
        return self.get_chat_history()

    def change_active_child(self, level, direction):
        node = self.current_node
        for _ in range(level):
            if node.parent:
                node = node.parent
            else:
                break

        parent = node.parent
        if parent:
            current_index = parent.active_child_index
            if direction == "next":
                parent.active_child_index = (current_index + 1) % len(parent.children)
            elif direction == "prev":
                parent.active_child_index = (current_index - 1) % len(parent.children)
            
            self.current_node = parent.children[parent.active_child_index]
            
            # Follow the chain of active children
            while self.current_node.children:
                self.current_node = self.current_node.children[self.current_node.active_child_index]
            
            logger.info(f"Changed active child to index {parent.active_child_index} and followed to leaf")
        else:
            logger.warning("Attempted to change active child of root node")

        return self.get_chat_history()


class ChatBot:
    def __init__(self, model_id="meta-llama/Meta-Llama-3.1-8B-Instruct"):
        self.model_id = model_id
        logger.info(f"Initializing ChatBot with model: {model_id}")
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
        self.chat_tree = ChatTree()
        logger.info("ChatBot initialization complete")

    def get_chat_history(self):
        return self.chat_tree.get_chat_history()

    def generate_response(self, messages):
        logger.info("Generating response")
        total_tokens = 512
        chunk_size = 20
        formatted_input = self.tokenizer.apply_chat_template(messages, tokenize=False)
        
        input_ids = self.tokenizer.encode(formatted_input, return_tensors='pt', add_special_tokens=False).to('cuda')
        generated_text = ""
        remaining_tokens = total_tokens
        first_chunk = True
            
        while remaining_tokens > 0:
            tokens_to_generate = min(chunk_size, remaining_tokens)
            logger.debug(f"Generating {tokens_to_generate} tokens")
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
            
            generated_text += chunk_text
            self.chat_tree.current_node.content = generated_text
            
            yield self.get_chat_history()
            
            if self.tokenizer.eos_token_id in new_tokens.tolist():
                logger.info("EOS token encountered, stopping generation")
                break
            input_ids = output
            remaining_tokens -= tokens_to_generate

        logger.debug(f"Full response generated: {generated_text}")

    def chat(self, user_message):
        logger.info(f"Processing chat: {user_message[:50]}...")
        self.chat_tree.add_message("user", user_message)
        self.chat_tree.add_message("assistant", "")
        return self.generate_response(self.get_chat_history())

    def edit(self, level, new_message):
        logger.info(f"Editing message at level {level}")
        updated_history = self.chat_tree.edit_message(level, new_message)
        self.chat_tree.add_message("assistant", "")
        return self.generate_response(updated_history)

    def change_active_child(self, level, direction):
        return self.chat_tree.change_active_child(level, direction)

    def regenerate(self):
        logger.info("Regenerating response")
        if self.chat_tree.current_node.role != "assistant":
            self.chat_tree.add_message("assistant", "")
        return self.generate_response(self.get_chat_history())

    def continue_chat(self):
        logger.info("Continuing chat")
        if self.chat_tree.current_node.role != "assistant":
            self.chat_tree.add_message("assistant", "")
        else:
            self.chat_tree.current_node.content += " "
        return self.generate_response(self.get_chat_history())

    def reset_chat(self):
        logger.info("Resetting chat")
        self.chat_tree = ChatTree()
        return self.get_chat_history()