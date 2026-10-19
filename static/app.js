const searchForm = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const message = document.querySelector("#form-message");
const loadingState = document.querySelector("#loading-state");
const weatherContent = document.querySelector("#weather-content");
const forecastGrid = document.querySelector("#forecast-grid");
const refreshButton = document.querySelector("#refresh-button");

let activeCity = "";
let activeRequest = null;

const weatherTypes = {
  clear: { label: "Clear sky", icon: "☀️" },
  mostlyClear: { label: "Mostly clear", icon: "🌤️" },
  partlyCloudy: { label: "Partly cloudy", icon: "⛅" },
  cloudy: { label: "Overcast", icon: "☁️" },
  fog: { label: "Fog", icon: "🌫️" },
  drizzle: { label: "Drizzle", icon: "🌦️" },
  rain: { label: "Rain", icon: "🌧️" },
  snow: { label: "Snow", icon: "❄️" },
  showers: { label: "Rain showers", icon: "🌧️" },
  snowShowers: { label: "Snow showers", icon: "🌨️" },
  thunderstorm: { label: "Thunderstorm", icon: "⛈️" },
};

function weatherForCode(code, isDay = 1) {
  if (code === 0 && !isDay) return { label: "Clear sky", icon: "🌙" };
  if (code === 0) return weatherTypes.clear;
  if (code === 1 && !isDay) return { label: "Mostly clear", icon: "🌙" };
  if (code === 1) return weatherTypes.mostlyClear;
  if (code === 2) return weatherTypes.partlyCloudy;
  if (code === 3) return weatherTypes.cloudy;
  if (code === 45 || code === 48) return weatherTypes.fog;
  if (code >= 51 && code <= 57) return weatherTypes.drizzle;
  if (code >= 61 && code <= 67) return weatherTypes.rain;
  if (code === 71 || code === 73 || code === 75 || code === 77) return weatherTypes.snow;
  if (code >= 80 && code <= 82) return weatherTypes.showers;
  if (code === 85 || code === 86) return weatherTypes.snowShowers;
  if (code >= 95) return weatherTypes.thunderstorm;
  return { label: "Conditions unavailable", icon: "—" };
}

function formatTemperature(value) {
  return `${Math.round(value)}°`;
}

function formatTime(value) {
  if (!value) return "—";
  const time = value.split("T")[1];
  if (!time) return "—";
  const [hours, minutes] = time.split(":");
  const hour = Number(hours);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minutes} ${suffix}`;
}

function formatForecastDay(date, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function setBusy(isBusy) {
  loadingState.hidden = !isBusy;
  searchButton.disabled = isBusy;
  searchButton.querySelector("span").textContent = isBusy ? "Searching" : "Search";
  if (isBusy) {
    weatherContent.hidden = true;
    message.textContent = "";
  }
}

function setMessage(text) {
  message.textContent = text;
  message.classList.toggle("has-error", Boolean(text));
}

function makeForecastCard(day, index) {
  const weather = weatherForCode(day.weather_code);
  const card = document.createElement("article");
  card.className = "forecast-card";
  card.setAttribute("aria-label", `${formatForecastDay(day.date, index)}: ${weather.label}, high ${Math.round(day.temperature_max)} degrees, low ${Math.round(day.temperature_min)} degrees Celsius`);

  const dayName = document.createElement("span");
  dayName.className = "forecast-day";
  dayName.textContent = formatForecastDay(day.date, index);

  const icon = document.createElement("span");
  icon.className = "weather-icon forecast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = weather.icon;

  const condition = document.createElement("span");
  condition.className = "forecast-condition";
  condition.textContent = weather.label;

  const temperatures = document.createElement("div");
  temperatures.className = "forecast-temperatures";
  const high = document.createElement("span");
  high.className = "forecast-high";
  high.textContent = formatTemperature(day.temperature_max);
  const low = document.createElement("span");
  low.className = "forecast-low";
  low.textContent = formatTemperature(day.temperature_min);

  temperatures.append(high, low);
  card.append(dayName, icon, condition, temperatures);
  return card;
}

function renderWeather(data) {
  const { location, current, forecast } = data;
  const locationName = [location.name, location.region, location.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(", ");
  const condition = weatherForCode(current.weather_code, current.is_day);
  const today = forecast[0];

  document.querySelector("#location-name").textContent = location.name;
  document.querySelector("#location-detail").textContent = [
    location.region,
    location.country,
    location.timezone,
  ].filter(Boolean).join(" · ") || locationName;
  document.querySelector("#current-temperature").textContent = formatTemperature(current.temperature_2m);
  document.querySelector("#current-icon").textContent = condition.icon;
  document.querySelector("#current-condition").textContent = condition.label;
  document.querySelector("#feels-like").textContent = `Feels like ${formatTemperature(current.apparent_temperature)}`;
  document.querySelector("#humidity").textContent = `${current.relative_humidity_2m}%`;
  document.querySelector("#wind-speed").textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  document.querySelector("#sunrise").textContent = formatTime(today?.sunrise);
  document.querySelector("#sunset").textContent = formatTime(today?.sunset);
  forecastGrid.replaceChildren(...forecast.map(makeForecastCard));
  weatherContent.hidden = false;
}

async function loadWeather(city) {
  const normalizedCity = city.trim();
  if (!normalizedCity) {
    setMessage("Enter a city name to see its weather.");
    cityInput.focus();
    return;
  }

  if (activeRequest) activeRequest.abort();
  activeRequest = new AbortController();
  const { signal } = activeRequest;
  setBusy(true);
  setMessage("");

  try {
    const response = await fetch(`/api/weather?city=${encodeURIComponent(normalizedCity)}`, { signal });
    let result;
    try {
      result = await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("The dashboard received an invalid response. Please try again.");
      }
      throw error;
    }
    if (!response.ok) {
      throw new Error(result.error || "Couldn't load the weather. Please try again.");
    }
    if (signal.aborted) return;

    activeCity = normalizedCity;
    cityInput.value = normalizedCity;
    renderWeather(result);
    setMessage("");
  } catch (error) {
    if (error.name === "AbortError") return;
    weatherContent.hidden = true;
    setMessage(error instanceof TypeError
      ? "Couldn't connect to the dashboard. Check your connection and try again."
      : error.message);
  } finally {
    if (!signal.aborted) {
      setBusy(false);
      activeRequest = null;
    }
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadWeather(cityInput.value);
});

document.querySelectorAll("[data-city]").forEach((button) => {
  button.addEventListener("click", () => loadWeather(button.dataset.city));
});

refreshButton.addEventListener("click", () => {
  if (activeCity) loadWeather(activeCity);
});

loadWeather("London");
