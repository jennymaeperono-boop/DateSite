import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.SUPABASE_CONFIG ?? {};
const form = document.querySelector("#date-form");
const saveButton = document.querySelector("#save-button");
const formStatus = document.querySelector("#form-status");
const dateList = document.querySelector("#date-list");
const dateCount = document.querySelector("#date-count");
const locationInput = document.querySelector("#location");
const mapStatus = document.querySelector("#map-status");
const searchInput = document.querySelector("#map-search");
const mapForm = document.querySelector("#map-search-form");
const dateInput = document.querySelector("#plan-date");
let selectedPoint = null;
let marker = null;
let supabase = null;

const today = new Date();
dateInput.min = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0")
].join("-");

const map = L.map("map", { scrollWheelZoom: false }).setView([12.8797, 121.774], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

function setPoint(latitude, longitude, label) {
  selectedPoint = { latitude, longitude };
  if (marker) marker.remove();
  marker = L.marker([latitude, longitude]).addTo(map);
  if (label) marker.bindPopup(label).openPopup();
  map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
}

map.on("click", (event) => {
  const { lat, lng } = event.latlng;
  setPoint(lat, lng, "Our date spot ♡");
  mapStatus.textContent = `Pin added at ${lat.toFixed(5)}, ${lng.toFixed(5)}. Add the place name above.`;
});

locationInput.addEventListener("input", () => {
  if (!selectedPoint) return;
  selectedPoint = null;
  if (marker) {
    marker.remove();
    marker = null;
  }
  mapStatus.textContent = "Place name changed. Search again or tap the map to update the pin.";
});

mapForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (!query) {
    mapStatus.textContent = "Type a place or address to search.";
    searchInput.focus();
    return;
  }

  mapStatus.textContent = "Looking for your spot…";
  const searchButton = mapForm.querySelector("button");
  searchButton.disabled = true;
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "1" });
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Place search failed (${response.status}).`);
    const results = await response.json();
    if (!results.length) {
      mapStatus.textContent = "No match found. Try another name, or tap the map to drop a pin.";
      return;
    }
    const place = results[0];
    const latitude = Number(place.lat);
    const longitude = Number(place.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("The place search returned invalid coordinates.");
    }
    const label = place.display_name.split(",").slice(0, 2).join(",");
    locationInput.value = label;
    setPoint(latitude, longitude, label);
    mapStatus.textContent = "Found it! Your date spot is pinned.";
  } catch (error) {
    mapStatus.textContent = error instanceof Error ? error.message : "Place search failed. Please try again.";
  } finally {
    searchButton.disabled = false;
  }
});

function setStatus(message, state = "") {
  formStatus.textContent = message;
  formStatus.dataset.state = state;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(date, time) {
  const dateTime = new Date(`${date}T${time}`);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(dateTime);
}

function renderPlans(plans) {
  dateCount.textContent = plans.length;
  if (!plans.length) {
    dateList.innerHTML = `<div class="empty-state">
      <span class="empty-heart" aria-hidden="true">♡</span>
      <p>Your next adventure goes here.</p>
      <span>Save a date and let the counting down begin.</span>
    </div>`;
    return;
  }

  dateList.innerHTML = plans.map((plan) => {
    const mapLink = plan.map_lat != null && plan.map_lng != null
      ? `<a class="plan-map-link" href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(plan.map_lat)}&amp;mlon=${encodeURIComponent(plan.map_lng)}#map=16/${encodeURIComponent(plan.map_lat)}/${encodeURIComponent(plan.map_lng)}" target="_blank" rel="noreferrer">Open map ↗</a>`
      : "";
    const details = [
      plan.activities && `<p><span aria-hidden="true">✳</span> ${escapeHtml(plan.activities)}</p>`,
      plan.eatery && `<p><span aria-hidden="true">♡</span> ${escapeHtml(plan.eatery)}</p>`,
      plan.message && `<p class="plan-message">“${escapeHtml(plan.message)}”</p>`
    ].filter(Boolean).join("");

    return `<article class="plan-card">
      <div class="plan-date-icon" aria-hidden="true">♡</div>
      <div class="plan-content">
        <p class="plan-date">${escapeHtml(formatDate(plan.plan_date, plan.plan_time))}</p>
        <h3>${escapeHtml(plan.date_type)}</h3>
        <p class="plan-location"><span aria-hidden="true">⌖</span> ${escapeHtml(plan.location)} ${mapLink}</p>
        ${details ? `<div class="plan-details">${details}</div>` : ""}
      </div>
    </article>`;
  }).join("");
}

async function loadPlans() {
  const { data, error } = await supabase
    .from("date_plans")
    .select("id, date_type, location, plan_date, plan_time, activities, eatery, message, map_lat, map_lng")
    .order("plan_date", { ascending: true })
    .order("plan_time", { ascending: true });
  if (error) {
    setStatus(`Could not load dates: ${error.message}`, "error");
    dateList.innerHTML = `<p class="list-error">Could not load your date plans. Check your Supabase table and access policies.</p>`;
    return;
  }
  renderPlans(data);
  setStatus("Your shared date plans are up to date.", "success");
}

if (!config.url || !config.anonKey) {
  saveButton.disabled = true;
  setStatus("Add your Supabase project URL and anon key in supabase-config.js to start saving.", "error");
} else {
  try {
    const projectUrl = new URL(config.url);
    if (projectUrl.protocol !== "https:" && projectUrl.protocol !== "http:") {
      throw new Error("The project URL must use HTTPS or HTTP.");
    }
    supabase = createClient(projectUrl.toString(), config.anonKey);
    loadPlans();
  } catch (error) {
    saveButton.disabled = true;
    setStatus(
      error instanceof Error ? `Supabase configuration is invalid: ${error.message}` : "Supabase configuration is invalid.",
      "error"
    );
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) {
    setStatus("Add your Supabase project URL and anon key in supabase-config.js first.", "error");
    return;
  }

  const values = new FormData(form);
  const plan = {
    date_type: values.get("date_type"),
    location: values.get("location").trim(),
    plan_date: values.get("plan_date"),
    plan_time: values.get("plan_time"),
    activities: values.get("activities").trim() || null,
    eatery: values.get("eatery").trim() || null,
    message: values.get("message").trim() || null,
    map_lat: selectedPoint?.latitude ?? null,
    map_lng: selectedPoint?.longitude ?? null
  };

  saveButton.disabled = true;
  setStatus("Saving your little plan…");
  const { error } = await supabase.from("date_plans").insert(plan);
  if (error) {
    setStatus(`Could not save your date: ${error.message}`, "error");
    saveButton.disabled = false;
    return;
  }

  form.reset();
  selectedPoint = null;
  if (marker) {
    marker.remove();
    marker = null;
  }
  map.setView([12.8797, 121.774], 5);
  mapStatus.textContent = "";
  setStatus("Date saved! Something lovely to look forward to.", "success");
  saveButton.disabled = false;
  await loadPlans();
});
