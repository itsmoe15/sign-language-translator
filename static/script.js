// script.js

import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

// Initialize Loading Overlay
import { initializeLoadingOverlay } from "./assets/js/loading.js";
initializeLoadingOverlay();
showLoadingOverlay(); // Show the loading overlay initially

let gestureRecognizer;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const videoElement = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const latestGestureOutput = document.getElementById("latest-gesture");
const accumulatedGesturesOutput = document.getElementById("accumulated-gestures");
enableWebcamButton = document.getElementById("webcamButton");
const cameraSelect = document.getElementById("cameraSelect");
const clearButton = document.getElementById("clearButton"); // Clear Button

let currentStream;

// Variables to store gestures
let accumulatedGestures = "";
let gestureCount = 0;
let gestureCaptureTimeout = null;
let currentGesture = null;


// Define Confidence Threshold
let waitTime = 1.5;
const CONFIDENCE_THRESHOLD = 0.65; // Adjust as needed (0.0 to 1.0)

// Map from gesture category names to letters
const gestureToLetterMap = {
    'ain': 'ع',
    'al': 'go',
    'aleff': 'ا',
    'bb': 'ب',
    'dal': 'د',
    'dha': 'ذ',
    'dhad': 'ض',
    'fa': 'ف',
    'gaaf': 'ق',
    'ghain': 'غ',
    'ha': 'ح',
    'haa': 'ه',
    'jeem': 'ج',
    'kaaf': 'ك',
    'khaa': 'خ',
    'la': 'ل',
    'laam': 'ل',
    'meem': 'م',
    'nun': 'ن',
    'ra': 'ر',
    'saad': 'ص',
    'seen': 'س',
    'sheen': 'ش',
    'ta': 'ت',
    'taa': 'ط',
    'thaa': 'ث',
    'thal': 'ظ',
    'toot': ' ',
    'waw': 'و',
    'ya': 'ي',
    'yaa': 'ي',
    'zay': 'ز'
};

const confidenceWarning = document.getElementById("confidence-warning"); // Confidence warning element

// Function to initialize the gesture recognizer
const createGestureRecognizer = async () => {
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "/static/moe_ar_sign_language_model.task", // Updated path
                delegate: "GPU"
            },
            runningMode: runningMode
        });

        // Once the recognizer is ready, populate cameras and hide loading
        await getCameras();
        hideLoadingOverlay();
    } catch (error) {
        console.error("Error initializing GestureRecognizer:", error);
        showErrorOverlay("Failed to load AI model. Please try again later.");
    }
};

createGestureRecognizer();

// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Populate the camera selection dropdown.
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === "videoinput");
        cameraSelect.innerHTML = ""; // Clear any existing options
        videoDevices.forEach((device, index) => {
            const option = document.createElement("option");
            option.value = device.deviceId;
            option.text = device.label || `Camera ${index + 1}`;
            cameraSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error getting cameras:", error);
        showErrorOverlay("Failed to access camera devices.");
    }
}

// Enable the live webcam view and start detection.
async function enableCam(event) {
    if (!gestureRecognizer) {
        alert("Please wait for the gesture recognizer to load");
        return;
    }

    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop()); // Stop existing stream
    }

    const constraints = {
        video: {
            deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined
        }
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        videoElement.srcObject = stream;

        // Wait for the video to load data before starting prediction
        videoElement.addEventListener("loadeddata", () => {
            webcamRunning = true;
            // Set canvas dimensions to match the video dimensions
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            predictWebcam();
        }, { once: true });
    } catch (error) {
        console.error("Error accessing the camera:", error);
        showErrorOverlay("Failed to access the camera. Please check permissions.");
    }
}

// Function to handle webcam predictions.
let lastVideoTime = -1;
let results = undefined;

async function predictWebcam() {
    if (!webcamRunning) {
        return;
    }

    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }

    let nowInMs = Date.now();
    if (videoElement.currentTime !== lastVideoTime) {
        lastVideoTime = videoElement.currentTime;
        try {
            results = gestureRecognizer.recognizeForVideo(videoElement, nowInMs);
        } catch (error) {
            console.error("Error during gesture recognition:", error);
            showErrorOverlay("Gesture recognition failed.");
            webcamRunning = false;
            return;
        }
    } else {
        // If video frame hasn't advanced, continue the loop
        window.requestAnimationFrame(predictWebcam);
        return;
    }

    // Clear the canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw landmarks and connectors if any
    if (results && results.landmarks) {
        const drawingUtils = new DrawingUtils(canvasCtx);
        for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
                color: "#00FF00",
                lineWidth: 5
            });
            drawingUtils.drawLandmarks(landmarks, {
                color: "#FF0000",
                lineWidth: 2
            });
        }
    }

    // Update gesture outputs
    if (results && results.gestures && results.gestures.length > 0) {
        const gesture = results.gestures[0][0];
        const categoryName = gesture.categoryName;
        const confidence = gesture.score;

        const mappedLetter = mapGestureToLetter(categoryName);

        latestGestureOutput.innerText = `Latest Gesture: ${mappedLetter} (Confidence: ${(confidence * 100).toFixed(2)}%)`;

        // Check if the gesture meets the confidence threshold
        if (confidence >= CONFIDENCE_THRESHOLD) {
            // Hide the confidence warning if it's visible
            if (!confidenceWarning.classList.contains("hidden")) {
                confidenceWarning.classList.add("hidden");
            }

            if (categoryName !== currentGesture) {
                // The gesture has changed
                currentGesture = categoryName;

                // Clear any existing timer
                if (gestureCaptureTimeout) {
                    clearTimeout(gestureCaptureTimeout);
                }

                // Start a new timer
                gestureCaptureTimeout = setTimeout(() => {
                    // After 3 seconds, if the gesture hasn't changed, capture it
                    accumulatedGestures += mappedLetter;
                    accumulatedGesturesOutput.innerText = `Accumulated Gestures: ${accumulatedGestures.trim()}`;

                    gestureCount += 1;  // Increment the gesture counter

                    // Check if we've accumulated enough gestures to send
                    if (gestureCount >= 3) { // Adjust as needed (3 or 4)
                        sendGesturesToServer(accumulatedGestures.trim());
                        // Do not clear accumulatedGestures; keep it displayed
                        gestureCount = 0; // Reset gesture count
                    }

                    // Reset current gesture and timer
                    currentGesture = null;
                    gestureCaptureTimeout = null;
                }, waitTime*1000); // 3 seconds
            }
            // Else, the gesture hasn't changed, do nothing (wait for timer to elapse)
        } else {
            // Confidence below threshold
            // Show the confidence warning
            if (confidenceWarning.classList.contains("hidden")) {
                confidenceWarning.classList.remove("hidden");
            }
            // Reset current gesture and timer
            if (gestureCaptureTimeout) {
                clearTimeout(gestureCaptureTimeout);
                gestureCaptureTimeout = null;
            }
            currentGesture = null;
        }
    } else {
        // No gesture detected
        latestGestureOutput.innerText = "No gesture detected";
        // Hide the confidence warning if it's visible
        if (!confidenceWarning.classList.contains("hidden")) {
            confidenceWarning.classList.add("hidden");
        }
        // Reset current gesture and timer
        if (gestureCaptureTimeout) {
            clearTimeout(gestureCaptureTimeout);
            gestureCaptureTimeout = null;
        }
        currentGesture = null;
    }

    // Continue the loop if webcam is running
    window.requestAnimationFrame(predictWebcam);
}

// Map gesture category names to letters
function mapGestureToLetter(categoryName) {
    return gestureToLetterMap[categoryName] || categoryName;
}

// Define the function to send gestures to the server

function sendGesturesToServer(gestures) {
    fetch('/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gestures: gestures })
    })
    .then(response => response.json())
    .then(data => {
        // Handle the response from the server
        console.log('Prediction:', data.prediction);
        // Check if there's an error
        if (data.error) {
            console.error('Server error:', data.error);
            return;
        }
        // Display the predicted word in the UI
        const predictedWordOutput = document.getElementById('predicted-word');
        const mostLikelyWord = data.prediction.most_likely_word; // Correctly access the field
        
        if (predictedWordOutput) {
            predictedWordOutput.innerText = `Predicted Word: ${mostLikelyWord}`;
        } else {
            // Create the element if it doesn't exist
            const newElement = document.createElement('p');
            newElement.id = 'predicted-word';
            newElement.innerText = `Predicted Word: ${mostLikelyWord}`;
            accumulatedGesturesOutput.parentNode.insertBefore(newElement, accumulatedGesturesOutput.nextSibling);
        }
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

// Initialize webcam access when the page loads
if (hasGetUserMedia()) {
    enableWebcamButton.addEventListener("click", enableCam);
    cameraSelect.addEventListener("change", enableCam);
} else {
    console.warn("getUserMedia() is not supported by your browser");
    showErrorOverlay("Your browser does not support webcam access.");
}

// Add functionality to clear accumulated gestures
if (clearButton) {
    clearButton.addEventListener("click", () => {
        accumulatedGestures = "";
        accumulatedGesturesOutput.innerText = "Accumulated gestures will appear here";
        currentGesture = null; // Reset current gesture as well
        gestureCount = 0; // Reset gesture count
        if (gestureCaptureTimeout) {
            clearTimeout(gestureCaptureTimeout);
            gestureCaptureTimeout = null;
        }
        // Clear predicted word display
        const predictedWordOutput = document.getElementById('predicted-word');
        if (predictedWordOutput) {
            predictedWordOutput.innerText = "Predicted word will appear here";
        }
    });
}

