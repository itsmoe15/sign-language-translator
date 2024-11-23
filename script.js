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
const gestureOutput = document.getElementById("translated-text");
enableWebcamButton = document.getElementById("webcamButton");
const cameraSelect = document.getElementById("cameraSelect");

let currentStream;

// Function to initialize the gesture recognizer
const createGestureRecognizer = async () => {
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "moe_ar_sign_language_model.task",
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

    // Update gesture output
    if (results && results.gestures && results.gestures.length > 0) {
        const categoryName = results.gestures[0][0].categoryName;
        gestureOutput.innerText = `Gesture: ${categoryName}`;
    } else {
        gestureOutput.innerText = "No gesture detected";
    }

    // Continue the loop if webcam is running
    window.requestAnimationFrame(predictWebcam);
}

// Initialize webcam access when the page loads
if (hasGetUserMedia()) {
    enableWebcamButton.addEventListener("click", enableCam);
    cameraSelect.addEventListener("change", enableCam);
} else {
    console.warn("getUserMedia() is not supported by your browser");
    showErrorOverlay("Your browser does not support webcam access.");
}

// Adjust canvas size on window resize to maintain aspect ratio
window.addEventListener('resize', () => {
    if (videoElement.videoWidth && videoElement.videoHeight) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    }
});
