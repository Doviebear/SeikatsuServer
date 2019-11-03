

const morgan = require('morgan')
const express = require('express')
var app = express()
var socket = require('socket.io')
var randomstring = require('randomstring')



const bodyParser = require('body-parser')

app.use(bodyParser.urlencoded({extended: false}))

/*
var testDict = {}
testDict["a"] = 1
testDict["b"] = 2


var testValue = "a"
console.log(testValue in testDict)
*/

app.use(morgan('short'))
app.use(express.static('./public'))

var waitingQueue = []
//Array of all active rooms with games in them
var gamesArray = []
var friendGamesDict = {}
var uniqueIdDict = {}


app.get("/", (req, res) => {
    console.log("Responding to root route")
    res.send("Hello World")
})

app.get("/boo", (req, res) => {
    console.log("responding to Boo")
    res.send("Got the BOO")
})

const router = require('./routes/user.js')
app.use(router)

//localhost:3003
var server = app.listen(3003, function(){
    console.log("App is up and running, listening on port 3003")
})

//socket Setup

var io = socket(server);

io.on('connection', function(socket){
    console.log("made socket connection", socket.id)
    var uniqueId = randomstring.generate()
    socket.emit('hereIsUniqueId', uniqueId)
    uniqueIdDict[uniqueId] = [socket.id]

    socket.on('reconnectionPing', function(data){
        //Change Socket To be the correct Unique ID
        if (typeof data == "string") {
            //This is the get rid of any data created on the old unique ID
            delete uniqueIdDict[uniqueId] 

            uniqueId = data
        
             //changes first room to be the socket id of the new socket
            let roomsOfId = uniqueIdDict[uniqueId]
            roomsOfId[0] = socket.id
            uniqueIdDict[uniqueId] = roomsOfId

            //change the new sockets rooms to match the Unique Id dict.
            for(var i = 1; i < roomsOfId.length; i++ ){
                var roomOfId = roomsOfId[i]
                socket.join(roomOfId, () => {
                    console.log("joined new room")
                })
            
            }
        }
    })
    socket.on('disconnect', function(){
        console.log("Socket connection " + socket.id + " disconnected")
    })
    socket.on('disconnecting', function(){
        let roomToSend = getRoom(socket)
        socket.to(roomToSend).emit('playerDisconnected')
        for (var i = 0; i < gamesArray.length; i++ ){
            if (gamesArray[i] == roomToSend){
                gamesArray.splice(i,1)
            }
        }
    })
    
    socket.on('chat', function(data){
        console.log("recieved chat messages with message: " + data)
    })
    socket.on('joinQueue', function(callback){
        var inQueue = false
        waitingQueue.forEach(socketInArray => {
            if (uniqueId == socketInArray[0]) {
                console.log("socket already in queue")
                inQueue = true
                callback(3)
            }
        })
        if (!inQueue) {
            console.log("User joined queue")
            waitingQueue.push([uniqueId,socket])
            console.log("current Queue Length: " + waitingQueue.length)
            callback(0)
        
            checkQueueForGame()
            //testStartGameEmit(socket)
        }
        
    })
    socket.on('turnEnded', function(data){
        const roomToSend = getRoom(socket)

        io.in(roomToSend).emit('startTurn', data)
        console.log("emitted start turn")
    })
    socket.on('roundEnded', function(data){
        const roomToSend = getRoom(socket)
        io.in(roomToSend).emit('endRound', data)
        console.log("emitted round end")
        for (var i = 0; i < gamesArray.length; i++ ){
            if (gamesArray[i] == roomToSend){
                gamesArray.splice(i,1)
            }
        }
    })
    socket.on('createGame', function(nameOfGame,callback){
        console.log("start Create Game func")
        var exists = false
        if (nameOfGame in friendGamesDict) {
            console.log("Game Name already exists, cant add")
                callback(3)
                exists = true
        }

        if (!exists) {
            const gameID = randomstring.generate()
            const gameString = "game" + gameID
            friendGamesDict[nameOfGame] = gameString
               
            socket.join(gameString, () => {
                console.log("Created friend room " + gameString)
                addToUniqueIdDict(uniqueId,gameString)
                callback(0)
            })
        }
    })
    socket.on('joinRoom', function(nameOfGame, callback){
        console.log("starting joinRoom")

        if (nameOfGame in friendGamesDict) {
            var gameString = friendGamesDict[nameOfGame]
            let room = room(gameString)
            if (room.length >= 3) {
                callback(11)
            }
            socket.join(gameString, () => {
                addToUniqueIdDict(uniqueId,gameString)
                callback(0)
                var room = io.sockets.adapter.rooms[gameString]
                io.to(gameString).emit('updateFriendRoom',room.length)
                console.log("Joined Friend Room")
            })
        } else {
            callback(10)
        }
        
    })
    socket.on('removeFromQueue', function(callback) {
        
        for (var i = 0; i < waitingQueue.length; i++ ){
            let socketInArray = waitingQueue[i]
            if (uniqueId == socketInArray[0]){
                waitingQueue.splice(i,1)
                callback(0)
                return
            }
        }
        callback(11)
    })
    socket.on('startFriendGame', function(nameOfGame){
        //console.log("StartedFriendGame")
        const roomToSend = getRoom(socket)
        socket.emit('getModel', (data) => {
            startGameFromRoom(roomToSend, data)
        })
        delete friendGamesDict[nameOfGame]
       
    })
    socket.on('getNumInRoom', function(callback){
        const roomToGet = getRoom(socket)
        callback(roomToGet.length)
    })
    
    
    
})



//helper Functions

function getRoom(incomingSocket) {
    let rooms = Object.keys(incomingSocket.rooms)
    var roomToReturn = undefined
    rooms.forEach(room => {
        console.log("room to compare is: " + room)
        if (room.includes("game")) {
            console.log("Found game to return")
            roomToReturn = room
        }
    });
    return roomToReturn
} 

function checkQueueForGame() {
    if (waitingQueue.length >= 3) {
        var socketsArray = []
        for(var i = 0; i < 3; i++ ){
            var socketToPut = waitingQueue.shift()
            socketsArray.push(socketToPut)
        }
        // Add gameID to Dict
        const gameID = randomstring.generate()
        const gameString = "game" + gameID
        gamesArray.push = gameString
           
        //Add Sockets to Room
        

        //Emit message to start game
        startGameFromSocketArray(socketsArray, gameString)    
            
    } else {
       //Didnt find enough players for a game 
    }
}


function startGameFromSocketArray(socketsArray, gameString){
    var socketPairOne = socketsArray[0]
    socketPairOne[1].emit('getModel', (data) => {
        var playerNum = 1
        socketsArray.forEach(socketPair => {
            let addedSocket = socketPair[1]
            addedSocket.join(gameString, () => {
                addToUniqueIdDict(socketPair[0],gameString)
                console.log("Added " + addedSocket.id + "to room: " + gameString)
            })
            addedSocket.emit('startGame', data, playerNum)
            console.log("sent json packet to player " + playerNum)
            playerNum += 1
        });
   })
}

function startGameFromRoom(roomID, data){
    //console.log("started StartGame Func")
    var playerNum = 1
    io.sockets.in(roomID).clients(function(err, clients) {
        clients.forEach(client => {
            let user = io.sockets.connected[client];
            //user is a socket connected to the room

            user.emit('startGame', data, playerNum)
            console.log("sent json packet to player " + playerNum)
            
            playerNum += 1
        });

    });
    gamesArray.push(roomID)
       
        
   
}

function addToUniqueIdDict(uniqueId, thingToAdd){
    let arrayToChange = uniqueIdDict[uniqueId]
    arrayToChange.push(thingToAdd)
    uniqueIdDict[uniqueId] = arrayToChange
}

/*
function testStartGameEmit(selectedSocket) {
    fs.readFile('./private/SeikatsuJSON.json' ,  (err, data) => {
        if (err) {
            console.log("There was an error: " + err)
            return
        }
        selectedSocket.emit('startGame', [data, 1] )
        console.log("sent json packet")
    })
    //console.log("json packet sent is :" + require('./private/SeikatsuJSON.json'))
}
*/


