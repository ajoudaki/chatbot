import torch
import transformers
from transformers import AutoConfig
import logging
import json
import os
import uuid
from datetime import datetime

from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

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
        return (1, 1)  # Root node

    def to_dict(self):
        return {
            'role': self.role,
            'content': self.content,
            'children': [child.to_dict() for child in self.children],
            'active_child_index': self.active_child_index
        }

    @classmethod
    def from_dict(cls, data, parent=None):
        node = cls(data['role'], data['content'])
        node.parent = parent
        node.active_child_index = data['active_child_index']
        for child_data in data['children']:
            child = cls.from_dict(child_data, parent=node)
            node.children.append(child)
        return node

class ChatTree:
    def __init__(self):
        self.root = ChatNode("user", "You are a helpful language assistant that are always factually correct.")
        self.current_node = self.root
        self.chat_id = str(uuid.uuid4())
        self.chat_name = ""  # New attribute to store the chat name
        self.last_modified = datetime.now().isoformat()  # New: last modified date
        logger.info(f"Initialized ChatTree with ID: {self.chat_id}")
    
    def update_last_modified(self):
        self.last_modified = datetime.now().isoformat()

    def set_chat_name(self, new_name):
        self.chat_name = new_name
        self.update_last_modified()
    
    def add_message(self, role, content):
        new_node = ChatNode(role, content)
        self.current_node.add_child(new_node)
        self.current_node.active_child_index = len(self.current_node.children) - 1
        self.current_node = new_node
        self.update_last_modified()  # <-- update timestamp
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
    
    def get_full_chat_history(self):
        return {
            'messages': self.get_chat_history(), 
            'id': self.chat_id, 
            'name': self.chat_name,
            'last_modified': self.last_modified  # New field
        }

    def regenerate_message(self, level=0):
        node = self.current_node
        for _ in range(level):
            if node.parent:
                node = node.parent
            else:
                break

        if node.role == "assistant":
            parent = node.parent
            new_assistant_node = ChatNode("assistant", "")
            parent.add_child(new_assistant_node)
            parent.active_child_index = len(parent.children) - 1
            self.current_node = new_assistant_node
            logger.info(f"Created new branch for regenerated assistant message at level {level}")
        else:
            logger.warning(f"Attempted to regenerate a non-assistant message at level {level}")
        self.update_last_modified()  # <-- update timestamp
        
        return self.get_chat_history()

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
            
        self.update_last_modified()  # <-- update timestamp
        
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
        self.update_last_modified()  # <-- update timestamp
        return self.get_chat_history()


    def to_dict(self):
        return {
            'chat_id': self.chat_id,
            'chat_name': self.chat_name,
            'last_modified': self.last_modified,  # New field
            'root': self.root.to_dict(),
            'current_node_path': self._get_current_node_path()
        }

    @classmethod
    def from_dict(cls, data):
        chat_tree = cls()
        chat_tree.chat_id = data['chat_id']
        chat_tree.chat_name = data.get('chat_name')  # Use get() in case older chat trees don't have this field
        chat_tree.last_modified = data.get('last_modified', datetime.now().isoformat())
        chat_tree.root = ChatNode.from_dict(data['root'])
        
        # Restore current node
        current_node = chat_tree.root
        for index in data['current_node_path']:
            current_node = current_node.children[index]
        chat_tree.current_node = current_node
        
        return chat_tree

    def _get_current_node_path(self):
        path = []
        node = self.current_node
        while node.parent:
            path.append(node.parent.children.index(node))
            node = node.parent
        return list(reversed(path))

    def to_json(self):
        return json.dumps(self.to_dict(), indent=2)

    @classmethod
    def from_json(cls, json_str):
        data = json.loads(json_str)
        return cls.from_dict(data)


class ChatBot:
    def __init__(
        self, 
        model_config_file="model_config.json", 
        chat_dir="chat_history"
    ):
        self.model_config_file = model_config_file
        self.chat_dir = chat_dir

        if not os.path.exists(self.chat_dir):
            os.makedirs(self.chat_dir)

        # 1. Load or create the model config
        self.load_model_config()  # sets self.model_name, self.generation_length, self.temperature, self.top_p

        # 2. Load the actual model & tokenizer
        self.model, self.tokenizer = self.load_model()

        # 3. Initialize ChatTree
        self.chat_tree = ChatTree()
        
        logger.info("ChatBot initialization complete")

    def load_model_config(self):
        """Load model config from JSON file or use defaults if not found."""
        defaults = {
            "model_name": "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
            "generation_length": 512,
            "temperature": 0.7,
            "top_p": 0.95
        }

        if os.path.exists(self.model_config_file):
            try:
                with open(self.model_config_file, "r") as f:
                    data = json.load(f)
                logger.info("Loaded existing model config.")
            except Exception as e:
                logger.warning(f"Could not read model config file: {e}")
                data = defaults
        else:
            data = defaults
            logger.info("No model config file found; using defaults.")

        # Set attributes
        self.model_name = data.get("model_name", defaults["model_name"])
        self.generation_length = data.get("generation_length", defaults["generation_length"])
        self.temperature = data.get("temperature", defaults["temperature"])
        self.top_p = data.get("top_p", defaults["top_p"])

    def save_model_config(self):
        """Save current config to the model_config_file."""
        data = {
            "model_name": self.model_name,
            "generation_length": self.generation_length,
            "temperature": self.temperature,
            "top_p": self.top_p
        }
        try:
            with open(self.model_config_file, "w") as f:
                json.dump(data, f, indent=2)
            logger.info("Model config saved.")
        except Exception as e:
            logger.error(f"Error saving model config: {e}")

    def update_model_config(self, new_config):
        """
        Update model config with new values (validate them), 
        reload the model if the model_name changed.
        """
        valid_models = [
            "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
            "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B"
        ]
        
        # 1. Validate model_name
        requested_model = new_config.get("model_name", self.model_name)
        if requested_model not in valid_models:
            raise ValueError(f"Invalid model_name: {requested_model}")

        # 2. Validate generation_length
        requested_length = new_config.get("generation_length", self.generation_length)
        if not isinstance(requested_length, int) or requested_length <= 0 or requested_length > 4096:
            raise ValueError("generation_length must be an integer in range 1..4096")

        # 3. Validate temperature
        requested_temp = new_config.get("temperature", self.temperature)
        if not (0.0 <= requested_temp <= 2.0):
            raise ValueError("temperature must be in range 0.0..2.0")

        # 4. Validate top_p
        requested_top_p = new_config.get("top_p", self.top_p)
        if not (0.0 <= requested_top_p <= 1.0):
            raise ValueError("top_p must be in range 0.0..1.0")

        # Check if the model_name is changing
        model_changed = (requested_model != self.model_name)

        # Update the config in memory
        self.model_name = requested_model
        self.generation_length = requested_length
        self.temperature = requested_temp
        self.top_p = requested_top_p

        # Reload model if needed
        if model_changed:
            logger.info("Model changed. Reloading new model...")
            self.model, self.tokenizer = self.load_model()

        # Save new config to file
        self.save_model_config()

        # Return updated config to the caller
        return self.get_model_config()

    def get_model_config(self):
        """Return current config as a dict."""
        return {
            "model_name": self.model_name,
            "generation_length": self.generation_length,
            "temperature": self.temperature,
            "top_p": self.top_p
        }


    def load_model(self,):
        """
        Load the model and tokenizer based on self.model_name, 
        returning (model, tokenizer).
        Make sure GPU is cleared if needed.
        """
        # If a model is already loaded, clear it before loading a new one
        try:
            if hasattr(self, 'model') and self.model is not None:
                del self.model
                torch.cuda.empty_cache()
        except Exception as e:
            logger.warning(f"Could not clear old model from GPU: {e}")
        # Define model identifier for the 32B model
        # Configure 4-bit quantization
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",       # recommended quantization type
            bnb_4bit_use_double_quant=True, # disable double quantization for speed
            bnb_4bit_compute_dtype=torch.float16  # use FP16 compute for speed
        )
        
        # Set max_memory for each GPU to force all parts of the model to load on GPU
        max_memory = {0: "24GB", 1: "24GB"}
        
        # Load the tokenizer
        tokenizer = AutoTokenizer.from_pretrained(self.model_name, trust_remote_code=True)
        if tokenizer.pad_token_id is None:
            tokenizer.pad_token_id = tokenizer.eos_token_id
        
        # Load the model with quantization, device map, and max_memory constraints
        model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            quantization_config=bnb_config,
            device_map="balanced",         # distribute layers across GPUs
            max_memory=max_memory,         # force all modules onto the GPUs
            torch_dtype=torch.float16,     # load weights in FP16
            trust_remote_code=True         # needed for custom Qwen implementations
        )
        try:
            model = torch.compile(model)
            print("Model compiled for optimized inference.")
        except Exception as e:
            print("Could not compile model (proceeding without torch.compile):", e)
            
        return model, tokenizer


    def get_chat_id(self):
        return self.chat_tree.chat_id
    
    def get_chat_name(self):
        return self.chat_tree.chat_name
    
    def edit_chat_name(self, new_name):
        self.chat_tree.set_chat_name(new_name)
        logger.info(f"Chat name updated to: {new_name}")
        return self.get_full_chat_history()

    def generate_name(self, first_message):
        logger.info("Generating chat name based on first message")
        prompt = f"Based on the following first message from a user, generate a short (2-5 words) and representative name for this chat conversation:\n\n'{first_message}'\n\nChat name:"
        first_device = self.model.hf_device_map.get('transformer.wte', 0)
        
        input_ids = self.tokenizer.encode(prompt, return_tensors='pt').to(first_device)
        
        with torch.no_grad():
            output = self.model.generate(
                input_ids, 
                max_new_tokens=30,  # Limit to a short response
                do_sample=True,
                temperature=0.6,  # Slightly randomized but still focused
                top_p=0.95,
                pad_token_id=self.tokenizer.eos_token_id
            )
        
        generated_text = self.tokenizer.decode(output[0], skip_special_tokens=True)
        chat_name = generated_text.split("Chat name:")[-1].strip()
        
        # Ensure the chat name is not too long
        if len(chat_name.split()) > 5:
            chat_name = " ".join(chat_name.split()[:5])
        
        self.chat_tree.chat_name = chat_name
        logger.info(f"Generated chat name: {chat_name}")
        return chat_name


    def get_chat_history(self):
        return self.chat_tree.get_chat_history()
    
    def get_full_chat_history(self):
        return self.chat_tree.get_full_chat_history()

    def generate_response(self, messages, ):
        logger.info("Generating response")
        total_tokens = self.generation_length
        chunk_size = 20
        formatted_input = self.tokenizer.apply_chat_template(messages[:11]+messages[-10:], tokenize=False)

        first_device = self.model.hf_device_map.get('transformer.wte', 0)
        
        input_ids = self.tokenizer.encode(formatted_input, return_tensors='pt', add_special_tokens=False).to(first_device)
        generated_text = self.chat_tree.current_node.content
        remaining_tokens = total_tokens
        first_chunk = True
            
        while remaining_tokens > 0:
            tokens_to_generate = min(chunk_size, remaining_tokens)
            logger.debug(f"Generating {tokens_to_generate} tokens")
            with torch.no_grad():
                output = self.model.generate(
                    input_ids, 
                    max_new_tokens=tokens_to_generate, 
                    temperature=self.temperature,  # Slightly randomized but still focused
                    top_p=self.top_p,
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
        # Final GPU memory cleanup
        del input_ids
        torch.cuda.empty_cache()

    def chat(self, user_message):
        logger.info(f"Processing chat: {user_message[:50]}...")
        self.chat_tree.add_message("user", user_message)
        self.chat_tree.add_message("assistant", "")

        # If this is the first user message and there's no chat name, generate one
        if len(self.chat_tree.get_chat_history()) >= 2 and not self.chat_tree.chat_name:  # 2 because of the initial system message
            self.generate_name(user_message)
        return self.generate_response(self.get_chat_history())

    def edit(self, level, new_message):
        logger.info(f"Editing message at level {level}")
        updated_history = self.chat_tree.edit_message(level, new_message)
        self.chat_tree.add_message("assistant", "")
        return self.generate_response(updated_history)

    def change_active_child(self, level, direction):
        return self.chat_tree.change_active_child(level, direction)

    def regenerate(self, level=0):
        logger.info(f"Regenerating response at level {level}")
        updated_history = self.chat_tree.regenerate_message(level)
        return self.generate_response(updated_history)


    def continue_chat(self):
        logger.info("Continuing chat")
        if self.chat_tree.current_node.role != "assistant":
            self.chat_tree.add_message("assistant", "")
            logger.debug("Continuing chat: new assistant message added") 
        else:
            self.chat_tree.current_node.content += " "
        return self.generate_response(self.get_chat_history())

    def reset_chat(self):
        logger.info("Resetting chat")
        self.chat_tree = ChatTree()
        return self.get_chat_history()

    def save_chat_tree(self):
        filename = f"{self.chat_tree.chat_id}.json"
        filepath = os.path.join(self.chat_dir, filename)
        with open(filepath, 'w') as f:
            json.dump(self.chat_tree.to_dict(), f, indent=2)
        logger.info(f"Chat tree saved to {filepath}")
        return filepath

    def load_chat_tree(self, chat_id):
        filename = f"{chat_id}.json"
        filepath = os.path.join(self.chat_dir, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"No chat history found for ID: {chat_id}")
        with open(filepath, 'r') as f:
            data = json.load(f)
        self.chat_tree = ChatTree.from_dict(data)
        logger.info(f"Chat tree loaded from {filepath}")
        return self.get_chat_history()

    def list_chat_histories(self):
        chat_files = [f for f in os.listdir(self.chat_dir) if f.endswith('.json')]
        chat_info = []
        for filename in chat_files:
            chat_id = os.path.splitext(filename)[0]
            filepath = os.path.join(self.chat_dir, filename)
            with open(filepath, 'r') as f:
                data = json.load(f)
            chat_name = data.get('chat_name', 'Unnamed Chat')
            last_modified = data.get('last_modified', '')
            chat_info.append({'id': chat_id, 'name': chat_name, 'last_modified': last_modified})

        return chat_info


    def start_new_chat(self):
        self.chat_tree = ChatTree()
        logger.info(f"Started new chat with ID: {self.chat_tree.chat_id}")
        return self.chat_tree.chat_id

    def get_current_chat_id(self):
        return self.chat_tree.chat_id
