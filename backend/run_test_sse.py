import requests, json, time, sseclient, os
media_dir = 'data/uploads'
videos = [f for f in os.listdir(media_dir) if f.endswith('.mp4')]
if not videos:
    print('No videos found in uploads.')
    exit(1)
video_path = os.path.join(media_dir, videos[0])
print(f"Testing video: {video_path}")
res = requests.post('http://localhost:8000/api/analyze', files={'video': open(video_path, 'rb')})
if res.status_code != 200:
    print(f"Failed to submit: {res.text}")
    exit(1)
job_id = res.json().get('job_id')
print(f"Listening to SSE for job {job_id}")

response = requests.get(f'http://localhost:8000/api/analyze/{job_id}/stream', stream=True)
client = sseclient.SSEClient(response)
for event in client.events():
    if event.event in ('log', 'event_concluded', 'complete', 'error', 'done', 'stats'):
        print(f"[{event.event}] {event.data}")
    if event.event in ('complete', 'error', 'done'):
        print("Analysis finished gracefully.")
        break
