// Client.js
const socket = io();

// DOM Elementleri
const statusElem = document.getElementById('game-status');

const homeScreen = document.getElementById('home-screen');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');

const createRoomScreen = document.getElementById('create-room-screen');
const roomIdDisplay = document.getElementById('room-id-display');

const joinRoomScreen = document.getElementById('join-room-screen');
const roomIdInput = document.getElementById('room-id-input');
const submitJoinBtn = document.getElementById('submit-join-btn');

const setupScreen = document.getElementById('setup-screen');
const secretInput = document.getElementById('secret-number-input');
const setNumberBtn = document.getElementById('set-number-btn');

const gameScreen = document.getElementById('game-screen');
const guessInput = document.getElementById('guess-input');
const guessBtn = document.getElementById('guess-btn');
const myGuessesList = document.getElementById('my-guesses');
const opponentGuessesList = document.getElementById('opponent-guesses');

const botPlayBtn = document.getElementById('create-bot-room-btn');

// Ana Menüye Dön butonu
const backToMenuBtn = document.createElement('button');
backToMenuBtn.textContent = 'Ana Menüye Dön';
backToMenuBtn.className = 'back-menu-btn hidden';
gameScreen.appendChild(backToMenuBtn);

backToMenuBtn.addEventListener('click', () => {
    resetGameState();
    showScreen(homeScreen);
    statusElem.textContent = 'Bir seçenek seçin.';
});

// Ekran değiştirme fonksiyonu
function showScreen(screen) {
    homeScreen.classList.add('hidden');
    createRoomScreen.classList.add('hidden');
    joinRoomScreen.classList.add('hidden');
    setupScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    screen.classList.remove('hidden');
}

// Ana Menüye dön butonunu göster
function showBackToMenuButton() {
    backToMenuBtn.classList.remove('hidden');
}

// Oyun sıfırlama
function resetGameState() {
    myGuessesList.innerHTML = '';
    opponentGuessesList.innerHTML = '';
    guessInput.value = '';
    secretInput.value = '';
    secretInput.disabled = false;
    setNumberBtn.disabled = false;
    guessInput.disabled = true;
    guessBtn.disabled = true;
    backToMenuBtn.classList.add('hidden');
    isBotMode = false;
    botSecretNumber = null;
    userSecretNumber = null;
    botCandidates = [];
    botHistory = [];
}

/* =============== MULTIPLAYER BUTONLAR =============== */
createRoomBtn.addEventListener('click', () => {
    socket.emit('createRoom');
});

joinRoomBtn.addEventListener('click', () => {
    showScreen(joinRoomScreen);
});

submitJoinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        socket.emit('joinRoom', roomId);
    }
});

setNumberBtn.addEventListener('click', () => {
    const number = secretInput.value;
    if (number.length === 4 && /^\d+$/.test(number)) {
        socket.emit('setNumber', number);
        secretInput.disabled = true;
        setNumberBtn.disabled = true;
    } else {
        alert('Lütfen 4 rakamdan oluşan bir sayı girin.');
    }
});

guessBtn.addEventListener('click', () => {
    const guess = guessInput.value;
    if (guess.length === 4 && /^\d+$/.test(guess)) {
        if (isBotMode) {
            userGuessBotMode(guess);
        } else {
            socket.emit('makeGuess', guess);
        }
        guessInput.value = '';
    } else {
        alert('Lütfen 4 rakamdan oluşan bir tahmin girin.');
    }
});

/* =============== MULTIPLAYER SOCKET OLAYLARI =============== */
socket.on('connect', () => {
    statusElem.textContent = 'Bağlantı başarılı. Bir seçenek seçin.';
    showScreen(homeScreen);
});

socket.on('roomCreated', (roomId) => {
    roomIdDisplay.textContent = roomId;
    showScreen(createRoomScreen);
});

socket.on('joinError', (message) => {
    alert(message);
    showScreen(homeScreen);
});

socket.on('gameStart', () => {
    showScreen(setupScreen);
});

socket.on('updateStatus', (message) => { statusElem.textContent = message; });

socket.on('turnChange', (turnPlayerId) => {
    if (!setupScreen.classList.contains('hidden')) {
        showScreen(gameScreen);
    }
    if (socket.id === turnPlayerId) {
        statusElem.textContent = 'Sıra sizde! Tahmininizi yapın.';
        guessInput.disabled = false;
        guessBtn.disabled = false;
        guessInput.focus();
    } else {
        statusElem.textContent = 'Rakibin sırası...';
        guessInput.disabled = true;
        guessBtn.disabled = true;
    }
});

socket.on('guessResult', (data) => {
    const li = document.createElement('li');
    li.innerHTML = `${data.guess} -> <span class="result plus">+${data.result.plus}</span> <span class="result minus">-${data.result.minus}</span>`;
    myGuessesList.prepend(li);
});

socket.on('opponentGuessed', (data) => {
    const li = document.createElement('li');
    li.innerHTML = `${data.guess} -> <span class="result plus">+${data.result.plus}</span> <span class="result minus">-${data.result.minus}</span>`;
    opponentGuessesList.prepend(li);
});

socket.on('gameWin', () => {
    statusElem.textContent = 'Tebrikler, Kazandınız!';
    guessInput.disabled = true;
    guessBtn.disabled = true;
    showBackToMenuButton();
});

socket.on('gameLose', () => {
    statusElem.textContent = 'Kaybettiniz. Rakibiniz sayıyı buldu.';
    guessInput.disabled = true;
    guessBtn.disabled = true;
    showBackToMenuButton();
});

socket.on('opponentLeft', () => {
    alert('Rakibiniz oyundan ayrıldı. Ana menüye yönlendiriliyorsunuz.');
    showScreen(homeScreen);
    statusElem.textContent = 'Bir seçenek seçin.';
});

/* =============== BOT MODU =============== */
let isBotMode = false;
let botSecretNumber = null;
let userSecretNumber = null;
let botCandidates = [];
let botHistory = [];
let isUserTurn = true;

botPlayBtn.addEventListener('click', () => {
    startBotGame();
});

function startBotGame() {
    isBotMode = true;
    myGuessesList.innerHTML = '';
    opponentGuessesList.innerHTML = '';
    botHistory = [];
    statusElem.textContent = 'Bot ile oyun başlıyor! 4 rakamdan oluşan sayınızı belirleyin.';
    secretInput.disabled = false;
    setNumberBtn.disabled = false;
    secretInput.value = '';
    showScreen(setupScreen);

    setNumberBtn.onclick = () => {
        const number = secretInput.value;
        if (number.length === 4 && /^\d+$/.test(number)) {
            userSecretNumber = number;
            botSecretNumber = generateRandomNumber();
            botCandidates = generateAllPossibleNumbers();
            botHistory = [];
            secretInput.disabled = true;
            setNumberBtn.disabled = true;
            showScreen(gameScreen);
            statusElem.textContent = 'Sıra sizde! Tahmininizi yapın.';
            guessInput.disabled = false;
            guessBtn.disabled = false;
            guessInput.focus();
        } else {
            alert('Lütfen 4 rakamdan oluşan bir sayı girin.');
        }
    };
}

function userGuessBotMode(guess) {
    const result = compareNumbers(botSecretNumber, guess);
    const li = document.createElement('li');
    li.innerHTML = `${guess} -> <span class="result plus">+${result.plus}</span> <span class="result minus">-${result.minus}</span>`;
    myGuessesList.prepend(li);

    if (result.plus === 4) {
        statusElem.textContent = 'Tebrikler, Botun sayısını buldunuz!';
        guessInput.disabled = true;
        guessBtn.disabled = true;
        showBackToMenuButton();
        return;
    }

    isUserTurn = false;
    guessInput.disabled = true;
    guessBtn.disabled = true;
    statusElem.textContent = 'Bot düşünüyor...';
    setTimeout(botMakeGuess, 800);
}

function smartBotGuess(possibleNumbers, history) {
    if (possibleNumbers.length === 0) {
        return null;
    }

    if (possibleNumbers.length === 1) {
        return possibleNumbers[0];
    }

    if (history.length === 0) {
        return possibleNumbers[Math.floor(Math.random() * possibleNumbers.length)];
    }


    let bestGuess = null;
    let minMaxGroups = Infinity;

    let candidatesToTest = possibleNumbers.slice(0, Math.min(30, possibleNumbers.length));

    for (let candidate of candidatesToTest) {
        let groups = {};

        for (let possible of possibleNumbers) {
            let result = compareNumbers(possible, candidate);
            let key = `${result.plus}-${result.minus}`;

            if (!groups[key]) {
                groups[key] = 0;
            }
            groups[key]++;
        }

        let maxGroupSize = Math.max(...Object.values(groups));

        if (maxGroupSize < minMaxGroups) {
            minMaxGroups = maxGroupSize;
            bestGuess = candidate;
        }
    }

    return bestGuess || possibleNumbers[0];
}

function botMakeGuess() {
    if (botCandidates.length === 0) {
        botCandidates = generateAllPossibleNumbers();

        if (botHistory && botHistory.length > 0) {
            const triedNumbers = botHistory.map(h => h.guess);
            botCandidates = botCandidates.filter(num => !triedNumbers.includes(num));
        }

        if (botCandidates.length === 0) {
            botHistory = [];
            botCandidates = generateAllPossibleNumbers();
        }

        setTimeout(botMakeGuess, 500);
        return;
    }

    let guess = smartBotGuess(botCandidates, botHistory);

    if (!guess || botHistory.some(h => h.guess === guess)) {
        const availableGuesses = botCandidates.filter(num =>
            !botHistory.some(h => h.guess === num)
        );

        if (availableGuesses.length > 0) {
            guess = availableGuesses[Math.floor(Math.random() * availableGuesses.length)];
        } else {
            botCandidates = generateAllPossibleNumbers();
            botHistory = [];
            guess = "1234";
        }
    }

    let result = compareNumbers(userSecretNumber, guess);
    botHistory.push({ guess, result });

    const li = document.createElement('li');
    li.innerHTML = `${guess} -> <span class="result plus">+${result.plus}</span> <span class="result minus">-${result.minus}</span>`;
    opponentGuessesList.prepend(li);

    if (result.plus === 4) {
        statusElem.textContent = 'Kaybettiniz. Bot sayınızı buldu!';
        showBackToMenuButton();
        return;
    }

    let newCandidates = botCandidates.filter(num => {
        let res = compareNumbers(num, guess);
        return res.plus === result.plus && res.minus === result.minus;
    });

    if (newCandidates.length === 0) {
        console.log("Bot algoritması tutarsızlık tespit etti, yeniden kalibre ediliyor...");
        statusElem.textContent = "Bot yeniden düşünüyor...";
        botCandidates = generateAllPossibleNumbers();

        const triedNumbers = botHistory.map(h => h.guess);
        botCandidates = botCandidates.filter(num => !triedNumbers.includes(num));

        setTimeout(botMakeGuess, 1000);
        return;
    }

    botCandidates = newCandidates;

    isUserTurn = true;
    guessInput.disabled = false;
    guessBtn.disabled = false;
    guessInput.focus();
    statusElem.textContent = `Sıra sizde!`;
}

/* =============== ORTAK FONKSİYONLAR =============== */
function generateRandomNumber() {
    let digits = [];
    while (digits.length < 4) {
        let d = Math.floor(Math.random() * 10);
        digits.push(d);
    }
    return digits.join('');
}

function generateAllPossibleNumbers() {
    let nums = [];
    for (let i = 0; i <= 9999; i++) {
        let str = i.toString().padStart(4, '0');
        nums.push(str);
    }
    return nums;
}

function compareNumbers(secret, guess) {
    let bulls = 0;
    let cows = 0;

    for (let i = 0; i < 4; i++) {
        if (secret[i] === guess[i]) bulls++;
    }

    let secretCount = Array(10).fill(0);
    let guessCount = Array(10).fill(0);

    for (let i = 0; i < 4; i++) {
        secretCount[Number(secret[i])]++;
        guessCount[Number(guess[i])]++;
    }

    let totalMatches = 0;
    for (let d = 0; d < 10; d++) {
        totalMatches += Math.min(secretCount[d], guessCount[d]);
    }

    cows = totalMatches - bulls;

    return { plus: bulls, minus: cows };
}

function showEndScreen(message) {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.remove('hidden');
    document.getElementById('end-message').textContent = message;
}

document.getElementById('back-to-menu-btn').addEventListener('click', () => {
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
    document.getElementById('game-status').textContent = "Ana menüdesiniz.";
});