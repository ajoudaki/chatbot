import logging
from flask import Flask, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
import os
from transcribe import Transcriber
from chatbot import ChatBot

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='./frontend/build')
socketio = SocketIO(app, cors_allowed_origins="*")

# Configuration for file uploads
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg', 'webm'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize the transcriber and chatbot when starting the app
transcriber = Transcriber('openai/whisper-base')
chatbot = ChatBot()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@socketio.on('connect')
def handle_connect():
    logger.info("Client connected")
    emit('chat_history', {'messages': chatbot.get_chat_history()})

@socketio.on('save_chat')
def handle_save_chat():
    logger.info("Saving current chat")
    filepath = chatbot.save_chat_tree()
    emit('chat_saved', {'filepath': filepath})

@socketio.on('load_chat')
def handle_load_chat(data):
    chat_id = data.get('chat_id')
    logger.info(f"Loading chat with ID: {chat_id}")
    try:
        chat_history = chatbot.load_chat_tree(chat_id)
        emit('chat_history', {
            'messages': chat_history,
            'id': chatbot.get_chat_id(),
            'name': chatbot.get_chat_name()
            })
    except FileNotFoundError:
        emit('error', {'message': 'Chat history not found'})

@socketio.on('list_chats')
def handle_list_chats():
    logger.info("Listing chat histories")
    chat_list = chatbot.list_chat_histories()
    emit('chat_list', {'chats': chat_list})


@socketio.on('new_chat')
def handle_new_chat():
    logger.info("Starting a new chat")
    # Save the current chat first
    chatbot.save_chat_tree()
    # Start a new chat
    chatbot.start_new_chat()
    emit('new_chat_started', {'chat_id': chatbot.get_chat_id()})
    emit('chat_history', {'messages': chatbot.get_chat_history()})

@socketio.on('chat')
def handle_chat(data):
    user_message = data.get('message', '')
    logger.info(f"Received chat message: {user_message}")
    for updated_messages in chatbot.chat(user_message):
        emit('chat_update', chatbot.get_full_chat_history())
    emit('chat_update', {'messages': updated_messages, 'type': 'stop'})
    logger.info("Chat response completed")


@socketio.on('update_model_config')
def handle_update_model_config(data):
    try:
        updated_config = chatbot.update_model_config(data)
        emit('model_config_updated', {"success": True, "config": updated_config})
    except ValueError as e:
        emit('model_config_updated', {"success": False, "error": str(e)})

@socketio.on('edit')
def handle_edit(data):
    level = data.get('level', 0)
    new_message = data.get('message', '')
    logger.info(f"Editing message at level {level}: {new_message}")
    for updated_messages in chatbot.edit(level, new_message):
        emit('chat_update', chatbot.get_full_chat_history())
    emit('chat_update', {'messages': updated_messages, 'type': 'stop'})
    logger.info("Edit completed")

@socketio.on('change_active_child')
def handle_change_active_child(data):
    level = data.get('level', 0)
    direction = data.get('direction', 'next')
    logger.info(f"Changing active child at level {level} in direction {direction}")
    
    updated_messages = chatbot.change_active_child(level, direction)
    emit('chat_update', {'messages': updated_messages, 'type': 'navigation'})
    logger.info("Navigation completed")


@socketio.on('edit_chat_name')
def handle_edit_chat_name(data):
    new_name = data.get('name', '')
    logger.info(f"Editing chat name to: {new_name}")
    updated_history = chatbot.edit_chat_name(new_name)
    chatbot.save_chat_tree()  # Save updated name and timestamp
    emit('chat_update', updated_history)

@socketio.on('regenerate')
def handle_regenerate(data):
    level = data.get('level', 0)
    logger.info("Regenerating response")
    for updated_messages in chatbot.regenerate(level):
        emit('chat_update', chatbot.get_full_chat_history())
    emit('chat_update', {'messages': updated_messages, 'type': 'stop'})
    logger.info("Regeneration completed")

@socketio.on('continue')
def handle_continue():
    logger.info("Continuing chat")
    for updated_messages in chatbot.continue_chat():
        emit('chat_update', chatbot.get_full_chat_history())
    emit('chat_update', {'messages': updated_messages, 'type': 'stop'})
    logger.info("Continuation completed")

@socketio.on('reset_chat')
def reset_chat():
    logger.info("Resetting chat")
    chat_history = chatbot.reset_chat()
    emit('chat_history', chatbot.get_full_chat_history())
    logger.info("Chat reset completed")

@app.route('/api/upload_audio', methods=['POST'])
def upload_audio():
    logger.info("Received audio upload request")
    if 'audio' not in request.files:
        logger.warning("No file part in the request")
        return jsonify({'error': 'No file part in the request'}), 400
    file = request.files['audio']
    
    if file.filename == '':
        logger.warning("No selected file")
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.webm'):
        filename = secure_filename(file.filename)
        webm_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(webm_path)
        logger.info(f"File uploaded successfully: {filename}")
        return jsonify({'message': 'File uploaded successfully', 'filename': filename}), 200
    else:
        logger.warning("Invalid file type")
        return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    logger.info("Received transcription request")
    data = request.json
    filename = data.get('filename')
    
    if not filename:
        logger.warning("No filename provided")
        return jsonify({'error': 'No filename provided'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    if not os.path.exists(filepath):
        logger.warning(f"File not found: {filepath}")
        return jsonify({'error': 'File not found'}), 404
    
    try:
        transcribed_text = transcriber.transcribe_audio(filepath)
        logger.info(f"Audio transcribed successfully: {filename}")
        logger.debug(f"Transcribed text: {transcribed_text}")
        return jsonify({
            'message': 'Audio transcribed successfully',
            'filename': filename,
            'text': transcribed_text
        }), 200
    except Exception as e:
        logger.error(f"Transcription failed: {str(e)}", exc_info=True)
        return jsonify({'error': f'Transcription failed: {str(e)}'}), 500

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
    logger.info("Starting the application")
    socketio.run(app, debug=True)