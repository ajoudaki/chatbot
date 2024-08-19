from flask import Flask, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
import logging
import os
from transcribe import Transcriber
from chatbot import ChatBot

# Set up logging
logging.basicConfig(level=logging.DEBUG)
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
transcriber = Transcriber()
chatbot = ChatBot()

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

@socketio.on('connect')
def handle_connect():
    emit('chat_history', {'messages': chatbot.chat_history})

@socketio.on('chat_message')
def handle_message(data):
    messages = data.get('messages', [])
    for updated_messages in chatbot.handle_message(messages):
        emit('chat_update', {'messages': updated_messages})
    emit('chat_update', {'messages': updated_messages, 'type': 'stop'})

@socketio.on('continue_chat')
def handle_continue(data):
    messages = data.get('messages', [])
    for updated_messages in chatbot.handle_continue(messages):
        emit('chat_update', {'messages': updated_messages})
    emit('chat_update', {'messages': updated_messages, 'type': 'stop'})

@socketio.on('reset_chat')
def reset_chat():
    chat_history = chatbot.reset_chat()
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