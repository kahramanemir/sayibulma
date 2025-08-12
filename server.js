// Server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let rooms = {};

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

function generateAllPossibleNumbers() {
    let numbers = [];
    for (let i = 1023; i <= 9876; i++) {
        let s = i.toString();
        if (new Set(s).size === 4 && s[0] !== '0') {
            numbers.push(s);
        }
    }
    return numbers;
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

    for (let candidate of possibleNumbers.slice(0, Math.min(50, possibleNumbers.length))) {
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

function botPlay(roomId) {
    let room = rooms[roomId];
    if (!room) return;

    if (!room.possibleNumbers || room.possibleNumbers.length === 0) {
        room.possibleNumbers = generateAllPossibleNumbers();
        room.botHistory = [];
        io.to(roomId).emit('updateStatus', "Bot yeniden başlıyor...");
        setTimeout(() => botPlay(roomId), 500);
        return;
    }

    let guess = smartBotGuess(room.possibleNumbers, room.botHistory);

    if (!guess) {
        room.possibleNumbers = generateAllPossibleNumbers();
        room.botHistory = [];
        guess = "1234";
    }

    let opponent = room.players.find(p => !p.isBot);
    let result = compareNumbers(opponent.number, guess);

    room.botHistory.push({ guess, result });

    let newPossibleNumbers = room.possibleNumbers.filter(num => {
        let res = compareNumbers(num, guess);
        return res.plus === result.plus && res.minus === result.minus;
    });

    if (newPossibleNumbers.length === 0 && result.plus !== 4) {
        console.log("Bot algoritması tutarsızlık tespit etti, yeniden başlıyor...");
        room.possibleNumbers = generateAllPossibleNumbers();
        room.botHistory = [];
        io.to(roomId).emit('updateStatus', "Bot yeniden kalibre ediliyor...");
        setTimeout(() => botPlay(roomId), 1000);
        return;
    }

    room.possibleNumbers = newPossibleNumbers;

    io.to(opponent.id).emit('opponentGuessed', { guess, result });

    if (result.plus === 4) {
        io.to(opponent.id).emit('gameLose');
        delete rooms[roomId];
    } else {
        room.turn = opponent.id;
        io.to(roomId).emit('turnChange', opponent.id);
    }
}

io.on('connection', (socket) => {
    console.log('Bir kullanıcı bağlandı:', socket.id);

    socket.on('createRoom', () => {
        let roomId;
        do {
            roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (rooms[roomId]);

        socket.join(roomId);
        rooms[roomId] = {
            players: [{ id: socket.id, number: null }],
            gameStarted: false,
        };
        socket.roomId = roomId;

        socket.emit('roomCreated', roomId);
    });

    socket.on('createBotRoom', () => {
        let roomId;
        do {
            roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (rooms[roomId]);

        socket.join(roomId);
        rooms[roomId] = {
            players: [
                { id: socket.id, number: null, isBot: false },
                { id: 'BOT', number: null, isBot: true },
            ],
            gameStarted: true,
            turn: socket.id,
            botHistory: [],
            possibleNumbers: generateAllPossibleNumbers(),
        };
        socket.roomId = roomId;

        io.to(roomId).emit('updateStatus', 'Bot ile oyun başladı!');
        io.to(roomId).emit('gameStart');
    });

    socket.on('joinRoom', (roomId) => {
        roomId = roomId.toUpperCase();
        let room = rooms[roomId];

        if (!room) {
            socket.emit('joinError', 'Oda bulunamadı!');
            return;
        }

        if (room.players.length >= 2) {
            socket.emit('joinError', 'Bu oda zaten dolu!');
            return;
        }

        socket.join(roomId);
        room.players.push({ id: socket.id, number: null });
        socket.roomId = roomId;

        room.gameStarted = true;
        io.to(roomId).emit('updateStatus', 'Oyun başlıyor! Lütfen 4 basamaklı sayınızı belirleyin.');
        io.to(roomId).emit('gameStart');
    });

    socket.on('setNumber', (number) => {
        const roomId = socket.roomId;
        if (!rooms[roomId]) return;

        let player = rooms[roomId].players.find(p => p.id === socket.id);
        if (player) {
            player.number = number;
            socket.emit('updateStatus', 'Rakibin sayısını belirlemesi bekleniyor...');
        }

        let allSet = rooms[roomId].players.length === 2 && rooms[roomId].players.every(p => p.number !== null);

        if (allSet) {
            rooms[roomId].turn = rooms[roomId].players[0].id;
            io.to(roomId).emit('turnChange', rooms[roomId].turn);

            let bot = rooms[roomId].players.find(p => p.isBot);
            if (bot && rooms[roomId].turn === bot.id) {
                setTimeout(() => botPlay(roomId), 1000);
            }
        }
    });

    socket.on('makeGuess', (guess) => {
        const roomId = socket.roomId;
        let room = rooms[roomId];
        if (!room || room.turn !== socket.id) return;

        let opponent = room.players.find(p => p.id !== socket.id);
        let result = compareNumbers(opponent.number, guess);

        socket.emit('guessResult', { guess, result });
        socket.to(roomId).emit('opponentGuessed', { guess, result });

        if (result.plus === 4) {
            socket.emit('gameWin');
            socket.to(roomId).emit('gameLose');
            delete rooms[roomId];
        } else {
            room.turn = opponent.id;
            io.to(roomId).emit('turnChange', opponent.id);

            if (opponent.isBot) {
                setTimeout(() => botPlay(roomId), 1000);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Bir kullanıcı ayrıldı:', socket.id);
        const roomId = socket.roomId;
        if (rooms[roomId]) {
            io.to(roomId).emit('opponentLeft');
            delete rooms[roomId];
        }
    });
});

server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});