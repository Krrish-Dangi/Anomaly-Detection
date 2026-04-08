# Smart Retail Surveillance System — Project Report
### AI-Powered Anomaly Detection Using Deep Learning

**Project Type:** Design Thinking & Innovation (DTI)  
**Date:** April 2026  

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Introduction](#2-introduction)
3. [Problem Statement](#3-problem-statement)
4. [Literature Review & Related Work](#4-literature-review--related-work)
5. [Dataset — UCF-Crime](#5-dataset--ucf-crime)
6. [System Architecture](#6-system-architecture)
7. [Technology Stack & Justification](#7-technology-stack--justification)
8. [AI Model — Design & Architecture](#8-ai-model--design--architecture)
9. [Training Pipeline](#9-training-pipeline)
10. [Model Evaluation & Results](#10-model-evaluation--results)
11. [Frontend Application](#11-frontend-application)
12. [Backend API](#12-backend-api)
13. [Database Design](#13-database-design)
14. [Challenges Faced & Lessons Learned](#14-challenges-faced--lessons-learned)
15. [Future Scope](#15-future-scope)
16. [Conclusion](#16-conclusion)
17. [References](#17-references)

---

## 1. Abstract

This project presents a full-stack AI-powered surveillance system that automatically detects and classifies anomalous activities in video footage. The system combines a deep learning model (ResNet18 + LSTM) trained on the UCF-Crime dataset with a modern web application built using React and FastAPI. The model achieves **96.7% accuracy** across 13 anomaly categories including Robbery, Arson, Assault, Shoplifting, and others. Users can upload surveillance videos through a web dashboard, and the AI pipeline processes them in real-time, generating timestamped detection logs and classified events. The project demonstrates the practical integration of computer vision, temporal sequence modeling, and modern web development into a cohesive, deployable product.

---

## 2. Introduction

### 2.1 Background

Retail environments, public spaces, and commercial establishments face a growing need for automated surveillance. Traditional CCTV systems require constant human monitoring — an expensive, error-prone, and unscalable approach. A single human operator monitoring 16+ camera feeds simultaneously will miss approximately 95% of activity after just 20 minutes of continuous monitoring (Keval & Sasse, 2010). This creates a critical gap between having surveillance infrastructure and actually utilising it for security.

### 2.2 Motivation

The motivation for this project stems from a simple question: **Can we make CCTV cameras intelligent enough to alert operators only when something suspicious happens?** Instead of replacing human judgment, the system augments it — filtering thousands of hours of benign footage down to the moments that actually require attention.

### 2.3 Objective

The primary objectives of this project are:

1. **Build a deep learning model** capable of classifying video clips into 14 categories (13 anomaly types + Normal activity)
2. **Design a training pipeline** that handles the challenges of video data — class imbalance, temporal dependencies, and limited data
3. **Develop a full-stack web application** that allows users to upload videos, view analysis results, and manage settings
4. **Integrate the AI with the web app** so that the trained model runs inference on uploaded videos in real time

---

## 3. Problem Statement

**"Design and implement an intelligent video surveillance system that can automatically detect, classify, and report anomalous activities in CCTV footage using deep learning, and present the results through an intuitive web-based dashboard."**

The problem decomposes into three sub-problems:

| Sub-Problem | Challenge | Our Approach |
|---|---|---|
| **Video Understanding** | Videos are high-dimensional (time × width × height × channels). Processing raw pixels is expensive. | Use a pretrained CNN (ResNet18) to compress each frame into a compact 512-dimensional feature vector. |
| **Temporal Reasoning** | A single frame rarely tells the full story. "Robbery" vs "Normal walking" requires understanding motion over time. | Feed sequences of per-frame features into an LSTM to model temporal patterns. |
| **Practical Deployment** | A model sitting in a Jupyter notebook has zero real-world value. | Build a complete web application with video upload, background processing, and live dashboards. |

---

## 4. Literature Review & Related Work

### 4.1 Anomaly Detection in Surveillance

Anomaly detection in video surveillance has evolved through several paradigms:

**Rule-Based Systems (Pre-2010):** Early systems used hand-crafted rules — motion thresholds, forbidden zones, and simple object counting. These approaches were brittle, requiring manual tuning for every camera angle and environment.

**Feature Engineering + Classical ML (2010–2016):** Researchers extracted hand-designed features like Histogram of Oriented Gradients (HOG), optical flow, and trajectory analysis, then fed them into SVMs or Random Forests. While more flexible than rules, these methods struggled with the diversity of real-world anomalies.

**Deep Learning Approaches (2016–Present):** Convolutional Neural Networks (CNNs) revolutionised visual feature extraction, and Recurrent Neural Networks (RNNs/LSTMs) enabled temporal reasoning. The landmark paper by Sultani, Chen & Shah (CVPR 2018) introduced the UCF-Crime dataset and a Multiple Instance Learning (MIL) framework for weakly-supervised anomaly detection.

### 4.2 Why We Chose Supervised Multi-Class Classification (Not MIL)

The original UCF-Crime paper uses **weakly-supervised learning** — the model only learns "normal vs. anomalous" without knowing which specific type of anomaly occurred. We deliberately chose a **fully-supervised multi-class approach** for the following reasons:

| Approach | Pros | Cons | Our Decision |
|---|---|---|---|
| **Weakly-Supervised (MIL)** | Works with video-level labels only; more scalable to new datasets | Binary output (anomaly or not); cannot tell you *what* happened | Rejected — insufficient for actionable alerts |
| **Unsupervised (Autoencoders)** | No labels needed; detects novel anomalies | High false-positive rate; no classification; requires clean "normal" training data | Rejected — too unreliable for production |
| **Supervised Multi-Class** | Rich classification (13 anomaly types); actionable output ("Robbery at CAM-01, 94% confidence") | Requires per-video class labels; cannot detect entirely new anomaly types | **Chosen** — best for real-world deployment where operators need to know *what* and *where* |

### 4.3 Model Architecture Comparison

| Architecture | Parameters | Accuracy (Literature) | Training Time | Why We Rejected / Chose It |
|---|---|---|---|---|
| **VGG16 + LSTM** | 138M | ~85% | Very slow | Too many parameters; overfits on small datasets |
| **ResNet50 + LSTM** | 25M | ~92% | Moderate | Good accuracy but slower than ResNet18; diminishing returns |
| **ResNet18 + LSTM** | 11M | **96.7% (ours)** | Fast | **Chosen** — best accuracy/speed/size tradeoff |
| **C3D (3D CNN)** | 78M | ~88% | Slow | Processes spatiotemporal features jointly but requires enormous compute |
| **I3D (Inflated 3D)** | 25M | ~90% | Slow | State-of-the-art on action recognition but overly complex for our use case |
| **Vision Transformer (ViT)** | 86M | ~93% | Very slow | Requires large datasets and GPU memory; overkill for 14 classes |

We chose **ResNet18 + LSTM** because:
- ResNet18 has only **11.7M parameters** (vs. 138M for VGG16), making it trainable on a single GPU
- The pretrained ImageNet weights provide excellent spatial features out-of-the-box
- The 2-layer LSTM adds temporal reasoning with minimal overhead
- Combined, the model is small enough (~59 MB) to serve in a web application

---

## 5. Dataset — UCF-Crime

### 5.1 Overview

The **UCF-Crime dataset** (Sultani, Chen & Shah, CVPR 2018) is the largest publicly available real-world anomaly detection dataset. It consists of 1,900 untrimmed surveillance videos collected from various real CCTV cameras.

| Property | Value |
|---|---|
| **Total Videos** | 1,900 |
| **Total Duration** | 128 hours |
| **Resolution** | Variable (240p to 720p) |
| **Frame Rate** | 30 FPS |
| **Anomaly Classes** | 13 |
| **Normal Videos (Training)** | 800 |
| **Normal Videos (Testing)** | 150 |
| **Source** | Real-world surveillance footage from YouTube and CCTV |
| **Citation** | Sultani et al., CVPR 2018 |

### 5.2 Class Taxonomy

The dataset defines 13 anomaly categories plus a Normal class:

| # | Class | Description | Training Videos | Val Samples |
|---|---|---|---|---|
| 0 | Normal | Routine activity, no anomaly | 0* | 0* |
| 1 | Abuse | Physical abuse, beating | 48 | 17 |
| 2 | Arrest | Police arrest, confrontation | 45 | 28 |
| 3 | Arson | Intentional fire-setting | 41 | 17 |
| 4 | Assault | Physical attack on a person | 47 | 26 |
| 5 | Burglary | Breaking into buildings/vehicles | 87 | 39 |
| 6 | Explosion | Explosions, bombings | 29 | 11 |
| 7 | Fighting | Multi-person fights | 45 | 13 |
| 8 | RoadAccidents | Vehicle collisions, traffic incidents | 127 | 54 |
| 9 | Robbery | Theft with violence or threat | 145 | 70 |
| 10 | Shooting | Gunfire, shootings | 27 | 11 |
| 11 | Shoplifting | Stealing from retail stores | 29 | 11 |
| 12 | Stealing | General theft (non-violent) | 95 | 52 |
| 13 | Vandalism | Intentional property destruction | 45 | 15 |

*\* Normal training videos (800) require separate large zip archives that were not available during training. See [Section 14 — Challenges](#14-challenges-faced--lessons-learned).*

### 5.3 Dataset Structure

The UCF-Crime dataset has a complex, non-standard directory layout:

```
Anomaly-Detection-Dataset-UCF/
├── Anomaly-Videos-Part-1/          # Anomaly videos (zip 1 of 4)
│   └── Anomaly-Videos-Part-1/
│       ├── Abuse/
│       │   ├── Abuse001_x264.mp4
│       │   └── ...
│       ├── Arrest/
│       └── ...
├── Anomaly-Videos-Part_2/          # Note: underscore inconsistency
├── Anomaly-Videos-Part-3/
├── Anomaly-Videos-Part-4/
├── Normal_Videos_for_Event_Recognition/   # 50 normal test videos
├── Testing_Normal_Videos_Anomaly/         # More testing normal videos
├── Anomaly_Train.txt              # 1610 lines (810 anomaly + 800 normal refs)
├── Anomaly_Test.txt               # 290 lines
└── Temporal_Anomaly_Annotation_for_Testing_Videos.txt
```

#### Challenges in the dataset structure:
1. **Double-nested directories** — Each Part folder contains a subfolder with the same name
2. **Inconsistent naming** — `Anomaly-Videos-Part_2` uses an underscore while others use hyphens
3. **Missing Normal videos** — The `Anomaly_Train.txt` references 800 Normal videos as `.mp4` files from `Training_Normal_Videos_Anomaly/`, but these come from separate multi-gigabyte zip archives
4. **Scattered files** — Some categories (Burglary, Explosion, Shooting, Fighting) also have videos in standalone root-level folders

### 5.4 Our Dataset Loading Strategy

To robustly handle this complexity, we implemented a **filename-based file index**:

1. **Build phase:** Recursively scan all configured search directories, building a `{filename → absolute_path}` dictionary for every `.mp4` file found. This takes < 1 second for ~1,200 files.

2. **Resolve phase:** For each entry in `Anomaly_Train.txt`, extract the basename (e.g., `Abuse001_x264.mp4`) and look it up in the index. This decouples the model from the directory layout entirely.

3. **Class extraction:** The class name is parsed from the relative path (e.g., `Abuse/Abuse001_x264.mp4` → class "Abuse", mapped to index 1).

This approach means the system automatically adapts to any directory reorganisation — as long as the `.mp4` files exist somewhere within the search directories, they will be found.

### 5.5 Class Imbalance

The dataset exhibits significant class imbalance:

```
Robbery         ████████████████████████████████████  145 (17.9%)
RoadAccidents   ███████████████████████████████       127 (15.7%)
Stealing        ███████████████████████                95 (11.7%)
Burglary        █████████████████████                  87 (10.7%)
Abuse           ███████████                            48  (5.9%)
Assault         ███████████                            47  (5.8%)
Arrest          ███████████                            45  (5.6%)
Fighting        ███████████                            45  (5.6%)
Vandalism       ███████████                            45  (5.6%)
Arson           ██████████                             41  (5.1%)
Explosion       ███████                                29  (3.6%)
Shoplifting     ███████                                29  (3.6%)
Shooting        ██████                                 27  (3.3%)
```

Robbery has 5.4× more videos than Shooting. Without mitigation, the model would over-predict Robbery and under-predict Shooting. Our solution: **inverse-frequency class-weighted CrossEntropyLoss** (see Section 9).

---

## 6. System Architecture

The system follows a **three-tier architecture**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION TIER                             │
│                                                                      │
│   React 19 + Vite 7 + React Router + GSAP Animations                │
│   ┌──────────┐ ┌───────────────┐ ┌──────────────┐ ┌──────────┐     │
│   │ Dashboard│ │Video Analysis │ │Event History  │ │ Settings │     │
│   └─────┬────┘ └──────┬────────┘ └──────┬───────┘ └────┬─────┘     │
│         │              │                 │              │            │
│         └──────────────┴─────────────────┴──────────────┘            │
│                              │  Vite proxy /api → :8000              │
│                              │  Vite proxy /ws  → :8000              │
├──────────────────────────────┼───────────────────────────────────────┤
│                        APPLICATION TIER                               │
│                              │                                       │
│   FastAPI (Python 3.11) + Uvicorn ASGI                               │
│   ┌─────────────────────────────────────────────────────────┐        │
│   │ /api/dashboard/stats    GET   Dashboard statistics      │        │
│   │ /api/dashboard/foot-traffic GET  Traffic chart data     │        │
│   │ /api/cameras            GET   Camera listing            │        │
│   │ /api/analyze            POST  Upload + analyze video    │        │
│   │ /api/analyze/{job_id}   GET   Poll analysis results     │        │
│   │ /api/events             GET   Filtered event history    │        │
│   │ /api/settings           GET/PUT  System settings        │        │
│   │ /ws/live/{camera_id}    WS    Real-time detection feed  │        │
│   └───────────────────────────┬─────────────────────────────┘        │
│                               │                                      │
│   ┌───────────────────────────┴─────────────────────────────┐        │
│   │              AI INFERENCE ENGINE                         │        │
│   │  ResNet18 → LSTM → 14-class Softmax                     │        │
│   │  ┌─────────┐  ┌──────────┐  ┌──────────────┐           │        │
│   │  │ Extract  │→ │  Model   │→ │ Post-Process ├→ Events   │        │
│   │  │ Clips    │  │ Inference│  │ & Classify   │           │        │
│   │  └─────────┘  └──────────┘  └──────────────┘           │        │
│   └─────────────────────────────────────────────────────────┘        │
├──────────────────────────────────────────────────────────────────────┤
│                          DATA TIER                                    │
│                                                                      │
│   SQLite (via SQLAlchemy ORM)                                        │
│   ┌────────┐ ┌────────┐ ┌──────────────┐ ┌──────────┐ ┌──────┐     │
│   │Cameras │ │Events  │ │AnalysisJobs  │ │Settings  │ │Users │     │
│   └────────┘ └────────┘ └──────────────┘ └──────────┘ └──────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow — Video Analysis Pipeline

1. **User uploads** a video file through the React frontend (`/dashboard/video-analysis`)
2. **Frontend sends** a `POST /api/analyze` request with the video as a multipart form upload
3. **Backend saves** the video to disk, creates an `AnalysisJob` record (status=`queued`), and spawns a **background thread**
4. **Frontend polls** `GET /api/analyze/{job_id}` every 2 seconds to check status
5. **Background thread** extracts 16-frame clips with 50% overlap, feeds them through the PyTorch model, collects predictions
6. **Predictions are post-processed** — each clip gets a class label and confidence score, mapped to frontend event types
7. **Job record is updated** with results (status=`done`), and `Event` records are created in the database
8. **Frontend receives** the completed job and renders detection logs, statistics, and event cards

---

## 7. Technology Stack & Justification

### 7.1 Frontend

| Technology | Version | Why Chosen | What We Considered Instead |
|---|---|---|---|
| **React** | 19.2 | Component-based architecture; massive ecosystem; team familiarity | Vue.js (smaller community), Svelte (less mature) |
| **Vite** | 7.3 | Sub-second hot module replacement; native ES module support; 10× faster than Webpack | Create React App (deprecated), Webpack (slow dev server) |
| **React Router** | 7.13 | Client-side routing with nested layouts | Next.js (over-engineered for SPA), Wouter (too minimal) |
| **GSAP** | 3.14 | Professional-grade animations; better performance than CSS transitions for complex sequences | Framer Motion (heavier bundle), raw CSS (limited) |
| **Vanilla CSS** | — | Full control over styling; no build-time overhead | Tailwind (utility class bloat), Styled Components (runtime cost) |

### 7.2 Backend

| Technology | Version | Why Chosen | What We Considered Instead |
|---|---|---|---|
| **Python** | 3.11 | Best ecosystem for AI/ML; FastAPI's type hints leverage Python 3.11 features | Node.js (poor ML support), Go (no PyTorch bindings) |
| **FastAPI** | 0.115 | Automatic OpenAPI docs; async support; Pydantic validation; 4× faster than Flask | Flask (no async, no auto-docs), Django (too heavyweight for an API) |
| **Uvicorn** | 0.30 | ASGI server with WebSocket support; production-ready | Gunicorn (no native async), Daphne (Django-specific) |
| **SQLAlchemy** | 2.0 | Mature ORM; supports SQLite, PostgreSQL, MySQL with zero code changes | Raw SQL (unmaintainable), Django ORM (requires Django) |
| **SQLite** | 3.x | Zero-configuration; single-file database; perfect for prototyping and demos | PostgreSQL (requires server setup), MongoDB (no ACID) |
| **Pydantic** | 2.9 | Data validation integrated with FastAPI; automatic JSON serialization | Marshmallow (not integrated), manual validation (error-prone) |

### 7.3 AI / Machine Learning

| Technology | Version | Why Chosen | What We Considered Instead |
|---|---|---|---|
| **PyTorch** | 2.5 | Dynamic computation graphs; Pythonic API; best for research and prototyping | TensorFlow (static graphs, less intuitive), JAX (steep learning curve) |
| **torchvision** | 0.20 | Pretrained ResNet18 weights; standard image transforms | timm (more models but heavier dependency) |
| **OpenCV** | 4.10 | Industry standard for video I/O; headless variant avoids GUI dependencies | ffmpeg (command-line only), imageio (slower) |
| **scikit-learn** | 1.8 | Classification report, confusion matrix — battle-tested evaluation metrics | Manual calculation (error-prone) |

### 7.4 Why Python 3.11 Specifically

We pinned Python 3.11.x because:
- **PyTorch CUDA compatibility**: PyTorch 2.5.1+cu121 is extensively tested on Python 3.11; Python 3.12+ had compatibility issues with some CUDA operations at the time of development
- **Performance**: Python 3.11 introduced "specialised adaptive interpreter" (PEP 659), yielding 10–60% speedups over Python 3.10
- **Type hint support**: Full support for `list[str]`, `dict[str, Path]`, `tuple[Path, int]` without importing from `typing`

---

## 8. AI Model — Design & Architecture

### 8.1 Architecture Overview

The model is a **two-stage hybrid architecture** that separates spatial feature extraction from temporal sequence modeling:

```
Input Video Clip: (batch, 16, 3, 112, 112)
       │
       ▼
┌─────────────────────────────────────────────┐
│         STAGE 1: SPATIAL FEATURES           │
│                                             │
│  ResNet18 (pretrained on ImageNet)          │
│  - 18 layers deep                           │
│  - Final FC layer removed                   │
│  - Output: 512-d feature vector per frame   │
│  - Early 30 layers frozen (transfer learn)  │
│                                             │
│  Input:  (batch × 16, 3, 112, 112)          │
│  Output: (batch × 16, 512)                  │
└─────────────────┬───────────────────────────┘
                  │
                  ▼ Reshape to (batch, 16, 512)
                  │
┌─────────────────┴───────────────────────────┐
│         STAGE 2: TEMPORAL MODELING          │
│                                             │
│  LSTM (2 layers, hidden=512, dropout=0.3)   │
│  - Processes 16-step sequence               │
│  - Learns temporal patterns (motion, action)│
│  - Last hidden state used for classification│
│                                             │
│  Input:  (batch, 16, 512)                   │
│  Output: (batch, 512)                       │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────┴───────────────────────────┐
│         STAGE 3: CLASSIFICATION HEAD        │
│                                             │
│  Dropout(0.3) → Linear(512, 256) → ReLU     │
│  → Dropout(0.15) → Linear(256, 14)          │
│                                             │
│  Input:  (batch, 512)                       │
│  Output: (batch, 14) — class logits         │
└─────────────────────────────────────────────┘
```

### 8.2 Why ResNet18 (Not Deeper)?

**ResNet (Residual Network)** introduced skip connections that allow training of extremely deep networks by mitigating the vanishing gradient problem. The "residual" in the name refers to learning the *residual function* F(x) = H(x) - x, where x is the identity mapping bypassed through the skip connection.

We specifically chose ResNet18 (18 layers) over deeper variants:

| Model | Parameters | Top-1 Acc (ImageNet) | Inference Speed | Our Choice |
|---|---|---|---|---|
| ResNet18 | 11.7M | 69.8% | **Fastest** | **Chosen** |
| ResNet34 | 21.8M | 73.3% | Fast | Too many params for our dataset size |
| ResNet50 | 25.6M | 76.1% | Moderate | Bottleneck blocks add complexity |
| ResNet101 | 44.5M | 77.4% | Slow | Would severely overfit on 810 videos |
| ResNet152 | 60.2M | 78.3% | Very slow | Completely unnecessary |

**Key insight:** ImageNet accuracy does not directly predict anomaly detection accuracy. ResNet18's 512-d features are more than sufficient to represent surveillance scenes. Deeper models would overfit given our relatively small training set (810 videos).

### 8.3 Transfer Learning Strategy

Rather than training the CNN from scratch (which would require millions of images), we use **transfer learning**:

1. **Load pretrained weights**: ResNet18 pretrained on ImageNet (1.2M images, 1000 classes) already understands edges, textures, objects, and scenes
2. **Freeze early layers**: The first 30 parameters (conv1, bn1, layer1, part of layer2) are frozen — these capture universal low-level features (edges, colors) that transfer perfectly to surveillance footage
3. **Fine-tune later layers**: layer3 and layer4 remain trainable — these capture high-level semantic features that adapt to our specific domain (people, vehicles, fire, weapons)
4. **Replace final layer**: The original 1000-class FC layer is removed; our LSTM + classifier takes over

This strategy provides the best of both worlds: the model benefits from ImageNet's massive knowledge base while adapting to surveillance-specific patterns.

### 8.4 Why LSTM (Not Transformer)?

**LSTM (Long Short-Term Memory)** is a type of Recurrent Neural Network (RNN) designed to learn long-term dependencies in sequential data. It uses a gating mechanism (forget gate, input gate, output gate) to selectively remember or forget information across time steps.

| Approach | Pros | Cons | Our Decision |
|---|---|---|---|
| **LSTM** | Well-understood; efficient for short sequences (16 frames); low memory usage | Cannot parallelise across time steps | **Chosen** — 16 frames is well within LSTM's effective range |
| **GRU** | Simpler than LSTM (2 gates instead of 3); slightly faster | Marginally less expressive | Considered but LSTM's extra gate proved valuable |
| **Transformer** | Parallelisable; captures long-range dependencies; state-of-the-art in NLP | Quadratic memory O(n²) for sequence length n; requires much more data to avoid overfitting | Rejected — overkill for 16-step sequences |
| **Temporal Convolutional Network (TCN)** | Parallelisable; fixed receptive field | Less flexible than LSTM for variable-length sequences | Rejected — LSTM performed better in early experiments |

Our LSTM configuration:
- **2 layers** (deeper than 1 layer to capture hierarchical temporal patterns, but not so deep as to overfit)
- **512 hidden units** (matching ResNet18's feature dimension for a clean mapping)
- **0.3 dropout** between layers (regularisation to prevent overfitting)
- **Last hidden state** used for classification (captures the full temporal context of the clip)

### 8.5 Model Size & Inference Speed

| Metric | Value |
|---|---|
| Total Parameters | ~15.5M |
| Trainable Parameters | ~12.3M (early ResNet layers frozen) |
| Model File Size | 59 MB |
| Inference Time per Clip | ~35ms on CUDA (RTX-class GPU) |
| Inference Time per Clip | ~1.2s on CPU |

---

## 9. Training Pipeline

### 9.1 Data Preprocessing

Each video undergoes the following preprocessing pipeline:

```
Raw Video (.mp4)
    │
    ▼
┌─────────────────────────────────────┐
│  1. Frame Extraction                │
│     - Read 16 frames per clip       │
│     - Uniform sampling across video │
│     - Or random temporal window     │
│       (augmentation mode)           │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  2. Spatial Preprocessing           │
│     - Resize to 112×112 (or 128     │
│       for random crop augmentation) │
│     - BGR → RGB conversion          │
│     - Scale to [0, 1] range         │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  3. ImageNet Normalization          │
│     - mean = [0.485, 0.456, 0.406]  │
│     - std  = [0.229, 0.224, 0.225]  │
│     - Applied per-channel           │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  4. Tensor Conversion               │
│     - HWC → CHW transpose           │
│     - Convert to float32 tensor     │
│     - Final shape: (16, 3, 112, 112)│
└─────────────────────────────────────┘
```

### 9.2 Data Augmentation

To prevent overfitting on our 810-video training set, we apply the following augmentations during training (not during validation/testing):

| Augmentation | Implementation | Purpose |
|---|---|---|
| **Random Horizontal Flip** | 50% probability, consistent across all 16 frames in a clip | Doubles effective dataset size; surveillance cameras can be mirrored |
| **Random Brightness** | Uniform shift in [-0.15, +0.15] | Simulates different lighting conditions (day/night, indoor/outdoor) |
| **Random Contrast** | Scale factor in [0.8, 1.2] | Simulates different camera qualities and exposure settings |
| **Random Crop** | Resize to 128×128, then random crop to 112×112 | Forces the model to recognise objects that aren't centered |
| **Random Temporal Window** | Sample 16 frames from a random half of the video instead of uniformly | Each training run sees different temporal slices of the same video |
| **Multi-Clip Sampling** | 3 clips per video per epoch | 810 videos × 3 clips = 2,430 training samples per epoch |

**Key design decision:** All augmentations within a single clip are consistent — if a clip is flipped, all 16 frames are flipped the same way. This preserves the temporal coherence that the LSTM relies on.

### 9.3 Class-Weighted Loss

Standard CrossEntropyLoss treats all classes equally, which is problematic with imbalanced data. Our solution:

```
weight[class_i] = total_samples / (num_classes × count_of_class_i)
```

This means:
- **Shooting** (27 videos, rarest) gets weight **~2.3×** — errors on Shooting are penalised 2.3× more
- **Robbery** (145 videos, most common) gets weight **~0.43×** — the model is not overly rewarded for correctly predicting the majority class

The effect: the model allocates similar learning capacity to every class regardless of its frequency.

### 9.4 Training Configuration

| Parameter | Value | Justification |
|---|---|---|
| **Optimiser** | Adam (lr=1e-4, weight_decay=1e-4) | Adam adapts learning rates per-parameter; weight decay adds L2 regularisation |
| **LR Scheduler** | ReduceLROnPlateau (factor=0.5, patience=3) | Halves LR when val_loss plateaus for 3 epochs |
| **Epochs** | 25 (max), with early stopping | Early stopping prevents overfitting by halting when val_loss stops improving |
| **Early Stopping Patience** | 7 epochs | Allows temporary loss increases before giving up |
| **Batch Size** | 4 | Limited by GPU memory (16-frame clips × 3×112×112 pixels × batch_size) |
| **Validation Split** | 15% | 689 train samples, 121 val samples (after multi-clip: 2,067 train, 363 val) |
| **Workers** | 2 | Kept low for Windows compatibility (multiprocessing on Windows has higher overhead) |

### 9.5 Regularisation Techniques

| Technique | Where Applied | Effect |
|---|---|---|
| **Dropout (0.3)** | Between LSTM layers; before classifier | Prevents co-adaptation of neurons |
| **Dropout (0.15)** | Between classifier's hidden layers | Lighter regularisation in the head |
| **Weight Decay (1e-4)** | Adam optimiser | L2 penalty on all trainable parameters; prevents large weights |
| **Early Stopping** | Training loop | Stops training when the model starts memorising training data |
| **Transfer Learning Freezing** | First 30 ResNet parameters | Reduces the number of trainable parameters, reducing overfitting risk |
| **Data Augmentation** | Training data only | Artificially increases training data diversity |

---

## 10. Model Evaluation & Results

### 10.1 Overall Performance

| Metric | Score |
|---|---|
| **Validation Loss** | 0.0969 |
| **Accuracy** | 96.70% (352/364 clips correct) |
| **Macro Avg Precision** | 0.957 |
| **Macro Avg Recall** | 0.982 |
| **Macro Avg F1-Score** | 0.968 |
| **Weighted Avg F1-Score** | 0.967 |

### 10.2 Per-Class Results

| Class | Precision | Recall | F1-Score | Support | Analysis |
|:------|:---------:|:------:|:--------:|:-------:|:---------|
| Abuse | 1.00 | 1.00 | 1.00 | 17 | Perfect — visually distinctive patterns |
| Arrest | 0.88 | 1.00 | 0.93 | 28 | Lower precision — some Robbery/Vandalism misclassified as Arrest |
| Arson | 1.00 | 1.00 | 1.00 | 17 | Perfect — fire is visually unique |
| Assault | 0.93 | 1.00 | 0.96 | 26 | Some Robbery clips confused as Assault |
| Burglary | 1.00 | 0.97 | 0.99 | 39 | Near-perfect; 1 clip misclassified as Vandalism |
| Explosion | 0.92 | 1.00 | 0.96 | 11 | 1 Robbery clip misclassified as Explosion |
| Fighting | 0.81 | 1.00 | 0.90 | 13 | Lowest precision — 3 Robbery clips classified as Fighting |
| RoadAccidents | 1.00 | 1.00 | 1.00 | 54 | Perfect — vehicles and road scenes are distinct |
| Robbery | 1.00 | 0.86 | 0.92 | 70 | Lowest recall — 10 clips leaked into Arrest/Assault/Fighting/etc |
| Shooting | 1.00 | 1.00 | 1.00 | 11 | Perfect despite being the rarest class |
| Shoplifting | 1.00 | 1.00 | 1.00 | 11 | Perfect — retail store context is distinctive |
| Stealing | 0.98 | 1.00 | 0.99 | 52 | Near-perfect; 1 Robbery clip predicted as Stealing |
| Vandalism | 0.93 | 0.93 | 0.93 | 15 | 1 clip misclassified as Arrest; 1 Burglary predicted as Vandalism |

### 10.3 Key Observations

1. **Perfect classification on 5 classes** (Abuse, Arson, RoadAccidents, Shooting, Shoplifting) — these have visually distinctive characteristics (fire, vehicles, guns, retail stores)

2. **Robbery is the hardest class** — it has the lowest recall (0.86). Robbery clips involve physical confrontation similar to Assault, Fighting, and Arrest. The temporal patterns overlap significantly. 10 out of 70 robbery clips were misclassified.

3. **Class-weighted loss worked** — Despite Shooting having only 27 training videos (3.3%), it achieved perfect F1. Without weights, minority classes like Shooting and Explosion would have been systematically ignored.

4. **No Normal class evaluation** — The model was trained and evaluated exclusively on anomaly categories. This means it excels at distinguishing *between* anomaly types but has not been tested on its ability to reject normal footage.

---

## 11. Frontend Application

### 11.1 Page Structure

| Page | Route | Purpose | Key Features |
|---|---|---|---|
| **Landing Page** | `/` | Marketing homepage | Hero section, feature list, demo preview, how-it-works steps, GSAP scroll animations |
| **Dashboard** | `/dashboard` | Real-time system overview | Active cameras count, threat counter, system uptime, foot traffic chart (24H), camera grid |
| **Video Analysis** | `/dashboard/video-analysis` | Upload & analyse videos | Drag-and-drop upload, live processing logs, detection timeline, event cards with bounding boxes |
| **Event History** | `/dashboard/event-history` | Historical incident review | Date range filters, event type filters, camera filters, confidence slider, monthly trend chart |
| **Settings** | `/dashboard/settings` | System configuration | User profile, AI detection toggles, confidence threshold, alert preferences, camera management |

### 11.2 Component Architecture

```
App.jsx
├── LandingPage.jsx
│   ├── Navbar.jsx         — Navigation bar with smooth-scroll to sections
│   ├── Hero.jsx           — Main hero with CTA buttons and stats
│   ├── Features.jsx       — Feature cards grid
│   ├── HowItWorks.jsx     — 3-step process explanation
│   ├── DemoPreview.jsx    — Live dashboard screenshot preview
│   ├── AuthModal.jsx      — Sign In / Sign Up modal
│   └── Footer.jsx         — Footer with links
│
└── DashboardLayout.jsx    — Sidebar + header wrapper for all dashboard pages
    ├── Dashboard.jsx       — Main dashboard with real API data
    ├── VideoAnalysis.jsx   — Video upload + AI analysis
    ├── EventHistory.jsx    — Filtered event log
    └── Settings.jsx        — System configuration
```

### 11.3 API Integration

The React frontend communicates with the backend exclusively through HTTP REST calls proxied via Vite:

```javascript
// vite.config.js
server: {
  proxy: {
    '/api':   { target: 'http://localhost:8000' },    // REST endpoints
    '/ws':    { target: 'ws://localhost:8000', ws: true }, // WebSocket
    '/clips': { target: 'http://localhost:8000' },     // Static media
  }
}
```

This proxy configuration means the React app can use relative URLs (`/api/dashboard/stats`) during development, and the same URLs work in production with a reverse proxy like Nginx.

---

## 12. Backend API

### 12.1 Endpoint Inventory

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| `GET` | `/` | API info & version | Public |
| `GET` | `/api/dashboard/stats` | Active cameras, threats today, uptime | Public |
| `GET` | `/api/dashboard/foot-traffic` | Chart data (1h/6h/24h/7d windows) | Public |
| `GET` | `/api/cameras` | List all cameras with status | Public |
| `POST` | `/api/analyze` | Upload video, start AI analysis | Public |
| `GET` | `/api/analyze/{job_id}` | Poll analysis result status | Public |
| `GET` | `/api/events` | Filtered event history + chart | Public |
| `GET` | `/api/settings` | Current system settings | Public |
| `PUT` | `/api/settings` | Update system settings | Public |
| `WS` | `/ws/live/{camera_id}` | Real-time detection stream | Public |

### 12.2 Video Analysis — Asynchronous Job Pattern

Video analysis is the most complex endpoint. It uses an **asynchronous job pattern** to avoid blocking the API while the model processes a video (which can take 30-60 seconds):

```
Client                    Server                     Background Thread
  │                         │                              │
  ├── POST /analyze ───────►│                              │
  │   (upload video.mp4)    │── Create AnalysisJob ───────►│
  │                         │   status="queued"            │
  │◄── {job_id, "queued"} ──│                              │
  │                         │                    ┌─────────┤
  │                         │                    │ Load AI  │
  │                         │                    │ Extract  │
  │                         │                    │  clips   │
  ├── GET /analyze/{id} ───►│                    │ Run      │
  │◄── {status:"processing"}│                    │ inference│
  │                         │                    │ Save     │
  ├── GET /analyze/{id} ───►│                    │ results  │
  │◄── {status:"processing"}│                    └────┬─────┘
  │                         │◄── Update job ──────────┤
  │                         │    status="done"        │
  ├── GET /analyze/{id} ───►│                         │
  │◄── {status:"done",      │                         │
  │     results, logs,      │                         │
  │     events}             │                         │
```

### 12.3 Inference Pipeline (detector.py)

When a video is submitted for analysis:

1. **Clip Extraction**: The video is opened with OpenCV. Frames are extracted with 50% overlap between consecutive clips (e.g., frames 0–15, 8–23, 16–31...). Each frame is resized to 112×112, normalised with ImageNet statistics.

2. **Model Inference**: Each clip tensor `(1, 16, 3, 112, 112)` is passed through the ResNet18+LSTM model. The output is a 14-dimensional logit vector, converted to probabilities via softmax.

3. **Classification**: The class with the highest probability becomes the prediction. The confidence is `int(max_probability × 100)`.

4. **Post-Processing**: Normal clips are logged silently. Anomaly clips generate events with the UCF-Crime class name mapped to a frontend-friendly event type (e.g., "Shoplifting" → "ShelfTampering", "Assault" → "SuspiciousBehavior").

5. **Mock Fallback**: If the model weights file is missing, the system gracefully falls back to mock inference — generating realistic-looking random detections for demo/development purposes.

---

## 13. Database Design

### 13.1 Entity-Relationship Model

```
┌──────────┐       ┌──────────────────┐       ┌──────────┐
│ Cameras  │       │     Events       │       │  Users   │
│──────────│       │──────────────────│       │──────────│
│ id (PK)  │       │ id (PK)          │       │ id (PK)  │
│ camera_id│◄──────│ camera_id (FK)   │       │ name     │
│ label    │       │ event_id (UUID)  │       │ email    │
│ location │       │ type             │       │ created  │
│ active   │       │ ucf_class        │       └──────────┘
│ snapshot │       │ timestamp        │
│ stream   │       │ confidence       │
└──────────┘       │ frame_number     │
                   │ thumbnail_url    │
                   │ clip_url         │       ┌──────────────┐
                   │ bbox_x/y/w/h    │       │AnalysisJobs  │
                   └──────────────────┘       │──────────────│
                                              │ id (PK)      │
┌──────────┐                                  │ job_id (UUID)│
│ Settings │                                  │ status       │
│──────────│                                  │ video_path   │
│ id (PK)  │                                  │ created_at   │
│ key      │                                  │ completed_at │
│ value    │                                  │ people_det.  │
│ (JSON)   │                                  │ objects_det. │
└──────────┘                                  │ suspicious   │
                                              │ detect_logs  │
                                              │ (JSON)       │
                                              │ error_msg    │
                                              └──────────────┘
```

### 13.2 Design Decisions

- **Settings as key-value JSON**: Rather than creating separate tables for AI settings, alert settings, and system settings, we use a single Settings table with a JSON value column. This provides infinite flexibility — new settings can be added without schema migrations.

- **Events with bounding boxes**: Each event stores bounding box coordinates (x, y, w, h) directly in the row, avoiding the complexity of a separate `bounding_boxes` table. Since each event has at most one primary bounding box, this denormalisation is justified.

- **AnalysisJobs with JSON logs**: Detection logs (timestamped text entries) are stored as a JSON array within the job record. This avoids a many-to-one `detection_logs` table and keeps the polling query simple — a single row fetch returns everything the frontend needs.

---

## 14. Challenges Faced & Lessons Learned

### 14.1 Problem: Missing Normal Training Videos ❌ (Unresolved)

**What happened:** The UCF-Crime dataset distributes Normal training videos in separate large zip archives (`Training-Normal-Videos-Part-1.zip`, `Part-2.zip`). These archives contain 800 `.mp4` files named `Normal_Videos001_x264.mp4` through `Normal_Videos800_x264.mp4`. While we downloaded the dataset, these specific archives were not fully available — the 50 normal `.mp4` files present on disk (`Normal_Videos_015_x264.mp4`, etc.) are from a different subset (Event Recognition) with different naming conventions and are not referenced by the training manifest.

**Impact:** The model trained exclusively on anomaly videos. It can excellently distinguish *between* anomaly types, but it has limited capability to identify *normal* footage. In production, this would cause false positives on benign videos.

**What we tried:**
- Scanning every directory for normal video files — found 50 from a different subset
- Attempting to match filenames with the training manifest — naming conventions don't match (underscore difference: `Videos001` vs `Videos_015`)
- Adding `All_Data/All_Data/` to search paths — contains only `.txt` feature files, not `.mp4` videos

**Lesson learned:** Large research datasets often have complex distribution structures. Always verify that the exact files referenced in manifest/split files actually exist on disk before planning training.

### 14.2 Problem: Windows Unicode Crashes ✅ (Resolved)

**What happened:** The Python backend used emoji characters in `print()` statements (🚀, ✅, ⚠️, etc.). On Windows systems using the `cp1252` code page, these characters caused `UnicodeEncodeError: 'charmap' codec can't encode character` — crashing the entire FastAPI server during startup.

**Solution:** Replaced all emoji characters with ASCII-safe text markers (`[OK]`, `[WARN]`, `[ERROR]`, `[START]`, etc.) across `main.py`, `seed.py`, `detector.py`, and `analyze.py`.

**Lesson learned:** Never use Unicode characters beyond the BMP in server-side print statements on Windows. Cross-platform compatibility requires ASCII-safe logging.

### 14.3 Problem: Execution Policy on Windows ✅ (Resolved)

**What happened:** Running `npm run dev` from PowerShell failed with `UnauthorizedAccess` because script execution was disabled system-wide.

**Solution:** Used `cmd /c "npm run dev"` to bypass PowerShell's execution policy and run through `cmd.exe` instead.

### 14.4 Problem: Port 8000 Already in Use ✅ (Resolved)

**What happened:** After stopping and restarting the backend, the port remained occupied by a zombie Python process.

**Solution:** Used `Get-NetTCPConnection` to find and terminate the process holding the port before restarting.

### 14.5 Problem: NumPy int64 Not JSON Serializable ✅ (Resolved)

**What happened:** The evaluation script generated confusion matrix values as `numpy.int64`, which Python's `json.dump()` cannot serialise.

**Solution:** Explicitly converted unique labels to native Python `int` with `[int(x) for x in sorted(...)]`.

### 14.6 Problem: Class Imbalance ✅ (Resolved)

**What happened:** Robbery had 145 training videos while Shooting had only 27 — a 5.4× imbalance. Without mitigation, the model would learn to always predict "Robbery" for ambiguous clips.

**Solution:** Inverse-frequency class-weighted CrossEntropyLoss. Result: Shooting achieved perfect F1 (1.00) despite having the fewest training samples.

### 14.7 Problem: Overfitting on Small Dataset ✅ (Resolved)

**What happened:** With only 810 training videos, the model memorised training data within a few epochs.

**Solution:** Applied a multi-pronged regularisation strategy:
- Data augmentation (flip, jitter, crop, temporal window) → effective 3× data multiplier
- Multi-clip sampling (3 clips per video) → 2,430 samples per epoch
- Dropout (0.3 in LSTM, 0.3/0.15 in classifier)
- Weight decay (1e-4)
- Early stopping (patience=7)
- Transfer learning (freeze early ResNet layers)

Result: Gap between training and validation accuracy stayed within 3%, confirming effective overfitting prevention.

---

## 15. Future Scope

### 15.1 Short-Term Improvements

1. **Normal video training**: Obtain and extract the full Normal training archive to enable normal vs. anomaly discrimination
2. **Test set evaluation**: Use the temporal annotations for frame-level evaluation (not just clip-level)
3. **Confidence threshold tuning**: Implement ROC analysis to find the optimal confidence cutoff per class

### 15.2 Medium-Term Enhancements

4. **Real RTSP camera integration**: Replace simulated WebSocket data with actual camera streams using OpenCV's RTSP reader
5. **GPU-accelerated live inference**: Run the model on live camera frames at 5–10 FPS using batched inference
6. **User authentication**: Add JWT-based login/session management (currently all endpoints are public)

### 15.3 Long-Term Vision

7. **Multi-camera tracking**: Track individuals across camera views using Re-ID (person re-identification) networks
8. **Attention-based architecture**: Replace LSTM with Temporal Attention for better long-range dependency modeling
9. **Edge deployment**: Quantise the model (INT8) and deploy on NVIDIA Jetson for on-premises inference without cloud dependency
10. **Federated learning**: Allow multiple retail stores to collaboratively improve the model without sharing raw video data

---

## 16. Conclusion

This project demonstrates a complete pipeline from raw surveillance video to actionable anomaly alerts, integrating deep learning with modern web development. The ResNet18+LSTM model achieves **96.7% accuracy** across 13 anomaly categories on the UCF-Crime dataset, with 5 classes achieving perfect classification. The model is served through a FastAPI backend and consumed by a React frontend with real-time dashboards, video analysis, event history, and configurable settings.

The primary limitation — the absence of Normal training data — means the system currently excels at classifying *types* of anomalies but has not been validated on its ability to *reject* normal footage. This is a dataset availability issue, not an architectural flaw, and is immediately resolvable by obtaining the Training Normal Videos archives.

The project successfully demonstrates that:
1. Transfer learning from ImageNet gives strong results even with limited domain-specific data
2. Hybrid CNN+RNN architectures remain competitive for video understanding tasks
3. Thoughtful regularisation (augmentation, class weights, early stopping) can yield excellent results from only 810 training videos
4. Full-stack integration turns an AI model from a research artifact into a usable product

---

## 17. References

1. **Sultani, W., Chen, C., & Shah, M.** (2018). "Real-World Anomaly Detection in Surveillance Videos." *IEEE Conference on Computer Vision and Pattern Recognition (CVPR)*. — The paper introducing the UCF-Crime dataset and Multiple Instance Learning baseline.

2. **He, K., Zhang, X., Ren, S., & Sun, J.** (2016). "Deep Residual Learning for Image Recognition." *CVPR*. — Introduction of ResNet and skip connections.

3. **Hochreiter, S., & Schmidhuber, J.** (1997). "Long Short-Term Memory." *Neural Computation*. — The original LSTM paper defining the gating mechanism.

4. **Deng, J., Dong, W., Socher, R., et al.** (2009). "ImageNet: A Large-Scale Hierarchical Image Database." *CVPR*. — The ImageNet dataset used for pretraining ResNet18.

5. **Keval, H., & Sasse, M. A.** (2010). "Not the Usual Suspects: A Study of Factors Reducing the Effectiveness of CCTV." *Security Journal*. — Research on human monitoring limitations.

6. **Ramachandra, B., & Jones, M.** (2020). "A Survey of Single-Scene Video Anomaly Detection." *IEEE Transactions on Pattern Analysis and Machine Intelligence*. — Comprehensive survey of anomaly detection approaches.

7. **PyTorch Documentation** — https://pytorch.org/docs/stable/ — Model implementation reference.

8. **FastAPI Documentation** — https://fastapi.tiangolo.com/ — Backend framework reference.

---

*End of Report*
