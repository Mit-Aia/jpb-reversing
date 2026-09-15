import frida
import time
import json
import sys

results = []

def on_message(message, data):
    if message['type'] == 'send':
        payload = message['payload']
        results.append(payload)
        print(json.dumps(payload)[:300])
    else:
        print("OTHER:", message)

dm = frida.get_device_manager()
dev = dm.add_remote_device('127.0.0.1:27042')
session = dev.attach('Gadget')

with open('hook_bones.js', 'r') as f:
    src = f.read()

script = session.create_script(src)
script.on('message', on_message)
script.load()

DURATION = int(sys.argv[1]) if len(sys.argv) > 1 else 30
print(f"listening for {DURATION}s...")
time.sleep(DURATION)

bone_matrices = [r for r in results if r.get('type') == 'bone_matrix']
print(f"\ntotal messages: {len(results)}, bone_matrix messages: {len(bone_matrices)}")

with open('bone_matrix_dump.json', 'w') as f:
    json.dump(results, f, indent=2)
print("saved to bone_matrix_dump.json")
