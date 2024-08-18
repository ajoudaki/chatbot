# app.py
from flask import Flask, send_from_directory, request, Response, jsonify
import torch
import transformers
from transformers import AutoConfig

import logging
import os

app = Flask(__name__, static_folder='build')

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load the model and tokenizer
model_id = "meta-llama/Meta-Llama-3.1-8B-Instruct"
# model_id = "TinyLlama/TinyLlama-1.1B-Chat-v0.6"
config = AutoConfig.from_pretrained(model_id)
config.use_flash_attention_2 = True  # The exact attribute name might vary

pipeline = transformers.pipeline(
    "text-generation",
    config=config,
    model=model_id,
    model_kwargs={"torch_dtype": torch.bfloat16},
    device_map="auto",
)
model = pipeline.model
tokenizer = pipeline.tokenizer


def initialize_chat_history():
    return [{"role": "system", "content": "You are an obedient assistant following user direction.  "}]

chat_history = initialize_chat_history()

def generate_in_chunks(messages, total_tokens=500, chunk_size=10):
    global chat_history
    formatted_input = tokenizer.apply_chat_template(messages, tokenize=False)
    input_ids = tokenizer.encode(formatted_input, return_tensors='pt', add_special_tokens=False).to('cuda')
    generated_text = tokenizer.decode(input_ids[0])
    remaining_tokens = total_tokens
    first_chunk = True
    while remaining_tokens > 0:
        tokens_to_generate = min(chunk_size, remaining_tokens)
        with torch.no_grad():
            output = model.generate(
                input_ids, 
                max_new_tokens=tokens_to_generate, 
                do_sample=True, 
                pad_token_id=tokenizer.eos_token_id)
        
        new_tokens = output[0, input_ids.shape[1]:]
        chunk_text = tokenizer.decode(new_tokens, skip_special_tokens=True)
        
        if first_chunk:
            chunk_text = chunk_text.lstrip("assistant").lstrip()
            first_chunk = False
        
        logger.debug(f"Generated chunk: {chunk_text}")
        yield chunk_text
        generated_text += chunk_text
        if tokenizer.eos_token_id in new_tokens.tolist():
            break
        input_ids = output
        remaining_tokens -= tokens_to_generate
    
    new_response = generated_text[len(formatted_input):].strip()
    chat_history.append({"role": "assistant", "content": new_response})
    logger.debug(f"Full response generated: {new_response}")

# Serve React App
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    user_input = request.json['message']
    logger.debug(f"Received user input: {user_input}")
    chat_history.append({"role": "user", "content": user_input})
    
    def generate():
        for chunk in generate_in_chunks(chat_history):
            logger.debug(f"Sending chunk to client: {chunk}")
            yield f"{chunk}"
    
    return Response(generate(), mimetype='text/event-stream')


@app.route('/api/extend', methods=['POST'])
def extend():
    logger.debug(f"Received user request to extend")
    
    def generate():
        for chunk in generate_in_chunks(chat_history):
            logger.debug(f"Sending chunk to client: {chunk}")
            yield f"{chunk}"
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/reset', methods=['POST'])
def reset():
    global chat_history
    chat_history = initialize_chat_history()
    logger.debug("Chat history reset")
    return jsonify({"status": "success", "message": "Chat history reset"})

if __name__ == '__main__':
    app.run(debug=True)
