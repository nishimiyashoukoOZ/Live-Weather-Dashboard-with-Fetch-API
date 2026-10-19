import json
from json import JSONDecodeError
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


class WeatherServiceError(Exception):
    """Raised when an upstream weather service cannot return usable data."""


def fetch_json(url, params):
    request_url = f"{url}?{urlencode(params)}"
    upstream_request = Request(
        request_url,
        headers={"User-Agent": "LiveWeatherDashboard/1.0"},
    )

    try:
        with urlopen(upstream_request, timeout=12) as response:
            return json.loads(response.read())
    except HTTPError as error:
        raise WeatherServiceError(
            "The weather service is temporarily unavailable. Please try again."
        ) from error
    except URLError as error:
        raise WeatherServiceError(
            "Could not reach the weather service. Check your connection and try again."
        ) from error
    except (UnicodeDecodeError, JSONDecodeError) as error:
        raise WeatherServiceError(
            "The weather service returned an unreadable response. Please try again."
        ) from error


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/weather")
def get_weather():
    city = request.args.get("city", "").strip()
    if not city:
        return jsonify(error="Enter a city name to see its weather."), 400
    if len(city) > 100 or any(ord(character) < 32 for character in city):
        return jsonify(error="Enter a valid city name (up to 100 characters)."), 400

    try:
        geocoding = fetch_json(
            GEOCODING_URL,
            {"name": city, "count": 1, "language": "en", "format": "json"},
        )
        places = geocoding.get("results", [])
        if not places:
            return jsonify(error=f"We couldn't find “{city}”. Check the spelling and try again."), 404

        place = places[0]
        forecast_data = fetch_json(
            FORECAST_URL,
            {
                "latitude": place["latitude"],
                "longitude": place["longitude"],
                "current": (
                    "temperature_2m,relative_humidity_2m,apparent_temperature,"
                    "is_day,weather_code,wind_speed_10m"
                ),
                "daily": (
                    "weather_code,temperature_2m_max,temperature_2m_min,"
                    "sunrise,sunset"
                ),
                "temperature_unit": "celsius",
                "wind_speed_unit": "kmh",
                "timezone": "auto",
                "forecast_days": 5,
            },
        )

        daily = forecast_data["daily"]
        if len(daily["time"]) != 5:
            raise WeatherServiceError(
                "The weather service did not return a complete five-day forecast."
            )
        days = [
            {
                "date": daily["time"][index],
                "weather_code": daily["weather_code"][index],
                "temperature_max": daily["temperature_2m_max"][index],
                "temperature_min": daily["temperature_2m_min"][index],
                "sunrise": daily["sunrise"][index],
                "sunset": daily["sunset"][index],
            }
            for index in range(len(daily["time"]))
        ]
        return jsonify(
            location={
                "name": place["name"],
                "region": place.get("admin1"),
                "country": place.get("country"),
                "timezone": forecast_data.get("timezone"),
            },
            current=forecast_data["current"],
            forecast=days,
        )
    except WeatherServiceError as error:
        return jsonify(error=str(error)), 502
    except (AttributeError, KeyError, IndexError, TypeError) as error:
        return jsonify(
            error="The weather service returned incomplete data. Please try again."
        ), 502


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
