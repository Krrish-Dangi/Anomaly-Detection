import cv2
import numpy as np
import os

frames = [np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8) for _ in range(10)]

def test_codec(fourcc_str, ext):
    fourcc = cv2.VideoWriter_fourcc(*fourcc_str)
    out = cv2.VideoWriter(f'test_{fourcc_str}.{ext}', fourcc, 10, (100, 100))
    if out.isOpened():
        for f in frames:
            out.write(f)
        out.release()
        size = os.path.getsize(f'test_{fourcc_str}.{ext}')
        print(f"{fourcc_str} working, size={size}")
    else:
        print(f"{fourcc_str} failed to open")

test_codec('mp4v', 'mp4')
test_codec('avc1', 'mp4')
test_codec('H264', 'mp4')
test_codec('vp09', 'webm')
test_codec('vp80', 'webm')
test_codec('hev1', 'mp4')
