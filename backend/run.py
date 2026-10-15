"""
CalmWork AI Backend Runner
Binds to 0.0.0.0:8000 with auto-reload so both localhost and mobile devices on Wi-Fi can connect.
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
