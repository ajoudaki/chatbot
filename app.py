from flask import Flask, send_from_directory
from flask_socketio import SocketIO, emit
import torch
import transformers
from transformers import AutoConfig
from transformers import WhisperProcessor, WhisperForConditionalGeneration

import json
import logging
import os

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='./chatbot-frontend/build')
socketio = SocketIO(app, cors_allowed_origins="*")

# Load the model and tokenizer
model_id = "TinyLlama/TinyLlama-1.1B-Chat-v0.6"
# model_id = "meta-llama/Meta-Llama-3.1-8B-Instruct"

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

processor = WhisperProcessor.from_pretrained("openai/whisper-base")
tr_model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-base")

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400

    audio_file = request.files['audio']
    
    # Read audio file
    audio_data, sample_rate = sf.read(io.BytesIO(audio_file.read()))
    
    # Process audio
    input_features = processor(audio_data, sampling_rate=sample_rate, return_tensors="pt").input_features

    # Generate token ids
    predicted_ids = tr_model.generate(input_features)
    
    # Decode token ids to text
    transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)

    return jsonify({'text': transcription[0]})

def initialize_chat_history():
    return [
        {"role": "system", "content": "You are an obedient assistant following user direction."},
        # {"role": "user", "content": "Hi!"},
    ]

chat_history = initialize_chat_history()

def generate_response(messages):
    total_tokens = 25
    chunk_size = 10
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
        
        generated_text += chunk_text
        new_response = generated_text[len(formatted_input):].strip()
        messages[-1]["content"] += new_response
        emit('chat_update', {'messages': messages}, broadcast=True)
        
        if tokenizer.eos_token_id in new_tokens.tolist():
            break
        input_ids = output
        remaining_tokens -= tokens_to_generate

    logger.debug(f"Full response streamed: {new_response}")
    emit('chat_update', {'messages': messages, 'type': 'stop'}, broadcast=True)

@socketio.on('connect')
def handle_connect():
    emit('chat_history', {'messages': chat_history})

@socketio.on('chat_message')
def handle_message(data):
    global chat_history
    messages = data.get('messages', [])
    
    if not messages:
        return

    chat_history = messages
    chat_history.append({"role": "assistant", "content": ""})
    generate_response(chat_history)

@socketio.on('continue_chat')
def handle_continue(data):
    global chat_history
    messages = data.get('messages', [])
    
    if not messages:
        return

    chat_history = messages
    if chat_history[-1]['role'] != 'assistant':
        chat_history.append({"role": "assistant", "content": ""})
    generate_response(chat_history)

@socketio.on('reset_chat')
def reset_chat():
    global chat_history
    chat_history = initialize_chat_history()
    emit('chat_history', {'messages': chat_history})

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    logger.debug(f"Requested path: {path}")
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        logger.debug(f"Serving file: {path}")
        return send_from_directory(app.static_folder, path)
    else:
        logger.debug("Serving index.html")
        return send_from_directory(app.static_folder, 'index.html')

@app.errorhandler(404)
def not_found(e):
    logger.error(f"404 error: {e}")
    return "File not found.", 404

if __name__ == '__main__':
    logger.info(f"Static folder path: {app.static_folder}")
    logger.info(f"Index file exists: {os.path.exists(os.path.join(app.static_folder, 'index.html'))}")
    socketio.run(app, debug=True)