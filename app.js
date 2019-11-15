

const morgan = require('morgan')
const express = require('express')
const redis = require('redis')
var app = express()
var socket = require('socket.io')
var randomstring = require('randomstring')
const Sentry = require('@sentry/node');

Sentry.init({ dsn: 'https://694155c86bd84ae8810fecd40820e1cd@sentry.io/1819274' });



const bodyParser = require('body-parser')

app.use(bodyParser.urlencoded({extended: false}))

let client = redis.createClient(6379, 'seikatsubackendcache.eeptcw.ng.0001.use1.cache.amazonaws.com')

client.on('connect', function(){
    console.log("connected to Redis")
})



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
//var friendGamesDict = {}
//var uniqueIdDict = {}


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
    //client.set(uniqueId, "socketId", socket.id)
    myUndefinedFunction();
    

    socket.on('reconnectionPing', function(data){
        //Change Socket To be the correct Unique ID
        if (typeof data == "string") {
            //This is the get rid of any data created on the old unique ID
            //delete uniqueIdDict[uniqueId] 


            uniqueId = data

            //client.hset(uniqueId, "socketId", socket.id)
        
             //changes first room to be the socket id of the new socket
            //let roomsOfId = uniqueIdDict[uniqueId]
            //roomsOfId[0] = socket.id
            //uniqueIdDict[uniqueId] = roomsOfId

            //change the new sockets rooms to match the Unique Id dict.
            client.get(uniqueId, function(err, reply){
                //Format of reply : "room1,room2,room3"
                let stringOfRooms = reply
                if (stringOfRooms != null) {
                    let arrayOfStrings = stringOfRooms.split(",")
                
                    for(var i = 0; i < arrayOfStrings.length; i++){
                        let gameRoom = arrayOfStrings[i]
                        socket.join(gameRoom, () => {
                            console.log("joined new room called: " + gameRoom)
                        })
                    }
                }
                
                
            } )
            
            
            
            
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
        client.get(nameOfGame, function(err, reply){
            console.log("createGame client.get return: " + reply)
            if (reply !== null) {
                console.log("Game Name already exists, cant add")
                    callback(3)
            } else {
                const gameID = randomstring.generate()
                const gameString = "game" + gameID
                client.set(nameOfGame, gameString, 'EX', 900)
                
                   
                socket.join(gameString, () => {
                    console.log("Created friend room " + gameString)
                    addToUniqueIdDict(uniqueId,gameString)
                    callback(0)
                })

            }

        })

    })
    socket.on('joinRoom', function(nameOfGame, callback){
        console.log("starting joinRoom")
        
        client.get(nameOfGame, function(err, reply){
            if ( reply !== null ) {
                console.log("joinRoom reply is: " + reply)
                var gameString = reply
                var room = io.sockets.adapter.rooms[gameString]
                
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
        client.del(nameOfGame)
       
    })
    socket.on('getNumInRoom', function(callback){
        const roomString = getRoom(socket)
        var room = io.sockets.adapter.rooms[roomString]
        console.log("room length is " + room.length)
        callback(room.length)
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
    gamesArray.push = roomID
       
        
   
}

function addToUniqueIdDict(uniqueId, gameStringToAdd){

    //let arrayToChange = uniqueIdDict[uniqueId]
    //arrayToChange.push(thingToAdd)
    //uniqueIdDict[uniqueId] = arrayToChange
    client.get(uniqueId, function(err, reply){
        client.set(uniqueId, reply + "," + gameStringToAdd,'EX', 900)
    })


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


