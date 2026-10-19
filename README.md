# Skyline live weather dashboard

A responsive Python/Flask weather website with live conditions and a five-day city forecast. The browser uses `fetch` and `async`/`await` to load weather asynchronously; Flask handles city lookup and requests data from Open-Meteo.

## Run locally

Python 3.10 or newer is recommended.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser. An internet connection is needed for weather data.

## Features

- Current temperature, feels-like temperature, humidity, wind, sunrise, and sunset.
- Five-day high/low forecast with weather conditions and icons.
- City search, popular-city shortcuts, loading feedback, and clear validation/API error messages.
- Responsive layout and accessible status announcements.

Weather data is provided by [Open-Meteo](https://open-meteo.com/).
