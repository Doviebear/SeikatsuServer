

const morgan = require('morgan')
const mysql = require('mysql')
const express = require('express')
var app = express()
var socket = require('socket.io')
var randomstring = require('randomstring')
var fs = require('fs')



const bodyParser = require('body-parser')

app.use(bodyParser.urlencoded({extended: false}))

const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: 'softdrink9',
    database: 'testDatabase'
})
function getConnection() {
    return pool
}



app.use(morgan('short'))
app.use(express.static('./public'))

var waitingQueue = []
var gamesDict = {}


app.get("/", (req, res) => {
    console.log("Responding to root route")
    res.send("Hello World")
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
    const queryString = "INSERT INTO Sockets (socketId) VALUES (?)"
    getConnection().query(queryString, socket.id, (err, results, fields) => {
        if (err) {
            console.log("Failed to insert with error: " + err)
            return
        }
        console.log("Inserted Socket with ID: " + socket.id)
        
    })

    socket.on('disconnect', function(){
        console.log("Socket connection " + socket.id + " disconnected")
        const queryString2 = "DELETE FROM Sockets WHERE socketId = ?"
        getConnection().query(queryString2, [socket.id], (err, results, fields) => {
            if (err) {
                console.log("Failed to delete with error: " + err)
                return
            }
            console.log("Deleted Socket with ID: " + socket.id)
        })
        
    })
    socket.on('chat', function(data){
        console.log("recieved chat messages with message: " + data)
    })
    socket.on('joinQueue', function(){
        var inQueue = false
        waitingQueue.forEach(socketInArray => {
            if (socket.id == socketInArray.id) {
                console.log("socket already in queue")
                inQueue = true
            }
        })
        if (!inQueue) {
            console.log("User joined queue")
            waitingQueue.push(socket)
            console.log("current Queue Length: " + waitingQueue.length)
        
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
        gamesDict.push = {
            key: socketsArray,
            value: gameString
        }
        //Add Sockets to Room
        

        //Emit message to start game
        socketsArray[0].emit('getModel', (data) => {
            var playerNum = 1
            socketsArray.forEach(addedSocket => {
                addedSocket.join(gameString, () => {
                    console.log("Added " + addedSocket.id + "to room: " + gameString)
                })
                addedSocket.emit('startGame', data, playerNum)
                console.log("sent json packet to player " + playerNum)
                playerNum += 1
            });
       })
        
            
            
        
        

    } else {
       //Didnt find enough players for a game 
    }
}

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



