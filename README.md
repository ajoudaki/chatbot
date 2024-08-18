
# ChatBot 

# Chatbot Project

## Overview

This project is a web-based chatbot application that uses a Flask backend with a React frontend. The chatbot is powered by a large language model from the Hugging Face `transformers` library, providing text generation capabilities in response to user input. The application is designed to handle conversational input and respond in real-time, streaming responses to the client as they are generated.

## Features

- **Real-time Text Generation**: The chatbot generates responses in real-time using a pre-trained language model, streaming the response back to the user in chunks.
- **Chat History Management**: The application maintains a chat history, which can be reset by the user at any time.
- **Responsive UI**: The frontend is built with React and Ant Design, offering a modern and responsive user interface.
- **Chunked Response Handling**: The chatbot streams its responses in chunks to provide a more interactive user experience.
- **Error Handling**: Basic error handling is implemented to manage issues during API calls and text generation.

## Technologies Used

- **Frontend**:
  - React
  - Ant Design
- **Backend**:
  - Flask
  - PyTorch
  - Hugging Face Transformers
- **Language Model**:
  - Meta-Llama 3.1 (8B)

## Installation and Setup

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- Python 3.8 or higher
- Node.js and npm
- A CUDA-compatible GPU with drivers installed (if running the model locally)

### Backend Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/ajoudaki/chatbot.git
   cd chatbot

## Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
