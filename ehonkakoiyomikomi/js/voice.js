export function getSpeechVoices() {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      resolve([]);
      return;
    }

    const voices = synth.getVoices?.() || [];
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    const onVoicesChanged = () => {
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(synth.getVoices?.() || []);
    };
    synth.addEventListener("voiceschanged", onVoicesChanged);
  });
}

export function formatVoiceLabel(voice) {
  if (!voice) {
    return "標準";
  }
  const lang = voice.lang ? ` (${voice.lang})` : "";
  return `${voice.name}${lang}`;
}

export function resolveVoice(voiceValue, voices = []) {
  if (!voiceValue) {
    return null;
  }

  const normalized = String(voiceValue).trim();
  if (!normalized) {
    return null;
  }

  const exact = voices.find((voice) => voice.name === normalized || voice.lang === normalized);
  if (exact) {
    return exact;
  }

  return voices.find((voice) => voice.name.toLowerCase().includes(normalized.toLowerCase()));
}

export function populateVoiceSelect(selectElement, voices = [], selectedValue = "") {
  if (!selectElement) {
    return;
  }

  const options = [{ value: "", label: "標準" }, ...voices.map((voice) => ({ value: voice.name, label: formatVoiceLabel(voice) }))];
  selectElement.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join("");

  if (selectedValue) {
    selectElement.value = selectedValue;
  }
}
