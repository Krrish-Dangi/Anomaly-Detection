import requests
import json
import time

try:
    import sseclient
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "sseclient-py"])
    import sseclient

# Upload first file in media dir
import os
media_dir = "data/media"
videos = [f for f in os.listdir(media_dir) if f.endswith('.mp4')]
if not videos:
    print("No videos found to test.")
    exit(1)

video_path = os.path.join(media_dir, videos[0])

print(f"Uploading {video_path}...")
res = requests.post('http://localhost:8000/api/analyze', files={'video': open(video_path, 'rb')})
print("POST response:", res.status_code, res.text)
job_id = res.json()['job_id']

print(f"Listening to SSE for job {job_id}...")
response = requests.get(f'http://localhost:8000/api/analyze/{job_id}/stream', stream=True)
client = sseclient.SSEClient(response)
for event in client.events():
    print(f"[{event.event}] {event.data}")
    if event.event == 'complete' or event.event == 'error' or event.event == 'done':
        break
