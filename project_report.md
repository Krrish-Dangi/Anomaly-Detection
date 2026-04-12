# SentinelAI: Intelligent Video Anomaly Detection System - Comprehensive Project Report

## 1. Executive Summary
SentinelAI is a real-time, hybrid AI surveillance platform designed to detect complex, scene-level anomalies and alert users via a live web dashboard. Utilizing a blend of spatiotemporal machine learning models and deterministic human-pose heuristics, the system bridges the gap between theoretical computer vision and production-ready security software. This report details the architectural decisions, the dataset used, the rationale behind specific technology choices compared to their alternatives, and a candid look at the problems successfully solved versus those that proved challenging.

---

## 2. Problem Statement
Traditional CCTV systems rely purely on human monitoring, leading to fatigue and missed incidents. Existing "smart" cameras often rely on simple motion detection, producing an overwhelming number of false positives (e.g., shadows, pets, moving trees). Furthermore, modern AI systems that actually detect complex human interactions (like fighting or assault) are notoriously difficult to deploy due to heavy computational requirements and fragmented video output.

**Our Goal:** To build a robust, real-time pipeline that effectively flags specific crimes or suspicious activities, stores contiguous video evidence automatically, minimizes false positives, and broadcasts these alerts seamlessly to remote clients without drowning in bandwidth costs.

---

## 3. The Dataset: UCF-Crime Dataset

### 3.1 Overview
The core of our scene-level anomaly classification relies on the **UCF-Crime dataset**. UCF-Crime is a large-scale dataset of 128 hours of videos, consisting of 1900 long and untrimmed real-world surveillance videos.
It covers 13 distinct real-world anomalies: *Abuse, Arrest, Arson, Assault, Road Accidents, Burglary, Explosion, Fighting, Robbery, Shooting, Stealing, Shoplifting, and Vandalism*, alongside a 14th class representing *Normal Activities*.

### 3.2 Why We Chose UCF-Crime
- **Unconstrained Real-World Environments:** Unlike the UCSD Ped2 or CUHK Avenue datasets, which feature staged actors in controlled walkway settings, UCF-Crime consists of actual CCTV footage with varying lighting, resolutions, and camera angles.
- **Complexity of Actions:** Datasets like KTH or HMDB51 focus on simple human actions (walking, clapping). SentinelAI required the capability to classify high-stakes anomalies that involve multiple people and temporal complexity (e.g., fighting or robbery).

---

## 4. In-Depth Explanation of Key Technical Concepts & Pipeline

Our AI pipeline uses a **Dual-Pipeline Hybrid Architecture** designed specifically to balance accuracy and performance.

### 4.1 Concept 1: Spatiotemporal Feature Extraction (ResNet18 + LSTM)
A single frame of a video cannot tell you if a "robbery" is happening; motion over time is required. 
- **ResNet18:** A Convolutional Neural Network (CNN) used to extract high-level visual features (spatial data) from individual frames. We resize frames to 112x112 and pass them through ResNet18.
- **LSTM (Long Short-Term Memory):** A Recurrent Neural Network (RNN) designed to process sequences of data. We feed the ResNet18 features from 16-frame clips into the LSTM to discern the *temporal* relationship (the actual movement or action over time).

### 4.2 Concept 2: Skeletal Heuristics & Filtering (YOLOv8-Pose)
While ResNet18+LSTM is great for scene-level classification, it is highly susceptible to adversarial scenes (e.g., a fast-moving crowd might look like a "fight"). 
To counteract this, we integrated **YOLOv8-Pose**. YOLOv8-Pose tracks human skeletons in real-time. By applying deterministic heuristics (e.g., checking the velocity of a wrist bounding box or the proximity of two skeletons), we can *veto* the deep learning model.
- **Example:** If the ResNet+LSTM flags an "Assault" with 85% confidence, but YOLOv8-Pose detects the two individuals moving slowly and calmly, the system downgrades the threat, recognizing it as a "Hug" or "Close Conversation."

---

## 5. Architectural Choices: Rejections vs. Selections

Throughout development, we faced multiple inflection points regarding technology choices. Below is a detailed comparison of why we chose our current stack.

### 5.1 AI Models: ResNet18+LSTM vs. 3D-CNNs (C3D / I3D)
* **What we rejected:** 3D Convolutional Neural Networks like I3D. These models process spatial and temporal dimensions simultaneously.
* **Why we rejected it:** Extreme memory overhead. 3D-CNNs require massive VRAM. Running them on edge devices or standard consumer GPUs results in massive frame drops. 
* **What we chose:** ResNet18 + LSTM.
* **Why:** Decoupling spatial extraction (ResNet18) from time-series analysis (LSTM) allows us to run inference on 16-frame chunks extremely quickly. The addition of YOLOv8-Pose allows us to retain accuracy without the computation cost of a 3D-CNN.

### 5.2 Video Networking: Cloudflare Tunnel vs. Ngrok
* **What we rejected:** Ngrok. Early in the project, we used Ngrok to expose our local FastAPI server to the web dashboard.
* **Why we rejected it:** Bandwidth bottlenecks. Video streaming over Ngrok quickly hit rate limits and caused massive latency. When attempting to stream localized MP4 anomaly clips back to the frontend, Ngrok choked.
* **What we chose:** Hybrid Networking w/ Cloudflare Tunnel.
* **Why:** Cloudflare Tunnels provide robust, production-grade HTTPS for our API endpoints, WebSockets, and Authentication callbacks. Crucially, we architected a hybrid routing system where lightweight API/JSON payloads travel securely over the public Cloudflare Tunnel, while heavy video clip streaming is served directly over the local network (LAN) using local LAN IP routing, yielding zero latency and infinite bandwidth for video playback.

### 5.3 Video Clipping: Event-Driven State Machine vs. Frame-by-Frame
* **What we rejected:** Saving individual JPEG frames to disk when an anomaly occurs and stitching them later.
* **Why we rejected it:** Battered I/O speeds and fragmented evidence. It resulted in a terrible user experience where "incidents" on the frontend were just slideshows of disjointed frames.
* **What we chose:** Continuous Time-Driven State Machine yielding single MP4s.
* **Why:** We built a rolling buffer that saves continuous video to disk encoded as standard `H.264/avc1`. When an anomaly triggers (Event Start), the system writes a pre-roll buffer, records the event, applies a post-roll buffer when activity ceases (Event End), and releases a single, perfectly playable high-quality MP4 to the user's dashboard.

### 5.4 Backend Framework: FastAPI / WebSockets vs. Django/Flask
* **What we rejected:** Synchronous frameworks like standard Django or Flask.
* **Why we rejected it:** Video processing is I/O and CPU bound. Synchronous workers would block the entire application while running inference on a video stream, freezing the UI.
* **What we chose:** FastAPI with WebSockets and Server-Sent Events (SSE).
* **Why:** Unparalleled async performance. The frontend receives alerts instantly via WebSockets as the YOLO tracker updates. SSE is used for long-lived progress bars (e.g., displaying the progress of a large MP4 upload).

### 5.5 Database & Auth: Supabase vs. Firebase/Custom Postgres
* **What we chose:** Supabase.
* **Why:** We needed a relational schema (Postgres) to map complex relationships (Users -> Cameras -> Incidents -> Video Clips). Firebase's NoSQL approach makes complex tabular queries cumbersome. Supabase gave us Postgres, alongside an instant API and out-of-the-box Auth (which we customized with a Gmail SMTP relay for password resets). 

---

## 6. Challenges constraints and Outcomes

### 6.1 What We Attempted But Couldn't Fully Solve (Limitations)
1. **Edge-Device GPU Starvation:** Despite optimizing the pipeline, processing the 14-class UCF-Crime weights dynamically on machines *without* a dedicated GPU remains unviable for true real-time scenarios (30+ FPS). 
   - *Workaround Implemented:* We built a fallback "mock inference" module that seamlessly activates when weights are missing or hardware is insufficient. While the ResNet/LSTM classes fall back to mock data, we ensured that the YOLOv8-Pose people-counting metrics remain active, ensuring the dashboard always has valuable analytical data.
2. **Perfect Multi-Camera Syncing:** Synchronizing WebSockets perfectly across 5+ concurrent highly active camera feeds on a standard backend instance caused slight desyncs in frame timestamps.

### 6.2 What We Excelled At (The Successes)
1. **False Positive Eradication via Fusion:** By fusing the UCF-Crime classification (LSTM) with direct human skeletal interaction (YOLOv8-Pose), we successfully implemented an "Explainable AI" component where the system doesn't just say "Anomaly: 90%", but rather "Anomaly: Assault [Vetoed: Skeletons indicate hugging]".
2. **The Hybrid Network Architecture:** The move to Cloudflare Tunnel + LAN video streaming fundamentally transformed the usability of the app, achieving real-world viability.
3. **Flawless UI Integration:** The frontend smoothly interprets real-time SSEs, dynamically updates foot-traffic charts, manages secure sign-ups with custom SMTP, and correctly logs every incident to the Supabase PostgreSQL database for historical auditing.

## 7. Conclusion
SentinelAI stands as a heavily optimized, end-to-end anomaly detection pipeline. By conscientiously navigating the tradeoffs between model accuracy and real-time processing limits—specifically through our YOLOv8-pose hardware compromise and hybrid networking structure—we built a secure, comprehensive system that solves the core issues plaguing modern automated surveillance.
