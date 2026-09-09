const STORAGE_KEY = 'academy_bus_app_data_v2';

let targetLeaveTime = null;
let audioCtx = null;
let alertInterval = null;
let isAlertTriggered = false;

window.onload = function() {
  initEventListeners();
  loadSavedData();
  calculateAndRender();
  setInterval(updateCountdown, 1000);
};

function initEventListeners() {
  document.getElementById('btnUpdate').addEventListener('click', saveAndCalculate);
  document.getElementById('btnStopAlert').addEventListener('click', stopAlert);
  document.getElementById('dummyToggle').addEventListener('change', toggleDummyMode);
}

function loadSavedData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const data = JSON.parse(saved);
    document.getElementById('academyTime').value = data.academyTime || '17:00';
    document.getElementById('busNumber').value = data.busNumber || '100';
    document.getElementById('busStop').value = data.busStop || '주공아파트 정류장';
    document.getElementById('walkToStop').value = data.walkToStop || '5';
    document.getElementById('rideDuration').value = data.rideDuration || '15';
    document.getElementById('apiKey').value = data.apiKey || '';
    document.getElementById('dummyToggle').checked = data.useDummy !== false;
  }
  toggleDummyMode();
}

function saveAndCalculate() {
  const data = {
    academyTime: document.getElementById('academyTime').value,
    busNumber: document.getElementById('busNumber').value,
    busStop: document.getElementById('busStop').value,
    walkToStop: document.getElementById('walkToStop').value,
    rideDuration: document.getElementById('rideDuration').value,
    apiKey: document.getElementById('apiKey').value,
    useDummy: document.getElementById('dummyToggle').checked
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  isAlertTriggered = false;
  calculateAndRender();
}

function toggleDummyMode() {
  const isDummy = document.getElementById('dummyToggle').checked;
  document.getElementById('apiConfig').style.display = isDummy ? 'none' : 'block';
}

async function calculateAndRender() {
  const academyTimeStr = document.getElementById('academyTime').value;
  const busNum = document.getElementById('busNumber').value.trim() || '버스';
  const stopName = document.getElementById('busStop').value.trim() || '정류장';
  const walkToStop = parseInt(document.getElementById('walkToStop').value) || 0;
  const rideDuration = parseInt(document.getElementById('rideDuration').value) || 0;
  const useDummy = document.getElementById('dummyToggle').checked;

  if (!academyTimeStr) return;

  // 1. 학원 도착 목표 및 버스 한계 도착시간 계산
  const now = new Date();
  const [hours, minutes] = academyTimeStr.split(':').map(Number);
  
  let latestBusArrival = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  
  if (latestBusArrival < now) {
    latestBusArrival.setDate(latestBusArrival.getDate() + 1);
  }
  
  latestBusArrival.setMinutes(latestBusArrival.getMinutes() - rideDuration);

  // 2. 버스 도착 데이터 수집 및 정렬
  let busArrivals = useDummy ? fetchDummyBusData(busNum, stopName) : await fetchRealBusData(busNum, stopName);
  busArrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);

  const validBuses = busArrivals.filter(b => b.arrivalTime <= latestBusArrival && b.arrivalTime > now);
  const busListEl = document.getElementById('busList');
  busListEl.innerHTML = '';

  if (validBuses.length === 0) {
    busListEl.innerHTML = `<div style="color:var(--text-sub); text-align:center; padding:12px;">목표 시간에 맞는 ${busNum}번 버스가 없습니다.</div>`;
    targetLeaveTime = null;
    document.getElementById('leaveTimeInfo').innerText = '출발 권장 시각: 조건 만족 버스 없음';
    return;
  }

  // 3. UI 버스 정보 표시
  validBuses.forEach(bus => {
    const timeStr = bus.arrivalTime.toTimeString().substring(0, 5);
    busListEl.innerHTML += `
      <div class="bus-card">
        <div>
          <div class="bus-number"><i class="fa-solid fa-bus"></i> ${bus.number}번</div>
          <div class="bus-stop-info"><i class="fa-solid fa-location-pin"></i> ${bus.stop}</div>
          <div class="bus-time">도착 예정: ${timeStr}</div>
        </div>
        <div style="color:var(--accent-pink); font-size:0.85rem; font-weight:600;">탑승 추천</div>
      </div>
    `;
  });

  const selectedBus = validBuses[validBuses.length - 1];

  // 4. 집 출발 시간 계산 = 버스 도착 시각 - (도보 시간 + 3분 여유)
  const leaveTime = new Date(selectedBus.arrivalTime.getTime());
  leaveTime.setMinutes(leaveTime.getMinutes() - (walkToStop + 3));
  
  targetLeaveTime = leaveTime;

  const leaveTimeString = leaveTime.toTimeString().substring(0, 5);
  document.getElementById('leaveTimeInfo').innerText = `집 출발 권장 시각: ${leaveTimeString} (3분 여유 포함)`;
  updateCountdown();
}

async function fetchRealBusData(busNum, stopName) {
  const apiKey = document.getElementById('apiKey').value;
  if (!apiKey) {
    alert("API Key를 입력해주세요! (모의 데이터로 대체합니다)");
    return fetchDummyBusData(busNum, stopName);
  }
  
  try {
    return fetchDummyBusData(busNum, stopName);
  } catch (error) {
    console.error("API 연동 실패:", error);
    return fetchDummyBusData(busNum, stopName);
  }
}

function fetchDummyBusData(busNum, stopName) {
  const now = new Date();
  return [
    { number: busNum, stop: stopName, arrivalTime: new Date(now.getTime() + 8 * 60000) },
    { number: busNum, stop: stopName, arrivalTime: new Date(now.getTime() + 18 * 60000) },
    { number: busNum, stop: stopName, arrivalTime: new Date(now.getTime() + 28 * 60000) }
  ];
}

function updateCountdown() {
  if (!targetLeaveTime) {
    document.getElementById('countdownDisplay').innerText = "00분 00초";
    document.getElementById('statusTitle').innerText = "⏰ 일정 없음";
    return;
  }

  const now = new Date();
  const diffMs = targetLeaveTime - now;

  const displayEl = document.getElementById('countdownDisplay');
  const statusTitle = document.getElementById('statusTitle');

  if (diffMs <= 0) {
    displayEl.innerText = "00분 00초";
    statusTitle.innerText = "🚨 지금 즉시 나가세요!";
    
    if (!isAlertTriggered) {
      triggerAlert();
      isAlertTriggered = true;
    }
    return;
  }

  const diffSec = Math.floor(diffMs / 1000);
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;

  displayEl.innerText = `${String(mins).padStart(2, '0')}분 ${String(secs).padStart(2, '0')}초`;

  if (mins < 3) {
    statusTitle.innerText = "⚠️ 출발 준비 하세요!";
  } else {
    statusTitle.innerText = "⏰ 여유 있음";
  }
}

function playBeep() {
  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.log("Audio 재생 오류:", e);
  }
}

function triggerAlert() {
  document.getElementById('alertModal').classList.add('active');
  playBeep();
  if (!alertInterval) {
    alertInterval = setInterval(playBeep, 800);
  }
}

function stopAlert() {
  document.getElementById('alertModal').classList.remove('active');
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
  }
}