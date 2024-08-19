from flask import Flask, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
import torch
import transformers
from transformers import AutoConfig
import json
import logging
import os
import soundfile as sf
import io
from pydub import AudioSegment
import numpy as np


from transcribe import Transcriber  # Import the function from the script above


# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='./chatbot-frontend/build')
socketio = SocketIO(app, cors_allowed_origins="*")

# Configuration for file uploads
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg', 'webm'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load the model and tokenizer
model_id = "meta-llama/Meta-Llama-3.1-8B-Instruct"

config = AutoConfig.from_pretrained(model_id)
config.use_flash_attention_2 = True
pipeline = transformers.pipeline(
    "text-generation",
    config=config,
    model=model_id,
    model_kwargs={"torch_dtype": torch.bfloat16},
    device_map="auto",
)
model = pipeline.model
tokenizer = pipeline.tokenizer

# Initialize the transcriber when starting the app
transcriber = Transcriber()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/api/upload_audio', methods=['POST'])
def upload_audio():

    if 'audio' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    file = request.files['audio']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.webm'):
        filename = secure_filename(file.filename)
        webm_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(webm_path)
        
        # Option 1: Keep as WebM
        # Just return the filename if you want to keep it as WebM
        return jsonify({'message': 'File uploaded successfully', 'filename': filename}), 200
    else:
        return jsonify({'error': 'Invalid file type'}), 400



@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    data = request.json
    filename = data.get('filename')
    
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        transcribed_text = transcriber.transcribe_audio(filepath)
        logger.debug(f"Transcribed text: {transcribed_text}")
        return jsonify({
            'message': 'Audio transcribed successfully',
            'filename': filename,
            'text': transcribed_text
        }), 200
    except Exception as e:
        
        logger.debug(f"Transcription failed: {str(e)}")
        return jsonify({'error': f'Transcription failed: {str(e)}'}), 500


def initialize_chat_history():
    return [
        {"role": "system", "content": "You are an obedient assistant following user direction."},
    ]

chat_history = initialize_chat_history()

def generate_response(messages):
    total_tokens = 512
    chunk_size = 20
    formatted_input = tokenizer.apply_chat_template(messages, tokenize=False)
    
    input_ids = tokenizer.encode(formatted_input, return_tensors='pt', add_special_tokens=False).to('cuda')
    generated_text = ""
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
        messages[-1]["content"] = generated_text
        emit('chat_update', {'messages': messages}, broadcast=True)
        
        if tokenizer.eos_token_id in new_tokens.tolist():
            break
        input_ids = output
        remaining_tokens -= tokens_to_generate

    logger.debug(f"Full response streamed: {generated_text}")
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