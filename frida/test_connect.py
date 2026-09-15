import frida

dm = frida.get_device_manager()
dev = dm.add_remote_device('127.0.0.1:27042')
print("device:", dev)

try:
    procs = dev.enumerate_processes()
    print("processes:", procs)
except Exception as e:
    print("enumerate_processes failed:", e)

try:
    session = dev.attach('Gadget')
    print("attached session:", session)
except Exception as e:
    print("attach('Gadget') failed:", e)
