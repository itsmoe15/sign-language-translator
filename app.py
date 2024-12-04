from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content
import json

app = Flask(__name__)

# Configure the Gemini AI model
genai.configure(api_key="")  # Replace with your actual API key

# Create the model
generation_config = {
    "temperature": 0,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_schema": content.Schema(
        type=content.Type.OBJECT,
        enum=[],
        required=["most_likely_word", "list_of_other_likely_words", "is_a_full_sentence"],
        properties={
            "most_likely_word": content.Schema(
                type=content.Type.STRING,
            ),
            "list_of_other_likely_words": content.Schema(
                type=content.Type.ARRAY,
                items=content.Schema(
                    type=content.Type.STRING,
                ),
            ),
            "is_a_full_sentence": content.Schema(
                type=content.Type.BOOLEAN,
            ),
        },
    ),
    "response_mime_type": "application/json",
}

model = genai.GenerativeModel(
    model_name="gemini-1.5-flash-8b",
    generation_config=generation_config,
    system_instruction=(
        "You are an LLM AI model, an Arabic language model designed to assist a sign language to speech translation system. "
        "You will be provided with a sequence of Arabic letters (which may contain errors or extra letters), and your task is to predict the most probable word or sentence the user intended. "
        "Your output should be a JSON object containing the keys 'most_likely_word', 'list_of_other_likely_words', and 'is_a_full_sentence'. "
        "Do not include any additional text or explanations. "
        "Inputs might be in Egyptian Arabic, so make sure you output Egyptian Arabic in that case, including the slangs that are used.",
        "if a word is in full you may try to guess the next word based on the context."
    ),
)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    gestures = data.get('gestures', '')
    
    # Start a chat session
    chat_session = model.start_chat(history=[])
    response = chat_session.send_message(gestures)
    
    # Parse the response as JSON
    try:
        prediction = json.loads(response.text)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        return jsonify({'error': 'Failed to parse model response as JSON.'}), 500
    
    # Return the parsed JSON to the client
    return jsonify({'prediction': prediction})

if __name__ == '__main__':
    app.run(debug=True)

