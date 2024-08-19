import torch
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import librosa
import soundfile as sf
from pydub import AudioSegment
import os

class Transcriber:
    def __init__(self, model_name="openai/whisper-base"):
        self.processor = WhisperProcessor.from_pretrained(model_name)
        self.model = WhisperForConditionalGeneration.from_pretrained(model_name)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = self.model.to(self.device)
        print(f"Model loaded and running on {self.device}")

    @staticmethod
    def convert_webm_to_wav(webm_path, wav_path):
        audio = AudioSegment.from_file(webm_path, format="webm")
        audio.export(wav_path, format="wav")

    def transcribe_audio(self, audio_path):
        # Convert WebM to WAV if necessary
        file_extension = os.path.splitext(audio_path)[1].lower()
        wav_path = None
        if file_extension == '.webm':
            wav_path = audio_path.rsplit('.', 1)[0] + '.wav'
            self.convert_webm_to_wav(audio_path, wav_path)
            audio_path = wav_path

        try:
            # Load the audio file
            audio, sr = librosa.load(audio_path, sr=16000)

            # Process the audio
            input_features = self.processor(audio, sampling_rate=16000, return_tensors="pt").input_features
            input_features = input_features.to(self.device)

            # Generate token ids
            predicted_ids = self.model.generate(input_features)

            # Decode the token ids to text
            transcription = self.processor.batch_decode(predicted_ids, skip_special_tokens=True)

            return transcription[0]

        finally:
            # Clean up the temporary WAV file if it was created
            if wav_path and os.path.exists(wav_path):
                os.remove(wav_path)