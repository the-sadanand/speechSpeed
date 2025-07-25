document.addEventListener('DOMContentLoaded', function () {
    // Feature detection
    const hasMicAccess = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!hasMicAccess || !SpeechRecognition) {
        alert('Your browser does not support Speech Recognition. Try using Chrome or Edge.');
        return;
    }

    // DOM elements
    const timerInput = document.getElementById('timer-seconds');
    const timerSetBtn = document.querySelector('.timer-set-btn');
    const btn = document.querySelector('.start-btn');
    const speakerIcon = document.querySelector('.speaker-icon');
    const transcriptDiv = document.querySelector('.transcript');
    const modeToggleBtn = document.getElementById('mode-toggle-btn');
    const popup = document.getElementById('done-popup');

    // State
    let recognition = null;
    let timerInterval = null;
    let running = false;
    let finalTranscript = '';
    let timeLeft = 60;
    let userTime = 60;
    let darkMode = false;
    let wordCount = 0;
    let startTime = null;
    let wpmDiv = null;
    let avgWpmDiv = null;
    let wpmHistory = [];

    // Create WPM displays
    function createWpmDisplays() {
        // Remove existing displays if they exist
        if (wpmDiv) wpmDiv.remove();
        if (avgWpmDiv) avgWpmDiv.remove();
        
        // Create WPM display
        wpmDiv = document.createElement('div');
        wpmDiv.className = 'wpm-display';
        Object.assign(wpmDiv.style, {
            marginTop: '12px',
            fontSize: '1.05rem',
            color: '#2d98da'
        });
        
        // Create average WPM display
        avgWpmDiv = document.createElement('div');
        avgWpmDiv.className = 'avg-wpm-display';
        Object.assign(avgWpmDiv.style, {
            marginTop: '4px',
            fontSize: '1.02rem',
            color: '#2176b6'
        });
        
        // Add to DOM
        transcriptDiv.insertAdjacentElement('afterend', wpmDiv);
        wpmDiv.insertAdjacentElement('afterend', avgWpmDiv);
        
        resetWpmDisplays();
    }

    function resetWpmDisplays() {
        if (wpmDiv) wpmDiv.textContent = 'Words per minute: 0';
        if (avgWpmDiv) avgWpmDiv.textContent = 'Average WPM: 0';
    }

    createWpmDisplays();

    // Timer set button logic
    // Timer set button logic
timerSetBtn.addEventListener('click', function () {
    let val = parseInt(timerInput.value, 10);
    
    // Validate and constrain the value
    if (isNaN(val)) {
        val = 60; // default value
    } else if (val < 30) {
        val = 30; // minimum value
    } else if (val > 300) {
        val = 300; // maximum value
    }
    
    // Update the display and state
    timerInput.value = val;
    userTime = val;
    timeLeft = val;
    btn.textContent = formatTime(val);
});

    // Toggle inputs disabled state
    function toggleInputs(disable) {
        timerInput.disabled = disable;
        timerSetBtn.disabled = disable;
    }

    // Request mic access on load
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            stream.getTracks().forEach(track => track.stop());
        })
        .catch(() => {
            alert('Microphone access denied. Please allow microphone access for speech recognition to work.');
        });

    // Main button click handler
    btn.addEventListener('click', function () {
        // Trigger animation
        speakerIcon.classList.remove('animate');
        void speakerIcon.offsetWidth; // Trigger reflow
        speakerIcon.classList.add('animate');
        
        if (!running) {
            startSession();
        } else {
            stopSession();
        }
    });

    function startSession() {
        toggleInputs(true);
        speakerIcon.classList.add('active');
        timeLeft = userTime;
        btn.textContent = formatTime(timeLeft);
        transcriptDiv.textContent = '';
        finalTranscript = '';
        running = true;
        startTime = Date.now();
        wordCount = 0;
        wpmHistory = [];
        resetWpmDisplays();
        
        startRecognition();
        timerInterval = setInterval(timerTick, 1000);
    }

    function timerTick() {
        timeLeft--;
        btn.textContent = formatTime(timeLeft);
        if (timeLeft <= 0) {
            stopSession();
        }
    }

    function stopSession() {
        clearInterval(timerInterval);
        stopRecognition();
        btn.textContent = 'Start';
        speakerIcon.classList.remove('active');
        toggleInputs(false);
        running = false;
        updateWpm(true);
        updateAvgWpm();
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function startRecognition() {
        // Stop any existing recognition
        if (recognition) {
            recognition.onend = null;
            recognition.stop();
        }
        
        // Initialize new recognition
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        
        // Event handlers
        recognition.onresult = handleResult;
        recognition.onerror = handleError;
        recognition.onend = function() {
            if (running) recognition.start();
        };
        
        recognition.start();
    }

    function handleResult(event) {
        let interimTranscript = '';
        let newWords = 0;
        
        // Process all results
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                const text = event.results[i][0].transcript.trim();
                finalTranscript += text + ' ';
                newWords += text.split(/\s+/).filter(Boolean).length;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        // Update counts and display
        wordCount += newWords;
        const fullText = (finalTranscript + interimTranscript).trim();
        
        if (transcriptDiv.textContent !== fullText) {
            transcriptDiv.textContent = fullText;
            transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
        }
        
        updateWpm();
    }

    function handleError(event) {
        popup.textContent = 'Speech recognition error: ' + event.error;
        popup.style.background = '#e74c3c';
        popup.style.display = 'block';
        
        setTimeout(() => {
            popup.style.display = 'none';
            popup.style.background = '';
            popup.textContent = 'done';
        }, 2000);
        
        console.error('Speech recognition error:', event.error);
    }

    function stopRecognition() {
        if (recognition) {
            recognition.onend = null;
            recognition.stop();
        }
    }

    function updateWpm(forceHistory = false) {
        if (!wpmDiv || !startTime) return;
        
        const elapsedMin = (Date.now() - startTime) / 60000;
        const wpm = elapsedMin > 0 ? Math.round(wordCount / elapsedMin) : 0;
        wpmDiv.textContent = `Words per minute: ${wpm}`;
        
        if ((forceHistory || !running) && wpm > 0) {
            wpmHistory.push(wpm);
        }
    }

    function updateAvgWpm() {
        if (!avgWpmDiv || wpmHistory.length === 0) {
            avgWpmDiv.textContent = 'Average WPM: 0';
            return;
        }
        
        const sum = wpmHistory.reduce((a, b) => a + b, 0);
        const avg = Math.round(sum / wpmHistory.length);
        avgWpmDiv.textContent = `Average WPM: ${avg}`;
    }

    // Pause on tab change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && running) stopSession();
    });

    // Dark/light mode toggle
    modeToggleBtn.addEventListener('click', function() {
        darkMode = !darkMode;
        document.body.classList.toggle('dark-mode', darkMode);
        modeToggleBtn.textContent = darkMode ? '☀️' : '🌙';
    });
});